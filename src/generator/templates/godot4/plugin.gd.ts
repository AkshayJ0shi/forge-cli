import { TemplateContext, TemplateFunction } from '../../utils/templateEngine';

/**
 * Godot 4.x plugin.gd template
 * Generates the plugin script that registers ShardSDK as an autoload singleton
 */
export const pluginGdTemplate: TemplateFunction = (context: TemplateContext): string => {
  return `@tool
extends EditorPlugin

const AUTOLOAD_NAME = "ShardSDK"
const AUTOLOAD_PATH = "res://addons/shard_sdk/ShardSDK.gd"

func _enter_tree() -> void:
	# Register project settings
	_register_project_settings()
	
	# Add autoload singleton
	add_autoload_singleton(AUTOLOAD_NAME, AUTOLOAD_PATH)

func _exit_tree() -> void:
	# Remove autoload singleton
	remove_autoload_singleton(AUTOLOAD_NAME)

func _register_project_settings() -> void:
	# Debug logging setting
	_add_project_setting(
		"shard_sdk/debug_logging",
		TYPE_BOOL,
		false,
		PROPERTY_HINT_NONE,
		"",
		"Enable debug logging output"
	)
${context.features.recording ? generateRecordingSettings() : ''}${context.features.errorTracking ? generateErrorTrackingSettings() : ''}${context.features.multiplayer ? generateMultiplayerSettings() : ''}

func _add_project_setting(name: String, type: int, default_value, hint: int = PROPERTY_HINT_NONE, hint_string: String = "", description: String = "") -> void:
	if not ProjectSettings.has_setting(name):
		ProjectSettings.set_setting(name, default_value)
	
	ProjectSettings.set_initial_value(name, default_value)
	ProjectSettings.add_property_info({
		"name": name,
		"type": type,
		"hint": hint,
		"hint_string": hint_string
	})
`;
};

function generateRecordingSettings(): string {
  return `
	# Recording SDK settings
	_add_project_setting(
		"shard_sdk/recording/server_url",
		TYPE_STRING,
		"ws://localhost:9876",
		PROPERTY_HINT_NONE,
		"",
		"WebSocket server URL for the recording server"
	)
	
	_add_project_setting(
		"shard_sdk/recording/auto_connect",
		TYPE_BOOL,
		true,
		PROPERTY_HINT_NONE,
		"",
		"Automatically connect to recording server on startup"
	)
	
	_add_project_setting(
		"shard_sdk/recording/auto_reconnect",
		TYPE_BOOL,
		true,
		PROPERTY_HINT_NONE,
		"",
		"Automatically reconnect if connection is lost"
	)
`;
}

function generateErrorTrackingSettings(): string {
  return `
	# Error Tracking SDK settings
	_add_project_setting(
		"shard_sdk/error_tracking/server_url",
		TYPE_STRING,
		"ws://localhost:9877",
		PROPERTY_HINT_NONE,
		"",
		"WebSocket server URL for the error tracking server"
	)
	
	_add_project_setting(
		"shard_sdk/error_tracking/game_id",
		TYPE_STRING,
		"",
		PROPERTY_HINT_NONE,
		"",
		"Unique game identifier (required)"
	)
	
	_add_project_setting(
		"shard_sdk/error_tracking/auto_connect",
		TYPE_BOOL,
		true,
		PROPERTY_HINT_NONE,
		"",
		"Automatically connect to server on startup"
	)
	
	_add_project_setting(
		"shard_sdk/error_tracking/sample_rate",
		TYPE_FLOAT,
		1.0,
		PROPERTY_HINT_RANGE,
		"0.0,1.0,0.01",
		"Event sampling rate (0.0-1.0)"
	)
`;
}

function generateMultiplayerSettings(): string {
  return `
	# Multiplayer SDK settings
	_add_project_setting(
		"shard_sdk/multiplayer/server_host",
		TYPE_STRING,
		"localhost",
		PROPERTY_HINT_NONE,
		"",
		"Game server hostname"
	)
	
	_add_project_setting(
		"shard_sdk/multiplayer/server_port",
		TYPE_INT,
		9877,
		PROPERTY_HINT_RANGE,
		"1,65535,1",
		"Game server port"
	)
	
	_add_project_setting(
		"shard_sdk/multiplayer/auto_reconnect",
		TYPE_BOOL,
		true,
		PROPERTY_HINT_NONE,
		"",
		"Automatically reconnect if connection is lost"
	)
	
	_add_project_setting(
		"shard_sdk/multiplayer/interpolation_delay",
		TYPE_INT,
		100,
		PROPERTY_HINT_RANGE,
		"0,500,10",
		"Interpolation delay in milliseconds"
	)
	
	_add_project_setting(
		"shard_sdk/multiplayer/prediction_enabled",
		TYPE_BOOL,
		true,
		PROPERTY_HINT_NONE,
		"",
		"Enable client-side prediction"
	)
`;
}

export default pluginGdTemplate;
