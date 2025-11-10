/*

# for 3-pin RGB LED on GPIO
npm i pigpio

# for WS2812 / NeoPixel (single LED)
npm i rpi-ws281x-native



*/

/**
 * Prompt-Haus Light Language for Raspberry Pi
 * -------------------------------------------
 * States:
 *  - IDLE:        cyan-green, slow breathing
 *  - GENERATING:  magenta, 1s pulse
 *  - LISTENING:   sky blue, 2s single blink
 *  - SPEAKING:    amber, amplitude-reactive (use feedAmplitude)
 *  - RESETTING:   white→blue directional fade (simulated as sweep)
 *  - ERROR:       red only; pattern encodes type:
 *      'noInternet' (double-blink),
 *      'resetFail'  (long fade loop),
 *      'genFail'    (triple-stutter),
 *      'internal'   (uneven heartbeat),
 *      'timeout'    (slow rise & drop)
 *
 * Usage:
 *  const light = await Light.create({
 *    driver: 'gpio', // 'gpio' | 'neopixel' | 'console'
 *    gpio: { r: 17, g: 27, b: 22, common: 'cathode' }, // or 'anode'
 *    neopixel: { pin: 18, brightness: 128 },
 *    fps: 60
 *  });
 *
 *  light.setState('IDLE');
 *  light.setState('GENERATING');
 *  light.setState('LISTENING');
 *  light.setState('SPEAKING');
 *  light.feedAmplitude(0.0..1.0); // when SPEAKING
 *  light.setState('RESETTING');
 *  light.setError('noInternet');  // or 'resetFail' | 'genFail' | 'internal' | 'timeout'
 *  light.clearError();            // returns to previous state
 *
 *  process.on('SIGINT', () => light.dispose());
 */

// ---------- small utils ----------
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => 0.5 * (1 - Math.cos(Math.PI * clamp01(t))); // cosine ease
const nowMs = () => Date.now();

function mixRGB(a, b, t) {
  return [
    Math.round(lerp(a[0], b[0], t)),
    Math.round(lerp(a[1], b[1], t)),
    Math.round(lerp(a[2], b[2], t)),
  ];
}

// ---------- color palette (0-255) ----------
const COLORS = {
  idle: [0, 200, 160], // cyan-green
  generating: [255, 0, 180], // magenta
  listening: [0, 180, 255], // sky blue
  speaking: [255, 160, 0], // amber
  white: [255, 255, 255],
  blue: [40, 90, 255],
  black: [0, 0, 0],
  red: [255, 32, 32], // deep crimson base
};

// ---------- drivers ----------
class ConsoleDriver {
  constructor() {
    this.type = "console";
  }
  async init() {}
  setRGB(rgb) {
    /* eslint-disable no-console */ console.log("LED", rgb);
  }
  dispose() {}
}

class GpioDriver {
  constructor(cfg) {
    this.type = "gpio";
    this.cfg = cfg || {};
    this.pins = this.cfg.pins || this.cfg;
    this.common = this.cfg.common || "cathode"; // or 'anode'
    this.PWM = null;
    this.r = this.g = this.b = null;
  }
  async init() {
    const pigpio = require("pigpio");
    this.PWM = pigpio.Gpio;
    this.r = new this.PWM(this.pins.r, { mode: this.PWM.OUTPUT });
    this.g = new this.PWM(this.pins.g, { mode: this.PWM.OUTPUT });
    this.b = new this.PWM(this.pins.b, { mode: this.PWM.OUTPUT });
    // start off
    this.setRGB([0, 0, 0]);
  }
  setRGB([r, g, b]) {
    // scale to 0..255; invert if common anode
    if (this.common === "anode") {
      r = 255 - r;
      g = 255 - g;
      b = 255 - b;
    }
    this.r.pwmWrite(r);
    this.g.pwmWrite(g);
    this.b.pwmWrite(b);
  }
  dispose() {
    this.setRGB([0, 0, 0]);
    this.r?.digitalWrite(0);
    this.g?.digitalWrite(0);
    this.b?.digitalWrite(0);
  }
}

