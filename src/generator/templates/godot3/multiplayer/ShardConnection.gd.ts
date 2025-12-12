import { TemplateContext, TemplateFunction } from '../../../utils/templateEngine';

/**
 * Godot 3.x ShardConnection.gd template
 * WebSocket connection management - uses Godot 3 syntax (WebSocketClient)
 */
export const shardConnectionTemplate: TemplateFunction = (context: TemplateContext): string => {
  return `extends Reference
class_name ShardConnection

# =============================================================================
# Shard Connection - WebSocket Management and Authentication
# Generated for ${context.gameName} (Godot ${context.godotVersion})
# =============================================================================

enum State { DISCONNECTED, CONNECTING, CONNECTED, AUTHENTICATED }

signal connected()
signal disconnected(reason)
signal authenticated(user_id, username)
signal authentication_failed(reason)
signal reconnected()
signal reconnection_failed()
signal connection_lost()
signal rate_limited()
signal error_received(code, message)
signal message_received(message)
signal latency_updated(latency_ms)

var _ws: WebSocketClient = null
var _state: int = State.DISCONNECTED
var _token: String = ""
var _user_id: String = ""
var _username: String = ""

var _reconnect_attempts: int = 0
var _reconnect_timer: float = 0.0
var _is_reconnecting: bool = false
var _was_authenticated: bool = false
var _match_reconnect_timer: float = 0.0
var _in_match: bool = false

var server_host: String = "localhost"
var server_port: int = 9877
var auto_reconnect: bool = true
var reconnect_delay: float = 2.0
var max_reconnect_attempts: int = 5
var debug_logging: bool = false

const MATCH_RECONNECT_TIMEOUT = 60.0
const SETTINGS_PREFIX = "shard_sdk/multiplayer/"
const PING_INTERVAL = 5.0
const LATENCY_BUFFER_SIZE = 5

var _messages_sent: int = 0
var _messages_received: int = 0
var _bytes_sent: int = 0
var _bytes_received: int = 0

var _ping_timer: float = 0.0
var _ping_sent_time: int = 0
var _current_latency: int = 0
var _latency_buffer: Array = []


func _init() -> void:
	_load_settings()


func _load_settings() -> void:
	server_host = _get_setting("server_host", "localhost")
	server_port = _get_setting("server_port", 9877)
	auto_reconnect = _get_setting("auto_reconnect", true)
	reconnect_delay = _get_setting("reconnect_delay", 2.0)
	max_reconnect_attempts = _get_setting("max_reconnect_attempts", 5)
	debug_logging = _get_setting("debug_logging", false)


func _get_setting(key: String, default_value):
	var full_key = SETTINGS_PREFIX + key
	if ProjectSettings.has_setting(full_key):
		return ProjectSettings.get_setting(full_key)
	return default_value


func set_debug_logging(enabled: bool) -> void:
	debug_logging = enabled


func connect_to_server(token: String) -> void:
	if _state != State.DISCONNECTED:
		_log("Already connected or connecting")
		return
	
	_token = token
	_state = State.CONNECTING
	_is_reconnecting = false
	
	_ws = WebSocketClient.new()
	_ws.connect("connection_established", self, "_on_connected")
	_ws.connect("connection_closed", self, "_on_disconnected")
	_ws.connect("connection_error", self, "_on_error")
	_ws.connect("data_received", self, "_on_data")
	
	var headers = PoolStringArray(["Authorization: Bearer " + token])
	var url = "ws://%s:%d" % [server_host, server_port]
	
	_log("Connecting to %s" % url)
	
	var err = _ws.connect_to_url(url, PoolStringArray(), false, headers)
	if err != OK:
		_log("Failed to initiate connection: %d" % err)
		_state = State.DISCONNECTED
		emit_signal("disconnected", "Failed to initiate connection")


func disconnect_from_server() -> void:
	_log("Disconnecting from server")
	_is_reconnecting = false
	_reconnect_attempts = 0
	_was_authenticated = false
	_in_match = false
	_ping_timer = 0.0
	_latency_buffer.clear()
	_current_latency = 0
	
	if _ws:
		_ws.disconnect_from_host()
	
	_state = State.DISCONNECTED
	_clear_user_info()


func reconnect() -> void:
	if _state != State.DISCONNECTED:
		_log("Cannot reconnect - not disconnected")
		return
	
	if _token.empty():
		_log("Cannot reconnect - no token stored")
		emit_signal("reconnection_failed")
		return
	
	_is_reconnecting = true
	_reconnect_attempts = 0
	_start_reconnection()


func send_message(message: Dictionary) -> void:
	if _state < State.CONNECTED:
		_log("Cannot send message - not connected")
		return
	
	if not _ws:
		return
	
	var json_str = JSON.print(message)
	var data = json_str.to_utf8()
	
	_ws.get_peer(1).put_packet(data)
	
	_messages_sent += 1
	_bytes_sent += data.size()
	
	_log("Sent: %s" % json_str)


func poll(delta: float) -> void:
	if _ws:
		_ws.poll()
	
	if _is_reconnecting and _state == State.DISCONNECTED:
		_reconnect_timer -= delta
		if _reconnect_timer <= 0:
			_attempt_reconnect()
	
	if _state == State.AUTHENTICATED:
		_ping_timer += delta
		if _ping_timer >= PING_INTERVAL:
			_send_ping()
			_ping_timer = 0.0
	
	if _in_match and _is_reconnecting:
		_match_reconnect_timer += delta
		if _match_reconnect_timer >= MATCH_RECONNECT_TIMEOUT:
			_log("Match reconnection timeout exceeded")
			_is_reconnecting = false
			_in_match = false
			emit_signal("reconnection_failed")


func is_connected() -> bool:
	return _state >= State.CONNECTED


func is_authenticated() -> bool:
	return _state == State.AUTHENTICATED


func is_reconnecting() -> bool:
	return _is_reconnecting


func get_reconnect_attempts() -> int:
	return _reconnect_attempts


func get_state() -> int:
	return _state


func get_state_string() -> String:
	match _state:
		State.DISCONNECTED:
			return "disconnected"
		State.CONNECTING:
			return "connecting"
		State.CONNECTED:
			return "connected"
		State.AUTHENTICATED:
			return "authenticated"
	return "unknown"


func get_user_id() -> String:
	return _user_id


func get_username() -> String:
	return _username


func get_stats() -> Dictionary:
	return {
		"messages_sent": _messages_sent,
		"messages_received": _messages_received,
		"bytes_sent": _bytes_sent,
		"bytes_received": _bytes_received
	}


func set_in_match(in_match: bool) -> void:
	_in_match = in_match


func get_latency() -> int:
	return _current_latency


func get_average_latency() -> int:
	if _latency_buffer.empty():
		return 0
	
	var sum = 0
	for latency in _latency_buffer:
		sum += latency
	
	return int(sum / _latency_buffer.size())


func _send_ping() -> void:
	var ShardProtocolClass = load("res://addons/shard_sdk/multiplayer/ShardProtocol.gd")
	_ping_sent_time = OS.get_ticks_msec()
	send_message({
		"type": ShardProtocolClass.MSG_PING,
		"timestamp": _ping_sent_time
	})
	_log("Ping sent at %d" % _ping_sent_time)


func _handle_pong(message: Dictionary) -> void:
	var current_time = OS.get_ticks_msec()
	var rtt = current_time - _ping_sent_time
	
	_current_latency = rtt
	
	_latency_buffer.append(rtt)
	if _latency_buffer.size() > LATENCY_BUFFER_SIZE:
		_latency_buffer.pop_front()
	
	_log("Pong received - RTT: %d ms, Average: %d ms" % [rtt, get_average_latency()])
	emit_signal("latency_updated", rtt)


func _on_connected(protocol: String) -> void:
	_log("WebSocket connected (protocol: %s)" % protocol)
	_state = State.CONNECTED
	emit_signal("connected")


func _on_data() -> void:
	var packet = _ws.get_peer(1).get_packet()
	var data = packet.get_string_from_utf8()
	
	_messages_received += 1
	_bytes_received += packet.size()
	
	_log("Received: %s" % data)
	
	var parsed = JSON.parse(data)
	if parsed.error != OK:
		_log("Failed to parse JSON: %s" % parsed.error_string)
		return
	
	var message = parsed.result
	if not message is Dictionary:
		_log("Invalid message format - expected Dictionary")
		return
	
	if not message.has("type"):
		_log("Message missing 'type' field")
		return
	
	var ShardProtocolClass = load("res://addons/shard_sdk/multiplayer/ShardProtocol.gd")
	if message.type == ShardProtocolClass.MSG_AUTHENTICATED:
		_handle_authenticated(message)
	elif message.type == ShardProtocolClass.MSG_PONG:
		_handle_pong(message)
	else:
		emit_signal("message_received", message)


func _on_disconnected(was_clean: bool) -> void:
	var close_code = 0
	if _ws:
		close_code = _ws.get_close_code()
	
	_log("WebSocket disconnected (clean: %s, code: %d)" % [was_clean, close_code])
	
	var previous_state = _state
	_state = State.DISCONNECTED
	
	var ShardProtocolClass = load("res://addons/shard_sdk/multiplayer/ShardProtocol.gd")
	match close_code:
		ShardProtocolClass.CLOSE_INVALID_SESSION:
			_log("Authentication failed - invalid or expired session")
			_clear_user_info()
			emit_signal("authentication_failed", "Invalid or expired session")
			return
		
		ShardProtocolClass.CLOSE_RATE_LIMITED:
			_log("Rate limited by server")
			emit_signal("rate_limited")
			return
		
		ShardProtocolClass.CLOSE_MESSAGE_TOO_LARGE:
			_log("Message exceeded size limit")
			emit_signal("error_received", "message_too_large", "Message exceeded 4KB limit")
	
	if previous_state == State.AUTHENTICATED and auto_reconnect:
		_was_authenticated = true
		emit_signal("connection_lost")
		_start_reconnection()
	else:
		emit_signal("disconnected", "Connection closed")


func _on_error() -> void:
	_log("WebSocket connection error")
	
	if _is_reconnecting:
		_reconnect_attempts += 1
		if _reconnect_attempts < max_reconnect_attempts:
			_schedule_reconnect()
		else:
			_log("Max reconnection attempts reached")
			_is_reconnecting = false
			emit_signal("reconnection_failed")
	else:
		_state = State.DISCONNECTED
		emit_signal("disconnected", "Connection error")


func _handle_authenticated(message: Dictionary) -> void:
	if not message.has("user"):
		_log("Authenticated message missing 'user' field")
		return
	
	var user = message.user
	if not user.has("id") or not user.has("username"):
		_log("User info missing required fields")
		return
	
	_user_id = str(user.id)
	_username = str(user.username)
	_state = State.AUTHENTICATED
	
	_log("Authenticated as %s (ID: %s)" % [_username, _user_id])
	
	if _is_reconnecting:
		_is_reconnecting = false
		_reconnect_attempts = 0
		_match_reconnect_timer = 0.0
		emit_signal("reconnected")
	else:
		emit_signal("authenticated", _user_id, _username)


func _clear_user_info() -> void:
	_user_id = ""
	_username = ""


func _start_reconnection() -> void:
	if _token.empty():
		_log("Cannot reconnect - no token available")
		emit_signal("reconnection_failed")
		return
	
	_is_reconnecting = true
	_reconnect_attempts = 0
	_match_reconnect_timer = 0.0
	_schedule_reconnect()


func _schedule_reconnect() -> void:
	var delay = reconnect_delay * pow(2, _reconnect_attempts)
	delay = min(delay, 30.0)
	
	_reconnect_timer = delay
	_log("Scheduling reconnection attempt %d in %.1f seconds" % [_reconnect_attempts + 1, delay])


func _attempt_reconnect() -> void:
	if not _is_reconnecting:
		return
	
	_reconnect_attempts += 1
	_log("Reconnection attempt %d of %d" % [_reconnect_attempts, max_reconnect_attempts])
	
	if _reconnect_attempts > max_reconnect_attempts:
		_log("Max reconnection attempts exceeded")
		_is_reconnecting = false
		emit_signal("reconnection_failed")
		return
	
	if _in_match and _match_reconnect_timer >= MATCH_RECONNECT_TIMEOUT:
		_log("Match reconnection timeout exceeded")
		_is_reconnecting = false
		_in_match = false
		emit_signal("reconnection_failed")
		return
	
	if _ws:
		_ws.disconnect("connection_established", self, "_on_connected")
		_ws.disconnect("connection_closed", self, "_on_disconnected")
		_ws.disconnect("connection_error", self, "_on_error")
		_ws.disconnect("data_received", self, "_on_data")
		_ws = null
	
	_state = State.CONNECTING
	_ws = WebSocketClient.new()
	_ws.connect("connection_established", self, "_on_connected")
	_ws.connect("connection_closed", self, "_on_disconnected")
	_ws.connect("connection_error", self, "_on_error")
	_ws.connect("data_received", self, "_on_data")
	
	var headers = PoolStringArray(["Authorization: Bearer " + _token])
	var url = "ws://%s:%d" % [server_host, server_port]
	
	var err = _ws.connect_to_url(url, PoolStringArray(), false, headers)
	if err != OK:
		_log("Failed to initiate reconnection: %d" % err)
		_state = State.DISCONNECTED
		_schedule_reconnect()


func _log(message: String) -> void:
	if debug_logging:
		var timestamp = OS.get_ticks_msec()
		print("[ShardConnection %d] %s" % [timestamp, message])
`;
};

export default shardConnectionTemplate;
