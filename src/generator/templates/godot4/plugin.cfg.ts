import { TemplateContext, TemplateFunction } from '../../utils/templateEngine';

/**
 * Godot 4.x plugin.cfg template
 * Generates the plugin configuration file for the Shard SDK addon
 */
export const pluginCfgTemplate: TemplateFunction = (context: TemplateContext): string => {
  return `[plugin]

name="Shard SDK"
description="Unified SDK for ${context.gameName} - Recording, Error Tracking, and Multiplayer features"
author="Shard"
version="1.0.0"
script="plugin.gd"
`;
};

export default pluginCfgTemplate;