class NeoPixelDriver {
  constructor(cfg) {
    this.type = "neopixel";
    this.cfg = cfg || {};
    this.ws281x = null;
    this.brightness = this.cfg.brightness ?? 128;
    this.leds = new Uint32Array(1);
  }
  async init() {
    this.ws281x = require("rpi-ws281x-native");
    this.ws281x.init(1, {
      dma: 10,
      freq: 800000,
      gpio: this.cfg.pin ?? 18,
      invert: false,
      brightness: this.brightness,
    });
    this.setRGB([0, 0, 0]);
  }
  setRGB([r, g, b]) {
    // pack into GRB for ws281x
    const color = ((g & 0xff) << 16) | ((r & 0xff) << 8) | (b & 0xff);
    this.leds[0] = color;
    this.ws281x.render(this.leds);
  }
  dispose() {
    this.setRGB([0, 0, 0]);
    try {
      this.ws281x.reset();
    } catch {}
  }
}

// ---------- core engine ----------
class Light {
  static async create(config = {}) {
    const light = new Light(config);
    await light.init();
    return light;
  }

  constructor(config) {
    this.config = Object.assign(
      {
        driver: "console", // 'gpio' | 'neopixel' | 'console'
        gpio: { r: 17, g: 27, b: 22, common: "cathode" },
        neopixel: { pin: 18, brightness: 128 },
        fps: 60,
      },
      config
    );

    this.driver =
      this.config.driver === "gpio"
        ? new GpioDriver(this.config.gpio)
        : this.config.driver === "neopixel"
        ? new NeoPixelDriver(this.config.neopixel)
        : new ConsoleDriver();

    this.state = "IDLE";
    this.errorType = null;
    this.prevNonErrorState = "IDLE";
    this.t0 = nowMs();
    this.amplitude = 0; // for SPEAKING
    this._timer = null;
    this._frameMs = Math.max(10, Math.round(1000 / (this.config.fps || 60)));
  }

  async init() {
    await this.driver.init();
    this._start();
    this.setState("IDLE");
    process.on("SIGINT", () => this.dispose());
  }

  dispose() {
    clearInterval(this._timer);
    this.driver.dispose();
    process.exit(0);
  }

  // -------- public API --------
  setState(state) {
    const upper = String(state || "").toUpperCase();
    if (upper === "ERROR") return; // use setError
    if (this.state !== "ERROR") this.prevNonErrorState = upper; // remember
    this.state = upper;
    this.errorType = null;
    this.t0 = nowMs();
  }

  setError(
    type /* 'noInternet' | 'resetFail' | 'genFail' | 'internal' | 'timeout' */
  ) {
    this.errorType = String(type || "internal");
    this.state = "ERROR";
    this.t0 = nowMs();
  }

  clearError() {
    this.errorType = null;
    this.state = this.prevNonErrorState || "IDLE";
    this.t0 = nowMs();
  }

  feedAmplitude(level) {
    this.amplitude = clamp01(level ?? 0);
  }

  // -------- engine loop --------
  _start() {
    this._timer = setInterval(() => this._tick(), this._frameMs);
  }

  _tick() {
    const t = (nowMs() - this.t0) / 1000; // seconds since state started
    let rgb = COLORS.black;

    switch (this.state) {
      case "IDLE":
        // slow breathing 3s cycle
        rgb = this._breathing(COLORS.idle, t, 3.0, 0.25, 0.95);
        break;

      case "GENERATING":
        // 1s pulse
        rgb = this._pulse(COLORS.generating, t, 1.0, 0.3, 1.0);
        break;

      case "LISTENING":
        // single blink every 2s
        rgb = this._blink(COLORS.listening, t, 2.0, 0.1);
        break;

      case "SPEAKING":
      case "PLAYBACK":
        // amplitude-reactive amber (min 0.2 floor so it's never fully dark)
        {
          const floor = 0.2;
          const a = floor + (1 - floor) * this._smoothedAmp();
          rgb = this._scale(COLORS.speaking, a);
        }
        break;

      case "RESETTING":
        // white -> blue "sweep": 1.5s cosine ease loop
        {
          const cycle = 1.5;
          const k = 0.5 * (1 - Math.cos((2 * Math.PI * (t % cycle)) / cycle));
          rgb = mixRGB(COLORS.white, COLORS.blue, k);
          // brief hold near white at start for clarity
        }
        break;

      case "ERROR":
        rgb = this._errorPattern(this.errorType || "internal", t);
        break;

      default:
        rgb = COLORS.black;
    }

    this.driver.setRGB(rgb);
  }

