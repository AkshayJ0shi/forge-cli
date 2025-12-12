import { TemplateContext, TemplateFunction } from '../../../utils/templateEngine';

/**
 * Godot 3.x ShardInput.gd template
 * Input buffering and sending - uses Godot 3 syntax
 */
export const shardInputTemplate: TemplateFunction = (context: TemplateContext): string => {
  return `extends Reference
class_name ShardInput

# =============================================================================
# Shard Input - Input Buffering and Sending
# Generated for ${context.gameName} (Godot ${context.godotVersion})
# =============================================================================

const INPUT_BUFFER_SIZE = 60

signal input_sent(tick, input)

var _current_tick: int = 0
var _input_buffer: Array = []
var _inputs_sent: int = 0
var _debug_logging: bool = false


func send_input(connection, input: Dictionary, is_playing: bool) -> void:
	if not is_playing:
		if _debug_logging:
			_log("Ignoring input - not in PLAYING state")
		return
	
	if not connection or not connection.is_authenticated():
		if _debug_logging:
			_log("Ignoring input - not connected/authenticated")
		return
	
	_current_tick += 1
	
	var validated_input = _validate_input(input)
	
	var ShardProtocolClass = load("res://addons/shard_sdk/multiplayer/ShardProtocol.gd")
	var message = {
		"type": ShardProtocolClass.MSG_PLAYER_INPUT,
		"timestamp": OS.get_ticks_msec(),
		"tick": _current_tick,
		"input": validated_input
	}
	
	connection.send_message(message)
	_inputs_sent += 1
	
	_store_input(_current_tick, validated_input)
	
	_log("Sent input tick %d: %s" % [_current_tick, str(validated_input)])
	emit_signal("input_sent", _current_tick, validated_input)


func _validate_input(input: Dictionary) -> Dictionary:
	return {
		"move_x": clamp(float(input.get("move_x", 0.0)), -1.0, 1.0),
		"move_y": clamp(float(input.get("move_y", 0.0)), -1.0, 1.0),
		"jump": bool(input.get("jump", false)),
		"pickup": bool(input.get("pickup", false)),
		"use_weapon": bool(input.get("use_weapon", false)),
		"drop_weapon": bool(input.get("drop_weapon", false)),
		"aim_angle": float(input.get("aim_angle", 0.0))
	}


func _store_input(tick: int, input: Dictionary) -> void:
	_input_buffer.append({
		"tick": tick,
		"input": input.duplicate()
	})
	
	while _input_buffer.size() > INPUT_BUFFER_SIZE:
		_input_buffer.pop_front()


func get_inputs_after_tick(tick: int) -> Array:
	var result = []
	for entry in _input_buffer:
		if entry.tick > tick:
			result.append(entry.duplicate())
	return result


func clear_inputs_before_tick(tick: int) -> void:
	while _input_buffer.size() > 0 and _input_buffer[0].tick <= tick:
		_input_buffer.pop_front()


func get_input_at_tick(tick: int) -> Dictionary:
	for entry in _input_buffer:
		if entry.tick == tick:
			return entry.input.duplicate()
	return {}


func get_buffer_size() -> int:
	return _input_buffer.size()


func get_current_tick() -> int:
	return _current_tick


func set_tick(tick: int) -> void:
	_current_tick = tick


func get_inputs_sent() -> int:
	return _inputs_sent


func get_stats() -> Dictionary:
	return {
		"inputs_sent": _inputs_sent,
		"current_tick": _current_tick,
		"buffer_size": _input_buffer.size()
	}


func reset() -> void:
	_current_tick = 0
	_input_buffer.clear()
	_inputs_sent = 0
	_log("Input state reset")


func set_debug_logging(enabled: bool) -> void:
	_debug_logging = enabled


func _log(message: String) -> void:
	if _debug_logging:
		var timestamp = OS.get_ticks_msec()
		print("[ShardInput %d] %s" % [timestamp, message])
`;
};

export default shardInputTemplate;
