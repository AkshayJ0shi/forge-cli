import { TemplateContext, TemplateFunction } from '../../utils/templateEngine';

/**
 * Godot 4.x ShardSDK.gd template
 * Main singleton that exposes recording, errors, and multiplayer sub-components
 * Uses Godot 4 syntax: await, .signal.connect(), .is_empty()
 */
export const shardSDKTemplate: TemplateFunction = (context: TemplateContext): string => {
  const hasRecording = context.features.recording;
  const hasErrorTracking = context.features.errorTracking;
  const hasMultiplayer = context.features.multiplayer;

  return `extends Node

## Shard SDK - Unified SDK for ${context.gameName}
## Generated for Godot ${context.godotVersion}
##
## This is the main entry point for all Shard SDK features.
## Access features through the singleton: ShardSDK.recording, ShardSDK.errors, ShardSDK.multiplayer

# =============================================================================
# Configuration
# =============================================================================

const SETTINGS_PREFIX = "shard_sdk/"

var _debug_logging: bool = false
${hasRecording ? `
# =============================================================================
# Recording Component
# =============================================================================

var recording: RecordingSDK = null
` : ''}${hasErrorTracking ? `
# =============================================================================
# Error Tracking Component
# =============================================================================

var errors: ErrorTrackingSDK = null
` : ''}${hasMultiplayer ? `
# =============================================================================
# Multiplayer Component
# =============================================================================

var multiplayer_sdk: ShardMultiplayer = null

# Convenience alias
var multiplayer_client: ShardMultiplayer:
	get:
		return multiplayer_sdk
` : ''}

# =============================================================================
# Lifecycle
# =============================================================================

func _ready() -> void:
	_load_configuration()
	_initialize_components()
	_log("ShardSDK initialized for ${context.gameName}")


func _load_configuration() -> void:
	_debug_logging = _get_setting("debug_logging", false)


func _get_setting(key: String, default_value: Variant) -> Variant:
	var full_key = SETTINGS_PREFIX + key
	if ProjectSettings.has_setting(full_key):
		return ProjectSettings.get_setting(full_key)
	return default_value


func _initialize_components() -> void:
${hasRecording ? `	# Initialize Recording SDK
	recording = RecordingSDK.new()
	recording.name = "RecordingSDK"
	add_child(recording)
	_log("Recording SDK initialized")
` : ''}${hasErrorTracking ? `	# Initialize Error Tracking SDK
	errors = ErrorTrackingSDK.new()
	errors.name = "ErrorTrackingSDK"
	add_child(errors)
	_log("Error Tracking SDK initialized")
` : ''}${hasMultiplayer ? `	# Initialize Multiplayer SDK
	multiplayer_sdk = ShardMultiplayer.new()
	multiplayer_sdk.name = "ShardMultiplayer"
	add_child(multiplayer_sdk)
	_log("Multiplayer SDK initialized")
` : ''}	pass

${hasRecording ? `
# =============================================================================
# Recording API (convenience methods)
# =============================================================================

## Start recording a gameplay moment
## event_id: The event identifier (e.g., "boss_defeated")
## Returns: Recording ID if successful, empty string otherwise
func start_recording(event_id: String) -> String:
	if recording == null:
		push_error("ShardSDK: Recording feature not initialized")
		return ""
	return await recording.start_recording(event_id)


## Stop an active recording
## recording_id: The recording ID returned from start_recording
## delay_seconds: Optional delay before stopping
func stop_recording(recording_id: String, delay_seconds: float = 0.0) -> void:
	if recording == null:
		push_error("ShardSDK: Recording feature not initialized")
		return
	await recording.stop_recording(recording_id, delay_seconds)


## Check if connected to the recording server
func is_recording_connected() -> bool:
	if recording == null:
		return false
	return recording.is_recorder_connected()
` : ''}${hasErrorTracking ? `
# =============================================================================
# Error Tracking API (convenience methods)
# =============================================================================

## Report an error to the error tracking server
## error_type: Type of error (e.g., "runtime_error", "network_error")
## message: Error message
## context: Optional additional context data
## Returns: Error ID if successful, empty string otherwise
func report_error(error_type: String, message: String, error_context: Dictionary = {}) -> String:
	if errors == null:
		push_error("ShardSDK: Error tracking feature not initialized")
		return ""
	return errors.capture_error(error_type, message, error_context)


## Add a breadcrumb for debugging
## message: Breadcrumb message
## category: Category (e.g., "navigation", "user_action")
## data: Optional additional data
func add_breadcrumb(message: String, category: String = "default", data: Dictionary = {}) -> void:
	if errors == null:
		return
	errors.add_breadcrumb(message, category, data)


## Set user information for error tracking
## user_id: Unique user identifier
## username: Optional username
## email: Optional email
func set_user(user_id: String, username: String = "", email: String = "") -> void:
	if errors == null:
		return
	errors.set_user(user_id, username, email)


## Track a metric
## metric_name: Name of the metric
## value: Metric value
## tags: Optional tags
## unit: Optional unit (e.g., "seconds", "bytes")
func track_metric(metric_name: String, value: float, tags: Dictionary = {}, unit: String = "") -> String:
	if errors == null:
		push_error("ShardSDK: Error tracking feature not initialized")
		return ""
	return errors.track_metric(metric_name, value, tags, unit)


## Check if connected to the error tracking server
func is_error_tracking_connected() -> bool:
	if errors == null:
		return false
	return errors.is_connected()
` : ''}${hasMultiplayer ? `
# =============================================================================
# Multiplayer API (convenience methods)
# =============================================================================

## Connect to the game server
## token: Session token for authentication
func connect_to_server(token: String) -> void:
	if multiplayer_sdk == null:
		push_error("ShardSDK: Multiplayer feature not initialized")
		return
	multiplayer_sdk.connect_to_server(token)


## Disconnect from the game server
func disconnect_from_server() -> void:
	if multiplayer_sdk == null:
		return
	multiplayer_sdk.disconnect_from_server()


## Create a new lobby
func create_lobby() -> void:
	if multiplayer_sdk == null:
		push_error("ShardSDK: Multiplayer feature not initialized")
		return
	multiplayer_sdk.create_lobby()


## Join an existing lobby
## lobby_code: The lobby code to join
func join_lobby(lobby_code: String) -> void:
	if multiplayer_sdk == null:
		push_error("ShardSDK: Multiplayer feature not initialized")
		return
	multiplayer_sdk.join_lobby(lobby_code)


## Leave the current lobby
func leave_lobby() -> void:
	if multiplayer_sdk == null:
		return
	multiplayer_sdk.leave_lobby()


## Start the match (host only)
func start_match() -> void:
	if multiplayer_sdk == null:
		push_error("ShardSDK: Multiplayer feature not initialized")
		return
	multiplayer_sdk.start_match()


## Send player input to the server
## input: Dictionary with input data
func send_input(input: Dictionary) -> void:
	if multiplayer_sdk == null:
		return
	multiplayer_sdk.send_input(input)


## Check if connected to the game server
func is_multiplayer_connected() -> bool:
	if multiplayer_sdk == null:
		return false
	return multiplayer_sdk.is_connected()


## Check if authenticated with the game server
func is_multiplayer_authenticated() -> bool:
	if multiplayer_sdk == null:
		return false
	return multiplayer_sdk.is_authenticated()


## Get the current lobby code
func get_lobby_code() -> String:
	if multiplayer_sdk == null:
		return ""
	return multiplayer_sdk.get_lobby_code()


## Get the current latency in milliseconds
func get_latency() -> int:
	if multiplayer_sdk == null:
		return 0
	return multiplayer_sdk.get_latency()
` : ''}

# =============================================================================
# Debug Logging
# =============================================================================

## Enable or disable debug logging
func set_debug_logging(enabled: bool) -> void:
	_debug_logging = enabled
${hasRecording ? `	if recording:
		recording.debug_logging = enabled
` : ''}${hasErrorTracking ? `	if errors:
		errors.enable_debug_logging = enabled
` : ''}${hasMultiplayer ? `	if multiplayer_sdk:
		multiplayer_sdk.set_debug_logging(enabled)
` : ''}	_log("Debug logging " + ("enabled" if enabled else "disabled"))


func _log(message: String) -> void:
	if _debug_logging:
		var timestamp = Time.get_ticks_msec()
		print("[ShardSDK %d] %s" % [timestamp, message])
`;
};

export default shardSDKTemplate;
