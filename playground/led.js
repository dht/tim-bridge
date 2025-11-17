import rpio from 'rpio';

rpio.init({ mapping: 'gpio' });

const RED = 17,
  GREEN = 22,
  BLUE = 24;
[RED, GREEN, BLUE].forEach(pin => {
  rpio.open(pin, rpio.PWM);
  rpio.pwmSetRange(pin, 1024);
});

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Utility: write 0–1024 PWM levels (common-anode invert handled)
function writeRGB(r, g, b, invert = false) {
  if (invert) {
    r = 1024 - r;
    g = 1024 - g;
    b = 1024 - b;
  }
  rpio.pwmSetData(RED, r);
  rpio.pwmSetData(GREEN, g);
  rpio.pwmSetData(BLUE, b);
}

// Convert 0–255 color to 0–1024 PWM value
function colorToPWM([r, g, b], scale = 1.0) {
  return [r, g, b].map(c => Math.round((c * scale * 1024) / 255));
}

// Helper: cosine-ease fade 0–1
const ease = t => 0.5 * (1 - Math.cos(Math.PI * t));

// ---------- PATTERNS ----------
async function breathing(color, period = 3000) {
  const [r, g, b] = color;
  while (true) {
    for (let t = 0; t < 1; t += 0.02) {
      const s = 0.25 + 0.7 * ease(t);
      writeRGB(...colorToPWM([r, g, b], s));
      await sleep(period / 50);
    }
  }
}

async function pulse(color, period = 1000) {
  const [r, g, b] = color;
  while (true) {
    for (let t = 0; t < 1; t += 0.04) {
      const s = 0.3 + 0.7 * ease(t);
      writeRGB(...colorToPWM([r, g, b], s));
      await sleep(period / 25);
    }
  }
}

async function blink(color, period = 2000, duty = 0.1) {
  const [r, g, b] = color;
  const onTime = period * duty,
    offTime = period - onTime;
  while (true) {
    writeRGB(...colorToPWM([r, g, b]));
    await sleep(onTime);
    writeRGB(0, 0, 0);
    await sleep(offTime);
  }
}

async function longFade(color, period = 2800) {
  const [r, g, b] = color;
  while (true) {
    for (let t = 0; t < 1; t += 0.02) {
      const s = ease(t);
      writeRGB(...colorToPWM([r, g, b], s));
      await sleep(period / 50);
    }
    for (let t = 1; t >= 0; t -= 0.02) {
      const s = ease(t);
      writeRGB(...colorToPWM([r, g, b], s));
      await sleep(period / 50);
    }
  }
}

async function doubleBlink(color) {
  const [r, g, b] = color;
  while (true) {
    for (let i = 0; i < 2; i++) {
      writeRGB(...colorToPWM([r, g, b]));
      await sleep(80);
      writeRGB(0, 0, 0);
      await sleep(120);
    }
    await sleep(1000);
  }
}

async function tripleStutter(color) {
  const [r, g, b] = color;
  while (true) {
    for (let i = 0; i < 3; i++) {
      writeRGB(...colorToPWM([r, g, b]));
      await sleep(100);
      writeRGB(0, 0, 0);
      await sleep(120);
    }
    await sleep(2000);
  }
}

async function unevenHeartbeat(color) {
  const [r, g, b] = color;
  while (true) {
    writeRGB(...colorToPWM([r, g, b]));
    await sleep(150);
    writeRGB(0, 0, 0);
    await sleep(100);
    writeRGB(...colorToPWM([r, g, b]));
    await sleep(400);
    writeRGB(0, 0, 0);
    await sleep(600);
  }
}

async function slowRiseDrop(color) {
  const [r, g, b] = color;
  while (true) {
    // rise
    for (let t = 0; t < 1; t += 0.02) {
      writeRGB(...colorToPWM([r, g, b], ease(t)));
      await sleep(30);
    }
    await sleep(500);
    // drop fast
    for (let t = 1; t >= 0; t -= 0.1) {
      writeRGB(...colorToPWM([r, g, b], t));
      await sleep(20);
    }
    await sleep(900);
  }
}

async function whiteToBlueSweep() {
  const white = [255, 255, 255],
    blue = [40, 90, 255];
  while (true) {
    for (let t = 0; t < 1; t += 0.02) {
      writeRGB(
        ...colorToPWM([
          white[0] + (blue[0] - white[0]) * t,
          white[1] + (blue[1] - white[1]) * t,
          white[2] + (blue[2] - white[2]) * t,
        ])
      );
      await sleep(30);
    }
  }
}

// ---------- STATE HANDLER ----------
export async function setState(state) {
  writeRGB(0, 0, 0);
  const c = {
    idle: [0, 200, 160],
    generating: [255, 0, 180],
    listening: [0, 180, 255],
    speaking: [255, 160, 0],
    error: [255, 32, 32],
  };
  switch (state.toUpperCase()) {
    case 'IDLE':
      return breathing(c.idle);
    case 'GENERATING':
      return pulse(c.generating);
    case 'LISTENING':
      return blink(c.listening);
    case 'RESETTING':
      return whiteToBlueSweep();
    case 'ERROR-NOINTERNET':
      return doubleBlink(c.error);
    case 'ERROR-RESETFAIL':
      return longFade(c.error);
    case 'ERROR-GENFAIL':
      return tripleStutter(c.error);
    case 'ERROR-INTERNAL':
      return unevenHeartbeat(c.error);
    case 'ERROR-TIMEOUT':
      return slowRiseDrop(c.error);
    default:
      writeRGB(0, 0, 0);
  }
}
