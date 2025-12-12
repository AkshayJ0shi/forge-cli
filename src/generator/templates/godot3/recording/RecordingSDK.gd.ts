import { TemplateContext, TemplateFunction } from '../../../utils/templateEngine';

/**
 * Godot 3.x RecordingSDK.gd template
 * Uses Godot 3 syntax: yield, WebSocketClient, .connect(), .empty()
 */
export const recordingSDKTemplate: TemplateFunction = (context: TemplateContext): string => {
  return `# RecordingSDK for Godot 3.x
# 
# Communicate with the Shard Launcher to automatically record gameplay moments.
# Generated for ${context.gameName}
#
# Usage:
#   # The SDK is available through ShardSDK.recording
#   ShardSDK.recording.connect_to_recorder()
#   
#   # Start recording an event
#   var recording_id = yield(ShardSDK.recording.start_recording("boss_defeated"), "completed")
#   
#   # Stop recording after gameplay moment
#   yield(ShardSDK.recording.stop_recording(recording_id, 3.0), "completed")

extends Node

# ============================================================================
# SIGNALS
# ============================================================================

# Connection signals
signal connected_to_recorder()
signal disconnected_from_recorder()

# Recording signals
signal recording_started(recording_id)
signal recording_stopped(recording_id, file_path)

# Settings signals
signal settings_received(auto_record_enabled, max_duration, video_quality)

# Event registration signal
signal event_registered(event_id)

# Error signal
signal error_occurred(error_message)

# Server shutdown signal (launcher is closing)
signal server_shutdown(reconnect_delay_ms)

# ============================================================================
# CONFIGURATION (from ProjectSettings)
# ============================================================================

const SETTINGS_PREFIX = "shard_sdk/recording/"

var server_url: String = "ws://localhost:9876"
var auto_connect: bool = true
var auto_reconnect: bool = true
var reconnect_delay: float = 2.0
var max_reconnect_attempts: int = 5
var debug_logging: bool = false

# ============================================================================
# RUNTIME STATE
# ============================================================================

var _websocket: WebSocketClient
var _is_connected: bool = false
var _reconnect_attempts: int = 0
var _current_recording_id: String = ""
var _is_reconnecting: bool = false

# Settings from launcher
var _auto_record_enabled: bool = true
var _max_recording_duration: int = 300
var _video_quality: String = "high"


func _init() -> void:
	_websocket = WebSocketClient.new()


func _ready() -> void:
	_load_settings()
	
	# Connect WebSocket signals
	var _err
	_err = _websocket.connect("connection_established", self, "_on_connection_established")
	_err = _websocket.connect("connection_closed", self, "_on_connection_closed")
	_err = _websocket.connect("connection_error", self, "_on_connection_error")
	_err = _websocket.connect("data_received", self, "_on_data_received")
	
	if auto_connect:
		call_deferred("connect_to_recorder")


func _process(_delta: float) -> void:
	if _websocket:
		_websocket.poll()


# ============================================================================
# PUBLIC API - Connection
# ============================================================================

func connect_to_recorder() -> void:
	if _is_connected:
		_log("Already connected")
		return
	
	_log("Connecting to recorder at %s..." % server_url)
	var err = _websocket.connect_to_url(server_url)
	if err != OK:
		push_error("[RecordingSDK] Failed to connect: %s" % err)
		emit_signal("error_occurred", "Failed to connect to recorder")


func disconnect_from_recorder() -> void:
	if _is_connected:
		_websocket.disconnect_from_host()
		_is_connected = false
		_is_reconnecting = false
		_log("Disconnected")


# ============================================================================
# PUBLIC API - Recording
# ============================================================================

# Start recording with an event identifier
# event_id format: {gameName}_{8hexChars} (e.g., "everplast_a1b2c3d4")
# Returns the recording ID if successful, empty string otherwise
func start_recording(event_id: String):
	if not _is_connected:
		push_error("[RecordingSDK] Not connected to recorder")
		emit_signal("error_occurred", "Not connected to recorder")
		yield(get_tree(), "idle_frame")
		return ""
	
	if not _auto_record_enabled:
		_log("Auto-record is disabled by user preference")
		yield(get_tree(), "idle_frame")
		return ""
	
	if event_id.empty():
		push_warning("[RecordingSDK] Starting recording with empty event_id")
	
	var message = {
		"type": "start_recording",
		"timestamp": int(OS.get_unix_time() * 1000),
		"metadata": {
			"event_id": event_id
		}
	}
	
	_send_message(message)
	_log("Recording requested for event: %s" % event_id)
	
	# Wait briefly for response
	yield(get_tree().create_timer(0.1), "timeout")
	return _current_recording_id


# Stop an active recording
# delay_seconds: Optional delay before stopping (useful for capturing aftermath)
func stop_recording(recording_id: String, delay_seconds: float = 0.0):
	if not _is_connected:
		push_error("[RecordingSDK] Not connected to recorder")
		yield(get_tree(), "idle_frame")
		return
	
	if recording_id.empty():
		push_error("[RecordingSDK] Invalid recording ID")
		yield(get_tree(), "idle_frame")
		return
	
	if delay_seconds > 0.0:
		_log("Stopping recording in %.1f seconds..." % delay_seconds)
		yield(get_tree().create_timer(delay_seconds), "timeout")
	
	var message = {
		"type": "stop_recording",
		"timestamp": int(OS.get_unix_time() * 1000),
		"recording_id": recording_id
	}
	
	_send_message(message)
	_log("Stop recording requested: %s" % recording_id)
	yield(get_tree(), "idle_frame")


# ============================================================================
# PUBLIC API - Event Registration
# ============================================================================

# Register an event_id to event_name mapping with the launcher
# This allows the launcher to display human-readable names for events
func register_event(event_id: String, event_name: String) -> void:
	if not _is_connected:
		push_error("[RecordingSDK] Not connected to recorder")
		emit_signal("error_occurred", "Not connected to recorder")
		return
	
	if event_id.empty() or event_name.empty():
		push_error("[RecordingSDK] event_id and event_name cannot be empty")
		return
	
	var message = {
		"type": "register_event",
		"timestamp": int(OS.get_unix_time() * 1000),
		"event_id": event_id,
		"event_name": event_name
	}
	
	_send_message(message)
	_log("Registering event: %s -> %s" % [event_id, event_name])


# ============================================================================
# PUBLIC API - Settings
# ============================================================================

# Request current settings from the launcher
func request_settings() -> void:
	if not _is_connected:
		return
	
	var message = {
		"type": "get_settings",
		"timestamp": int(OS.get_unix_time() * 1000)
	}
	
	_send_message(message)


# ============================================================================
# PUBLIC API - Status Checks
# ============================================================================

func is_recorder_connected() -> bool:
	return _is_connected


func is_auto_record_enabled() -> bool:
	return _auto_record_enabled


func get_current_recording_id() -> String:
	return _current_recording_id


func is_recording() -> bool:
	return not _current_recording_id.empty()


func get_max_recording_duration() -> int:
	return _max_recording_duration


func get_video_quality() -> String:
	return _video_quality


func reload_settings() -> void:
	_load_settings()
	_log("Settings reloaded")


# ============================================================================
# INTERNAL - Settings
# ============================================================================

func _load_settings() -> void:
	server_url = _get_setting("server_url", "ws://localhost:9876")
	auto_connect = _get_setting("auto_connect", true)
	auto_reconnect = _get_setting("auto_reconnect", true)
	reconnect_delay = _get_setting("reconnect_delay", 2.0)
	max_reconnect_attempts = _get_setting("max_reconnect_attempts", 5)
	debug_logging = _get_setting("enable_debug_logging", false)


func _get_setting(key: String, default_value):
	var full_key = SETTINGS_PREFIX + key
	if ProjectSettings.has_setting(full_key):
		return ProjectSettings.get_setting(full_key)
	return default_value


# ============================================================================
# INTERNAL - WebSocket Communication
# ============================================================================

func _send_message(message: Dictionary) -> void:
	var json = JSON.print(message)
	var err = _websocket.get_peer(1).put_packet(json.to_utf8())
	if err != OK:
		push_error("[RecordingSDK] Failed to send message: %s" % err)


func _handle_message(json_string: String) -> void:
	var json_result = JSON.parse(json_string)
	
	if json_result.error != OK:
		push_error("[RecordingSDK] Failed to parse JSON: %s" % json_string)
		return
	
	var message = json_result.result
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
			emit_signal("settings_received", _auto_record_enabled, _max_recording_duration, _video_quality)
		
		"recording_started":
			_current_recording_id = message.get("recording_id", "")
			_log("Recording started: %s" % _current_recording_id)
			emit_signal("recording_started", _current_recording_id)
		
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
			
			emit_signal("recording_stopped", recording_id, file_path)
		
		"event_registered":
			_log("Event registered successfully")
			emit_signal("event_registered", "")
		
		"pong":
			# Heartbeat response - no action needed
			pass
		
		"server_shutdown":
			var reconnect_ms = message.get("reconnect_delay_ms", 3000)
			_log("Server shutting down, reconnect in %dms" % reconnect_ms)
			emit_signal("server_shutdown", reconnect_ms)
		
		"error":
			var error_msg = message.get("message", "Unknown error")
			push_error("[RecordingSDK] Server error: %s" % error_msg)
			emit_signal("error_occurred", error_msg)


func _log(message: String) -> void:
	if debug_logging:
		print("[RecordingSDK] %s" % message)


# ============================================================================
# INTERNAL - WebSocket Callbacks
# ============================================================================

func _on_connection_established(_protocol: String = "") -> void:
	_log("Connected to recorder!")
	_is_connected = true
	_is_reconnecting = false
	_reconnect_attempts = 0
	emit_signal("connected_to_recorder")
	
	# Request settings from launcher
	request_settings()
	
	# Start heartbeat
	_start_heartbeat()


func _on_connection_closed(_was_clean: bool = true) -> void:
	_log("Disconnected from recorder")
	var was_connected = _is_connected
	_is_connected = false
	_current_recording_id = ""
	
	if was_connected:
		emit_signal("disconnected_from_recorder")
	
	# Attempt reconnection if enabled
	if auto_reconnect and not _is_reconnecting and _reconnect_attempts < max_reconnect_attempts:
		_is_reconnecting = true
		_reconnect_attempts += 1
		_log("Reconnecting in %.1fs (attempt %d/%d)..." % [
			reconnect_delay, _reconnect_attempts, max_reconnect_attempts
		])
		yield(get_tree().create_timer(reconnect_delay), "timeout")
		if _is_reconnecting:
			connect_to_recorder()


func _on_connection_error() -> void:
	push_error("[RecordingSDK] Connection error")
	_is_connected = false
	emit_signal("error_occurred", "Connection error")
	_on_connection_closed(false)


func _on_data_received() -> void:
	var packet = _websocket.get_peer(1).get_packet()
	var json_string = packet.get_string_from_utf8()
	_handle_message(json_string)


func _start_heartbeat() -> void:
	while _is_connected:
		yield(get_tree().create_timer(30.0), "timeout")
		if _is_connected:
			var message = {
				"type": "ping",
				"timestamp": int(OS.get_unix_time() * 1000)
			}
			_send_message(message)


func _exit_tree() -> void:
	disconnect_from_recorder()
`;
};

export default recordingSDKTemplate;
