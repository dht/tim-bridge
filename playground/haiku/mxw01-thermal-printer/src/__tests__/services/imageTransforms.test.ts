import { describe, it, expect } from 'vitest';
import {
  rotate,
  flip,
  rgbaToGray,
  grayToRgba,
  scaleImageData,
} from '../../services/imageTransforms';

describe('services/imageTransforms', () => {
  describe('rotate', () => {
    it('should not modify data for 0 degree rotation', () => {
      const data = new Uint8ClampedArray([1, 2, 3, 4]);
      const result = rotate(data, 2, 2, 0);
      
      expect(result).toEqual(data);
      expect(result).toBe(data); // Should return same reference
    });

    it('should rotate 90 degrees clockwise', () => {
      const data = new Uint8ClampedArray([
        1, 2,
        3, 4
      ]);
      const result = rotate(data, 2, 2, 90);
      
      // After 90° rotation: [3,1,4,2]
      expect(result).toEqual(new Uint8ClampedArray([3, 1, 4, 2]));
    });

    it('should rotate 180 degrees', () => {
      const data = new Uint8ClampedArray([
        1, 2,
        3, 4
      ]);
      const result = rotate(data, 2, 2, 180);
      
      // After 180° rotation: [4,3,2,1]
      expect(result).toEqual(new Uint8ClampedArray([4, 3, 2, 1]));
    });

    it('should rotate 270 degrees clockwise', () => {
      const data = new Uint8ClampedArray([
        1, 2,
        3, 4
      ]);
      const result = rotate(data, 2, 2, 270);
      
      // After 270° rotation: [2,4,1,3]
      expect(result).toEqual(new Uint8ClampedArray([2, 4, 1, 3]));
    });

    it('should handle 3x3 matrix rotation', () => {
      const data = new Uint8ClampedArray([
        1, 2, 3,
        4, 5, 6,
        7, 8, 9
      ]);
      const result = rotate(data, 3, 3, 180);
      
      expect(result).toEqual(new Uint8ClampedArray([
        9, 8, 7,
        6, 5, 4,
        3, 2, 1
      ]));
    });

    it('should handle rectangular (non-square) 180 degree rotation', () => {
      // Test case similar to the bug: 4x2 image (width=4, height=2)
      const data = new Uint8ClampedArray([
        1, 2, 3, 4,
        5, 6, 7, 8
      ]);
      const result = rotate(data, 4, 2, 180);
      
      // After 180° rotation, dimensions stay 4x2 but flipped
      expect(result.length).toBe(8);
      expect(result).toEqual(new Uint8ClampedArray([
        8, 7, 6, 5,
        4, 3, 2, 1
      ]));
    });

    it('should handle rectangular 90 degree rotation with dimension swap', () => {
      // 3x2 image (width=3, height=2)
      const data = new Uint8ClampedArray([
        1, 2, 3,
        4, 5, 6
      ]);
      const result = rotate(data, 3, 2, 90);
      
      // After 90° rotation, dimensions become 2x3 (height x width)
      expect(result.length).toBe(6);
      expect(result).toEqual(new Uint8ClampedArray([
        4, 1,
        5, 2,
        6, 3
      ]));
    });

    it('should handle rectangular 270 degree rotation with dimension swap', () => {
      // 3x2 image (width=3, height=2)
      const data = new Uint8ClampedArray([
        1, 2, 3,
        4, 5, 6
      ]);
      const result = rotate(data, 3, 2, 270);
      
      // After 270° rotation, dimensions become 2x3 (height x width)
      expect(result.length).toBe(6);
      expect(result).toEqual(new Uint8ClampedArray([
        3, 6,
        2, 5,
        1, 4
      ]));
    });
  });

  describe('flip', () => {
    it('should not modify data for "none"', () => {
      const data = new Uint8ClampedArray([1, 2, 3, 4]);
      const result = flip(data, 2, 2, 'none');
      
      expect(result).toEqual(data);
      expect(result).toBe(data); // Should return same reference
    });

    it('should flip horizontally', () => {
      const data = new Uint8ClampedArray([
        1, 2,
        3, 4
      ]);
      const result = flip(data, 2, 2, 'h');
      
      // After horizontal flip: [2,1,4,3]
      expect(result).toEqual(new Uint8ClampedArray([2, 1, 4, 3]));
    });

    it('should flip vertically', () => {
      const data = new Uint8ClampedArray([
        1, 2,
        3, 4
      ]);
      const result = flip(data, 2, 2, 'v');
      
      // After vertical flip: [3,4,1,2]
      expect(result).toEqual(new Uint8ClampedArray([3, 4, 1, 2]));
    });

    it('should flip both horizontally and vertically', () => {
      const data = new Uint8ClampedArray([
        1, 2,
        3, 4
      ]);
      const result = flip(data, 2, 2, 'both');
      
      // After both flips: [4,3,2,1]
      expect(result).toEqual(new Uint8ClampedArray([4, 3, 2, 1]));
    });

    it('should handle 3x2 matrix horizontal flip', () => {
      const data = new Uint8ClampedArray([
        1, 2, 3,
        4, 5, 6
      ]);
      const result = flip(data, 3, 2, 'h');
      
      expect(result).toEqual(new Uint8ClampedArray([
        3, 2, 1,
        6, 5, 4
      ]));
    });
  });

  describe('rgbaToGray', () => {
    it('should convert pure black RGBA to black', () => {
      // RGBA format: R | (G << 8) | (B << 16) | (A << 24)
      const rgba = new Uint32Array([0xff000000]); // Black, opaque
      const result = rgbaToGray(rgba);
      
      expect(result[0]).toBe(0);
    });

    it('should convert pure white RGBA to white', () => {
      // White: R=255, G=255, B=255, A=255
      const white = 0xff | (0xff << 8) | (0xff << 16) | (0xff << 24);
      const rgba = new Uint32Array([white]);
      const result = rgbaToGray(rgba);
      
      expect(result[0]).toBeGreaterThan(200); // Should be close to 255
    });

    it('should apply weighted conversion (RGB to grayscale)', () => {
      // Pure red: R=255, others=0
      const red = 0xff | (0 << 8) | (0 << 16) | (0xff << 24);
      const rgba = new Uint32Array([red]);
      const result = rgbaToGray(rgba);
      
      // Red weight is 0.2125, so result ≈ 255 * 0.2125 ≈ 54
      expect(result[0]).toBeGreaterThan(30);
      expect(result[0]).toBeLessThan(100);
    });

    it('should handle transparency as white when alphaAsWhite is true', () => {
      // Transparent black
      const transparent = 0x00000000;
      const rgba = new Uint32Array([transparent]);
      const result = rgbaToGray(rgba, 128, true);
      
      // Should convert to white due to transparency
      expect(result[0]).toBeGreaterThan(200);
    });

    it('should handle transparency as black when alphaAsWhite is false', () => {
      // Transparent white
      const transparentWhite = 0xff | (0xff << 8) | (0xff << 16) | (0x00 << 24);
      const rgba = new Uint32Array([transparentWhite]);
      const result = rgbaToGray(rgba, 128, false);
      
      // Should multiply by alpha (0), resulting in black
      expect(result[0]).toBeLessThan(50);
    });

    it('should apply brightness adjustment', () => {
      const gray = 0x80 | (0x80 << 8) | (0x80 << 16) | (0xff << 24);
      new Uint32Array([gray]);
      const normal = rgbaToGray(new Uint32Array([gray]), 128);
      const brighter = rgbaToGray(new Uint32Array([gray]), 200);
      const darker = rgbaToGray(new Uint32Array([gray]), 50);
      
      expect(brighter[0]).toBeGreaterThan(normal[0]);
      expect(darker[0]).toBeLessThan(normal[0]);
    });
  });

  describe('grayToRgba', () => {
    it('should convert grayscale to RGBA', () => {
      const mono = new Uint8ClampedArray([128]);
      const result = grayToRgba(mono);
      
      // Extract RGBA components
      const r = result[0] & 0xff;
      const g = (result[0] >> 8) & 0xff;
      const b = (result[0] >> 16) & 0xff;
      const a = (result[0] >> 24) & 0xff;
      
      expect(r).toBe(128);
      expect(g).toBe(128);
      expect(b).toBe(128);
      expect(a).toBe(255); // Opaque
    });

    it('should handle pure black', () => {
      const mono = new Uint8ClampedArray([0]);
      const result = grayToRgba(mono);
      
      const r = result[0] & 0xff;
      const a = (result[0] >> 24) & 0xff;
      
      expect(r).toBe(0);
      expect(a).toBe(255);
    });

    it('should handle pure white', () => {
      const mono = new Uint8ClampedArray([255]);
      const result = grayToRgba(mono, false);
      
      const r = result[0] & 0xff;
      const g = (result[0] >> 8) & 0xff;
      const b = (result[0] >> 16) & 0xff;
      const a = (result[0] >> 24) & 0xff;
      
      expect(r).toBe(255);
      expect(g).toBe(255);
      expect(b).toBe(255);
      expect(a).toBe(255);
    });

    it('should make white transparent when whiteAsTransparent is true', () => {
      const mono = new Uint8ClampedArray([255]);
      const result = grayToRgba(mono, true);
      
      const a = (result[0] >> 24) & 0xff;
      expect(a).toBe(0); // Transparent
    });

    it('should handle multiple pixels', () => {
      const mono = new Uint8ClampedArray([0, 128, 255]);
      const result = grayToRgba(mono);
      
      expect(result.length).toBe(3);
    });
  });

  describe('scaleImageData', () => {
    it('should scale down 4x4 to 2x2', () => {
      const source = {
        data: new Uint8ClampedArray([
          1, 0, 0, 255,  2, 0, 0, 255,  3, 0, 0, 255,  4, 0, 0, 255,
          5, 0, 0, 255,  6, 0, 0, 255,  7, 0, 0, 255,  8, 0, 0, 255,
          9, 0, 0, 255, 10, 0, 0, 255, 11, 0, 0, 255, 12, 0, 0, 255,
         13, 0, 0, 255, 14, 0, 0, 255, 15, 0, 0, 255, 16, 0, 0, 255,
        ]),
        width: 4,
        height: 4,
      };
      
      const result = scaleImageData(source, 2, 2);
      
      expect(result.width).toBe(2);
      expect(result.height).toBe(2);
      expect(result.data.length).toBe(2 * 2 * 4); // 2x2 pixels, 4 bytes each
    });

    it('should scale up 2x2 to 4x4', () => {
      const source = {
        data: new Uint8ClampedArray([
          100, 0, 0, 255, 150, 0, 0, 255,
          200, 0, 0, 255, 250, 0, 0, 255,
        ]),
        width: 2,
        height: 2,
      };
      
      const result = scaleImageData(source, 4, 4);
      
      expect(result.width).toBe(4);
      expect(result.height).toBe(4);
      expect(result.data.length).toBe(4 * 4 * 4);
    });

    it('should preserve RGBA channels', () => {
      const source = {
        data: new Uint8ClampedArray([
          10, 20, 30, 40, // R=10, G=20, B=30, A=40
        ]),
        width: 1,
        height: 1,
      };
      
      const result = scaleImageData(source, 2, 2);
      
      // All pixels should have same RGBA values
      for (let i = 0; i < result.data.length; i += 4) {
        expect(result.data[i]).toBe(10);     // R
        expect(result.data[i + 1]).toBe(20); // G
        expect(result.data[i + 2]).toBe(30); // B
        expect(result.data[i + 3]).toBe(40); // A
      }
    });

    it('should handle same size (no scaling)', () => {
      const source = {
        data: new Uint8ClampedArray([1, 2, 3, 4, 5, 6, 7, 8]),
        width: 2,
        height: 1,
      };
      
      const result = scaleImageData(source, 2, 1);
      
      expect(result.width).toBe(2);
      expect(result.height).toBe(1);
      expect(result.data).toEqual(source.data);
    });

    it('should use nearest-neighbor interpolation', () => {
      const source = {
        data: new Uint8ClampedArray([
          100, 0, 0, 255, 200, 0, 0, 255,
        ]),
        width: 2,
        height: 1,
      };
      
      const result = scaleImageData(source, 3, 1);
      
      // With nearest-neighbor, pixels should be either 100 or 200
      for (let i = 0; i < result.data.length; i += 4) {
        const r = result.data[i];
        expect(r === 100 || r === 200).toBe(true);
      }
    });
  });
});
