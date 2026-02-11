import { describe, it, expect } from 'vitest';
import { makeCommand, parseNotification, Command, PROTOCOL } from '../../services/protocol';

describe('services/protocol', () => {
  describe('makeCommand', () => {
    it('should create valid command packet with correct structure', () => {
      const payload = new Uint8Array([0x5d]);
      const cmd = makeCommand(Command.SetIntensity, payload);
      
      // Check header
      expect(cmd[0]).toBe(PROTOCOL.HEADER_BYTE_1); // 0x22
      expect(cmd[1]).toBe(PROTOCOL.HEADER_BYTE_2); // 0x21
      expect(cmd[2]).toBe(Command.SetIntensity); // Command ID
      expect(cmd[3]).toBe(0x00); // Reserved
      
      // Check length (little-endian)
      expect(cmd[4]).toBe(0x01); // Length low byte
      expect(cmd[5]).toBe(0x00); // Length high byte
      
      // Check payload
      expect(cmd[6]).toBe(0x5d);
      
      // Check terminator
      expect(cmd[cmd.length - 1]).toBe(PROTOCOL.TERMINATOR); // 0xff
    });

    it('should handle empty payload', () => {
      const payload = new Uint8Array([]);
      const cmd = makeCommand(Command.GetStatus, payload);
      
      expect(cmd[0]).toBe(PROTOCOL.HEADER_BYTE_1);
      expect(cmd[1]).toBe(PROTOCOL.HEADER_BYTE_2);
      expect(cmd[2]).toBe(Command.GetStatus);
      expect(cmd[4]).toBe(0x00); // Length = 0
      expect(cmd[cmd.length - 1]).toBe(PROTOCOL.TERMINATOR);
    });

    it('should handle multi-byte payload', () => {
      const payload = new Uint8Array([0x10, 0x20, 0x30, 0x40]);
      const cmd = makeCommand(Command.PrintRequest, payload);
      
      expect(cmd[4]).toBe(0x04); // Length low byte
      expect(cmd[5]).toBe(0x00); // Length high byte
      expect(cmd[6]).toBe(0x10);
      expect(cmd[7]).toBe(0x20);
      expect(cmd[8]).toBe(0x30);
      expect(cmd[9]).toBe(0x40);
    });

    it('should include CRC before terminator', () => {
      const payload = new Uint8Array([0x5d]);
      const cmd = makeCommand(Command.SetIntensity, payload);
      
      // CRC should be second to last byte
      const crcByte = cmd[cmd.length - 2];
      expect(crcByte).toBeGreaterThanOrEqual(0);
      expect(crcByte).toBeLessThanOrEqual(255);
    });
  });

  describe('parseNotification', () => {
    it('should parse valid notification correctly', () => {
      const msg = new Uint8Array([
        0x22, 0x21,    // Header
        0xa1,          // Command ID (GetStatus)
        0x00,          // Reserved
        0x02, 0x00,    // Length (2 bytes)
        0xaa, 0xbb     // Payload
      ]);
      
      const result = parseNotification(msg);
      expect(result).not.toBeNull();
      expect(result?.cmdId).toBe(0xa1);
      expect(result?.payload).toEqual(new Uint8Array([0xaa, 0xbb]));
    });

    it('should return null for invalid header byte 1', () => {
      const msg = new Uint8Array([
        0x00, 0x21,    // Wrong header byte 1
        0xa1,
        0x00,
        0x01, 0x00,
        0xaa
      ]);
      
      expect(parseNotification(msg)).toBeNull();
    });

    it('should return null for invalid header byte 2', () => {
      const msg = new Uint8Array([
        0x22, 0x00,    // Wrong header byte 2
        0xa1,
        0x00,
        0x01, 0x00,
        0xaa
      ]);
      
      expect(parseNotification(msg)).toBeNull();
    });

    it('should parse notification with empty payload', () => {
      const msg = new Uint8Array([
        0x22, 0x21,
        0xaa,          // PrintComplete
        0x00,
        0x00, 0x00     // Length = 0
      ]);
      
      const result = parseNotification(msg);
      expect(result).not.toBeNull();
      expect(result?.cmdId).toBe(0xaa);
      expect(result?.payload).toEqual(new Uint8Array([]));
    });

    it('should parse notification with large payload', () => {
      const payloadData = new Uint8Array(100).fill(0x42);
      const msg = new Uint8Array([
        0x22, 0x21,
        0xa1,
        0x00,
        0x64, 0x00,    // Length = 100
        ...payloadData
      ]);
      
      const result = parseNotification(msg);
      expect(result).not.toBeNull();
      expect(result?.cmdId).toBe(0xa1);
      expect(result?.payload.length).toBe(100);
      expect(result?.payload[0]).toBe(0x42);
    });

    it('should handle different command IDs', () => {
      const testCommands = [
        Command.GetStatus,
        Command.SetIntensity,
        Command.PrintRequest,
        Command.FlushData,
        Command.PrintComplete
      ];

      testCommands.forEach(cmdId => {
        const msg = new Uint8Array([
          0x22, 0x21,
          cmdId,
          0x00,
          0x01, 0x00,
          0x99
        ]);
        
        const result = parseNotification(msg);
        expect(result).not.toBeNull();
        expect(result?.cmdId).toBe(cmdId);
      });
    });
  });

  describe('Command constants', () => {
    it('should have correct command values', () => {
      expect(Command.GetStatus).toBe(0xa1);
      expect(Command.SetIntensity).toBe(0xa2);
      expect(Command.PrintRequest).toBe(0xa9);
      expect(Command.FlushData).toBe(0xad);
      expect(Command.PrintComplete).toBe(0xaa);
    });
  });

  describe('PROTOCOL constants', () => {
    it('should have correct protocol values', () => {
      expect(PROTOCOL.HEADER_BYTE_1).toBe(0x22);
      expect(PROTOCOL.HEADER_BYTE_2).toBe(0x21);
      expect(PROTOCOL.TERMINATOR).toBe(0xff);
    });
  });
});
