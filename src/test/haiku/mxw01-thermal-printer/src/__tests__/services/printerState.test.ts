import { describe, it, expect, beforeEach } from 'vitest';
import {
  parsePrinterState,
  createDefaultState,
  PrinterStateManager,
} from '../../services/printerState';
import { Command } from '../../services/protocol';

describe('services/printerState', () => {
  describe('parsePrinterState', () => {
    it('should parse valid printer state', () => {
      // Status byte at index 6: 0b00000001 = printing
      const payload = new Uint8Array([0, 0, 0, 0, 0, 0, 0b00000001]);
      const state = parsePrinterState(payload);
      
      expect(state).not.toBeNull();
      expect(state?.printing).toBe(true);
      expect(state?.paper_jam).toBe(false);
      expect(state?.out_of_paper).toBe(false);
      expect(state?.cover_open).toBe(false);
      expect(state?.battery_low).toBe(false);
      expect(state?.overheat).toBe(false);
    });

    it('should parse all status flags', () => {
      // All flags set: 0b00111111 = 0x3F
      const payload = new Uint8Array([0, 0, 0, 0, 0, 0, 0x3F]);
      const state = parsePrinterState(payload);
      
      expect(state).not.toBeNull();
      expect(state?.printing).toBe(true);
      expect(state?.paper_jam).toBe(true);
      expect(state?.out_of_paper).toBe(true);
      expect(state?.cover_open).toBe(true);
      expect(state?.battery_low).toBe(true);
      expect(state?.overheat).toBe(true);
    });

    it('should parse paper jam flag', () => {
      const payload = new Uint8Array([0, 0, 0, 0, 0, 0, 0b00000010]);
      const state = parsePrinterState(payload);
      
      expect(state?.printing).toBe(false);
      expect(state?.paper_jam).toBe(true);
    });

    it('should parse out of paper flag', () => {
      const payload = new Uint8Array([0, 0, 0, 0, 0, 0, 0b00000100]);
      const state = parsePrinterState(payload);
      
      expect(state?.out_of_paper).toBe(true);
    });

    it('should parse cover open flag', () => {
      const payload = new Uint8Array([0, 0, 0, 0, 0, 0, 0b00001000]);
      const state = parsePrinterState(payload);
      
      expect(state?.cover_open).toBe(true);
    });

    it('should parse battery low flag', () => {
      const payload = new Uint8Array([0, 0, 0, 0, 0, 0, 0b00010000]);
      const state = parsePrinterState(payload);
      
      expect(state?.battery_low).toBe(true);
    });

    it('should parse overheat flag', () => {
      const payload = new Uint8Array([0, 0, 0, 0, 0, 0, 0b00100000]);
      const state = parsePrinterState(payload);
      
      expect(state?.overheat).toBe(true);
    });

    it('should return null for payload shorter than 7 bytes', () => {
      const payload = new Uint8Array([0, 0, 0]);
      expect(parsePrinterState(payload)).toBeNull();
    });

    it('should handle payload longer than 7 bytes', () => {
      const payload = new Uint8Array([0, 0, 0, 0, 0, 0, 0b00000001, 0xFF, 0xFF]);
      const state = parsePrinterState(payload);
      
      expect(state).not.toBeNull();
      expect(state?.printing).toBe(true);
    });
  });

  describe('createDefaultState', () => {
    it('should create state with all flags false', () => {
      const state = createDefaultState();
      
      expect(state.printing).toBe(false);
      expect(state.paper_jam).toBe(false);
      expect(state.out_of_paper).toBe(false);
      expect(state.cover_open).toBe(false);
      expect(state.battery_low).toBe(false);
      expect(state.overheat).toBe(false);
    });
  });

  describe('PrinterStateManager', () => {
    let manager: PrinterStateManager;

    beforeEach(() => {
      manager = new PrinterStateManager();
    });

    describe('getState', () => {
      it('should return default state initially', () => {
        const state = manager.getState();
        
        expect(state.printing).toBe(false);
        expect(state.paper_jam).toBe(false);
        expect(state.out_of_paper).toBe(false);
        expect(state.cover_open).toBe(false);
        expect(state.battery_low).toBe(false);
        expect(state.overheat).toBe(false);
      });

      it('should return a copy of state', () => {
        const state1 = manager.getState();
        const state2 = manager.getState();
        
        expect(state1).not.toBe(state2);
        expect(state1).toEqual(state2);
      });
    });

    describe('isPrintComplete', () => {
      it('should return false initially', () => {
        expect(manager.isPrintComplete()).toBe(false);
      });

      it('should return true after PrintComplete notification', () => {
        const payload = new Uint8Array([]);
        manager.processNotification(Command.PrintComplete, payload);
        
        expect(manager.isPrintComplete()).toBe(true);
      });
    });

    describe('resetPrintComplete', () => {
      it('should reset print complete flag', () => {
        // Set flag to true
        manager.processNotification(Command.PrintComplete, new Uint8Array([]));
        expect(manager.isPrintComplete()).toBe(true);
        
        // Reset
        manager.resetPrintComplete();
        expect(manager.isPrintComplete()).toBe(false);
      });
    });

    describe('processNotification', () => {
      it('should update state on GetStatus notification', () => {
        const payload = new Uint8Array([0, 0, 0, 0, 0, 0, 0b00000101]);
        manager.processNotification(Command.GetStatus, payload);
        
        const state = manager.getState();
        expect(state.printing).toBe(true);
        expect(state.out_of_paper).toBe(true);
      });

      it('should set print complete flag on PrintComplete notification', () => {
        manager.processNotification(Command.PrintComplete, new Uint8Array([]));
        expect(manager.isPrintComplete()).toBe(true);
      });

      it('should resolve pending promises', async () => {
        const waitPromise = manager.waitForNotification(Command.GetStatus, 1000);
        const payload = new Uint8Array([1, 2, 3]);
        
        manager.processNotification(Command.GetStatus, payload);
        
        const result = await waitPromise;
        expect(result).toEqual(payload);
      });

      it('should handle multiple notifications', () => {
        manager.processNotification(
          Command.GetStatus,
          new Uint8Array([0, 0, 0, 0, 0, 0, 0b00000001])
        );
        expect(manager.getState().printing).toBe(true);
        
        manager.processNotification(
          Command.GetStatus,
          new Uint8Array([0, 0, 0, 0, 0, 0, 0b00000000])
        );
        expect(manager.getState().printing).toBe(false);
      });
    });

    describe('waitForNotification', () => {
      it('should resolve when notification arrives', async () => {
        const payload = new Uint8Array([0xaa, 0xbb]);
        
        setTimeout(() => {
          manager.processNotification(Command.SetIntensity, payload);
        }, 50);
        
        const result = await manager.waitForNotification(Command.SetIntensity, 1000);
        expect(result).toEqual(payload);
      });

      it('should reject on timeout', async () => {
        await expect(
          manager.waitForNotification(Command.GetStatus, 100)
        ).rejects.toThrow('Timeout waiting for notification 0xa1');
      });

      it('should handle multiple pending promises', async () => {
        const promise1 = manager.waitForNotification(Command.GetStatus, 1000);
        const promise2 = manager.waitForNotification(Command.SetIntensity, 1000);
        
        setTimeout(() => {
          manager.processNotification(Command.GetStatus, new Uint8Array([1]));
          manager.processNotification(Command.SetIntensity, new Uint8Array([2]));
        }, 50);
        
        const [result1, result2] = await Promise.all([promise1, promise2]);
        expect(result1).toEqual(new Uint8Array([1]));
        expect(result2).toEqual(new Uint8Array([2]));
      });

      it('should only resolve once', async () => {
        const payload = new Uint8Array([0xaa]);
        const waitPromise = manager.waitForNotification(Command.GetStatus, 1000);
        
        manager.processNotification(Command.GetStatus, payload);
        const result = await waitPromise;
        
        expect(result).toEqual(payload);
        
        // Second notification should not affect resolved promise
        manager.processNotification(Command.GetStatus, new Uint8Array([0xbb]));
      });
    });
  });
});
