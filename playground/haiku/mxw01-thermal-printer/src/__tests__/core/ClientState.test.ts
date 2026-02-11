import { describe, it, expect, beforeEach } from 'vitest';
import { ClientState } from '../../core/ClientState';

describe('core/ClientState', () => {
  let state: ClientState;

  beforeEach(() => {
    state = new ClientState();
  });

  describe('initial state', () => {
    it('should initialize with default values', () => {
      expect(state.isConnected).toBe(false);
      expect(state.isPrinting).toBe(false);
      expect(state.printerState).toBeNull();
      expect(state.statusMessage).toBe('Ready to connect printer');
      expect(state.ditherMethod).toBe('steinberg');
      expect(state.printIntensity).toBe(0x5d);
    });
  });

  describe('isConnected', () => {
    it('should get connection status', () => {
      expect(state.isConnected).toBe(false);
    });

    it('should update connection status', () => {
      state.setConnected(true);
      expect(state.isConnected).toBe(true);
      
      state.setConnected(false);
      expect(state.isConnected).toBe(false);
    });
  });

  describe('isPrinting', () => {
    it('should get printing status', () => {
      expect(state.isPrinting).toBe(false);
    });

    it('should update printing status', () => {
      state.setPrinting(true);
      expect(state.isPrinting).toBe(true);
      
      state.setPrinting(false);
      expect(state.isPrinting).toBe(false);
    });
  });

  describe('printerState', () => {
    it('should get printer state', () => {
      expect(state.printerState).toBeNull();
    });

    it('should update printer state', () => {
      const newState = {
        printing: true,
        paper_jam: false,
        out_of_paper: false,
        cover_open: false,
        battery_low: false,
        overheat: false,
      };
      
      state.setPrinterState(newState);
      expect(state.printerState).toEqual(newState);
    });

    it('should set printer state to null', () => {
      const newState = {
        printing: true,
        paper_jam: false,
        out_of_paper: false,
        cover_open: false,
        battery_low: false,
        overheat: false,
      };
      
      state.setPrinterState(newState);
      expect(state.printerState).toEqual(newState);
      
      state.setPrinterState(null);
      expect(state.printerState).toBeNull();
    });
  });

  describe('statusMessage', () => {
    it('should get status message', () => {
      expect(state.statusMessage).toBe('Ready to connect printer');
    });

    it('should update status message', () => {
      state.setStatusMessage('Connecting...');
      expect(state.statusMessage).toBe('Connecting...');
      
      state.setStatusMessage('Connected');
      expect(state.statusMessage).toBe('Connected');
    });
  });

  describe('ditherMethod', () => {
    it('should get dither method', () => {
      expect(state.ditherMethod).toBe('steinberg');
    });

    it('should update dither method', () => {
      state.setDitherMethod('threshold');
      expect(state.ditherMethod).toBe('threshold');
      
      state.setDitherMethod('bayer');
      expect(state.ditherMethod).toBe('bayer');
      
      state.setDitherMethod('atkinson');
      expect(state.ditherMethod).toBe('atkinson');
      
      state.setDitherMethod('pattern');
      expect(state.ditherMethod).toBe('pattern');
    });
  });

  describe('printIntensity', () => {
    it('should get print intensity', () => {
      expect(state.printIntensity).toBe(0x5d);
    });

    it('should update print intensity', () => {
      state.setPrintIntensity(100);
      expect(state.printIntensity).toBe(100);
      
      state.setPrintIntensity(200);
      expect(state.printIntensity).toBe(200);
    });

    it('should validate intensity is within 0-255 range', () => {
      expect(() => state.setPrintIntensity(-1)).toThrow(
        'Print intensity must be between 0 and 255'
      );
      
      expect(() => state.setPrintIntensity(256)).toThrow(
        'Print intensity must be between 0 and 255'
      );
      
      expect(() => state.setPrintIntensity(1000)).toThrow(
        'Print intensity must be between 0 and 255'
      );
    });

    it('should accept boundary values', () => {
      expect(() => state.setPrintIntensity(0)).not.toThrow();
      expect(state.printIntensity).toBe(0);
      
      expect(() => state.setPrintIntensity(255)).not.toThrow();
      expect(state.printIntensity).toBe(255);
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      // Modify all state
      state.setConnected(true);
      state.setPrinting(true);
      state.setPrinterState({
        printing: true,
        paper_jam: true,
        out_of_paper: true,
        cover_open: true,
        battery_low: true,
        overheat: true,
      });
      state.setStatusMessage('Custom message');
      
      // Reset
      state.reset();
      
      // Check all values are back to default
      expect(state.isConnected).toBe(false);
      expect(state.isPrinting).toBe(false);
      expect(state.printerState).toBeNull();
      expect(state.statusMessage).toBe('Ready to connect printer');
      
      // Note: reset() doesn't reset ditherMethod and printIntensity
      // as they are user preferences
    });

    it('should not reset dither method', () => {
      state.setDitherMethod('threshold');
      state.reset();
      expect(state.ditherMethod).toBe('threshold');
    });

    it('should not reset print intensity', () => {
      state.setPrintIntensity(100);
      state.reset();
      expect(state.printIntensity).toBe(100);
    });
  });

  describe('state transitions', () => {
    it('should handle typical connection flow', () => {
      // Initial
      expect(state.isConnected).toBe(false);
      expect(state.statusMessage).toBe('Ready to connect printer');
      
      // Connecting
      state.setStatusMessage('Connecting...');
      expect(state.statusMessage).toBe('Connecting...');
      
      // Connected
      state.setConnected(true);
      state.setStatusMessage('Connected');
      expect(state.isConnected).toBe(true);
      expect(state.statusMessage).toBe('Connected');
      
      // Disconnected
      state.setConnected(false);
      state.setPrinterState(null);
      state.setStatusMessage('Disconnected');
      expect(state.isConnected).toBe(false);
      expect(state.printerState).toBeNull();
    });

    it('should handle typical printing flow', () => {
      // Start printing
      state.setPrinting(true);
      state.setStatusMessage('Printing...');
      expect(state.isPrinting).toBe(true);
      
      // Finish printing
      state.setPrinting(false);
      state.setStatusMessage('Print completed');
      expect(state.isPrinting).toBe(false);
    });

    it('should handle error scenarios', () => {
      state.setStatusMessage('Error: Connection failed');
      expect(state.statusMessage).toBe('Error: Connection failed');
      
      state.setPrinterState({
        printing: false,
        paper_jam: true,
        out_of_paper: false,
        cover_open: false,
        battery_low: false,
        overheat: false,
      });
      
      expect(state.printerState?.paper_jam).toBe(true);
    });
  });

  describe('multiple state updates', () => {
    it('should handle rapid state changes', () => {
      for (let i = 0; i < 100; i++) {
        state.setPrinting(i % 2 === 0);
      }
      expect(state.isPrinting).toBe(false);
    });

    it('should handle all dither methods in sequence', () => {
      const methods = ['threshold', 'steinberg', 'bayer', 'atkinson', 'pattern'] as const;
      
      methods.forEach(method => {
        state.setDitherMethod(method);
        expect(state.ditherMethod).toBe(method);
      });
    });

    it('should handle intensity range', () => {
      for (let i = 0; i <= 255; i += 10) {
        state.setPrintIntensity(i);
        expect(state.printIntensity).toBe(i);
      }
    });
  });
});
