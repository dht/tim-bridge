import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from '../../core/EventEmitter';

describe('core/EventEmitter', () => {
  let emitter: EventEmitter;

  beforeEach(() => {
    emitter = new EventEmitter();
  });

  describe('on', () => {
    it('should register event listener', () => {
      const listener = vi.fn();
      emitter.on('connected', listener);
      
      emitter.emit({ type: 'connected', device: { id: '123', name: 'Printer' } });
      
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should pass correct event data to listener', () => {
      const listener = vi.fn();
      const event = { type: 'connected' as const, device: { id: '123', name: 'Test' } };
      
      emitter.on('connected', listener);
      emitter.emit(event);
      
      expect(listener).toHaveBeenCalledWith(event);
    });

    it('should return unsubscribe function', () => {
      const listener = vi.fn();
      const unsubscribe = emitter.on('error', listener);
      
      expect(typeof unsubscribe).toBe('function');
    });

    it('should allow multiple listeners for same event', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      
      emitter.on('connected', listener1);
      emitter.on('connected', listener2);
      
      emitter.emit({ type: 'connected', device: { id: '1', name: 'Test' } });
      
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should handle different event types independently', () => {
      const connectedListener = vi.fn();
      const errorListener = vi.fn();
      
      emitter.on('connected', connectedListener);
      emitter.on('error', errorListener);
      
      emitter.emit({ type: 'connected', device: { id: '1', name: 'Test' } });
      
      expect(connectedListener).toHaveBeenCalledTimes(1);
      expect(errorListener).not.toHaveBeenCalled();
    });
  });

  describe('emit', () => {
    it('should call all registered listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();
      
      emitter.on('stateChange', listener1);
      emitter.on('stateChange', listener2);
      emitter.on('stateChange', listener3);
      
      const event = {
        type: 'stateChange' as const,
        state: {
          printing: true,
          paper_jam: false,
          out_of_paper: false,
          cover_open: false,
          battery_low: false,
          overheat: false,
        },
      };
      
      emitter.emit(event);
      
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
      expect(listener3).toHaveBeenCalledTimes(1);
    });

    it('should not throw if no listeners registered', () => {
      expect(() => {
        emitter.emit({ type: 'connected', device: { id: '1', name: 'Test' } });
      }).not.toThrow();
    });

    it('should handle listener errors gracefully', () => {
      const errorListener = vi.fn(() => {
        throw new Error('Listener error');
      });
      const normalListener = vi.fn();
      
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      emitter.on('error', errorListener);
      emitter.on('error', normalListener);
      
      emitter.emit({ type: 'error', error: new Error('Test') });
      
      expect(errorListener).toHaveBeenCalled();
      expect(normalListener).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      consoleErrorSpy.mockRestore();
    });

    it('should emit to correct event type only', () => {
      const connectedListener = vi.fn();
      const disconnectedListener = vi.fn();
      
      emitter.on('connected', connectedListener);
      emitter.on('disconnected', disconnectedListener);
      
      emitter.emit({ type: 'disconnected' });
      
      expect(connectedListener).not.toHaveBeenCalled();
      expect(disconnectedListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('unsubscribe', () => {
    it('should remove listener when unsubscribe is called', () => {
      const listener = vi.fn();
      const unsubscribe = emitter.on('connected', listener);
      
      emitter.emit({ type: 'connected', device: { id: '1', name: 'Test' } });
      expect(listener).toHaveBeenCalledTimes(1);
      
      unsubscribe();
      
      emitter.emit({ type: 'connected', device: { id: '2', name: 'Test2' } });
      expect(listener).toHaveBeenCalledTimes(1); // Still 1, not 2
    });

    it('should only remove specific listener', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      
      const unsubscribe1 = emitter.on('error', listener1);
      emitter.on('error', listener2);
      
      unsubscribe1();
      
      emitter.emit({ type: 'error', error: new Error('Test') });
      
      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should be safe to call unsubscribe multiple times', () => {
      const listener = vi.fn();
      const unsubscribe = emitter.on('connected', listener);
      
      expect(() => {
        unsubscribe();
        unsubscribe();
        unsubscribe();
      }).not.toThrow();
    });

    it('should work correctly after unsubscribe and re-subscribe', () => {
      const listener = vi.fn();
      
      const unsubscribe1 = emitter.on('error', listener);
      unsubscribe1();
      
      emitter.on('error', listener);
      emitter.emit({ type: 'error', error: new Error('Test') });
      
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('clear', () => {
    it('should remove all listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();
      
      emitter.on('connected', listener1);
      emitter.on('error', listener2);
      emitter.on('stateChange', listener3);
      
      emitter.clear();
      
      emitter.emit({ type: 'connected', device: { id: '1', name: 'Test' } });
      emitter.emit({ type: 'error', error: new Error('Test') });
      emitter.emit({
        type: 'stateChange',
        state: {
          printing: false,
          paper_jam: false,
          out_of_paper: false,
          cover_open: false,
          battery_low: false,
          overheat: false,
        },
      });
      
      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
      expect(listener3).not.toHaveBeenCalled();
    });

    it('should allow adding listeners after clear', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      
      emitter.on('connected', listener1);
      emitter.clear();
      emitter.on('connected', listener2);
      
      emitter.emit({ type: 'connected', device: { id: '1', name: 'Test' } });
      
      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearEventType', () => {
    it('should remove all listeners for specific event type', () => {
      const connectedListener = vi.fn();
      const errorListener = vi.fn();
      
      emitter.on('connected', connectedListener);
      emitter.on('error', errorListener);
      
      emitter.clearEventType('connected');
      
      emitter.emit({ type: 'connected', device: { id: '1', name: 'Test' } });
      emitter.emit({ type: 'error', error: new Error('Test') });
      
      expect(connectedListener).not.toHaveBeenCalled();
      expect(errorListener).toHaveBeenCalledTimes(1);
    });

    it('should handle clearing non-existent event type', () => {
      expect(() => {
        emitter.clearEventType('connected');
      }).not.toThrow();
    });

    it('should remove multiple listeners of same type', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();
      
      emitter.on('error', listener1);
      emitter.on('error', listener2);
      emitter.on('error', listener3);
      
      emitter.clearEventType('error');
      
      emitter.emit({ type: 'error', error: new Error('Test') });
      
      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
      expect(listener3).not.toHaveBeenCalled();
    });
  });

  describe('integration scenarios', () => {
    it('should handle complex event flow', () => {
      const events: string[] = [];
      
      emitter.on('connected', () => events.push('connected'));
      emitter.on('stateChange', () => events.push('stateChange'));
      emitter.on('disconnected', () => events.push('disconnected'));
      
      emitter.emit({ type: 'connected', device: { id: '1', name: 'Test' } });
      emitter.emit({
        type: 'stateChange',
        state: {
          printing: true,
          paper_jam: false,
          out_of_paper: false,
          cover_open: false,
          battery_low: false,
          overheat: false,
        },
      });
      emitter.emit({ type: 'disconnected' });
      
      expect(events).toEqual(['connected', 'stateChange', 'disconnected']);
    });

    it('should maintain listener order', () => {
      const order: number[] = [];
      
      emitter.on('connected', () => order.push(1));
      emitter.on('connected', () => order.push(2));
      emitter.on('connected', () => order.push(3));
      
      emitter.emit({ type: 'connected', device: { id: '1', name: 'Test' } });
      
      expect(order).toEqual([1, 2, 3]);
    });
  });
});
