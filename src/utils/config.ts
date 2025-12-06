import * as fs from 'fs';
import * as path from 'path';
import Ajv from 'ajv';
import { isValidEventId } from './eventId';

export const CONFIG_FILE_NAME = 'shard.recording.json';

export interface RecordingEvent {
  id: string;
  name: string;
  createdAt: string;
}

export interface RecordingConfig {
  $schema?: string;
  gameName: string;
  events: RecordingEvent[];
}

// JSON Schema for shard.recording.json
const configSchema = {
  type: 'object',
  required: ['gameName', 'events'],
  properties: {
    $schema: { type: 'string' },
    gameName: { 
      type: 'string',
      minLength: 1,
      maxLength: 50
    },
    events: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'name', 'createdAt'],
        properties: {
          id: { 
            type: 'string',
            pattern: '^[a-zA-Z0-9]+_[a-f0-9]{8}$'
          },
          name: { 
            type: 'string',
            minLength: 3,
            maxLength: 50
          },
          createdAt: { type: 'string' }
        }
      }
    }
  }
};

// JSON Schema for game_events.json
const gameEventsSchema = {
  type: 'object',
  patternProperties: {
    '^[a-zA-Z0-9]+_[a-f0-9]{8}$': {
      type: 'string',
      minLength: 3,
      maxLength: 50
    }
  },
  additionalProperties: false
};

const ajv = new Ajv({ allErrors: true });
const validateConfigSchema = ajv.compile(configSchema);
const validateGameEventsSchema = ajv.compile(gameEventsSchema);

/**
 * Initialize a new recording configuration file
 */
export function initConfig(gameName: string): void {
  const configPath = path.join(process.cwd(), CONFIG_FILE_NAME);
  
  if (fs.existsSync(configPath)) {
    throw new Error(`${CONFIG_FILE_NAME} already exists. Delete it first or use a different directory.`);
  }

  const config: RecordingConfig = {
    $schema: 'https://shard.gg/schemas/recording-config.json',
    gameName: gameName.trim(),
    events: []
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

/**
 * Load the recording configuration from the current directory
 */
export function loadConfig(): RecordingConfig | null {
  const configPath = path.join(process.cwd(), CONFIG_FILE_NAME);
  
  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(content) as RecordingConfig;
  } catch {
    throw new Error(`Failed to parse ${CONFIG_FILE_NAME}. Ensure it's valid JSON.`);
  }
}

/**
 * Save the recording configuration to the current directory
 */
export function saveConfig(config: RecordingConfig): void {
  const configPath = path.join(process.cwd(), CONFIG_FILE_NAME);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

/**
 * Export configuration to game_events.json format
 */
export function exportToGameEvents(config: RecordingConfig, outputPath: string): void {
  const gameEvents: Record<string, string> = {};
  
  for (const event of config.events) {
    if (!isValidEventId(event.id)) {
      throw new Error(`Invalid event ID found during export: ${event.id}`);
    }
    gameEvents[event.id] = event.name;
  }

  const fullPath = path.isAbsolute(outputPath) 
    ? outputPath 
    : path.join(process.cwd(), outputPath);

  fs.writeFileSync(fullPath, JSON.stringify(gameEvents, null, 2));
}

/**
 * Validate the recording configuration
 */
export function validateConfig(config: RecordingConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const schemaValid = validateConfigSchema(config);
  if (!schemaValid && validateConfigSchema.errors) {
    for (const error of validateConfigSchema.errors) {
      const errorAny = error as any;
      const path = errorAny.instancePath || errorAny.schemaPath || '';
      errors.push(`Schema error: ${path} ${error.message}`);
    }
  }

  if (!config.gameName || config.gameName.trim().length === 0) {
    errors.push('Game name is required');
  }

  const seenIds = new Set<string>();
  for (const event of config.events) {
    if (!isValidEventId(event.id)) {
      errors.push(`Invalid event ID format: ${event.id}`);
    }
    
    if (seenIds.has(event.id)) {
      errors.push(`Duplicate event ID: ${event.id}`);
    }
    seenIds.add(event.id);

    if (!event.name || event.name.length < 3) {
      errors.push(`Event name too short: "${event.name}" (minimum 3 characters)`);
    }

    if (event.name && event.name.length > 50) {
      errors.push(`Event name too long: "${event.name}" (maximum 50 characters)`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate a game_events.json file
 */
export function validateGameEventsFile(filePath: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!fs.existsSync(filePath)) {
    return { valid: false, errors: ['File not found'] };
  }

  let content: Record<string, string>;
  try {
    content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return { valid: false, errors: ['Invalid JSON format'] };
  }

  const schemaValid = validateGameEventsSchema(content);
  if (!schemaValid && validateGameEventsSchema.errors) {
    for (const error of validateGameEventsSchema.errors) {
      const errorAny = error as any;
      const path = errorAny.instancePath || errorAny.schemaPath || '';
      errors.push(`Schema error: ${path} ${error.message}`);
    }
  }

  for (const [eventId, eventName] of Object.entries(content)) {
    if (!isValidEventId(eventId)) {
      errors.push(`Invalid event ID format: ${eventId}`);
    }

    if (typeof eventName !== 'string') {
      errors.push(`Event name must be a string for ID: ${eventId}`);
    } else if (eventName.length < 3 || eventName.length > 50) {
      errors.push(`Event name must be 3-50 characters for ID: ${eventId}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
