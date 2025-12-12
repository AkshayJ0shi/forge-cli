# ShardKit CLI

Command line tools for game developers integrating with the Shard platform. Generate customized Godot addons with Recording, Error Tracking, and Multiplayer features.

## Installation

### Using npx (recommended)

```bash
npx @shard-dev/shardkit init
```

### Global installation

```bash
npm install -g @shard-dev/shardkit
```

## Quick Start

```bash
# 1. Initialize your project (interactive)
npx @shard-dev/shardkit init

# 2. Enable the plugin in Godot
# Project → Project Settings → Plugins → Enable "Shard SDK"

# 3. Use the SDK in your game
# ShardSDK.recording.trigger_event("myGame_a1b2c3d4")
```

### Non-Interactive Setup

```bash
# Create a singleplayer game with recording and error tracking
shardkit init --name "My Game" --godot 4 --type singleplayer --features recording,errors -y

# Create a multiplayer game (multiplayer feature auto-enabled)
shardkit init --name "My Game" --godot 4 --type multiplayer -y
```

## Commands

### `shardkit init`

Initialize Shard SDK configuration and generate the Godot addon.

```bash
shardkit init                    # Interactive setup
shardkit init --name "My Game"   # Partial flags (prompts for rest)
shardkit init --name "My Game" --godot 4 --type singleplayer -y
                              # Non-interactive with all flags
```

**Options:**
- `--name <name>` - Game name (used for event ID generation)
- `--godot <version>` - Godot version: `3` or `4`
- `--type <type>` - Game type: `singleplayer` or `multiplayer`
- `--features <features>` - Comma-separated: `recording,errors`
- `-y, --yes` - Accept defaults and skip interactive prompts

**What it does:**
1. Creates `shard.config.json` with your settings
2. Generates `addons/shard_sdk/` with selected features
3. Displays next steps for enabling the plugin

### `shardkit generate`

Regenerate the Shard SDK addon from existing configuration.

```bash
shardkit generate                # Regenerate (skips existing files)
shardkit generate --force        # Overwrite all files
shardkit generate --clean        # Remove addon folder first
```

**Options:**
- `--force` - Overwrite existing files without prompting
- `--clean` - Remove existing addon directory before generating

**Use after:**
- Modifying `shard.config.json` manually
- Adding or removing features
- Updating to a new Godot version

### `shardkit recording add`

Add a new recording event with an auto-generated unique ID.

```bash
shardkit recording add
# ? Event name (e.g., "Boss Defeated"): First Chicken Kill
# ✓ Added event: First Chicken Kill
#   Event ID: myGame_a1b2c3d4
```

### `shardkit recording list`

View all configured recording events.

### `shardkit recording remove`

Remove an event from your configuration.

### `shardkit recording export`

Export events to `game_events.json` for distribution.

```bash
shardkit recording export
shardkit recording export -o ./build/game_events.json
```

### `shardkit recording validate`

Check your configuration for errors.

## Configuration

### shard.config.json

The main configuration file created by `shardkit init`:

```json
{
  "$schema": "https://shard.gg/schemas/shard-config.json",
  "gameName": "My Game",
  "godotVersion": "4.x",
  "gameType": "singleplayer",
  "features": {
    "recording": true,
    "errorTracking": true,
    "multiplayer": false
  },
  "recording": {
    "events": [
      {
        "id": "myGame_a1b2c3d4",
        "name": "Boss Defeated",
        "createdAt": "2024-01-15T10:30:00.000Z"
      }
    ]
  }
}
```

### Generated SDK Structure

```
addons/shard_sdk/
├── plugin.cfg              # Godot plugin metadata
├── plugin.gd               # Plugin entry point
├── ShardSDK.gd             # Main autoload singleton
├── README.md               # Usage documentation
├── recording/              # If recording enabled
│   └── RecordingSDK.gd
├── error_tracking/         # If errorTracking enabled
│   └── ErrorTrackingSDK.gd
└── multiplayer/            # If multiplayer enabled
    ├── ShardMultiplayer.gd
    ├── ShardConnection.gd
    └── ...
```

## Using the SDK in Your Game

### Godot 4.x

```gdscript
# Recording
var recording_id = await ShardSDK.recording.start_recording("myGame_a1b2c3d4")
await ShardSDK.recording.stop_recording(recording_id, 3.0)

# Error Tracking
ShardSDK.errors.report_error("Something went wrong")

# Multiplayer
ShardSDK.multiplayer.connect_to_server("ws://your-server:8080")
```

### Godot 3.x

```gdscript
# Recording
var recording_id = yield(ShardSDK.recording.start_recording("myGame_a1b2c3d4"), "completed")
yield(ShardSDK.recording.stop_recording(recording_id, 3.0), "completed")

# Error Tracking
ShardSDK.errors.report_error("Something went wrong")

# Multiplayer
ShardSDK.multiplayer.connect_to_server("ws://your-server:8080")
```

## Event ID Format

Event IDs follow the format: `{camelCaseGameName}_{8hexChars}`

| Game Title | Generated Event ID |
|------------|-------------------|
| Everplast | `everplast_a1b2c3d4` |
| Dark Souls 3 | `darkSouls3_e5f6g7h8` |
| My Cool Game | `myCoolGame_i9j0k1l2` |

## Migration Guide

### From shard.recording.json

If you have an existing `shard.recording.json` file from an older version:

1. Run `shardkit init` - it will detect your existing events
2. Your events will be migrated to the new `shard.config.json` format
3. The old `shard.recording.json` can be deleted after migration

### From Separate SDK Repositories

If you were using the old separate SDKs (`multiplayer_sdk`, `recording_sdk`, `error_tracking_sdk`):

1. Remove old addon folders:
   ```bash
   rm -rf addons/multiplayer_sdk addons/recording_sdk addons/error_tracking_sdk
   ```

2. Run `shardkit init` to generate the new unified SDK

3. Update your code references:
   ```gdscript
   # Old
   RecordingSDK.start_recording("event_id")
   ErrorTrackingSDK.report_error("message")
   
   # New
   ShardSDK.recording.start_recording("event_id")
   ShardSDK.errors.report_error("message")
   ```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run locally
npm start init

# Run tests
npm test
```

## Documentation

- [Getting Started](https://shard.gg/docs/getting-started)
- [ShardKit CLI Reference](https://shard.gg/docs/shardkit)
- [Recording SDK](https://shard.gg/docs/recording)
- [Error Tracking](https://shard.gg/docs/error-tracking)
- [Multiplayer SDK](https://shard.gg/docs/multiplayer)

## License

MIT
