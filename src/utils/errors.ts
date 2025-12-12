/**
 * Error codes for ShardKit CLI operations
 */
export enum ForgeErrorCode {
  CONFIG_NOT_FOUND = 'CONFIG_NOT_FOUND',
  CONFIG_INVALID = 'CONFIG_INVALID',
  FEATURE_NOT_ENABLED = 'FEATURE_NOT_ENABLED',
  GENERATION_FAILED = 'GENERATION_FAILED',
  FILE_WRITE_ERROR = 'FILE_WRITE_ERROR',
  NOT_GODOT_PROJECT = 'NOT_GODOT_PROJECT',
  INVALID_INPUT = 'INVALID_INPUT',
}

/**
 * Suggestion messages for each error code
 */
export const ERROR_SUGGESTIONS: Record<ForgeErrorCode, string> = {
  [ForgeErrorCode.CONFIG_NOT_FOUND]: 'Run `shardkit init` to create a configuration file.',
  [ForgeErrorCode.CONFIG_INVALID]: 'Fix the errors in shard.config.json and try again.',
  [ForgeErrorCode.FEATURE_NOT_ENABLED]: 'Run `shardkit init` to enable the required feature.',
  [ForgeErrorCode.GENERATION_FAILED]: 'Check file permissions and try again.',
  [ForgeErrorCode.FILE_WRITE_ERROR]: 'Check file permissions and available disk space.',
  [ForgeErrorCode.NOT_GODOT_PROJECT]: 'Run this command from your Godot project root directory.',
  [ForgeErrorCode.INVALID_INPUT]: 'Check the input values and try again.',
};

/**
 * Custom error class for ShardKit CLI errors with error codes and suggestions
 */
export class ForgeError extends Error {
  public readonly code: ForgeErrorCode;
  public readonly suggestion: string;

  constructor(code: ForgeErrorCode, message: string, suggestion?: string) {
    super(message);
    this.name = 'ForgeError';
    this.code = code;
    this.suggestion = suggestion ?? ERROR_SUGGESTIONS[code];
    
    // Maintains proper stack trace for where error was thrown (only in V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ForgeError);
    }
  }

  /**
   * Check if an error is a ForgeError
   */
  static isForgeError(error: unknown): error is ForgeError {
    return error instanceof ForgeError;
  }
}

/**
 * Helper function to create a CONFIG_NOT_FOUND error
 */
export function configNotFoundError(configFileName: string): ForgeError {
  return new ForgeError(
    ForgeErrorCode.CONFIG_NOT_FOUND,
    `No ${configFileName} found.`,
    `Run \`shardkit init\` to create one.`
  );
}

/**
 * Helper function to create a CONFIG_INVALID error
 */
export function configInvalidError(details: string[]): ForgeError {
  const message = details.length === 1
    ? `Configuration validation failed: ${details[0]}`
    : `Configuration validation failed:\n  - ${details.join('\n  - ')}`;
  return new ForgeError(ForgeErrorCode.CONFIG_INVALID, message);
}

/**
 * Helper function to create a FEATURE_NOT_ENABLED error
 */
export function featureNotEnabledError(feature: string, configFileName: string): ForgeError {
  return new ForgeError(
    ForgeErrorCode.FEATURE_NOT_ENABLED,
    `${feature} feature is not enabled in ${configFileName}.`,
    `Run \`shardkit init\` to enable ${feature.toLowerCase()}.`
  );
}

/**
 * Helper function to create a GENERATION_FAILED error
 */
export function generationFailedError(details: string): ForgeError {
  return new ForgeError(
    ForgeErrorCode.GENERATION_FAILED,
    `Failed to generate SDK: ${details}`
  );
}

/**
 * Helper function to create a FILE_WRITE_ERROR error
 */
export function fileWriteError(filePath: string, details: string): ForgeError {
  return new ForgeError(
    ForgeErrorCode.FILE_WRITE_ERROR,
    `Failed to write file ${filePath}: ${details}`
  );
}

/**
 * Helper function to create a NOT_GODOT_PROJECT warning (returns ForgeError for consistency)
 */
export function notGodotProjectError(): ForgeError {
  return new ForgeError(
    ForgeErrorCode.NOT_GODOT_PROJECT,
    'No project.godot found in current directory.'
  );
}

/**
 * Helper function to create an INVALID_INPUT error
 */
export function invalidInputError(field: string, details: string): ForgeError {
  return new ForgeError(
    ForgeErrorCode.INVALID_INPUT,
    `Invalid ${field}: ${details}`
  );
}
