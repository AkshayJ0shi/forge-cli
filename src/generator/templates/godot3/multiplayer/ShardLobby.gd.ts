import { TemplateContext, TemplateFunction } from '../../../utils/templateEngine';

/**
 * Godot 3.x ShardLobby.gd template
 * Lobby state and operations - uses Godot 3 syntax
 */
export const shardLobbyTemplate: TemplateFunction = (context: TemplateContext): string => {
  return `extends Reference
class_name ShardLobby

# =============================================================================
# Shard Lobby - Lobby State and Operations
# Generated for ${context.gameName} (Godot ${context.godotVersion})
# =============================================================================

signal lobby_created(lobby_code, players)
signal lobby_joined(lobby_code, players)
signal lobby_left()
signal lobby_closed(reason)
signal lobby_error(code, message)
signal player_joined(peer_id, username)
signal player_left(peer_id, username, new_host_peer_id)

var _lobby_code: String = ""
var _players: Dictionary = {}
var _my_peer_id: int = -1
var _host_peer_id: int = -1
var _debug_logging: bool = false


func create_lobby(connection) -> void:
	if not connection or not connection.is_authenticated():
		_log("Cannot create lobby - not authenticated")
		return
	
	var ShardProtocolClass = load("res://addons/shard_sdk/multiplayer/ShardProtocol.gd")
	var message = {
		"type": ShardProtocolClass.MSG_CREATE_LOBBY,
		"timestamp": OS.get_ticks_msec()
	}
	connection.send_message(message)
	_log("Sent create_lobby request")


func join_lobby(connection, lobby_code: String) -> void:
	if not connection or not connection.is_authenticated():
		_log("Cannot join lobby - not authenticated")
		return
	
	if lobby_code.empty():
		_log("Cannot join lobby - empty lobby code")
		var ShardProtocolClass = load("res://addons/shard_sdk/multiplayer/ShardProtocol.gd")
		emit_signal("lobby_error", ShardProtocolClass.ERR_INVALID_LOBBY_CODE, "Lobby code cannot be empty")
		return
	
	var ShardProtocolClass = load("res://addons/shard_sdk/multiplayer/ShardProtocol.gd")
	var message = {
		"type": ShardProtocolClass.MSG_JOIN_LOBBY,
		"timestamp": OS.get_ticks_msec(),
		"lobby_code": lobby_code
	}
	connection.send_message(message)
	_log("Sent join_lobby request for code: %s" % lobby_code)


func leave_lobby(connection) -> void:
	if not connection or not connection.is_authenticated():
		_log("Cannot leave lobby - not authenticated")
		return
	
	if _lobby_code.empty():
		_log("Cannot leave lobby - not in a lobby")
		return
	
	var ShardProtocolClass = load("res://addons/shard_sdk/multiplayer/ShardProtocol.gd")
	var message = {
		"type": ShardProtocolClass.MSG_LEAVE_LOBBY,
		"timestamp": OS.get_ticks_msec()
	}
	connection.send_message(message)
	_log("Sent leave_lobby request")
	
	_clear_state()
	emit_signal("lobby_left")


func handle_message(message: Dictionary) -> bool:
	if not message.has("type"):
		return false
	
	var ShardProtocolClass = load("res://addons/shard_sdk/multiplayer/ShardProtocol.gd")
	
	match message.type:
		ShardProtocolClass.MSG_LOBBY_CREATED:
			_handle_lobby_created(message)
			return true
		
		ShardProtocolClass.MSG_LOBBY_JOINED:
			_handle_lobby_joined(message)
			return true
		
		ShardProtocolClass.MSG_PLAYER_JOINED:
			_handle_player_joined(message)
			return true
		
		ShardProtocolClass.MSG_PLAYER_LEFT:
			_handle_player_left(message)
			return true
		
		ShardProtocolClass.MSG_LOBBY_CLOSED:
			_handle_lobby_closed(message)
			return true
		
		ShardProtocolClass.MSG_ERROR:
			return _handle_error(message)
	
	return false


func _handle_lobby_created(message: Dictionary) -> void:
	if not message.has("lobby_code"):
		_log("lobby_created message missing lobby_code")
		return
	
	_lobby_code = message.lobby_code
	
	if message.has("players"):
		_parse_players(message.players)
	
	_log("Lobby created with code: %s" % _lobby_code)
	emit_signal("lobby_created", _lobby_code, _players.duplicate())


func _handle_lobby_joined(message: Dictionary) -> void:
	if not message.has("lobby_code"):
		_log("lobby_joined message missing lobby_code")
		return
	
	_lobby_code = message.lobby_code
	
	if message.has("players"):
		_parse_players(message.players)
	
	_log("Joined lobby with code: %s" % _lobby_code)
	emit_signal("lobby_joined", _lobby_code, _players.duplicate())


func _handle_player_joined(message: Dictionary) -> void:
	if not message.has("peer_id") or not message.has("username"):
		_log("player_joined message missing required fields")
		return
	
	var peer_id = int(message.peer_id)
	var username = str(message.username)
	
	_players[peer_id] = {
		"username": username,
		"is_host": false
	}
	
	_log("Player joined: %s (peer_id: %d)" % [username, peer_id])
	emit_signal("player_joined", peer_id, username)


func _handle_player_left(message: Dictionary) -> void:
	if not message.has("peer_id"):
		_log("player_left message missing peer_id")
		return
	
	var peer_id = int(message.peer_id)
	var username = ""
	var new_host_peer_id = -1
	
	if _players.has(peer_id):
		username = _players[peer_id].get("username", "")
		_players.erase(peer_id)
	
	if message.has("username"):
		username = str(message.username)
	
	if message.has("new_host_peer_id"):
		new_host_peer_id = int(message.new_host_peer_id)
		_host_peer_id = new_host_peer_id
		
		if _players.has(_host_peer_id):
			_players[_host_peer_id].is_host = true
		
		_log("Host transferred to peer_id: %d" % new_host_peer_id)
	
	_log("Player left: %s (peer_id: %d)" % [username, peer_id])
	emit_signal("player_left", peer_id, username, new_host_peer_id)


func _handle_lobby_closed(message: Dictionary) -> void:
	var reason = message.get("reason", "Lobby closed")
	
	_log("Lobby closed: %s" % reason)
	_clear_state()
	emit_signal("lobby_closed", reason)


func _handle_error(message: Dictionary) -> bool:
	if not message.has("code"):
		return false
	
	var code = str(message.code)
	var error_message = message.get("message", "Unknown error")
	
	var ShardProtocolClass = load("res://addons/shard_sdk/multiplayer/ShardProtocol.gd")
	if ShardProtocolClass.is_lobby_error(code):
		_log("Lobby error: %s - %s" % [code, error_message])
		emit_signal("lobby_error", code, error_message)
		return true
	
	return false


func _parse_players(players_array) -> void:
	_players.clear()
	_host_peer_id = -1
	
	if not players_array is Array:
		_log("Invalid players data - expected Array")
		return
	
	for p in players_array:
		if not p is Dictionary:
			continue
		
		if not p.has("peer_id") or not p.has("username"):
			continue
		
		var peer_id = int(p.peer_id)
		var is_host = p.get("is_host", false)
		
		_players[peer_id] = {
			"username": str(p.username),
			"is_host": is_host
		}
		
		if is_host:
			_host_peer_id = peer_id
		
		if p.get("is_self", false):
			_my_peer_id = peer_id
	
	_log("Parsed %d players, host: %d, self: %d" % [_players.size(), _host_peer_id, _my_peer_id])


func get_lobby_code() -> String:
	return _lobby_code


func get_players() -> Dictionary:
	return _players.duplicate(true)


func is_host() -> bool:
	return _my_peer_id >= 0 and _my_peer_id == _host_peer_id


func get_player_count() -> int:
	return _players.size()


func get_my_peer_id() -> int:
	return _my_peer_id


func get_host_peer_id() -> int:
	return _host_peer_id


func is_in_lobby() -> bool:
	return not _lobby_code.empty()


func set_my_peer_id(peer_id: int) -> void:
	_my_peer_id = peer_id


func _clear_state() -> void:
	_lobby_code = ""
	_players.clear()
	_host_peer_id = -1


func reset() -> void:
	_clear_state()
	_my_peer_id = -1


func set_debug_logging(enabled: bool) -> void:
	_debug_logging = enabled


func _log(message: String) -> void:
	if _debug_logging:
		var timestamp = OS.get_ticks_msec()
		print("[ShardLobby %d] %s" % [timestamp, message])
`;
};

export default shardLobbyTemplate;
