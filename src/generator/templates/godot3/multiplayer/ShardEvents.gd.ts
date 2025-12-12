import { TemplateContext, TemplateFunction } from '../../../utils/templateEngine';

/**
 * Godot 3.x ShardEvents.gd template
 * Game event handling - uses Godot 3 syntax
 */
export const shardEventsTemplate: TemplateFunction = (context: TemplateContext): string => {
  return `extends Reference
class_name ShardEvents

# =============================================================================
# Shard Events - Game Event Handling
# Generated for ${context.gameName} (Godot ${context.godotVersion})
# =============================================================================

signal player_damaged(attacker_peer_id, victim_peer_id, damage, health_remaining)
signal player_eliminated(peer_id, killer_peer_id)
signal weapon_picked_up(peer_id, weapon_type)
signal weapon_dropped(peer_id, weapon_type, position)

signal player_disconnected(peer_id, username)
signal player_reconnected(peer_id, username)
signal player_timed_out(peer_id, username)

var _player_states: Dictionary = {}
var _debug_logging: bool = false


func handle_message(message: Dictionary) -> bool:
	if not message.has("type"):
		return false
	
	var ShardProtocolClass = load("res://addons/shard_sdk/multiplayer/ShardProtocol.gd")
	
	match message.type:
		ShardProtocolClass.MSG_PLAYER_DAMAGED:
			_handle_player_damaged(message)
			return true
		
		ShardProtocolClass.MSG_PLAYER_ELIMINATED:
			_handle_player_eliminated(message)
			return true
		
		ShardProtocolClass.MSG_WEAPON_PICKUP:
			_handle_weapon_pickup(message)
			return true
		
		ShardProtocolClass.MSG_WEAPON_DROPPED:
			_handle_weapon_dropped(message)
			return true
		
		ShardProtocolClass.MSG_PLAYER_DISCONNECTED:
			_handle_player_disconnected(message)
			return true
		
		ShardProtocolClass.MSG_PLAYER_RECONNECTED:
			_handle_player_reconnected(message)
			return true
		
		ShardProtocolClass.MSG_PLAYER_TIMEOUT:
			_handle_player_timeout(message)
			return true
	
	return false


func _handle_player_damaged(message: Dictionary) -> void:
	var attacker_peer_id = int(message.get("attacker_peer_id", -1))
	var victim_peer_id = int(message.get("victim_peer_id", -1))
	var damage = int(message.get("damage", 0))
	var health_remaining = int(message.get("health_remaining", 0))
	
	_log("Player damaged: attacker=%d, victim=%d, damage=%d, health=%d" % [
		attacker_peer_id, victim_peer_id, damage, health_remaining
	])
	
	emit_signal("player_damaged", attacker_peer_id, victim_peer_id, damage, health_remaining)


func _handle_player_eliminated(message: Dictionary) -> void:
	var peer_id = int(message.get("peer_id", -1))
	var killer_peer_id = int(message.get("killer_peer_id", -1))
	
	_log("Player eliminated: peer_id=%d, killer=%d" % [peer_id, killer_peer_id])
	
	emit_signal("player_eliminated", peer_id, killer_peer_id)


func _handle_weapon_pickup(message: Dictionary) -> void:
	var peer_id = int(message.get("peer_id", -1))
	var weapon_type = str(message.get("weapon_type", ""))
	
	_log("Weapon picked up: peer_id=%d, weapon=%s" % [peer_id, weapon_type])
	
	emit_signal("weapon_picked_up", peer_id, weapon_type)


func _handle_weapon_dropped(message: Dictionary) -> void:
	var peer_id = int(message.get("peer_id", -1))
	var weapon_type = str(message.get("weapon_type", ""))
	
	var x = float(message.get("x", 0.0))
	var y = float(message.get("y", 0.0))
	var position = Vector2(x, y)
	
	_log("Weapon dropped: peer_id=%d, weapon=%s, position=%s" % [peer_id, weapon_type, str(position)])
	
	emit_signal("weapon_dropped", peer_id, weapon_type, position)


func _handle_player_disconnected(message: Dictionary) -> void:
	var peer_id = int(message.get("peer_id", -1))
	var username = str(message.get("username", ""))
	
	_update_player_state(peer_id, "disconnected", username)
	
	_log("Player disconnected: peer_id=%d, username=%s" % [peer_id, username])
	
	emit_signal("player_disconnected", peer_id, username)


func _handle_player_reconnected(message: Dictionary) -> void:
	var peer_id = int(message.get("peer_id", -1))
	var username = str(message.get("username", ""))
	
	_update_player_state(peer_id, "connected", username)
	
	_log("Player reconnected: peer_id=%d, username=%s" % [peer_id, username])
	
	emit_signal("player_reconnected", peer_id, username)


func _handle_player_timeout(message: Dictionary) -> void:
	var peer_id = int(message.get("peer_id", -1))
	var username = str(message.get("username", ""))
	
	_update_player_state(peer_id, "timed_out", username)
	
	_log("Player timed out: peer_id=%d, username=%s" % [peer_id, username])
	
	emit_signal("player_timed_out", peer_id, username)


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


func set_debug_logging(enabled: bool) -> void:
	_debug_logging = enabled


func _log(message: String) -> void:
	if _debug_logging:
		var timestamp = OS.get_ticks_msec()
		print("[ShardEvents %d] %s" % [timestamp, message])
`;
};

export default shardEventsTemplate;
