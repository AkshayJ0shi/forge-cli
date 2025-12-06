import * as crypto from 'crypto';

/**
 * Event ID Generator Utility
 * 
 * Generates unique event IDs in the format: camelCaseGameName_hexSuffix
 * Example: "everplast_a1b2c3d4" or "darkSouls3_e5f6g7h8"
 */

/**
 * Converts a game name to camelCase format
 * - Removes special characters
 * - First word lowercase, subsequent words capitalized
 * - Limits to 20 characters
 */
export function toCamelCase(gameName: string): string {
  return gameName
    .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special chars
    .split(/\s+/) // Split by whitespace
    .filter(word => word.length > 0) // Remove empty strings
    .map((word, index) => {
      if (index === 0) {
        return word.toLowerCase(); // First word lowercase
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join('')
    .substring(0, 20); // Limit length
}

/**
 * Generates an 8-character hexadecimal suffix using crypto-secure random generation
 */
export function generateHexSuffix(): string {
  const bytes = crypto.randomBytes(4);
  return bytes.toString('hex');
}

/**
 * Generates a unique event ID for a game
 * Format: camelCaseGameName_hexSuffix
 * 
 * @example
 * generateEventId("Everplast") // "everplast_a1b2c3d4"
 * generateEventId("Dark Souls 3") // "darkSouls3_e5f6g7h8"
 */
export function generateEventId(gameName: string): string {
  const camelCaseName = toCamelCase(gameName);
  const hexSuffix = generateHexSuffix();
  
  if (!camelCaseName) {
    return `game_${hexSuffix}`;
  }
  
  return `${camelCaseName}_${hexSuffix}`;
}

/**
 * Parses an event ID to extract the game name and hex ID
 */
export function parseEventId(eventId: string): { gameName: string; hexId: string } {
  const underscoreIndex = eventId.lastIndexOf('_');
  if (underscoreIndex === -1) {
    return { gameName: eventId, hexId: '' };
  }
  return {
    gameName: eventId.substring(0, underscoreIndex),
    hexId: eventId.substring(underscoreIndex + 1)
  };
}

/**
 * Validates an event ID matches the expected format
 * Pattern: camelCaseGameName_8hexChars
 */
export function isValidEventId(eventId: string): boolean {
  return /^[a-zA-Z0-9]+_[a-f0-9]{8}$/.test(eventId);
}
