# Shard CLI

Command line tools for game developers integrating with the Shard platform.

## Installation

### Using npx (recommended)

```bash
npx @shard/cli recording init
```

### Global installation

```bash
npm install -g @shard/cli
```

## Quick Start

```bash
# 1. Initialize for your game
npx @shard/cli recording init
# Enter: Everplast

# 2. Add recording events
npx @shard/cli recording add
# Enter: Boss Defeated → everplast_a1b2c3d4

# 3. Export for distribution
npx @shard/cli recording export
# Creates: game_events.json
```

## Commands

### `shard recording init`

Create a new `shard.recording.json` configuration file.

### `shard recording add`

Add a new recording event with an auto-generated unique ID.

```
? Event name (e.g., "Boss Defeated"): First Chicken Kill
✓ Added event: First Chicken Kill
  Event ID: everplast_a1b2c3d4

Copy this ID to use in your game code:
  "everplast_a1b2c3d4"
```

### `shard recording list`

View all configured events.

### `shard recording remove`

Remove an event from your configuration.

### `shard recording export`

Export events to `game_events.json` for distribution.

```bash
shard recording export
shard recording export -o ./build/game_events.json
```

### `shard recording validate`

Check your configuration for errors.

## Event ID Format

Event IDs follow the format: `{camelCaseGameName}_{8hexChars}`

| Game Title | Generated Event ID |
|------------|-------------------|
| Everplast | `everplast_a1b2c3d4` |
| Dark Souls 3 | `darkSouls3_e5f6g7h8` |
| My Cool Game | `myCoolGame_i9j0k1l2` |

## Configuration Files

### shard.recording.json

Your local development configuration (don't distribute):

```json
{
  "$schema": "https://shard.gg/schemas/recording-config.json",
  "gameName": "Everplast",
  "events": [
    {
      "id": "everplast_a1b2c3d4",
      "name": "Boss Defeated",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

### game_events.json

Include this file with your game distribution:

```json
{
  "everplast_a1b2c3d4": "Boss Defeated",
  "everplast_e5f6g7h8": "First Blood"
}
```

## Using Events in Your Game

### Godot 3.x

```gdscript
# Start recording when boss fight begins
RecordingSDK.start_recording("everplast_a1b2c3d4")

# Stop recording 3 seconds after boss dies
yield(RecordingSDK.stop_recording(recording_id, 3.0), "completed")
```

### Godot 4.x

```gdscript
# Start recording
var id = await RecordingSDK.start_recording("everplast_a1b2c3d4")

# Stop with delay
await RecordingSDK.stop_recording(id, 3.0)
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run locally
npm start recording init

# Run tests
npm test
```

## License

MIT
