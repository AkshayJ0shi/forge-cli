import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exportToGameEvents, RecordingConfig } from './config';

describe('exportToGameEvents', () => {
  let testDir: string;
  let outputPath: string;

  beforeEach(() => {
    testDir = path.join(os.tmpdir(), `shard-cli-test-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });
    outputPath = path.join(testDir, 'game_events.json');
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Event ID Validation', () => {
    it('should export successfully with valid event IDs', () => {
      const config: RecordingConfig = {
        gameName: 'TestGame',
        events: [
          { id: 'testGame_a1b2c3d4', name: 'First Event', createdAt: new Date().toISOString() },
          { id: 'testGame_e5f6a7b8', name: 'Second Event', createdAt: new Date().toISOString() },
        ],
      };

      expect(() => exportToGameEvents(config, outputPath)).not.toThrow();

      const exported = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
      expect(exported['testGame_a1b2c3d4']).toBe('First Event');
      expect(exported['testGame_e5f6a7b8']).toBe('Second Event');
    });

    it('should throw error for invalid event ID format', () => {
      const config: RecordingConfig = {
        gameName: 'TestGame',
        events: [
          { id: 'invalid-event-id', name: 'Bad Event', createdAt: new Date().toISOString() },
        ],
      };

      expect(() => exportToGameEvents(config, outputPath)).toThrow(
        'Invalid event ID found during export: invalid-event-id'
      );
    });

    it('should throw error for event ID with wrong hex length', () => {
      const config: RecordingConfig = {
        gameName: 'TestGame',
        events: [
          { id: 'testGame_abc', name: 'Short Hex', createdAt: new Date().toISOString() },
        ],
      };

      expect(() => exportToGameEvents(config, outputPath)).toThrow(
        'Invalid event ID found during export: testGame_abc'
      );
    });

    it('should throw error for event ID with uppercase hex characters', () => {
      const config: RecordingConfig = {
        gameName: 'TestGame',
        events: [
          { id: 'testGame_A1B2C3D4', name: 'Uppercase Hex', createdAt: new Date().toISOString() },
        ],
      };

      expect(() => exportToGameEvents(config, outputPath)).toThrow(
        'Invalid event ID found during export: testGame_A1B2C3D4'
      );
    });

    it('should throw error for event ID missing underscore', () => {
      const config: RecordingConfig = {
        gameName: 'TestGame',
        events: [
          { id: 'testGamea1b2c3d4', name: 'No Underscore', createdAt: new Date().toISOString() },
        ],
      };

      expect(() => exportToGameEvents(config, outputPath)).toThrow(
        'Invalid event ID found during export: testGamea1b2c3d4'
      );
    });

    it('should not write file when validation fails', () => {
      const config: RecordingConfig = {
        gameName: 'TestGame',
        events: [
          { id: 'invalid', name: 'Bad Event', createdAt: new Date().toISOString() },
        ],
      };

      try {
        exportToGameEvents(config, outputPath);
      } catch {
        // Expected to throw
      }

      expect(fs.existsSync(outputPath)).toBe(false);
    });
  });
});
