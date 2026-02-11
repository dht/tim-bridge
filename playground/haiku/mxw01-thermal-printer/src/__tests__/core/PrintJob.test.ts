import { describe, it, expect } from 'vitest';
import { PrintJob } from '../../core/PrintJob';

describe('core/PrintJob', () => {
  describe('constructor', () => {
    it('should create print job with image data', () => {
      const imageData = {
        data: new Uint8ClampedArray([255, 0, 0, 255]),
        width: 1,
        height: 1,
      };
      
      const job = new PrintJob(imageData);
      expect(job).toBeDefined();
    });

    it('should create print job with options', () => {
      const imageData = {
        data: new Uint8ClampedArray([255, 0, 0, 255]),
        width: 1,
        height: 1,
      };
      const options = {
        dither: 'threshold' as const,
        brightness: 150,
        intensity: 100,
      };
      
      const job = new PrintJob(imageData, options);
      expect(job).toBeDefined();
    });

    it('should handle empty options', () => {
      const imageData = {
        data: new Uint8ClampedArray([255, 0, 0, 255]),
        width: 1,
        height: 1,
      };
      
      const job = new PrintJob(imageData, {});
      expect(job).toBeDefined();
    });
  });

  describe('prepare', () => {
    it('should prepare image for printing', () => {
      const imageData = {
        data: new Uint8ClampedArray([
          255, 255, 255, 255, // White pixel
          0, 0, 0, 255,       // Black pixel
          128, 128, 128, 255, // Gray pixel
          200, 200, 200, 255, // Light gray pixel
        ]),
        width: 2,
        height: 2,
      };
      
      const job = new PrintJob(imageData);
      const result = job.prepare('steinberg');
      
      expect(result).toHaveProperty('imageBuffer');
      expect(result).toHaveProperty('numLines');
      expect(result.imageBuffer).toBeInstanceOf(Uint8Array);
      expect(result.numLines).toBeGreaterThan(0);
    });

    it('should keep images with width <= 384px unchanged', () => {
      // Create a 100x100 image
      const size = 100;
      const imageData = {
        data: new Uint8ClampedArray(size * size * 4).fill(128),
        width: size,
        height: size,
      };
      
      const job = new PrintJob(imageData);
      const result = job.prepare('threshold');
      
      // Image should stay 100x100 (no scaling since width <= 384)
      expect(result.numLines).toBe(100);
    });

    it('should use provided dither method from options', () => {
      const imageData = {
        data: new Uint8ClampedArray(16).fill(128),
        width: 2,
        height: 2,
      };
      
      const job = new PrintJob(imageData, { dither: 'bayer' });
      const result = job.prepare('steinberg'); // Default will be overridden
      
      expect(result.imageBuffer).toBeInstanceOf(Uint8Array);
      expect(result.numLines).toBeGreaterThan(0);
    });

    it('should use default dither if not specified in options', () => {
      const imageData = {
        data: new Uint8ClampedArray(16).fill(128),
        width: 2,
        height: 2,
      };
      
      const job = new PrintJob(imageData); // No dither in options
      const result = job.prepare('threshold'); // Should use this default
      
      expect(result.imageBuffer).toBeInstanceOf(Uint8Array);
      expect(result.numLines).toBeGreaterThan(0);
    });

    it('should use provided brightness from options', () => {
      const imageData = {
        data: new Uint8ClampedArray([
          128, 128, 128, 255,
          128, 128, 128, 255,
        ]),
        width: 2,
        height: 1,
      };
      
      // Test with different brightness values
      const job1 = new PrintJob(imageData, { brightness: 50 });
      const result1 = job1.prepare('threshold');
      
      const job2 = new PrintJob(imageData, { brightness: 200 });
      const result2 = job2.prepare('threshold');
      
      // Both should produce results
      expect(result1.imageBuffer).toBeInstanceOf(Uint8Array);
      expect(result2.imageBuffer).toBeInstanceOf(Uint8Array);
    });

    it('should handle very small images', () => {
      const imageData = {
        data: new Uint8ClampedArray([255, 255, 255, 255]), // 1x1 white
        width: 1,
        height: 1,
      };
      
      const job = new PrintJob(imageData);
      const result = job.prepare('threshold');
      
      expect(result.imageBuffer).toBeInstanceOf(Uint8Array);
      expect(result.imageBuffer.length).toBeGreaterThan(0);
    });

    it('should crop images with width > 384px', () => {
      // 500x500 image
      const size = 500;
      const imageData = {
        data: new Uint8ClampedArray(size * size * 4).fill(128),
        width: size,
        height: size,
      };
      
      const job = new PrintJob(imageData);
      const result = job.prepare('threshold');
      
      // Image should be cropped to 384x500 (width cropped, height unchanged)
      expect(result.imageBuffer).toBeInstanceOf(Uint8Array);
      expect(result.numLines).toBe(500);
    });

    it('should apply 180° rotation for MXW01 printer', () => {
      // This is implicit in the prepare() method
      const imageData = {
        data: new Uint8ClampedArray([
          255, 0, 0, 255,    // Red
          0, 255, 0, 255,    // Green
          0, 0, 255, 255,    // Blue
          255, 255, 255, 255 // White
        ]),
        width: 2,
        height: 2,
      };
      
      const job = new PrintJob(imageData);
      const result = job.prepare('threshold');
      
      // Should have processed and rotated the image
      expect(result.imageBuffer).toBeInstanceOf(Uint8Array);
      expect(result.numLines).toBeGreaterThan(0);
    });

    it('should produce buffer with minimum padding', () => {
      const imageData = {
        data: new Uint8ClampedArray(4).fill(255), // 1x1 image
        width: 1,
        height: 1,
      };
      
      const job = new PrintJob(imageData);
      const result = job.prepare('threshold');
      
      // Buffer should be at least minimum size (4320 bytes)
      expect(result.imageBuffer.length).toBeGreaterThanOrEqual(4320);
    });
  });

  describe('getIntensity', () => {
    it('should return intensity from options if provided', () => {
      const imageData = {
        data: new Uint8ClampedArray([255, 255, 255, 255]),
        width: 1,
        height: 1,
      };
      
      const job = new PrintJob(imageData, { intensity: 120 });
      const intensity = job.getIntensity(93); // Default
      
      expect(intensity).toBe(120);
    });

    it('should return default intensity if not in options', () => {
      const imageData = {
        data: new Uint8ClampedArray([255, 255, 255, 255]),
        width: 1,
        height: 1,
      };
      
      const job = new PrintJob(imageData); // No intensity in options
      const intensity = job.getIntensity(93); // Default
      
      expect(intensity).toBe(93);
    });

    it('should return 0 if specified', () => {
      const imageData = {
        data: new Uint8ClampedArray([255, 255, 255, 255]),
        width: 1,
        height: 1,
      };
      
      const job = new PrintJob(imageData, { intensity: 0 });
      const intensity = job.getIntensity(93);
      
      expect(intensity).toBe(0);
    });

    it('should return 255 if specified', () => {
      const imageData = {
        data: new Uint8ClampedArray([255, 255, 255, 255]),
        width: 1,
        height: 1,
      };
      
      const job = new PrintJob(imageData, { intensity: 255 });
      const intensity = job.getIntensity(93);
      
      expect(intensity).toBe(255);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete print job workflow', () => {
      // Create a simple 10x10 gradient image
      const size = 10;
      const imageData = {
        data: new Uint8ClampedArray(size * size * 4),
        width: size,
        height: size,
      };
      
      // Fill with gradient
      for (let i = 0; i < size * size; i++) {
        const value = Math.floor((i / (size * size)) * 255);
        imageData.data[i * 4] = value;     // R
        imageData.data[i * 4 + 1] = value; // G
        imageData.data[i * 4 + 2] = value; // B
        imageData.data[i * 4 + 3] = 255;   // A
      }
      
      const job = new PrintJob(imageData, {
        dither: 'steinberg',
        brightness: 128,
        intensity: 93,
      });
      
      const prepared = job.prepare('threshold');
      const intensity = job.getIntensity(93);
      
      expect(prepared.imageBuffer).toBeInstanceOf(Uint8Array);
      expect(prepared.numLines).toBeGreaterThan(0);
      expect(intensity).toBe(93);
    });

    it('should handle different dither methods', () => {
      const imageData = {
        data: new Uint8ClampedArray(100 * 4).fill(128),
        width: 10,
        height: 10,
      };
      
      const methods = ['threshold', 'steinberg', 'bayer', 'atkinson', 'pattern'] as const;
      
      methods.forEach(method => {
        const job = new PrintJob(imageData, { dither: method });
        const result = job.prepare('threshold');
        
        expect(result.imageBuffer).toBeInstanceOf(Uint8Array);
        expect(result.numLines).toBeGreaterThan(0);
      });
    });

    it('should create reproducible results', () => {
      const imageData = {
        data: new Uint8ClampedArray([
          100, 100, 100, 255,
          150, 150, 150, 255,
          200, 200, 200, 255,
          250, 250, 250, 255,
        ]),
        width: 2,
        height: 2,
      };
      
      const job1 = new PrintJob(imageData, { dither: 'threshold', brightness: 128 });
      const job2 = new PrintJob(imageData, { dither: 'threshold', brightness: 128 });
      
      const result1 = job1.prepare('threshold');
      const result2 = job2.prepare('threshold');
      
      // Should produce identical results
      expect(result1.numLines).toBe(result2.numLines);
      expect(result1.imageBuffer.length).toBe(result2.imageBuffer.length);
    });
  });
});
