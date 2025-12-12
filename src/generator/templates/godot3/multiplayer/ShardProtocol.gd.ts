import { TemplateContext, TemplateFunction } from '../../../utils/templateEngine';

/**
 * Godot 3.x ShardProtocol.gd template
 * Protocol constants - uses Godot 3 syntax
 */
export const shardProtocolTemplate: TemplateFunction = (context: TemplateContext): string => {
  return `extends Reference
class_name ShardProtocol

# =============================================================================
# Shard Protocol - Message Types and Constants
# Generated for ${context.gameName} (Godot ${context.godotVersion})
# =============================================================================

# Client → Server message types
const MSG_CREATE_LOBBY = "create_lobby"
const MSG_JOIN_LOBBY = "join_lobby"
const MSG_LEAVE_LOBBY = "leave_lobby"
const MSG_START_MATCH = "start_match"
const MSG_PLAYER_INPUT = "player_input"
const MSG_PING = "ping"

# Server → Client message types
const MSG_AUTHENTICATED = "authenticated"
const MSG_LOBBY_CREATED = "lobby_created"
const MSG_LOBBY_JOINED = "lobby_joined"
const MSG_PLAYER_JOINED = "player_joined"
const MSG_PLAYER_LEFT = "player_left"
const MSG_LOBBY_CLOSED = "lobby_closed"
const MSG_COUNTDOWN = "countdown"
const MSG_ROUND_START = "round_start"
const MSG_STATE_SNAPSHOT = "state_snapshot"
const MSG_ROUND_OVER = "round_over"
const MSG_MATCH_OVER = "match_over"
const MSG_PLAYER_DAMAGED = "player_damaged"
const MSG_PLAYER_ELIMINATED = "player_eliminated"
const MSG_PLAYER_DISCONNECTED = "player_disconnected"
const MSG_PLAYER_RECONNECTED = "player_reconnected"
const MSG_PLAYER_TIMEOUT = "player_timeout"
const MSG_WEAPON_PICKUP = "weapon_pickup"
const MSG_WEAPON_DROPPED = "weapon_dropped"
const MSG_PONG = "pong"
const MSG_ERROR = "error"

# Error codes
const ERR_INVALID_LOBBY_CODE = "invalid_lobby_code"
const ERR_LOBBY_FULL = "lobby_full"
const ERR_ALREADY_IN_LOBBY = "already_in_lobby"
const ERR_NOT_HOST = "not_host"
const ERR_NOT_ENOUGH_PLAYERS = "not_enough_players"
const ERR_INVALID_MESSAGE = "invalid_message"
const ERR_RATE_LIMITED = "rate_limited"
const ERR_MESSAGE_TOO_LARGE = "message_too_large"

# WebSocket close codes
const CLOSE_INVALID_SESSION = 4001
const CLOSE_RATE_LIMITED = 4008
const CLOSE_MESSAGE_TOO_LARGE = 4009

# Lobby-related error codes for filtering
const LOBBY_ERROR_CODES = [
	ERR_INVALID_LOBBY_CODE,
	ERR_LOBBY_FULL,
	ERR_ALREADY_IN_LOBBY,
	ERR_NOT_HOST,
	ERR_NOT_ENOUGH_PLAYERS
]


static func is_lobby_error(code: String) -> bool:
	return code in LOBBY_ERROR_CODES
`;
};

export default shardProtocolTemplate;
