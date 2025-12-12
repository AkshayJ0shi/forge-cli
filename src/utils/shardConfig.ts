import * as fs from 'fs';
import * as path from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { isValidEventId } from './eventId';
import { RecordingConfig, CONFIG_FILE_NAME as LEGACY_CONFIG_FILE_NAME } from './config';
import shardConfigSchema from '../schemas/shard-config.schema.json';

export const SHARD_CONFIG_FILE_NAME = 'shard.config.json';

export type GodotVersion = '3.x' | '4.x';
export type GameType = 'singleplayer' | 'multiplayer';

export interface RecordingEvent {
  id: string;
  name: string;
  createdAt: string;
}

export interface ShardFeatures {
  recording: boolean;
  errorTracking: boolean;
  multiplayer: boolean;
}

export interface ShardConfig {
  $schema?: string;
  gameName: string;
  godotVersion: GodotVersion;
  gameType: GameType;
  features: ShardFeatures;
  recording?: {
    events: RecordingEvent[];
  };
}

// Initialize AJV with formats support
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const validateShardConfigSchema = ajv.compile(shardConfigSchema);

/**
 * Get the path to shard.config.json in the current directory
 */
export function getShardConfigPath(): string {
  return path.join(process.cwd(), SHARD_CONFIG_FILE_NAME);
}

/**
 * Get the path to legacy shard.recording.json in the current directory
 */
export function getLegacyConfigPath(): string {
  return path.join(process.cwd(), LEGACY_CONFIG_FILE_NAME);
}

/**
 * Check if shard.config.json exists in the current directory
 */
export function shardConfigExists(): boolean {
  return fs.existsSync(getShardConfigPath());
}

/**
 * Check if legacy shard.recording.json exists in the current directory
 */
export function legacyConfigExists(): boolean {
  return fs.existsSync(getLegacyConfigPath());
}


/**
 * Load the shard configuration from the current directory
 * Prefers shard.config.json over legacy shard.recording.json
 */
export function loadShardConfig(): ShardConfig | null {
  const configPath = getShardConfigPath();
  
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(content) as ShardConfig;
    } catch {
      throw new Error(`Failed to parse ${SHARD_CONFIG_FILE_NAME}. Ensure it's valid JSON.`);
    }
  }

  return null;
}

/**
 * Load legacy recording config from shard.recording.json
 */
export function loadLegacyConfig(): RecordingConfig | null {
  const configPath = getLegacyConfigPath();
  
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(content) as RecordingConfig;
    } catch {
      throw new Error(`Failed to parse ${LEGACY_CONFIG_FILE_NAME}. Ensure it's valid JSON.`);
    }
  }

  return null;
}

/**
 * Save the shard configuration to the current directory
 */
export function saveShardConfig(config: ShardConfig): void {
  const configPath = getShardConfigPath();
  
  // Ensure $schema is set
  const configWithSchema: ShardConfig = {
    $schema: 'https://shard.gg/schemas/shard-config.json',
    ...config,
  };
  
  fs.writeFileSync(configPath, JSON.stringify(configWithSchema, null, 2));
}

/**
 * Create a new shard configuration with defaults
 */
export function createShardConfig(
  gameName: string,
  godotVersion: GodotVersion,
  gameType: GameType,
  features: Partial<ShardFeatures>
): ShardConfig {
  // Multiplayer is auto-enabled for multiplayer game type
  const multiplayer = gameType === 'multiplayer' || features.multiplayer === true;
  
  const config: ShardConfig = {
    $schema: 'https://shard.gg/schemas/shard-config.json',
    gameName: gameName.trim(),
    godotVersion,
    gameType,
    features: {
      recording: features.recording ?? false,
      errorTracking: features.errorTracking ?? false,
      multiplayer,
    },
  };

  // Initialize recording events array if recording is enabled
  if (config.features.recording) {
    config.recording = {
      events: [],
    };
  }

  return config;
}


/**
 * Validate the shard configuration against the JSON schema and business rules
 */
export function validateShardConfig(config: ShardConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Schema validation
  const schemaValid = validateShardConfigSchema(config);
  if (!schemaValid && validateShardConfigSchema.errors) {
    for (const error of validateShardConfigSchema.errors) {
      const errorAny = error as any;
      const instancePath = errorAny.instancePath || '';
      errors.push(`Schema error at ${instancePath || 'root'}: ${error.message}`);
    }
  }

  // Business rule validations
  if (!config.gameName || config.gameName.trim().length === 0) {
    errors.push('Game name is required');
  }

  // Validate multiplayer feature consistency with game type
  if (config.gameType === 'multiplayer' && !config.features.multiplayer) {
    errors.push('Multiplayer feature must be enabled for multiplayer game type');
  }

  // Validate recording events if recording is enabled
  if (config.features.recording && config.recording?.events) {
    const seenIds = new Set<string>();
    
    for (const event of config.recording.events) {
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
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Migrate legacy shard.recording.json to new shard.config.json format
 * Returns partial config that needs additional fields (godotVersion, gameType, errorTracking)
 */
export function migrateFromLegacyConfig(
  legacyConfig: RecordingConfig,
  godotVersion: GodotVersion,
  gameType: GameType,
  enableErrorTracking: boolean = false
): ShardConfig {
  const multiplayer = gameType === 'multiplayer';
  
  return {
    $schema: 'https://shard.gg/schemas/shard-config.json',
    gameName: legacyConfig.gameName,
    godotVersion,
    gameType,
    features: {
      recording: true, // Legacy config implies recording was enabled
      errorTracking: enableErrorTracking,
      multiplayer,
    },
    recording: {
      events: legacyConfig.events.map(event => ({
        id: event.id,
        name: event.name,
        createdAt: event.createdAt,
      })),
    },
  };
}

/**
 * Load config with fallback to legacy format
 * Returns the config and a flag indicating if it was migrated from legacy
 */
export function loadConfigWithFallback(): { config: ShardConfig | null; isLegacy: boolean } {
  // Try new format first
  const shardConfig = loadShardConfig();
  if (shardConfig) {
    return { config: shardConfig, isLegacy: false };
  }

  // Fall back to legacy format (but don't auto-migrate, just return null)
  // Migration requires user input for missing fields
  if (legacyConfigExists()) {
    return { config: null, isLegacy: true };
  }

  return { config: null, isLegacy: false };
}

/**
 * Add a recording event to the config
 */
export function addRecordingEvent(config: ShardConfig, event: RecordingEvent): ShardConfig {
  if (!config.features.recording) {
    throw new Error('Recording feature is not enabled in this configuration');
  }

  if (!config.recording) {
    config.recording = { events: [] };
  }

  // Check for duplicate ID
  if (config.recording.events.some(e => e.id === event.id)) {
    throw new Error(`Event with ID ${event.id} already exists`);
  }

  config.recording.events.push(event);
  return config;
}

/**
 * Remove a recording event from the config by ID
 */
export function removeRecordingEvent(config: ShardConfig, eventId: string): ShardConfig {
  if (!config.features.recording || !config.recording) {
    throw new Error('Recording feature is not enabled in this configuration');
  }

  const index = config.recording.events.findIndex(e => e.id === eventId);
  if (index === -1) {
    throw new Error(`Event with ID ${eventId} not found`);
  }

  config.recording.events.splice(index, 1);
  return config;
}

/**
 * Get recording events from config
 */
export function getRecordingEvents(config: ShardConfig): RecordingEvent[] {
  if (!config.features.recording || !config.recording) {
    return [];
  }
  return config.recording.events;
}
