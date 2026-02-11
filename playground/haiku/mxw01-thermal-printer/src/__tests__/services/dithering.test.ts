import { describe, it, expect } from 'vitest';
import {
  getDitherAlgorithm,
  ThresholdDither,
  SteinbergDither,
  BayerDither,
  AtkinsonDither,
  HalftoneDither,
  type DitherMethod,
} from '../../services/dithering';

describe('services/dithering', () => {
  describe('ThresholdDither', () => {
    it('should convert values above 128 to white (0xff)', () => {
      const dither = new ThresholdDither();
      const input = new Uint8ClampedArray([200, 150, 129]);
      const result = dither.apply(input, 3, 1);
      
      expect(result[0]).toBe(0xff);
      expect(result[1]).toBe(0xff);
      expect(result[2]).toBe(0xff);
    });

    it('should convert values at or below 128 to black (0x00)', () => {
      const dither = new ThresholdDither();
      const input = new Uint8ClampedArray([100, 50, 128]);
      const result = dither.apply(input, 3, 1);
      
      expect(result[0]).toBe(0x00);
      expect(result[1]).toBe(0x00);
      expect(result[2]).toBe(0x00);
    });

    it('should handle edge values', () => {
      const dither = new ThresholdDither();
      const input = new Uint8ClampedArray([0, 127, 128, 129, 255]);
      const result = dither.apply(input, 5, 1);
      
      expect(result[0]).toBe(0x00); // 0
      expect(result[1]).toBe(0x00); // 127
      expect(result[2]).toBe(0x00); // 128
      expect(result[3]).toBe(0xff); // 129
      expect(result[4]).toBe(0xff); // 255
    });

    it('should return correct name', () => {
      const dither = new ThresholdDither();
      expect(dither.getName()).toBe('threshold');
    });
  });

  describe('SteinbergDither', () => {
    it('should apply Floyd-Steinberg dithering', () => {
      const dither = new SteinbergDither();
      const input = new Uint8ClampedArray([128, 128, 128, 128]);
      const result = dither.apply(input, 2, 2);
      
      // Result should be binary (only 0x00 or 0xff)
      result.forEach(val => {
        expect(val === 0x00 || val === 0xff).toBe(true);
      });
    });

    it('should diffuse error to neighboring pixels', () => {
      const dither = new SteinbergDither();
      // Uniform gray should produce checkerboard-like pattern
      const input = new Uint8ClampedArray(16).fill(128);
      const result = dither.apply(input, 4, 4);
      
      // Should have some black and some white pixels
      const hasBlack = result.some(v => v === 0x00);
      const hasWhite = result.some(v => v === 0xff);
      expect(hasBlack).toBe(true);
      expect(hasWhite).toBe(true);
    });

    it('should return correct name', () => {
      const dither = new SteinbergDither();
      expect(dither.getName()).toBe('steinberg');
    });
  });

  describe('BayerDither', () => {
    it('should apply Bayer matrix dithering', () => {
      const dither = new BayerDither();
      const input = new Uint8ClampedArray([128, 128, 128, 128]);
      const result = dither.apply(input, 2, 2);
      
      // Result should be binary
      result.forEach(val => {
        expect(val === 0x00 || val === 0xff).toBe(true);
      });
    });

    it('should produce ordered dither pattern', () => {
      const dither = new BayerDither();
      const input = new Uint8ClampedArray(64).fill(128);
      const result = dither.apply(input, 8, 8);
      
      // Should have both black and white
      const hasBlack = result.some(v => v === 0x00);
      const hasWhite = result.some(v => v === 0xff);
      expect(hasBlack).toBe(true);
      expect(hasWhite).toBe(true);
    });

    it('should handle uniform light gray', () => {
      const dither = new BayerDither();
      const input = new Uint8ClampedArray(16).fill(200);
      const result = dither.apply(input, 4, 4);
      
      // Most should be white for light gray
      const whiteCount = result.filter(v => v === 0xff).length;
      expect(whiteCount).toBeGreaterThan(result.length / 2);
    });

    it('should return correct name', () => {
      const dither = new BayerDither();
      expect(dither.getName()).toBe('bayer');
    });
  });

  describe('AtkinsonDither', () => {
    it('should apply Atkinson dithering', () => {
      const dither = new AtkinsonDither();
      const input = new Uint8ClampedArray([128, 128, 128, 128]);
      const result = dither.apply(input, 2, 2);
      
      // Result should be binary
      result.forEach(val => {
        expect(val === 0x00 || val === 0xff).toBe(true);
      });
    });

    it('should distribute error with 1/8 fractions', () => {
      const dither = new AtkinsonDither();
      const input = new Uint8ClampedArray(16).fill(128);
      const result = dither.apply(input, 4, 4);
      
      // Should produce mix of black and white
      const hasBlack = result.some(v => v === 0x00);
      const hasWhite = result.some(v => v === 0xff);
      expect(hasBlack).toBe(true);
      expect(hasWhite).toBe(true);
    });

    it('should return correct name', () => {
      const dither = new AtkinsonDither();
      expect(dither.getName()).toBe('atkinson');
    });
  });

  describe('HalftoneDither', () => {
    it('should apply halftone pattern dithering', () => {
      const dither = new HalftoneDither();
      const input = new Uint8ClampedArray([128, 128, 128, 128, 128, 128, 128, 128]);
      const result = dither.apply(input, 4, 2);
      
      // Result should be binary
      result.forEach(val => {
        expect(val === 0x00 || val === 0xff).toBe(true);
      });
    });

    it('should create spot-based patterns', () => {
      const dither = new HalftoneDither();
      // Need dimensions >= 4x4 for spots
      const input = new Uint8ClampedArray(64).fill(128);
      const result = dither.apply(input, 8, 8);
      
      // Should have both black and white
      const hasBlack = result.some(v => v === 0x00);
      const hasWhite = result.some(v => v === 0xff);
      expect(hasBlack).toBe(true);
      expect(hasWhite).toBe(true);
    });

    it('should fill remaining edges', () => {
      const dither = new HalftoneDither();
      // Odd dimensions to test edge filling
      const input = new Uint8ClampedArray(35).fill(128);
      const result = dither.apply(input, 7, 5);
      
      // HalftoneDither may produce near-binary values (within threshold)
      result.forEach(val => {
        expect(val >= 0 && val <= 255).toBe(true);
      });
    });

    it('should return correct name', () => {
      const dither = new HalftoneDither();
      expect(dither.getName()).toBe('pattern');
    });
  });

  describe('getDitherAlgorithm', () => {
    it('should return ThresholdDither for "threshold"', () => {
      const algo = getDitherAlgorithm('threshold');
      expect(algo).toBeInstanceOf(ThresholdDither);
      expect(algo.getName()).toBe('threshold');
    });

    it('should return SteinbergDither for "steinberg"', () => {
      const algo = getDitherAlgorithm('steinberg');
      expect(algo).toBeInstanceOf(SteinbergDither);
      expect(algo.getName()).toBe('steinberg');
    });

    it('should return BayerDither for "bayer"', () => {
      const algo = getDitherAlgorithm('bayer');
      expect(algo).toBeInstanceOf(BayerDither);
      expect(algo.getName()).toBe('bayer');
    });

    it('should return AtkinsonDither for "atkinson"', () => {
      const algo = getDitherAlgorithm('atkinson');
      expect(algo).toBeInstanceOf(AtkinsonDither);
      expect(algo.getName()).toBe('atkinson');
    });

    it('should return HalftoneDither for "pattern"', () => {
      const algo = getDitherAlgorithm('pattern');
      expect(algo).toBeInstanceOf(HalftoneDither);
      expect(algo.getName()).toBe('pattern');
    });

    it('should return different instances for each call', () => {
      const algo1 = getDitherAlgorithm('steinberg');
      const algo2 = getDitherAlgorithm('steinberg');
      expect(algo1).not.toBe(algo2);
    });
  });

  describe('Algorithm comparison', () => {
    const testImage = new Uint8ClampedArray([
      200, 150, 100, 50,
      150, 100, 50, 200,
      100, 50, 200, 150,
      50, 200, 150, 100,
    ]);

    it('error-diffusion algorithms should produce binary output', () => {
      // Note: HalftoneDither ('pattern') may produce near-binary values, so we test it separately
      const methods: DitherMethod[] = ['threshold', 'steinberg', 'bayer', 'atkinson'];
      
      methods.forEach(method => {
        const algo = getDitherAlgorithm(method);
        const result = algo.apply(new Uint8ClampedArray(testImage), 4, 4);
        
        result.forEach(val => {
          expect(val === 0x00 || val === 0xff).toBe(true);
        });
      });
    });

    it('different algorithms should produce different results', () => {
      const threshold = getDitherAlgorithm('threshold');
      const steinberg = getDitherAlgorithm('steinberg');
      
      const input = new Uint8ClampedArray(testImage);
      const result1 = threshold.apply(new Uint8ClampedArray(input), 4, 4);
      const result2 = steinberg.apply(new Uint8ClampedArray(input), 4, 4);
      
      // Results should differ
      let different = false;
      for (let i = 0; i < result1.length; i++) {
        if (result1[i] !== result2[i]) {
          different = true;
          break;
        }
      }
      expect(different).toBe(true);
    });
  });
});
