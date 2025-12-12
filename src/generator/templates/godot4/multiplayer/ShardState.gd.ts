import { TemplateContext, TemplateFunction } from '../../../utils/templateEngine';

/**
 * Godot 4.x ShardState.gd template
 * Ported from Godot 3.x to use Godot 4 syntax
 */
export const shardStateTemplate: TemplateFunction = (context: TemplateContext): string => {
  return `class_name ShardState
extends RefCounted

## Shard State - State Snapshots and Interpolation

# Constants
const SNAPSHOT_BUFFER_SIZE = 3

# =============================================================================
# Signals
# =============================================================================
signal state_received(snapshot: Dictionary)

# Snapshot buffer
var _snapshots: Array = []

# Configuration
var _interpolation_delay: int = 100

# Statistics
var _snapshots_received: int = 0

var _debug_logging: bool = false


# =============================================================================
# Snapshot Handling
# =============================================================================

func handle_snapshot(message: Dictionary) -> void:
	var snapshot = {
		"tick": message.get("tick", 0),
		"timestamp": message.get("timestamp", 0),
		"server_time": Time.get_ticks_msec(),
		"last_processed_input": message.get("last_processed_input", {}),
		"players": message.get("players", []),
		"projectiles": message.get("projectiles", []),
		"pickups": message.get("pickups", [])
	}
	
	_snapshots.append(snapshot)
	
	while _snapshots.size() > SNAPSHOT_BUFFER_SIZE:
		_snapshots.pop_front()
	
	_snapshots_received += 1
	
	_log("Received snapshot tick %d with %d players" % [snapshot.tick, snapshot.players.size()])
	
	state_received.emit(snapshot)


func get_latest_state() -> Dictionary:
	if _snapshots.is_empty():
		return {}
	return _snapshots.back().duplicate(true)


# =============================================================================
# State Interpolation
# =============================================================================

func get_interpolated_state(render_time: float) -> Dictionary:
	if _snapshots.size() < 2:
		return get_latest_state()
	
	var target_time = render_time - _interpolation_delay
	
	var older = null
	var newer = null
	
	for i in range(_snapshots.size() - 1):
		var snap_older = _snapshots[i]
		var snap_newer = _snapshots[i + 1]
		
		if snap_older.server_time <= target_time and snap_newer.server_time >= target_time:
			older = snap_older
			newer = snap_newer
			break
	
	if older == null or newer == null:
		_log("No bracketing snapshots for time %d, returning latest" % int(target_time))
		return get_latest_state()
	
	var time_diff = newer.server_time - older.server_time
	var t = 0.0
	if time_diff > 0:
		t = (target_time - older.server_time) / float(time_diff)
	t = clampf(t, 0.0, 1.0)
	
	var interpolated = {
		"tick": newer.tick,
		"timestamp": newer.timestamp,
		"server_time": int(lerpf(older.server_time, newer.server_time, t)),
		"last_processed_input": newer.last_processed_input,
		"players": _interpolate_players(older.players, newer.players, t),
		"projectiles": newer.projectiles,
		"pickups": newer.pickups
	}
	
	return interpolated


func _interpolate_players(older_players: Array, newer_players: Array, t: float) -> Array:
	var result = []
	
	for new_player in newer_players:
		var peer_id = new_player.get("peer_id", -1)
		var old_player = _find_player_by_peer_id(older_players, peer_id)
		
		if old_player != null:
			var interpolated_player = {
				"peer_id": peer_id,
				"x": lerpf(old_player.get("x", 0.0), new_player.get("x", 0.0), t),
				"y": lerpf(old_player.get("y", 0.0), new_player.get("y", 0.0), t),
				"vx": new_player.get("vx", 0.0),
				"vy": new_player.get("vy", 0.0),
				"health": new_player.get("health", 100),
				"weapon": new_player.get("weapon", null),
				"weapon_cooldown": new_player.get("weapon_cooldown", 0.0),
				"state": new_player.get("state", "alive")
			}
			result.append(interpolated_player)
		else:
			result.append(new_player.duplicate())
	
	return result


func _find_player_by_peer_id(players: Array, peer_id: int) -> Variant:
	for player in players:
		if player.get("peer_id", -1) == peer_id:
			return player
	return null


# =============================================================================
# Utility Methods
# =============================================================================

func get_last_processed_tick(peer_id: int) -> int:
	if _snapshots.is_empty():
		return 0
	
	var latest = _snapshots.back()
	var last_processed = latest.get("last_processed_input", {})
	
	var tick = last_processed.get(str(peer_id), 0)
	if tick == 0:
		tick = last_processed.get(peer_id, 0)
	
	return tick


func get_player_state(peer_id: int) -> Dictionary:
	if _snapshots.is_empty():
		return {}
	
	var latest = _snapshots.back()
	var player = _find_player_by_peer_id(latest.players, peer_id)
	
	if player != null:
		return player.duplicate()
	return {}


func get_snapshot_count() -> int:
	return _snapshots.size()


func get_snapshots_received() -> int:
	return _snapshots_received


# =============================================================================
# Configuration
# =============================================================================

func set_interpolation_delay(delay_ms: int) -> void:
	_interpolation_delay = max(0, delay_ms)
	_log("Interpolation delay set to %d ms" % _interpolation_delay)


func get_interpolation_delay() -> int:
	return _interpolation_delay


# =============================================================================
# Statistics
# =============================================================================

func get_stats() -> Dictionary:
	return {
		"snapshots_received": _snapshots_received,
		"buffer_size": _snapshots.size(),
		"interpolation_delay": _interpolation_delay
	}


# =============================================================================
# State Management
# =============================================================================

func reset() -> void:
	_snapshots.clear()
	_snapshots_received = 0
	_log("State reset")


# =============================================================================
# Debug Logging
# =============================================================================

func set_debug_logging(enabled: bool) -> void:
	_debug_logging = enabled


func _log(message: String) -> void:
	if _debug_logging:
		var timestamp = Time.get_ticks_msec()
		print("[ShardState %d] %s" % [timestamp, message])
`;
};

export default shardStateTemplate;
