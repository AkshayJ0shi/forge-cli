/**
 * Godot 4.x SDK Templates
 * Exports all template functions for Godot 4.x SDK generation
 */

export { pluginCfgTemplate } from './plugin.cfg';
export { pluginGdTemplate } from './plugin.gd';
export { shardSDKTemplate } from './ShardSDK.gd';
export { recordingSDKTemplate } from './recording/RecordingSDK.gd';
export { errorTrackingSDKTemplate } from './error_tracking/ErrorTrackingSDK.gd';

// Multiplayer templates
export { shardMultiplayerTemplate } from './multiplayer/ShardMultiplayer.gd';
export { shardConnectionTemplate } from './multiplayer/ShardConnection.gd';
export { shardLobbyTemplate } from './multiplayer/ShardLobby.gd';
export { shardMatchTemplate } from './multiplayer/ShardMatch.gd';
export { shardInputTemplate } from './multiplayer/ShardInput.gd';
export { shardStateTemplate } from './multiplayer/ShardState.gd';
export { shardPredictionTemplate } from './multiplayer/ShardPrediction.gd';
export { shardProtocolTemplate } from './multiplayer/ShardProtocol.gd';
export { shardEventsTemplate } from './multiplayer/ShardEvents.gd';

import { TemplateEngine } from '../../utils/templateEngine';
import { pluginCfgTemplate } from './plugin.cfg';
import { pluginGdTemplate } from './plugin.gd';
import { shardSDKTemplate } from './ShardSDK.gd';
import { recordingSDKTemplate } from './recording/RecordingSDK.gd';
import { errorTrackingSDKTemplate } from './error_tracking/ErrorTrackingSDK.gd';
import { shardMultiplayerTemplate } from './multiplayer/ShardMultiplayer.gd';
import { shardConnectionTemplate } from './multiplayer/ShardConnection.gd';
import { shardLobbyTemplate } from './multiplayer/ShardLobby.gd';
import { shardMatchTemplate } from './multiplayer/ShardMatch.gd';
import { shardInputTemplate } from './multiplayer/ShardInput.gd';
import { shardStateTemplate } from './multiplayer/ShardState.gd';
import { shardPredictionTemplate } from './multiplayer/ShardPrediction.gd';
import { shardProtocolTemplate } from './multiplayer/ShardProtocol.gd';
import { shardEventsTemplate } from './multiplayer/ShardEvents.gd';

/**
 * Register all Godot 4.x templates with the template engine
 */
export function registerGodot4Templates(engine: TemplateEngine): void {
  // Core templates
  engine.registerTemplate('godot4', 'plugin.cfg', pluginCfgTemplate);
  engine.registerTemplate('godot4', 'plugin.gd', pluginGdTemplate);
  engine.registerTemplate('godot4', 'ShardSDK.gd', shardSDKTemplate);

  // Recording templates
  engine.registerTemplate('godot4', 'recording/RecordingSDK.gd', recordingSDKTemplate);

  // Error tracking templates
  engine.registerTemplate('godot4', 'error_tracking/ErrorTrackingSDK.gd', errorTrackingSDKTemplate);

  // Multiplayer templates
  engine.registerTemplate('godot4', 'multiplayer/ShardMultiplayer.gd', shardMultiplayerTemplate);
  engine.registerTemplate('godot4', 'multiplayer/ShardConnection.gd', shardConnectionTemplate);
  engine.registerTemplate('godot4', 'multiplayer/ShardLobby.gd', shardLobbyTemplate);
  engine.registerTemplate('godot4', 'multiplayer/ShardMatch.gd', shardMatchTemplate);
  engine.registerTemplate('godot4', 'multiplayer/ShardInput.gd', shardInputTemplate);
  engine.registerTemplate('godot4', 'multiplayer/ShardState.gd', shardStateTemplate);
  engine.registerTemplate('godot4', 'multiplayer/ShardPrediction.gd', shardPredictionTemplate);
  engine.registerTemplate('godot4', 'multiplayer/ShardProtocol.gd', shardProtocolTemplate);
  engine.registerTemplate('godot4', 'multiplayer/ShardEvents.gd', shardEventsTemplate);
}
