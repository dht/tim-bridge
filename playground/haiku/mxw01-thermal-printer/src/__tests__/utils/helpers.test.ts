import { describe, it, expect } from 'vitest';
import { crc8, delay } from '../../utils/helpers';

describe('utils/helpers', () => {
  describe('crc8', () => {
    it('should calculate correct CRC8 for known values', () => {
      const data1 = new Uint8Array([0x01, 0x02, 0x03]);
      const result1 = crc8(data1);
      expect(result1).toBe(0x48);
    });

    it('should return 0 for empty array', () => {
      const data = new Uint8Array([]);
      expect(crc8(data)).toBe(0);
    });

    it('should handle single byte', () => {
      const data = new Uint8Array([0x5d]);
      const result = crc8(data);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(255);
    });

    it('should produce different results for different inputs', () => {
      const data1 = new Uint8Array([0x01, 0x02]);
      const data2 = new Uint8Array([0x02, 0x01]);
      expect(crc8(data1)).not.toBe(crc8(data2));
    });

    it('should handle long arrays', () => {
      const data = new Uint8Array(1000).fill(0xaa);
      const result = crc8(data);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(255);
    });
  });

  describe('delay', () => {
    it('should delay execution for specified milliseconds', async () => {
      const start = Date.now();
      await delay(100);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(100);
      expect(elapsed).toBeLessThan(150); // Allow some margin
    });

    it('should resolve immediately for 0ms delay', async () => {
      const start = Date.now();
      await delay(0);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(10);
    });

    it('should work with very short delays', async () => {
      const start = Date.now();
      await delay(10);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(10);
      expect(elapsed).toBeLessThan(50);
    });
  });
});