  // -------- pattern helpers --------
  _scale([r, g, b], s) {
    return [(r * s) | 0, (g * s) | 0, (b * s) | 0];
  }

  _breathing(color, t, period = 3, min = 0.2, max = 1.0) {
    const k = (Math.sin((2 * Math.PI * t) / period - Math.PI / 2) + 1) / 2; // 0..1
    const a = lerp(min, max, k);
    return this._scale(color, a);
  }

  _pulse(color, t, period = 1, min = 0.3, max = 1.0) {
    const phase = (t % period) / period; // 0..1
    const a = lerp(min, max, easeInOut(phase)); // smooth pulse
    return this._scale(color, a);
  }

  _blink(color, t, period = 2, duty = 0.1) {
    const phase = (t % period) / period;
    const on = phase < duty;
    return on ? color : COLORS.black;
  }

  _tripleStutter(color, t, gap = 0.12, pause = 2.0) {
    const cycle = 3 * gap + pause; // three quick blinks then rest
    const p = t % cycle;
    const on =
      p < gap || (p >= gap && p < 2 * gap) || (p >= 2 * gap && p < 3 * gap);
    return on ? color : COLORS.black;
  }

  _doubleBlink(color, t, blink = 0.08, gap = 0.12, pause = 1.0) {
    const cycle = 2 * blink + gap + pause;
    const p = t % cycle;
    const on = p < blink || (p >= blink + gap && p < blink + gap + blink);
    return on ? color : COLORS.black;
  }

  _longFadeLoop(color, t, period = 2.5) {
    return this._pulse(color, t, period, 0.05, 1.0);
  }

  _unevenHeartbeat(color, t) {
    // two pulses: short then longer, repeating every ~1.2s
    const cycle = 1.2;
    const p = t % cycle;
    if (p < 0.15) {
      return this._pulse(color, p, 0.15, 0.1, 1.0);
    } else if (p < 0.55) {
      return this._pulse(color, p - 0.15, 0.4, 0.1, 1.0);
    } else {
      return COLORS.black;
    }
  }

  _slowRiseDrop(color, t, rise = 1.4, hold = 0.4, drop = 0.1, dark = 0.8) {
    const cycle = rise + hold + drop + dark;
    const p = t % cycle;
    if (p < rise) {
      const a = lerp(0.05, 1.0, easeInOut(p / rise));
      return this._scale(color, a);
    } else if (p < rise + hold) {
      return color;
    } else if (p < rise + hold + drop) {
      const a = lerp(1.0, 0.0, easeInOut((p - rise - hold) / drop));
      return this._scale(color, a);
    } else {
      return COLORS.black;
    }
  }

  _errorPattern(type, t) {
    const red = COLORS.red;

    switch (type) {
      case "noInternet": // short double-blink, 1s pause
        return this._doubleBlink(red, t, 0.08, 0.12, 1.0);

      case "resetFail": // long fade in/out loop
        return this._longFadeLoop(red, t, 2.8);

      case "genFail": // triple stutter then rest
        return this._tripleStutter(red, t, 0.1, 2.0);

      case "internal": // uneven heartbeat
        return this._unevenHeartbeat(red, t);

      case "timeout": // slow rise, hold, sudden drop, dark
        return this._slowRiseDrop(red, t, 1.6, 0.5, 0.12, 0.9);

      default:
        return this._unevenHeartbeat(red, t);
    }
  }

  // amplitude smoothing for SPEAKING
  _smoothedAmp() {
    // simple one-pole low-pass
    this._ampState = this._ampState ?? 0;
    const alpha = 0.35;
    this._ampState =
      this._ampState * (1 - alpha) + (this.amplitude || 0) * alpha;
    return clamp01(this._ampState);
  }
}

module.exports = { Light };
