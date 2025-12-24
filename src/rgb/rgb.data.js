// colors.js
export const COLORS = {
  off: { r: 0, g: 0, b: 0 },
  red: { r: 255, g: 0, b: 0 },
  green: { r: 0, g: 255, b: 0 },
  blue: { r: 0, g: 0, b: 255 },
  purple: { r: 255, g: 0, b: 255 },
};

export const PATTERNS = {
  GREEN: {
    steps: [
      { color: 'green', duration: 0 }, // 🔵 uses named color
    ],
    loop: false,
  },

  PURPLE_BLINK: {
    steps: [
      { color: 'purple', duration: 200 },
      { color: 'off', duration: 200 },
    ],
    loop: true,
  },

  OFF: {
    steps: [{ color: 'off', duration: 0 }],
    loop: false,
  },

  PURPLE: {
    steps: [{ color: 'purple', duration: 0 }],
    loop: false,
  },

  BLUE_BLINKING: {
    steps: [
      { color: 'blue', duration: 200 },
      { color: 'off', duration: 200 },
    ],
    loop: true,
  },

  RED: {
    steps: [{ color: 'red', duration: 0 }],
    loop: false,
  },
};

export const STATUS_TO_PATTERN = {
  '1.IDLE': PATTERNS.OFF,
  '2a.GENERATING': PATTERNS.PURPLE_BLINK,
  '2b.READY': PATTERNS.OFF,
  '3a.PLAYBACK': PATTERNS.OFF,
  '3b.DONE': PATTERNS.OFF,
  '4.RESETTING': PATTERNS.OFF,
  '0.ERROR': PATTERNS.RED,
};
