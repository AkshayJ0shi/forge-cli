import { TemplateContext, TemplateFunction } from '../../../utils/templateEngine';

/**
 * Godot 4.x ShardEvents.gd template
 * Ported from Godot 3.x to use Godot 4 syntax
 */
export const shardEventsTemplate: TemplateFunction = (context: TemplateContext): string => {
  return `class_name ShardEvents
extends RefCounted

## Shard Events - Game Event Handling

# =============================================================================
# Signals - Game Events
# =============================================================================
signal player_damaged(attacker_peer_id: int, victim_peer_id: int, damage: int, health_remaining: int)
signal player_eliminated(peer_id: int, killer_peer_id: int)
signal weapon_picked_up(peer_id: int, weapon_type: String)
signal weapon_dropped(peer_id: int, weapon_type: String, position: Vector2)

# =============================================================================
# Signals - Player Connection Events
# =============================================================================
signal player_disconnected(peer_id: int, username: String)
signal player_reconnected(peer_id: int, username: String)
signal player_timed_out(peer_id: int, username: String)

# Player connection states
var _player_states: Dictionary = {}
var _debug_logging: bool = false


# =============================================================================
# Message Handling
# =============================================================================

func handle_message(message: Dictionary) -> bool:
	if not message.has("type"):
		return false
	
	match message.type:
		ShardProtocol.MSG_PLAYER_DAMAGED:
			_handle_player_damaged(message)
			return true
		
		ShardProtocol.MSG_PLAYER_ELIMINATED:
			_handle_player_eliminated(message)
			return true
		
		ShardProtocol.MSG_WEAPON_PICKUP:
			_handle_weapon_pickup(message)
			return true
		
		ShardProtocol.MSG_WEAPON_DROPPED:
			_handle_weapon_dropped(message)
			return true
		
		ShardProtocol.MSG_PLAYER_DISCONNECTED:
			_handle_player_disconnected(message)
			return true
		
		ShardProtocol.MSG_PLAYER_RECONNECTED:
			_handle_player_reconnected(message)
			return true
		
		ShardProtocol.MSG_PLAYER_TIMEOUT:
			_handle_player_timeout(message)
			return true
	
	return false


# =============================================================================
# Game Event Handlers
# =============================================================================

func _handle_player_damaged(message: Dictionary) -> void:
	var attacker_peer_id = int(message.get("attacker_peer_id", -1))
	var victim_peer_id = int(message.get("victim_peer_id", -1))
	var damage = int(message.get("damage", 0))
	var health_remaining = int(message.get("health_remaining", 0))
	
	_log("Player damaged: attacker=%d, victim=%d, damage=%d, health=%d" % [
		attacker_peer_id, victim_peer_id, damage, health_remaining
	])
	
	player_damaged.emit(attacker_peer_id, victim_peer_id, damage, health_remaining)


func _handle_player_eliminated(message: Dictionary) -> void:
	var peer_id = int(message.get("peer_id", -1))
	var killer_peer_id = int(message.get("killer_peer_id", -1))
	
	_log("Player eliminated: peer_id=%d, killer=%d" % [peer_id, killer_peer_id])
	
	player_eliminated.emit(peer_id, killer_peer_id)


func _handle_weapon_pickup(message: Dictionary) -> void:
	var peer_id = int(message.get("peer_id", -1))
	var weapon_type = str(message.get("weapon_type", ""))
	
	_log("Weapon picked up: peer_id=%d, weapon=%s" % [peer_id, weapon_type])
	
	weapon_picked_up.emit(peer_id, weapon_type)


func _handle_weapon_dropped(message: Dictionary) -> void:
	var peer_id = int(message.get("peer_id", -1))
	var weapon_type = str(message.get("weapon_type", ""))
	var x = float(message.get("x", 0.0))
	var y = float(message.get("y", 0.0))
	var position = Vector2(x, y)
	
	_log("Weapon dropped: peer_id=%d, weapon=%s, position=%s" % [peer_id, weapon_type, str(position)])
	
	weapon_dropped.emit(peer_id, weapon_type, position)


# =============================================================================
# Player Connection Event Handlers
# =============================================================================

func _handle_player_disconnected(message: Dictionary) -> void:
	var peer_id = int(message.get("peer_id", -1))
	var username = str(message.get("username", ""))
	
	_update_player_state(peer_id, "disconnected", username)
	_log("Player disconnected: peer_id=%d, username=%s" % [peer_id, username])
	
	player_disconnected.emit(peer_id, username)


func _handle_player_reconnected(message: Dictionary) -> void:
	var peer_id = int(message.get("peer_id", -1))
	var username = str(message.get("username", ""))
	
	_update_player_state(peer_id, "connected", username)
	_log("Player reconnected: peer_id=%d, username=%s" % [peer_id, username])
	
	player_reconnected.emit(peer_id, username)


func _handle_player_timeout(message: Dictionary) -> void:
	var peer_id = int(message.get("peer_id", -1))
	var username = str(message.get("username", ""))
	
	_update_player_state(peer_id, "timed_out", username)
	_log("Player timed out: peer_id=%d, username=%s" % [peer_id, username])
	
	player_timed_out.emit(peer_id, username)


# =============================================================================
# Player State Management
# =============================================================================

func _update_player_state(peer_id: int, state: String, username: String) -> void:
	_player_states[peer_id] = {
		"state": state,
		"username": username
	}


func get_player_state(peer_id: int) -> String:
	if _player_states.has(peer_id):
		return _player_states[peer_id].get("state", "unknown")
	return "unknown"


func is_player_connected(peer_id: int) -> bool:
	return get_player_state(peer_id) == "connected"


func is_player_disconnected(peer_id: int) -> bool:
	var state = get_player_state(peer_id)
	return state == "disconnected" or state == "timed_out"


func get_all_player_states() -> Dictionary:
	return _player_states.duplicate(true)


func set_player_connected(peer_id: int, username: String) -> void:
	_update_player_state(peer_id, "connected", username)


func clear_player_states() -> void:
	_player_states.clear()


func reset() -> void:
	_player_states.clear()
	_log("Events state reset")


# =============================================================================
# Debug Logging
# =============================================================================

func set_debug_logging(enabled: bool) -> void:
	_debug_logging = enabled


func _log(message: String) -> void:
	if _debug_logging:
		var timestamp = Time.get_ticks_msec()
		print("[ShardEvents %d] %s" % [timestamp, message])
`;
};

export default shardEventsTemplate;
