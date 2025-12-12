import { TemplateContext, TemplateFunction } from '../../../utils/templateEngine';

/**
 * Godot 3.x ShardMultiplayer.gd template
 * Main singleton for multiplayer SDK - uses Godot 3 syntax
 */
export const shardMultiplayerTemplate: TemplateFunction = (context: TemplateContext): string => {
  return `extends Node

# =============================================================================
# Shard Multiplayer SDK - Main Singleton
# Generated for ${context.gameName} (Godot ${context.godotVersion})
# =============================================================================
# This is the main entry point and facade for the Shard Multiplayer SDK.
# It coordinates all child components and provides a unified API.

# =============================================================================
# Signals - Connection
# =============================================================================
signal connected()
signal disconnected(reason)
signal authenticated(user_id, username)
signal authentication_failed(reason)
signal reconnected()
signal reconnection_failed()
signal connection_lost()

# =============================================================================
# Signals - Lobby
# =============================================================================
signal lobby_created(lobby_code, players)
signal lobby_joined(lobby_code, players)
signal lobby_left()
signal lobby_closed(reason)
signal lobby_error(code, message)
signal player_joined(peer_id, username)
signal player_left(peer_id, username, new_host_peer_id)

# =============================================================================
# Signals - Match
# =============================================================================
signal countdown(seconds)
signal round_started(round_number, spawn_positions, weapon_spawns)
signal round_ended(winner_peer_id, scores)
signal match_ended(winner_peer_id, winner_username, final_scores)

# =============================================================================
# Signals - Game Events
# =============================================================================
signal state_received(snapshot)
signal player_damaged(attacker_peer_id, victim_peer_id, damage, health_remaining)
signal player_eliminated(peer_id, killer_peer_id)
signal player_disconnected(peer_id, username)
signal player_reconnected(peer_id, username)
signal player_timed_out(peer_id, username)
signal weapon_picked_up(peer_id, weapon_type)
signal weapon_dropped(peer_id, weapon_type, position)

# =============================================================================
# Signals - Utility
# =============================================================================
signal latency_updated(latency_ms)
signal error_received(code, message)
signal rate_limited()
signal prediction_corrected(server_pos, predicted_pos, correction_amount)

# =============================================================================
# Child Components
# =============================================================================
var _connection
var _lobby
var _match
var _input
var _state
var _prediction

# =============================================================================
# Configuration
# =============================================================================
const SETTINGS_PREFIX = "shard_sdk/multiplayer/"

var _debug_logging: bool = false
var _interpolation_delay: int = 100
var _prediction_enabled: bool = true

# =============================================================================
# Error Tracking
# =============================================================================
var _last_error: Dictionary = {}

# =============================================================================
# Lifecycle
# =============================================================================

func _ready() -> void:
	_load_configuration()
	_initialize_components()
	_wire_signals()
	_log("ShardMultiplayer initialized")


func _load_configuration() -> void:
	_debug_logging = _get_setting("debug_logging", false)
	_interpolation_delay = _get_setting("interpolation_delay", 100)
	_prediction_enabled = _get_setting("prediction_enabled", true)


func _get_setting(key: String, default_value):
	var full_key = SETTINGS_PREFIX + key
	if ProjectSettings.has_setting(full_key):
		return ProjectSettings.get_setting(full_key)
	return default_value


func _initialize_components() -> void:
	var ShardConnectionClass = load("res://addons/shard_sdk/multiplayer/ShardConnection.gd")
	var ShardLobbyClass = load("res://addons/shard_sdk/multiplayer/ShardLobby.gd")
	var ShardMatchClass = load("res://addons/shard_sdk/multiplayer/ShardMatch.gd")
	var ShardInputClass = load("res://addons/shard_sdk/multiplayer/ShardInput.gd")
	var ShardStateClass = load("res://addons/shard_sdk/multiplayer/ShardState.gd")
	var ShardPredictionClass = load("res://addons/shard_sdk/multiplayer/ShardPrediction.gd")
	
	_connection = ShardConnectionClass.new()
	_lobby = ShardLobbyClass.new()
	_match = ShardMatchClass.new()
	_input = ShardInputClass.new()
	_state = ShardStateClass.new()
	_prediction = ShardPredictionClass.new()
	
	_state.set_interpolation_delay(_interpolation_delay)
	_prediction.set_enabled(_prediction_enabled)
	_apply_debug_logging(_debug_logging)


func _wire_signals() -> void:
	# Connection signals
	_connection.connect("connected", self, "_on_connection_connected")
	_connection.connect("disconnected", self, "_on_connection_disconnected")
	_connection.connect("authenticated", self, "_on_connection_authenticated")
	_connection.connect("authentication_failed", self, "_on_connection_authentication_failed")
	_connection.connect("reconnected", self, "_on_connection_reconnected")
	_connection.connect("reconnection_failed", self, "_on_connection_reconnection_failed")
	_connection.connect("connection_lost", self, "_on_connection_lost")
	_connection.connect("rate_limited", self, "_on_connection_rate_limited")
	_connection.connect("error_received", self, "_on_connection_error")
	_connection.connect("message_received", self, "_on_message_received")
	_connection.connect("latency_updated", self, "_on_latency_updated")
	
	# Lobby signals
	_lobby.connect("lobby_created", self, "_on_lobby_created")
	_lobby.connect("lobby_joined", self, "_on_lobby_joined")
	_lobby.connect("lobby_left", self, "_on_lobby_left")
	_lobby.connect("lobby_closed", self, "_on_lobby_closed")
	_lobby.connect("lobby_error", self, "_on_lobby_error")
	_lobby.connect("player_joined", self, "_on_player_joined")
	_lobby.connect("player_left", self, "_on_player_left")
	
	# Match signals
	_match.connect("countdown", self, "_on_countdown")
	_match.connect("round_started", self, "_on_round_started")
	_match.connect("round_ended", self, "_on_round_ended")
	_match.connect("match_ended", self, "_on_match_ended")
	
	# State signals
	_state.connect("state_received", self, "_on_state_received")
	
	# Prediction signals
	_prediction.connect("prediction_corrected", self, "_on_prediction_corrected")


func _process(delta: float) -> void:
	if _connection:
		_connection.poll(delta)
	
	if _prediction and _state and _input and _match.is_playing():
		_prediction.reconcile(_state, _input)


# =============================================================================
# Connection API
# =============================================================================

func connect_to_server(token: String) -> void:
	_log("Connecting to server...")
	_connection.connect_to_server(token)


func disconnect_from_server() -> void:
	_log("Disconnecting from server...")
	_connection.disconnect_from_server()
	_reset_game_state()


func reconnect() -> void:
	_log("Manual reconnection requested")
	_connection.reconnect()


func is_connected() -> bool:
	return _connection.is_connected() if _connection else false


func is_authenticated() -> bool:
	return _connection.is_authenticated() if _connection else false


# =============================================================================
# Lobby API
# =============================================================================

func create_lobby() -> void:
	_log("Creating lobby...")
	_lobby.create_lobby(_connection)


func join_lobby(lobby_code: String) -> void:
	_log("Joining lobby: %s" % lobby_code)
	_lobby.join_lobby(_connection, lobby_code)


func leave_lobby() -> void:
	_log("Leaving lobby...")
	_lobby.leave_lobby(_connection)


func get_lobby_code() -> String:
	return _lobby.get_lobby_code() if _lobby else ""


func get_players() -> Dictionary:
	return _lobby.get_players() if _lobby else {}


func is_host() -> bool:
	return _lobby.is_host() if _lobby else false


func get_player_count() -> int:
	return _lobby.get_player_count() if _lobby else 0


# =============================================================================
# Match API
# =============================================================================

func start_match() -> void:
	_log("Starting match...")
	_match.start_match(_connection)
	_connection.set_in_match(true)


func get_match_state() -> int:
	return _match.get_state() if _match else 0


func get_current_round() -> int:
	return _match.get_current_round() if _match else 0


func get_scores() -> Dictionary:
	return _match.get_scores() if _match else {}


func get_my_peer_id() -> int:
	return _lobby.get_my_peer_id() if _lobby else -1


# =============================================================================
# Input API
# =============================================================================

func send_input(input: Dictionary) -> void:
	var is_playing = _match.is_playing() if _match else false
	_input.send_input(_connection, input, is_playing)
	
	if _prediction and _prediction.is_enabled() and is_playing:
		_prediction.apply_input(input, get_process_delta_time())


func get_current_tick() -> int:
	return _input.get_current_tick() if _input else 0


# =============================================================================
# State API
# =============================================================================

func get_latest_state() -> Dictionary:
	return _state.get_latest_state() if _state else {}


func get_interpolated_state(render_time: float) -> Dictionary:
	return _state.get_interpolated_state(render_time) if _state else {}


# =============================================================================
# Prediction API
# =============================================================================

func get_predicted_position() -> Vector2:
	return _prediction.get_predicted_position() if _prediction else Vector2.ZERO


func get_predicted_velocity() -> Vector2:
	return _prediction.get_predicted_velocity() if _prediction else Vector2.ZERO


# =============================================================================
# Latency API
# =============================================================================

func get_latency() -> int:
	return _connection.get_latency() if _connection else 0


func get_average_latency() -> int:
	return _connection.get_average_latency() if _connection else 0


# =============================================================================
# Reconnection API
# =============================================================================

func get_reconnect_attempts() -> int:
	return _connection.get_reconnect_attempts() if _connection else 0


func is_reconnecting() -> bool:
	return _connection.is_reconnecting() if _connection else false


# =============================================================================
# Debug and Diagnostics API
# =============================================================================

func set_debug_logging(enabled: bool) -> void:
	_debug_logging = enabled
	_apply_debug_logging(enabled)
	_log("Debug logging %s" % ["enabled" if enabled else "disabled"])


func _apply_debug_logging(enabled: bool) -> void:
	if _connection:
		_connection.set_debug_logging(enabled)
	if _lobby:
		_lobby.set_debug_logging(enabled)
	if _match:
		_match.set_debug_logging(enabled)
	if _input:
		_input.set_debug_logging(enabled)
	if _state:
		_state.set_debug_logging(enabled)
	if _prediction:
		_prediction.set_debug_logging(enabled)


func get_stats() -> Dictionary:
	var stats = {
		"messages_sent": 0,
		"messages_received": 0,
		"bytes_sent": 0,
		"bytes_received": 0,
		"snapshots_received": 0,
		"inputs_sent": 0,
		"prediction_corrections": 0
	}
	
	if _connection:
		var conn_stats = _connection.get_stats()
		stats.messages_sent = conn_stats.get("messages_sent", 0)
		stats.messages_received = conn_stats.get("messages_received", 0)
		stats.bytes_sent = conn_stats.get("bytes_sent", 0)
		stats.bytes_received = conn_stats.get("bytes_received", 0)
	
	if _state:
		stats.snapshots_received = _state.get_snapshots_received()
	
	if _input:
		stats.inputs_sent = _input.get_inputs_sent()
	
	if _prediction:
		stats.prediction_corrections = _prediction.get_prediction_corrections()
	
	return stats


func get_connection_state() -> String:
	if not _connection:
		return "disconnected"
	
	if _match and _match.is_in_match():
		return "in_match"
	
	if _lobby and _lobby.is_in_lobby():
		return "in_lobby"
	
	return _connection.get_state_string()


func get_last_error() -> Dictionary:
	return _last_error.duplicate()


# =============================================================================
# Message Routing
# =============================================================================

func _on_message_received(message: Dictionary) -> void:
	if not message.has("type"):
		_log("Received message without type field")
		return
	
	var msg_type = message.type
	_log("Routing message: %s" % msg_type)
	
	if _lobby.handle_message(message):
		return
	
	if _match.handle_message(message):
		var ShardProtocolClass = load("res://addons/shard_sdk/multiplayer/ShardProtocol.gd")
		if msg_type == ShardProtocolClass.MSG_ROUND_START:
			_connection.set_in_match(true)
		elif msg_type == ShardProtocolClass.MSG_MATCH_OVER:
			_connection.set_in_match(false)
		return
	
	var ShardProtocolClass = load("res://addons/shard_sdk/multiplayer/ShardProtocol.gd")
	if msg_type == ShardProtocolClass.MSG_STATE_SNAPSHOT:
		_state.handle_snapshot(message)
		return
	
	_handle_game_event(message)


func _handle_game_event(message: Dictionary) -> void:
	var msg_type = message.get("type", "")
	var ShardProtocolClass = load("res://addons/shard_sdk/multiplayer/ShardProtocol.gd")
	
	match msg_type:
		ShardProtocolClass.MSG_PLAYER_DAMAGED:
			var attacker = int(message.get("attacker_peer_id", -1))
			var victim = int(message.get("victim_peer_id", -1))
			var damage = int(message.get("damage", 0))
			var health = int(message.get("health_remaining", 0))
			emit_signal("player_damaged", attacker, victim, damage, health)
		
		ShardProtocolClass.MSG_PLAYER_ELIMINATED:
			var peer_id = int(message.get("peer_id", -1))
			var killer = int(message.get("killer_peer_id", -1))
			emit_signal("player_eliminated", peer_id, killer)
		
		ShardProtocolClass.MSG_PLAYER_DISCONNECTED:
			var peer_id = int(message.get("peer_id", -1))
			var username = str(message.get("username", ""))
			emit_signal("player_disconnected", peer_id, username)
		
		ShardProtocolClass.MSG_PLAYER_RECONNECTED:
			var peer_id = int(message.get("peer_id", -1))
			var username = str(message.get("username", ""))
			emit_signal("player_reconnected", peer_id, username)
		
		ShardProtocolClass.MSG_PLAYER_TIMEOUT:
			var peer_id = int(message.get("peer_id", -1))
			var username = str(message.get("username", ""))
			emit_signal("player_timed_out", peer_id, username)
		
		ShardProtocolClass.MSG_WEAPON_PICKUP:
			var peer_id = int(message.get("peer_id", -1))
			var weapon_type = str(message.get("weapon_type", ""))
			emit_signal("weapon_picked_up", peer_id, weapon_type)
		
		ShardProtocolClass.MSG_WEAPON_DROPPED:
			var peer_id = int(message.get("peer_id", -1))
			var weapon_type = str(message.get("weapon_type", ""))
			var pos = Vector2(message.get("x", 0.0), message.get("y", 0.0))
			emit_signal("weapon_dropped", peer_id, weapon_type, pos)
		
		ShardProtocolClass.MSG_ERROR:
			_handle_error(message)


func _handle_error(message: Dictionary) -> void:
	var code = str(message.get("code", "unknown"))
	var error_message = str(message.get("message", "Unknown error"))
	
	_last_error = {
		"code": code,
		"message": error_message,
		"timestamp": OS.get_ticks_msec()
	}
	
	_log("Error received: %s - %s" % [code, error_message])
	
	var ShardProtocolClass = load("res://addons/shard_sdk/multiplayer/ShardProtocol.gd")
	if not ShardProtocolClass.is_lobby_error(code):
		emit_signal("error_received", code, error_message)


# =============================================================================
# Signal Handlers - Connection
# =============================================================================

func _on_connection_connected() -> void:
	_log("Connected to server")
	emit_signal("connected")


func _on_connection_disconnected(reason: String) -> void:
	_log("Disconnected: %s" % reason)
	_reset_game_state()
	emit_signal("disconnected", reason)


func _on_connection_authenticated(user_id: String, username: String) -> void:
	_log("Authenticated as %s (ID: %s)" % [username, user_id])
	emit_signal("authenticated", user_id, username)


func _on_connection_authentication_failed(reason: String) -> void:
	_log("Authentication failed: %s" % reason)
	_last_error = {
		"code": "authentication_failed",
		"message": reason,
		"timestamp": OS.get_ticks_msec()
	}
	emit_signal("authentication_failed", reason)


func _on_connection_reconnected() -> void:
	_log("Reconnected to server")
	if _prediction and _state:
		_prediction.initialize_from_server_state(_state)
	emit_signal("reconnected")


func _on_connection_reconnection_failed() -> void:
	_log("Reconnection failed")
	_reset_game_state()
	emit_signal("reconnection_failed")


func _on_connection_lost() -> void:
	_log("Connection lost")
	emit_signal("connection_lost")


func _on_connection_rate_limited() -> void:
	_log("Rate limited by server")
	_last_error = {
		"code": "rate_limited",
		"message": "Too many requests",
		"timestamp": OS.get_ticks_msec()
	}
	emit_signal("rate_limited")


func _on_connection_error(code: String, message: String) -> void:
	_log("Connection error: %s - %s" % [code, message])
	_last_error = {
		"code": code,
		"message": message,
		"timestamp": OS.get_ticks_msec()
	}
	emit_signal("error_received", code, message)


func _on_latency_updated(latency_ms: int) -> void:
	emit_signal("latency_updated", latency_ms)


# =============================================================================
# Signal Handlers - Lobby
# =============================================================================

func _on_lobby_created(lobby_code: String, players: Dictionary) -> void:
	_log("Lobby created: %s with %d players" % [lobby_code, players.size()])
	_sync_peer_id_to_prediction()
	emit_signal("lobby_created", lobby_code, players)


func _on_lobby_joined(lobby_code: String, players: Dictionary) -> void:
	_log("Joined lobby: %s with %d players" % [lobby_code, players.size()])
	_sync_peer_id_to_prediction()
	emit_signal("lobby_joined", lobby_code, players)


func _on_lobby_left() -> void:
	_log("Left lobby")
	emit_signal("lobby_left")


func _on_lobby_closed(reason: String) -> void:
	_log("Lobby closed: %s" % reason)
	_match.reset()
	emit_signal("lobby_closed", reason)


func _on_lobby_error(code: String, message: String) -> void:
	_log("Lobby error: %s - %s" % [code, message])
	_last_error = {
		"code": code,
		"message": message,
		"timestamp": OS.get_ticks_msec()
	}
	emit_signal("lobby_error", code, message)


func _on_player_joined(peer_id: int, username: String) -> void:
	_log("Player joined: %s (peer_id=%d)" % [username, peer_id])
	emit_signal("player_joined", peer_id, username)


func _on_player_left(peer_id: int, username: String, new_host_peer_id: int) -> void:
	_log("Player left: %s (peer_id=%d), new host: %d" % [username, peer_id, new_host_peer_id])
	emit_signal("player_left", peer_id, username, new_host_peer_id)


# =============================================================================
# Signal Handlers - Match
# =============================================================================

func _on_countdown(seconds: int) -> void:
	_log("Countdown: %d" % seconds)
	emit_signal("countdown", seconds)


func _on_round_started(round_number: int, spawn_positions: Array, weapon_spawns: Array) -> void:
	_log("Round %d started" % round_number)
	_input.reset()
	_initialize_prediction_for_round(spawn_positions)
	emit_signal("round_started", round_number, spawn_positions, weapon_spawns)


func _on_round_ended(winner_peer_id: int, scores: Dictionary) -> void:
	_log("Round ended - winner: %d" % winner_peer_id)
	emit_signal("round_ended", winner_peer_id, scores)


func _on_match_ended(winner_peer_id: int, winner_username: String, final_scores: Array) -> void:
	_log("Match ended - winner: %s (peer_id=%d)" % [winner_username, winner_peer_id])
	_connection.set_in_match(false)
	emit_signal("match_ended", winner_peer_id, winner_username, final_scores)


# =============================================================================
# Signal Handlers - State and Prediction
# =============================================================================

func _on_state_received(snapshot: Dictionary) -> void:
	emit_signal("state_received", snapshot)


func _on_prediction_corrected(server_pos: Vector2, predicted_pos: Vector2, correction_amount: float) -> void:
	_log("Prediction corrected: server=%s predicted=%s diff=%.2f" % [str(server_pos), str(predicted_pos), correction_amount])
	emit_signal("prediction_corrected", server_pos, predicted_pos, correction_amount)


# =============================================================================
# Helper Methods
# =============================================================================

func _sync_peer_id_to_prediction() -> void:
	if _lobby and _prediction:
		var peer_id = _lobby.get_my_peer_id()
		if peer_id >= 0:
			_prediction.set_my_peer_id(peer_id)


func _initialize_prediction_for_round(spawn_positions: Array) -> void:
	if not _prediction or not _lobby:
		return
	
	var my_peer_id = _lobby.get_my_peer_id()
	if my_peer_id < 0:
		return
	
	for spawn in spawn_positions:
		if spawn is Dictionary and spawn.get("peer_id", -1) == my_peer_id:
			var pos = Vector2(spawn.get("x", 0.0), spawn.get("y", 0.0))
			_prediction.set_position(pos)
			_prediction.set_velocity(Vector2.ZERO)
			_prediction.set_grounded(true)
			_log("Initialized prediction at spawn: %s" % str(pos))
			break


func _reset_game_state() -> void:
	if _lobby:
		_lobby.reset()
	if _match:
		_match.reset()
	if _input:
		_input.reset()
	if _state:
		_state.reset()
	if _prediction:
		_prediction.reset()


# =============================================================================
# Debug Logging
# =============================================================================

func _log(message: String) -> void:
	if _debug_logging:
		var timestamp = OS.get_ticks_msec()
		print("[ShardMultiplayer %d] %s" % [timestamp, message])
`;
};

export default shardMultiplayerTemplate;
