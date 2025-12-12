import { TemplateContext, TemplateFunction } from '../../../utils/templateEngine';

/**
 * Godot 3.x ShardMatch.gd template
 * Match lifecycle and state management - uses Godot 3 syntax
 */
export const shardMatchTemplate: TemplateFunction = (context: TemplateContext): string => {
  return `extends Reference
class_name ShardMatch

# =============================================================================
# Shard Match - Match Lifecycle and State Management
# Generated for ${context.gameName} (Godot ${context.godotVersion})
# =============================================================================

enum State { LOBBY, COUNTDOWN, PLAYING, ROUND_OVER, MATCH_OVER }

signal countdown(seconds)
signal round_started(round_number, spawn_positions, weapon_spawns)
signal round_ended(winner_peer_id, scores)
signal match_ended(winner_peer_id, winner_username, final_scores)

var _state: int = State.LOBBY
var _current_round: int = 0
var _scores: Dictionary = {}
var _spawn_positions: Array = []
var _weapon_spawns: Array = []

var _final_winner_peer_id: int = -1
var _final_winner_username: String = ""
var _final_scores: Array = []

var _debug_logging: bool = false


func start_match(connection) -> void:
	if not connection or not connection.is_authenticated():
		_log("Cannot start match - not authenticated")
		return
	
	var ShardProtocolClass = load("res://addons/shard_sdk/multiplayer/ShardProtocol.gd")
	var message = {
		"type": ShardProtocolClass.MSG_START_MATCH,
		"timestamp": OS.get_ticks_msec()
	}
	connection.send_message(message)
	_log("Sent start_match request")


func handle_message(message: Dictionary) -> bool:
	if not message.has("type"):
		return false
	
	var ShardProtocolClass = load("res://addons/shard_sdk/multiplayer/ShardProtocol.gd")
	
	match message.type:
		ShardProtocolClass.MSG_COUNTDOWN:
			_handle_countdown(message)
			return true
		
		ShardProtocolClass.MSG_ROUND_START:
			_handle_round_start(message)
			return true
		
		ShardProtocolClass.MSG_ROUND_OVER:
			_handle_round_over(message)
			return true
		
		ShardProtocolClass.MSG_MATCH_OVER:
			_handle_match_over(message)
			return true
	
	return false


func _handle_countdown(message: Dictionary) -> void:
	if not message.has("seconds"):
		_log("countdown message missing seconds field")
		return
	
	var seconds = int(message.seconds)
	_state = State.COUNTDOWN
	
	_log("Countdown: %d seconds" % seconds)
	emit_signal("countdown", seconds)


func _handle_round_start(message: Dictionary) -> void:
	if not message.has("round"):
		_log("round_start message missing round field")
		return
	
	_current_round = int(message.round)
	_state = State.PLAYING
	
	_spawn_positions = []
	if message.has("spawn_positions") and message.spawn_positions is Array:
		_spawn_positions = message.spawn_positions.duplicate()
	
	_weapon_spawns = []
	if message.has("weapon_spawns") and message.weapon_spawns is Array:
		_weapon_spawns = message.weapon_spawns.duplicate()
	
	_log("Round %d started with %d spawn positions and %d weapon spawns" % [
		_current_round, 
		_spawn_positions.size(), 
		_weapon_spawns.size()
	])
	emit_signal("round_started", _current_round, _spawn_positions, _weapon_spawns)


func _handle_round_over(message: Dictionary) -> void:
	_state = State.ROUND_OVER
	
	var winner_peer_id = -1
	if message.has("winner_peer_id"):
		winner_peer_id = int(message.winner_peer_id)
	
	if message.has("scores"):
		_parse_scores(message.scores)
	
	_log("Round over - winner: %d, scores: %s" % [winner_peer_id, str(_scores)])
	emit_signal("round_ended", winner_peer_id, _scores.duplicate())


func _handle_match_over(message: Dictionary) -> void:
	_state = State.MATCH_OVER
	
	_final_winner_peer_id = -1
	if message.has("winner_peer_id"):
		_final_winner_peer_id = int(message.winner_peer_id)
	
	_final_winner_username = ""
	if message.has("winner_username"):
		_final_winner_username = str(message.winner_username)
	
	_final_scores = []
	if message.has("final_scores") and message.final_scores is Array:
		_final_scores = message.final_scores.duplicate()
		_parse_final_scores(message.final_scores)
	
	_log("Match over - winner: %s (peer_id: %d)" % [_final_winner_username, _final_winner_peer_id])
	emit_signal("match_ended", _final_winner_peer_id, _final_winner_username, _final_scores)


func _parse_scores(scores_array) -> void:
	if not scores_array is Array:
		_log("Invalid scores data - expected Array")
		return
	
	for s in scores_array:
		if not s is Dictionary:
			continue
		
		if not s.has("peer_id"):
			continue
		
		var peer_id = int(s.peer_id)
		var rounds_won = int(s.get("rounds_won", 0))
		_scores[peer_id] = rounds_won


func _parse_final_scores(scores_array) -> void:
	_scores.clear()
	_parse_scores(scores_array)


func get_state() -> int:
	return _state


func get_state_string() -> String:
	match _state:
		State.LOBBY:
			return "lobby"
		State.COUNTDOWN:
			return "countdown"
		State.PLAYING:
			return "playing"
		State.ROUND_OVER:
			return "round_over"
		State.MATCH_OVER:
			return "match_over"
	return "unknown"


func get_current_round() -> int:
	return _current_round


func get_scores() -> Dictionary:
	return _scores.duplicate()


func get_spawn_positions() -> Array:
	return _spawn_positions.duplicate()


func get_weapon_spawns() -> Array:
	return _weapon_spawns.duplicate()


func get_final_winner_peer_id() -> int:
	return _final_winner_peer_id


func get_final_winner_username() -> String:
	return _final_winner_username


func get_final_scores() -> Array:
	return _final_scores.duplicate()


func is_playing() -> bool:
	return _state == State.PLAYING


func is_in_match() -> bool:
	return _state != State.LOBBY


func is_match_over() -> bool:
	return _state == State.MATCH_OVER


func reset() -> void:
	_state = State.LOBBY
	_current_round = 0
	_scores.clear()
	_spawn_positions.clear()
	_weapon_spawns.clear()
	_final_winner_peer_id = -1
	_final_winner_username = ""
	_final_scores.clear()
	_log("Match state reset")


func return_to_lobby() -> void:
	_state = State.LOBBY
	_current_round = 0
	_spawn_positions.clear()
	_weapon_spawns.clear()


func set_debug_logging(enabled: bool) -> void:
	_debug_logging = enabled


func _log(message: String) -> void:
	if _debug_logging:
		var timestamp = OS.get_ticks_msec()
		print("[ShardMatch %d] %s" % [timestamp, message])
`;
};

export default shardMatchTemplate;
