import { TemplateContext, TemplateFunction } from '../../../utils/templateEngine';

/**
 * Godot 4.x RecordingSDK.gd template
 * Ported from Godot 3.x to use Godot 4 syntax:
 * - WebSocketPeer instead of WebSocketClient
 * - await instead of yield
 * - .signal.connect() instead of .connect("signal", ...)
 * - .is_empty() instead of .empty()
 */
export const recordingSDKTemplate: TemplateFunction = (context: TemplateContext): string => {
  return `extends Node
class_name RecordingSDK

## Recording SDK for Godot 4.x
## 
## Communicate with the Shard Launcher to automatically record gameplay moments.
##
## Usage:
##   # Start recording an event
##   var recording_id = await ShardSDK.recording.start_recording("boss_defeated")
##   
##   # Stop recording after gameplay moment
##   await ShardSDK.recording.stop_recording(recording_id, 3.0)

# =============================================================================
# Signals
# =============================================================================

signal connected_to_recorder()
signal disconnected_from_recorder()
signal recording_started(recording_id: String)
signal recording_stopped(recording_id: String, file_path: String)
signal settings_received(auto_record_enabled: bool, max_duration: int, video_quality: String)
signal event_registered(event_id: String)
signal error_occurred(error_message: String)
signal server_shutdown(reconnect_delay_ms: int)

# =============================================================================
# Configuration
# =============================================================================

const SETTINGS_PREFIX = "shard_sdk/recording/"

var server_url: String = "ws://localhost:9876"
var auto_connect: bool = true
var auto_reconnect: bool = true
var reconnect_delay: float = 2.0
var max_reconnect_attempts: int = 5
var debug_logging: bool = false

# =============================================================================
# Runtime State
# =============================================================================

var _websocket: WebSocketPeer = null
var _is_connected: bool = false
var _reconnect_attempts: int = 0
var _current_recording_id: String = ""
var _is_reconnecting: bool = false

# Settings from launcher
var _auto_record_enabled: bool = true
var _max_recording_duration: int = 300
var _video_quality: String = "high"

# Timers
var _reconnect_timer: Timer = null
var _heartbeat_timer: Timer = null


func _ready() -> void:
	_load_settings()
	_setup_timers()
	
	if auto_connect:
		call_deferred("connect_to_recorder")


func _process(_delta: float) -> void:
	if _websocket == null:
		return
	
	_websocket.poll()
	var state = _websocket.get_ready_state()
	
	match state:
		WebSocketPeer.STATE_OPEN:
			if not _is_connected:
				_on_connection_established()
			_process_incoming_messages()
		WebSocketPeer.STATE_CLOSING:
			pass
		WebSocketPeer.STATE_CLOSED:
			if _is_connected:
				_on_connection_closed()


func _setup_timers() -> void:
	_reconnect_timer = Timer.new()
	_reconnect_timer.one_shot = true
	_reconnect_timer.wait_time = reconnect_delay
	_reconnect_timer.timeout.connect(_on_reconnect_timer_timeout)
	add_child(_reconnect_timer)
	
	_heartbeat_timer = Timer.new()
	_heartbeat_timer.one_shot = false
	_heartbeat_timer.wait_time = 30.0
	_heartbeat_timer.timeout.connect(_on_heartbeat_timer_timeout)
	add_child(_heartbeat_timer)


# =============================================================================
# Public API - Connection
# =============================================================================

func connect_to_recorder() -> void:
	if _is_connected:
		_log("Already connected")
		return
	
	_log("Connecting to recorder at %s..." % server_url)
	
	_websocket = WebSocketPeer.new()
	var err = _websocket.connect_to_url(server_url)
	
	if err != OK:
		push_error("[RecordingSDK] Failed to connect: %s" % err)
		error_occurred.emit("Failed to connect to recorder")
		_start_reconnect_timer()


func disconnect_from_recorder() -> void:
	if _websocket != null:
		_websocket.close()
		_websocket = null
	
	_is_connected = false
	_is_reconnecting = false
	_heartbeat_timer.stop()
	_log("Disconnected")


# =============================================================================
# Public API - Recording
# =============================================================================

## Start recording with an event identifier
## event_id format: {gameName}_{8hexChars} (e.g., "everplast_a1b2c3d4")
## Returns the recording ID if successful, empty string otherwise
func start_recording(event_id: String) -> String:
	if not _is_connected:
		push_error("[RecordingSDK] Not connected to recorder")
		error_occurred.emit("Not connected to recorder")
		return ""
	
	if not _auto_record_enabled:
		_log("Auto-record is disabled by user preference")
		return ""
	
	if event_id.is_empty():
		push_warning("[RecordingSDK] Starting recording with empty event_id")
	
	var message = {
		"type": "start_recording",
		"timestamp": int(Time.get_unix_time_from_system() * 1000),
		"metadata": {
			"event_id": event_id
		}
	}
	
	_send_message(message)
	_log("Recording requested for event: %s" % event_id)
	
	# Wait briefly for response
	await get_tree().create_timer(0.1).timeout
	return _current_recording_id


## Stop an active recording
## delay_seconds: Optional delay before stopping (useful for capturing aftermath)
func stop_recording(recording_id: String, delay_seconds: float = 0.0) -> void:
	if not _is_connected:
		push_error("[RecordingSDK] Not connected to recorder")
		return
	
	if recording_id.is_empty():
		push_error("[RecordingSDK] Invalid recording ID")
		return
	
	if delay_seconds > 0.0:
		_log("Stopping recording in %.1f seconds..." % delay_seconds)
		await get_tree().create_timer(delay_seconds).timeout
	
	var message = {
		"type": "stop_recording",
		"timestamp": int(Time.get_unix_time_from_system() * 1000),
		"recording_id": recording_id
	}
	
	_send_message(message)
	_log("Stop recording requested: %s" % recording_id)


# =============================================================================
# Public API - Event Registration
# =============================================================================

## Register an event_id to event_name mapping with the launcher
func register_event(event_id: String, event_name: String) -> void:
	if not _is_connected:
		push_error("[RecordingSDK] Not connected to recorder")
		error_occurred.emit("Not connected to recorder")
		return
	
	if event_id.is_empty() or event_name.is_empty():
		push_error("[RecordingSDK] event_id and event_name cannot be empty")
		return
	
	var message = {
		"type": "register_event",
		"timestamp": int(Time.get_unix_time_from_system() * 1000),
		"event_id": event_id,
		"event_name": event_name
	}
	
	_send_message(message)
	_log("Registering event: %s -> %s" % [event_id, event_name])


## Request current settings from the launcher
func request_settings() -> void:
	if not _is_connected:
		return
	
	var message = {
		"type": "get_settings",
		"timestamp": int(Time.get_unix_time_from_system() * 1000)
	}
	
	_send_message(message)


# =============================================================================
# Public API - Status Checks
# =============================================================================

func is_recorder_connected() -> bool:
	return _is_connected


func is_auto_record_enabled() -> bool:
	return _auto_record_enabled


func get_current_recording_id() -> String:
	return _current_recording_id


func is_recording() -> bool:
	return not _current_recording_id.is_empty()


func get_max_recording_duration() -> int:
	return _max_recording_duration


func get_video_quality() -> String:
	return _video_quality


func reload_settings() -> void:
	_load_settings()
	_log("Settings reloaded")


# =============================================================================
# Internal - Settings
# =============================================================================

func _load_settings() -> void:
	server_url = _get_setting("server_url", "ws://localhost:9876")
	auto_connect = _get_setting("auto_connect", true)
	auto_reconnect = _get_setting("auto_reconnect", true)
	reconnect_delay = _get_setting("reconnect_delay", 2.0)
	max_reconnect_attempts = _get_setting("max_reconnect_attempts", 5)
	debug_logging = _get_setting("enable_debug_logging", false)


func _get_setting(key: String, default_value: Variant) -> Variant:
	var full_key = SETTINGS_PREFIX + key
	if ProjectSettings.has_setting(full_key):
		return ProjectSettings.get_setting(full_key)
	return default_value


# =============================================================================
# Internal - WebSocket Communication
# =============================================================================

func _send_message(message: Dictionary) -> void:
	if _websocket == null or not _is_connected:
		return
	
	var json_str = JSON.stringify(message)
	_websocket.send_text(json_str)


func _process_incoming_messages() -> void:
	while _websocket.get_available_packet_count() > 0:
		var packet = _websocket.get_packet()
		var json_string = packet.get_string_from_utf8()
		_handle_message(json_string)


func _handle_message(json_string: String) -> void:
	var json = JSON.new()
	var err = json.parse(json_string)
	
	if err != OK:
		push_error("[RecordingSDK] Failed to parse JSON: %s" % json_string)
		return
	
	var message = json.data
	if not message is Dictionary:
		return
	
	var msg_type = message.get("type", "")
	
	match msg_type:
		"settings":
			_auto_record_enabled = message.get("auto_record_enabled", true)
			_max_recording_duration = message.get("max_recording_duration", 300)
			_video_quality = message.get("video_quality", "high")
			_log("Settings received - auto_record: %s, max_duration: %ds, quality: %s" % [
				"ON" if _auto_record_enabled else "OFF",
				_max_recording_duration,
				_video_quality
			])
			settings_received.emit(_auto_record_enabled, _max_recording_duration, _video_quality)
		
		"recording_started":
			_current_recording_id = message.get("recording_id", "")
			_log("Recording started: %s" % _current_recording_id)
			recording_started.emit(_current_recording_id)
		
		"recording_stopped":
			var recording_id = message.get("recording_id", "")
			var file_path = message.get("file_path", "")
			var duration = message.get("duration", 0.0)
			var file_size = message.get("file_size", 0)
			
			_log("Recording stopped: %s (%.1fs, %.2f MB)" % [
				file_path, duration, file_size / 1024.0 / 1024.0
			])
			
			if recording_id == _current_recording_id:
				_current_recording_id = ""
			
			recording_stopped.emit(recording_id, file_path)
		
		"event_registered":
			_log("Event registered successfully")
			event_registered.emit("")
		
		"pong":
			pass
		
		"server_shutdown":
			var reconnect_ms = message.get("reconnect_delay_ms", 3000)
			_log("Server shutting down, reconnect in %dms" % reconnect_ms)
			server_shutdown.emit(reconnect_ms)
		
		"error":
			var error_msg = message.get("message", "Unknown error")
			push_error("[RecordingSDK] Server error: %s" % error_msg)
			error_occurred.emit(error_msg)


func _log(message: String) -> void:
	if debug_logging:
		print("[RecordingSDK] %s" % message)


# =============================================================================
# Internal - Connection Callbacks
# =============================================================================

func _on_connection_established() -> void:
	_log("Connected to recorder!")
	_is_connected = true
	_is_reconnecting = false
	_reconnect_attempts = 0
	connected_to_recorder.emit()
	
	# Request settings from launcher
	request_settings()
	
	# Start heartbeat
	_heartbeat_timer.start()


func _on_connection_closed() -> void:
	_log("Disconnected from recorder")
	var was_connected = _is_connected
	_is_connected = false
	_current_recording_id = ""
	_heartbeat_timer.stop()
	_websocket = null
	
	if was_connected:
		disconnected_from_recorder.emit()
	
	# Attempt reconnection if enabled
	if auto_reconnect and not _is_reconnecting and _reconnect_attempts < max_reconnect_attempts:
		_start_reconnect_timer()


func _start_reconnect_timer() -> void:
	if _reconnect_timer.is_stopped():
		_is_reconnecting = true
		_reconnect_attempts += 1
		_log("Reconnecting in %.1fs (attempt %d/%d)..." % [
			reconnect_delay, _reconnect_attempts, max_reconnect_attempts
		])
		_reconnect_timer.start()


func _on_reconnect_timer_timeout() -> void:
	if _is_reconnecting:
		connect_to_recorder()


func _on_heartbeat_timer_timeout() -> void:
	if _is_connected:
		var message = {
			"type": "ping",
			"timestamp": int(Time.get_unix_time_from_system() * 1000)
		}
		_send_message(message)


func _exit_tree() -> void:
	disconnect_from_recorder()
`;
};

export default recordingSDKTemplate;
