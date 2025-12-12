import { TemplateContext, TemplateFunction } from '../../../utils/templateEngine';

/**
 * Godot 4.x ShardConnection.gd template
 * Ported from Godot 3.x - uses WebSocketPeer instead of WebSocketClient
 */
export const shardConnectionTemplate: TemplateFunction = (context: TemplateContext): string => {
  return `class_name ShardConnection
extends RefCounted

## Shard Connection - WebSocket Management and Authentication

# Connection states
enum State { DISCONNECTED, CONNECTING, CONNECTED, AUTHENTICATED }

# =============================================================================
# Signals
# =============================================================================
signal connected()
signal disconnected(reason: String)
signal authenticated(user_id: String, username: String)
signal authentication_failed(reason: String)
signal reconnected()
signal reconnection_failed()
signal connection_lost()
signal rate_limited()
signal error_received(code: String, message: String)
signal message_received(message: Dictionary)
signal latency_updated(latency_ms: int)

# =============================================================================
# WebSocket
# =============================================================================
var _ws: WebSocketPeer = null

# Connection state
var _state: int = State.DISCONNECTED
var _token: String = ""
var _user_id: String = ""
var _username: String = ""

# Reconnection state
var _reconnect_attempts: int = 0
var _reconnect_timer: float = 0.0
var _is_reconnecting: bool = false
var _was_authenticated: bool = false
var _match_reconnect_timer: float = 0.0
var _in_match: bool = false

# Configuration
const SETTINGS_PREFIX = "shard_sdk/multiplayer/"
var server_host: String = "localhost"
var server_port: int = 9877
var auto_reconnect: bool = true
var reconnect_delay: float = 2.0
var max_reconnect_attempts: int = 5
var debug_logging: bool = false

# Constants
const MATCH_RECONNECT_TIMEOUT = 60.0
const PING_INTERVAL = 5.0
const LATENCY_BUFFER_SIZE = 5

# Statistics
var _messages_sent: int = 0
var _messages_received: int = 0
var _bytes_sent: int = 0
var _bytes_received: int = 0

# Latency measurement
var _ping_timer: float = 0.0
var _ping_sent_time: int = 0
var _current_latency: int = 0
var _latency_buffer: Array = []


func _init() -> void:
	_load_settings()


# =============================================================================
# Configuration
# =============================================================================

func _load_settings() -> void:
	server_host = _get_setting("server_host", "localhost")
	server_port = _get_setting("server_port", 9877)
	auto_reconnect = _get_setting("auto_reconnect", true)
	reconnect_delay = _get_setting("reconnect_delay", 2.0)
	max_reconnect_attempts = _get_setting("max_reconnect_attempts", 5)
	debug_logging = _get_setting("debug_logging", false)


func _get_setting(key: String, default_value: Variant) -> Variant:
	var full_key = SETTINGS_PREFIX + key
	if ProjectSettings.has_setting(full_key):
		return ProjectSettings.get_setting(full_key)
	return default_value


func set_debug_logging(enabled: bool) -> void:
	debug_logging = enabled


# =============================================================================
# Connection Management
# =============================================================================

func connect_to_server(token: String) -> void:
	if _state != State.DISCONNECTED:
		_log("Already connected or connecting")
		return
	
	_token = token
	_state = State.CONNECTING
	_is_reconnecting = false
	
	_ws = WebSocketPeer.new()
	
	var url = "ws://%s:%d" % [server_host, server_port]
	var headers = PackedStringArray(["Authorization: Bearer " + token])
	
	_log("Connecting to %s" % url)
	
	var err = _ws.connect_to_url(url, TLSOptions.client(), false, headers)
	if err != OK:
		_log("Failed to initiate connection: %d" % err)
		_state = State.DISCONNECTED
		disconnected.emit("Failed to initiate connection")


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
		_ws.close()
	
	_state = State.DISCONNECTED
	_clear_user_info()


func reconnect() -> void:
	if _state != State.DISCONNECTED:
		_log("Cannot reconnect - not disconnected")
		return
	
	if _token.is_empty():
		_log("Cannot reconnect - no token stored")
		reconnection_failed.emit()
		return
	
	_is_reconnecting = true
	_reconnect_attempts = 0
	_start_reconnection()


func send_message(message: Dictionary) -> void:
	if _state < State.CONNECTED:
		_log("Cannot send message - not connected")
		return
	
	if _ws == null:
		return
	
	var json_str = JSON.stringify(message)
	var data = json_str.to_utf8_buffer()
	
	_ws.send_text(json_str)
	
	_messages_sent += 1
	_bytes_sent += data.size()
	
	_log("Sent: %s" % json_str)


func poll(delta: float) -> void:
	if _ws:
		_ws.poll()
		
		var state = _ws.get_ready_state()
		match state:
			WebSocketPeer.STATE_OPEN:
				if _state == State.CONNECTING:
					_on_connected()
				_process_incoming()
			WebSocketPeer.STATE_CLOSING:
				pass
			WebSocketPeer.STATE_CLOSED:
				if _state != State.DISCONNECTED:
					_on_disconnected()
	
	# Handle reconnection timer
	if _is_reconnecting and _state == State.DISCONNECTED:
		_reconnect_timer -= delta
		if _reconnect_timer <= 0:
			_attempt_reconnect()
	
	# Handle ping timer
	if _state == State.AUTHENTICATED:
		_ping_timer += delta
		if _ping_timer >= PING_INTERVAL:
			_send_ping()
			_ping_timer = 0.0
	
	# Handle match reconnection timeout
	if _in_match and _is_reconnecting:
		_match_reconnect_timer += delta
		if _match_reconnect_timer >= MATCH_RECONNECT_TIMEOUT:
			_log("Match reconnection timeout exceeded")
			_is_reconnecting = false
			_in_match = false
			reconnection_failed.emit()


func _process_incoming() -> void:
	while _ws.get_available_packet_count() > 0:
		var packet = _ws.get_packet()
		var data = packet.get_string_from_utf8()
		
		_messages_received += 1
		_bytes_received += packet.size()
		
		_log("Received: %s" % data)
		
		var json = JSON.new()
		var err = json.parse(data)
		if err != OK:
			_log("Failed to parse JSON: %s" % json.get_error_message())
			continue
		
		var message = json.data
		if not message is Dictionary:
			_log("Invalid message format - expected Dictionary")
			continue
		
		if not message.has("type"):
			_log("Message missing 'type' field")
			continue
		
		if message.type == ShardProtocol.MSG_AUTHENTICATED:
			_handle_authenticated(message)
		elif message.type == ShardProtocol.MSG_PONG:
			_handle_pong(message)
		else:
			message_received.emit(message)


# =============================================================================
# State Accessors
# =============================================================================

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


# =============================================================================
# Latency Measurement
# =============================================================================

func get_latency() -> int:
	return _current_latency


func get_average_latency() -> int:
	if _latency_buffer.is_empty():
		return 0
	
	var sum = 0
	for latency in _latency_buffer:
		sum += latency
	
	return int(sum / _latency_buffer.size())


func _send_ping() -> void:
	_ping_sent_time = Time.get_ticks_msec()
	send_message({
		"type": ShardProtocol.MSG_PING,
		"timestamp": _ping_sent_time
	})
	_log("Ping sent at %d" % _ping_sent_time)


func _handle_pong(message: Dictionary) -> void:
	var current_time = Time.get_ticks_msec()
	var rtt = current_time - _ping_sent_time
	
	_current_latency = rtt
	
	_latency_buffer.append(rtt)
	if _latency_buffer.size() > LATENCY_BUFFER_SIZE:
		_latency_buffer.pop_front()
	
	_log("Pong received - RTT: %d ms, Average: %d ms" % [rtt, get_average_latency()])
	
	latency_updated.emit(rtt)


# =============================================================================
# Connection Event Handlers
# =============================================================================

func _on_connected() -> void:
	_log("WebSocket connected")
	_state = State.CONNECTED
	connected.emit()


func _on_disconnected() -> void:
	var close_code = _ws.get_close_code() if _ws else 0
	
	_log("WebSocket disconnected (code: %d)" % close_code)
	
	var previous_state = _state
	_state = State.DISCONNECTED
	
	match close_code:
		ShardProtocol.CLOSE_INVALID_SESSION:
			_log("Authentication failed - invalid or expired session")
			_clear_user_info()
			authentication_failed.emit("Invalid or expired session")
			return
		
		ShardProtocol.CLOSE_RATE_LIMITED:
			_log("Rate limited by server")
			rate_limited.emit()
			return
		
		ShardProtocol.CLOSE_MESSAGE_TOO_LARGE:
			_log("Message exceeded size limit")
			error_received.emit("message_too_large", "Message exceeded 4KB limit")
	
	if previous_state == State.AUTHENTICATED and auto_reconnect:
		_was_authenticated = true
		connection_lost.emit()
		_start_reconnection()
	else:
		disconnected.emit("Connection closed")


# =============================================================================
# Authentication Handling
# =============================================================================

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
		reconnected.emit()
	else:
		authenticated.emit(_user_id, _username)


func _clear_user_info() -> void:
	_user_id = ""
	_username = ""


# =============================================================================
# Reconnection Logic
# =============================================================================

func _start_reconnection() -> void:
	if _token.is_empty():
		_log("Cannot reconnect - no token available")
		reconnection_failed.emit()
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
		reconnection_failed.emit()
		return
	
	if _in_match and _match_reconnect_timer >= MATCH_RECONNECT_TIMEOUT:
		_log("Match reconnection timeout exceeded")
		_is_reconnecting = false
		_in_match = false
		reconnection_failed.emit()
		return
	
	_ws = null
	
	_state = State.CONNECTING
	_ws = WebSocketPeer.new()
	
	var headers = PackedStringArray(["Authorization: Bearer " + _token])
	var url = "ws://%s:%d" % [server_host, server_port]
	
	var err = _ws.connect_to_url(url, TLSOptions.client(), false, headers)
	if err != OK:
		_log("Failed to initiate reconnection: %d" % err)
		_state = State.DISCONNECTED
		_schedule_reconnect()


# =============================================================================
# Logging
# =============================================================================

func _log(message: String) -> void:
	if debug_logging:
		var timestamp = Time.get_ticks_msec()
		print("[ShardConnection %d] %s" % [timestamp, message])
`;
};

export default shardConnectionTemplate;
