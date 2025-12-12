import { TemplateContext, TemplateFunction } from '../../../utils/templateEngine';

/**
 * Godot 3.x ShardPrediction.gd template
 * Client-side prediction and server reconciliation - uses Godot 3 syntax
 */
export const shardPredictionTemplate: TemplateFunction = (context: TemplateContext): string => {
  return `extends Reference
class_name ShardPrediction

# =============================================================================
# Shard Prediction - Client-Side Prediction and Server Reconciliation
# Generated for ${context.gameName} (Godot ${context.godotVersion})
# =============================================================================

const CORRECTION_THRESHOLD = 5.0
const GRAVITY = 980.0
const MOVE_SPEED = 200.0
const JUMP_VELOCITY = -400.0

signal prediction_corrected(server_pos, predicted_pos, correction_amount)

var _enabled: bool = true
var _predicted_position: Vector2 = Vector2.ZERO
var _predicted_velocity: Vector2 = Vector2.ZERO
var _my_peer_id: int = -1
var _is_grounded: bool = true
var _prediction_corrections: int = 0
var _debug_logging: bool = false


func set_enabled(enabled: bool) -> void:
	_enabled = enabled
	_log("Prediction %s" % ["enabled" if enabled else "disabled"])


func is_enabled() -> bool:
	return _enabled


func set_my_peer_id(peer_id: int) -> void:
	_my_peer_id = peer_id
	_log("My peer ID set to %d" % peer_id)


func get_my_peer_id() -> int:
	return _my_peer_id


func apply_input(input: Dictionary, delta: float) -> void:
	if not _enabled:
		return
	
	var move_x = input.get("move_x", 0.0)
	_predicted_velocity.x = move_x * MOVE_SPEED
	
	var jump = input.get("jump", false)
	if jump and _is_grounded:
		_predicted_velocity.y = JUMP_VELOCITY
		_is_grounded = false
	
	_predicted_velocity.y += GRAVITY * delta
	_predicted_position += _predicted_velocity * delta
	
	if _predicted_position.y >= 0 and _predicted_velocity.y >= 0:
		_predicted_position.y = 0
		_predicted_velocity.y = 0
		_is_grounded = true


func apply_input_without_delta(input: Dictionary) -> void:
	apply_input(input, 1.0 / 60.0)


func reconcile(state, input_handler) -> void:
	if not _enabled or _my_peer_id < 0:
		return
	
	var latest = state.get_latest_state()
	if latest.empty():
		return
	
	var server_player = _find_my_player(latest.get("players", []))
	if server_player == null:
		return
	
	var server_pos = Vector2(
		server_player.get("x", 0.0),
		server_player.get("y", 0.0)
	)
	
	var last_processed = state.get_last_processed_tick(_my_peer_id)
	var diff = _predicted_position.distance_to(server_pos)
	
	if diff > CORRECTION_THRESHOLD:
		_log("Prediction error: %.2f units (threshold: %.2f)" % [diff, CORRECTION_THRESHOLD])
		
		var old_predicted = _predicted_position
		
		_predicted_position = server_pos
		_predicted_velocity = Vector2(
			server_player.get("vx", 0.0),
			server_player.get("vy", 0.0)
		)
		
		_is_grounded = _predicted_velocity.y >= 0 and _predicted_position.y >= 0
		
		var unprocessed_inputs = input_handler.get_inputs_after_tick(last_processed)
		_log("Re-applying %d unprocessed inputs after tick %d" % [unprocessed_inputs.size(), last_processed])
		
		for entry in unprocessed_inputs:
			apply_input_without_delta(entry.input)
		
		_prediction_corrections += 1
		emit_signal("prediction_corrected", server_pos, old_predicted, diff)
	
	input_handler.clear_inputs_before_tick(last_processed)


func _find_my_player(players: Array):
	for player in players:
		if player.get("peer_id", -1) == _my_peer_id:
			return player
	return null


func get_predicted_position() -> Vector2:
	return _predicted_position


func get_predicted_velocity() -> Vector2:
	return _predicted_velocity


func is_grounded() -> bool:
	return _is_grounded


func set_position(pos: Vector2) -> void:
	_predicted_position = pos
	_log("Position set to %s" % str(pos))


func set_velocity(vel: Vector2) -> void:
	_predicted_velocity = vel


func set_grounded(grounded: bool) -> void:
	_is_grounded = grounded


func initialize_from_server_state(state) -> void:
	if _my_peer_id < 0:
		return
	
	var latest = state.get_latest_state()
	if latest.empty():
		return
	
	var server_player = _find_my_player(latest.get("players", []))
	if server_player == null:
		return
	
	_predicted_position = Vector2(
		server_player.get("x", 0.0),
		server_player.get("y", 0.0)
	)
	_predicted_velocity = Vector2(
		server_player.get("vx", 0.0),
		server_player.get("vy", 0.0)
	)
	_is_grounded = _predicted_velocity.y >= 0 and _predicted_position.y >= 0
	
	_log("Initialized from server state: pos=%s vel=%s" % [str(_predicted_position), str(_predicted_velocity)])


func get_prediction_corrections() -> int:
	return _prediction_corrections


func get_stats() -> Dictionary:
	return {
		"enabled": _enabled,
		"prediction_corrections": _prediction_corrections,
		"predicted_position": _predicted_position,
		"predicted_velocity": _predicted_velocity,
		"is_grounded": _is_grounded
	}


func reset() -> void:
	_predicted_position = Vector2.ZERO
	_predicted_velocity = Vector2.ZERO
	_is_grounded = true
	_prediction_corrections = 0
	_log("Prediction state reset")


func set_debug_logging(enabled: bool) -> void:
	_debug_logging = enabled


func _log(message: String) -> void:
	if _debug_logging:
		var timestamp = OS.get_ticks_msec()
		print("[ShardPrediction %d] %s" % [timestamp, message])
`;
};

export default shardPredictionTemplate;
