// colors.js
export const COLORS = {
  off: { r: 0, g: 0, b: 0 },
  red: { r: 255, g: 0, b: 0 },
  green: { r: 0, g: 255, b: 0 },
  blue: { r: 0, g: 0, b: 255 },
  purple: { r: 255, g: 0, b: 255 },
};

export const PATTERNS = {
  '1.IDLE': {
    steps: [
      { color: 'green', duration: 0 }, // 🔵 uses named color
    ],
    loop: true,
  },

  '2a.GENERATING': {
    steps: [
      { color: 'purple', duration: 200 },
      { color: 'off', duration: 200 },
    ],
    loop: true,
  },

  '2b.READY': {
    steps: [{ color: 'off', duration: 0 }],
    loop: false,
  },

  '3a.PLAYBACK': {
    steps: [{ color: 'purple', duration: 0 }],
    loop: true,
  },

  '3b.DONE': {
    steps: [{ color: 'off', duration: 0 }],
    loop: false,
  },

  '4.RESETTING': {
    steps: [
      { color: 'blue', duration: 200 },
      { color: 'off', duration: 200 },
    ],
    loop: true,
  },

  '0.ERROR': {
    steps: [{ color: 'red', duration: 0 }],
    loop: true,
  },
};
