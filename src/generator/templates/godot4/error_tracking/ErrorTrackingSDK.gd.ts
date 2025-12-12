import { TemplateContext, TemplateFunction } from '../../../utils/templateEngine';

/**
 * Godot 4.x ErrorTrackingSDK.gd template
 * Based on existing ErrorTrackingSDK.gd which is already Godot 4 compatible
 */
export const errorTrackingSDKTemplate: TemplateFunction = (context: TemplateContext): string => {
  return `extends Node
class_name ErrorTrackingSDK

## Shard Error Tracking SDK for Godot 4.x
## Provides error tracking, breadcrumbs, metrics, and session management via WebSocket

# =============================================================================
# Signals
# =============================================================================

signal connected()
signal disconnected()
signal error_captured(error_id: String)
signal metric_tracked(metric_id: String)

# =============================================================================
# Constants
# =============================================================================

const MAX_QUEUE_SIZE: int = 100
const CONNECTION_TIMEOUT_MS: int = 5000
const RECONNECT_DELAY_SEC: float = 5.0
const HEARTBEAT_INTERVAL_SEC: float = 30.0

# WebSocket states
enum ConnectionState { DISCONNECTED, CONNECTING, CONNECTED }

# =============================================================================
# Configuration
# =============================================================================

const SETTINGS_PREFIX = "shard_sdk/error_tracking/"

var server_url: String = "ws://localhost:9877"
var game_id: String = ""
var auto_connect: bool = true
var auto_capture_errors: bool = true
var max_breadcrumbs: int = 50
var enable_debug_logging: bool = false
var sample_rate: float = 1.0

# =============================================================================
# Internal State
# =============================================================================

var _websocket: WebSocketPeer = null
var _connection_state: ConnectionState = ConnectionState.DISCONNECTED
var _session_id: String = ""
var _device_info: Dictionary = {}
var _user_info: Dictionary = {}
var _global_tags: Dictionary = {}
var _global_context: Dictionary = {}
var _breadcrumbs: Array[Dictionary] = []
var _event_queue: Array[Dictionary] = []

# Timers
var _reconnect_timer: Timer = null
var _heartbeat_timer: Timer = null
var _connection_start_time: int = 0


func _ready() -> void:
	_load_configuration()
	_session_id = _generate_uuid()
	_device_info = _collect_device_info()
	_setup_timers()
	
	if auto_connect and not game_id.is_empty():
		connect_to_server()


func _process(_delta: float) -> void:
	if _websocket == null:
		return
	
	_websocket.poll()
	var state = _websocket.get_ready_state()
	
	match state:
		WebSocketPeer.STATE_OPEN:
			if _connection_state == ConnectionState.CONNECTING:
				_on_connection_opened()
			_process_incoming_messages()
		WebSocketPeer.STATE_CLOSING:
			pass
		WebSocketPeer.STATE_CLOSED:
			if _connection_state != ConnectionState.DISCONNECTED:
				_on_connection_closed()
	
	# Check connection timeout
	if _connection_state == ConnectionState.CONNECTING:
		if Time.get_ticks_msec() - _connection_start_time > CONNECTION_TIMEOUT_MS:
			_log_debug("Connection timeout")
			_on_connection_closed()


func _load_configuration() -> void:
	server_url = _get_setting("server_url", server_url)
	game_id = _get_setting("game_id", game_id)
	auto_connect = _get_setting("auto_connect", auto_connect)
	auto_capture_errors = _get_setting("auto_capture_errors", auto_capture_errors)
	max_breadcrumbs = _get_setting("max_breadcrumbs", max_breadcrumbs)
	enable_debug_logging = _get_setting("enable_debug_logging", enable_debug_logging)
	sample_rate = _get_setting("sample_rate", sample_rate)


func _get_setting(key: String, default_value: Variant) -> Variant:
	var full_key = SETTINGS_PREFIX + key
	if ProjectSettings.has_setting(full_key):
		return ProjectSettings.get_setting(full_key)
	return default_value


func _setup_timers() -> void:
	_reconnect_timer = Timer.new()
	_reconnect_timer.one_shot = true
	_reconnect_timer.wait_time = RECONNECT_DELAY_SEC
	_reconnect_timer.timeout.connect(_on_reconnect_timer_timeout)
	add_child(_reconnect_timer)
	
	_heartbeat_timer = Timer.new()
	_heartbeat_timer.one_shot = false
	_heartbeat_timer.wait_time = HEARTBEAT_INTERVAL_SEC
	_heartbeat_timer.timeout.connect(_on_heartbeat_timer_timeout)
	add_child(_heartbeat_timer)


# =============================================================================
# Connection Management
# =============================================================================

func connect_to_server() -> void:
	if _connection_state != ConnectionState.DISCONNECTED:
		_log_debug("Already connected or connecting")
		return
	
	if game_id.is_empty():
		push_error("ErrorTrackingSDK: game_id is required")
		return
	
	_websocket = WebSocketPeer.new()
	var err = _websocket.connect_to_url(server_url)
	
	if err != OK:
		push_error("ErrorTrackingSDK: Failed to connect to server: " + str(err))
		_start_reconnect_timer()
		return
	
	_connection_state = ConnectionState.CONNECTING
	_connection_start_time = Time.get_ticks_msec()
	_log_debug("Connecting to " + server_url)


func disconnect_from_server() -> void:
	if _websocket == null:
		return
	
	_heartbeat_timer.stop()
	_reconnect_timer.stop()
	_websocket.close()
	_connection_state = ConnectionState.DISCONNECTED
	_websocket = null
	_log_debug("Disconnected from server")


func is_connected() -> bool:
	return _connection_state == ConnectionState.CONNECTED


func _on_connection_opened() -> void:
	_connection_state = ConnectionState.CONNECTED
	_log_debug("Connected to server")
	_send_handshake()
	_heartbeat_timer.start()
	_flush_queue()
	connected.emit()


func _on_connection_closed() -> void:
	var was_connected = _connection_state == ConnectionState.CONNECTED
	_connection_state = ConnectionState.DISCONNECTED
	_heartbeat_timer.stop()
	_websocket = null
	
	if was_connected:
		disconnected.emit()
	
	if auto_connect:
		_start_reconnect_timer()


func _send_handshake() -> void:
	var handshake = {
		"type": "handshake",
		"game_id": game_id,
		"session_id": _session_id,
		"device_info": _device_info,
		"sdk_version": "1.0.0",
		"timestamp": _get_iso_timestamp()
	}
	_send_message(handshake)


func _process_incoming_messages() -> void:
	while _websocket.get_available_packet_count() > 0:
		var packet = _websocket.get_packet()
		var message = packet.get_string_from_utf8()
		_handle_server_message(message)


func _handle_server_message(message: String) -> void:
	var json = JSON.new()
	var err = json.parse(message)
	if err != OK:
		_log_debug("Failed to parse server message: " + message)
		return
	
	var data = json.data
	if data is Dictionary:
		match data.get("type", ""):
			"pong":
				_log_debug("Received pong")
			"ack":
				_log_debug("Event acknowledged: " + str(data.get("id", "")))
			_:
				_log_debug("Unknown message type: " + str(data.get("type", "")))


func _send_message(data: Dictionary) -> void:
	if _websocket == null or _connection_state != ConnectionState.CONNECTED:
		return
	
	var json_str = JSON.stringify(data)
	_websocket.send_text(json_str)


func _start_reconnect_timer() -> void:
	if not _reconnect_timer.is_stopped():
		return
	_log_debug("Reconnecting in " + str(RECONNECT_DELAY_SEC) + " seconds")
	_reconnect_timer.start()


func _on_reconnect_timer_timeout() -> void:
	connect_to_server()


func _on_heartbeat_timer_timeout() -> void:
	if is_connected():
		var ping = {
			"type": "ping",
			"timestamp": _get_iso_timestamp()
		}
		_send_message(ping)
		_log_debug("Sent ping")


# =============================================================================
# Device Info & Session
# =============================================================================

func _collect_device_info() -> Dictionary:
	return {
		"os_name": OS.get_name(),
		"os_version": OS.get_version(),
		"processor_name": OS.get_processor_name(),
		"processor_count": OS.get_processor_count(),
		"gpu_name": _get_gpu_name(),
		"gpu_vendor": _get_gpu_vendor(),
		"godot_version": Engine.get_version_info().string,
		"locale": OS.get_locale(),
		"screen_size": _get_screen_size()
	}


func _get_gpu_name() -> String:
	var info = RenderingServer.get_video_adapter_name()
	return info if not info.is_empty() else "Unknown"


func _get_gpu_vendor() -> String:
	var info = RenderingServer.get_video_adapter_vendor()
	return info if not info.is_empty() else "Unknown"


func _get_screen_size() -> String:
	var size = DisplayServer.screen_get_size()
	return str(size.x) + "x" + str(size.y)


func _generate_uuid() -> String:
	var chars = "0123456789abcdef"
	var uuid = ""
	for i in range(32):
		if i == 8 or i == 12 or i == 16 or i == 20:
			uuid += "-"
		if i == 12:
			uuid += "4"
		elif i == 16:
			uuid += chars[randi() % 4 + 8]
		else:
			uuid += chars[randi() % 16]
	return uuid


# =============================================================================
# Event Queue Management
# =============================================================================

func _send_or_queue(event: Dictionary) -> void:
	if is_connected():
		_send_message(event)
	else:
		_queue_event(event)


func _queue_event(event: Dictionary) -> void:
	_event_queue.append(event)
	
	while _event_queue.size() > MAX_QUEUE_SIZE:
		_event_queue.pop_front()
		_log_debug("Queue full, discarded oldest event")


func _flush_queue() -> void:
	if _event_queue.is_empty():
		return
	
	_log_debug("Flushing " + str(_event_queue.size()) + " queued events")
	
	for event in _event_queue:
		_send_message(event)
	
	_event_queue.clear()


# =============================================================================
# Error Capture
# =============================================================================

func capture_error(error_type: String, message: String, error_context: Dictionary = {}) -> String:
	if not _should_sample():
		return ""
	
	var error_id = _generate_uuid()
	var stack_trace = _get_stack_trace()
	
	var merged_context = _global_context.duplicate(true)
	merged_context.merge(error_context, true)
	
	var merged_tags = _global_tags.duplicate(true)
	
	var event = {
		"id": error_id,
		"type": "error",
		"error_type": error_type,
		"message": message,
		"stack_trace": stack_trace,
		"breadcrumbs": _breadcrumbs.duplicate(true),
		"context": merged_context,
		"tags": merged_tags,
		"device_info": _device_info,
		"user_info": _user_info.duplicate(true) if not _user_info.is_empty() else null,
		"session_id": _session_id,
		"timestamp": _get_iso_timestamp()
	}
	
	_send_or_queue(event)
	error_captured.emit(error_id)
	_log_debug("Captured error: " + error_id)
	
	return error_id


func capture_exception(exception_message: String, stack: Array = []) -> String:
	if not _should_sample():
		return ""
	
	var error_id = _generate_uuid()
	var stack_trace = stack if not stack.is_empty() else _get_stack_trace()
	
	var event = {
		"id": error_id,
		"type": "error",
		"error_type": "exception",
		"message": exception_message,
		"stack_trace": stack_trace,
		"breadcrumbs": _breadcrumbs.duplicate(true),
		"context": _global_context.duplicate(true),
		"tags": _global_tags.duplicate(true),
		"device_info": _device_info,
		"user_info": _user_info.duplicate(true) if not _user_info.is_empty() else null,
		"session_id": _session_id,
		"timestamp": _get_iso_timestamp()
	}
	
	_send_or_queue(event)
	error_captured.emit(error_id)
	_log_debug("Captured exception: " + error_id)
	
	return error_id


func _get_stack_trace() -> Array:
	var stack = get_stack()
	var formatted_stack: Array = []
	
	for i in range(2, stack.size()):
		var frame = stack[i]
		formatted_stack.append({
			"function": frame.get("function", "unknown"),
			"source": frame.get("source", "unknown"),
			"line": frame.get("line", 0)
		})
	
	return formatted_stack


# =============================================================================
# Breadcrumb Management
# =============================================================================

func add_breadcrumb(message: String, category: String = "default", data: Dictionary = {}) -> void:
	var breadcrumb = {
		"message": message,
		"category": category,
		"timestamp": _get_iso_timestamp()
	}
	
	if not data.is_empty():
		breadcrumb["data"] = data
	
	_breadcrumbs.append(breadcrumb)
	
	while _breadcrumbs.size() > max_breadcrumbs:
		_breadcrumbs.pop_front()


func clear_breadcrumbs() -> void:
	_breadcrumbs.clear()


# =============================================================================
# Metric Tracking
# =============================================================================

func track_metric(metric_name: String, value: float, tags: Dictionary = {}, unit: String = "") -> String:
	if not _should_sample():
		return ""
	
	var metric_id = _generate_uuid()
	
	var merged_tags = _global_tags.duplicate(true)
	merged_tags.merge(tags, true)
	
	var event = {
		"id": metric_id,
		"type": "metric",
		"metric_type": "gauge",
		"metric_name": metric_name,
		"value": value,
		"unit": unit,
		"tags": merged_tags,
		"session_id": _session_id,
		"timestamp": _get_iso_timestamp()
	}
	
	_send_or_queue(event)
	metric_tracked.emit(metric_id)
	_log_debug("Tracked metric: " + metric_name + " = " + str(value))
	
	return metric_id


func track_recording_metric(recording_id: String, duration_seconds: float, file_size_bytes: int, quality: String, event_id: String = "") -> void:
	var base_tags = {
		"recording_id": recording_id,
		"quality": quality
	}
	
	if not event_id.is_empty():
		base_tags["event_id"] = event_id
	
	track_metric("recording_duration", duration_seconds, base_tags, "seconds")
	track_metric("recording_size", float(file_size_bytes), base_tags, "bytes")


# =============================================================================
# User Context Management
# =============================================================================

func set_user(user_id: String, username: String = "", email: String = "") -> void:
	_user_info = {
		"user_id": user_id
	}
	
	if not username.is_empty():
		_user_info["username"] = username
	
	if not email.is_empty():
		_user_info["email"] = email


func clear_user() -> void:
	_user_info.clear()


# =============================================================================
# Tag Management
# =============================================================================

func set_tag(key: String, value: String) -> void:
	_global_tags[key] = value


func remove_tag(key: String) -> void:
	_global_tags.erase(key)


# =============================================================================
# Context Management
# =============================================================================

func set_context(key: String, data: Dictionary) -> void:
	_global_context[key] = data


func remove_context(key: String) -> void:
	_global_context.erase(key)


# =============================================================================
# Sampling
# =============================================================================

func _should_sample() -> bool:
	if sample_rate >= 1.0:
		return true
	if sample_rate <= 0.0:
		return false
	return randf() < sample_rate


# =============================================================================
# Utilities
# =============================================================================

func _get_iso_timestamp() -> String:
	var datetime = Time.get_datetime_dict_from_system(true)
	return "%04d-%02d-%02dT%02d:%02d:%02dZ" % [
		datetime.year,
		datetime.month,
		datetime.day,
		datetime.hour,
		datetime.minute,
		datetime.second
	]


func _log_debug(message: String) -> void:
	if enable_debug_logging:
		print("[ErrorTrackingSDK] " + message)
`;
};

export default errorTrackingSDKTemplate;
