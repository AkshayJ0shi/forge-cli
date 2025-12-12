#!/usr/bin/env node

import { Command } from 'commander';
import { registerInitCommand } from './commands/init';
import { registerGenerateCommand } from './commands/generate';
import { registerRecordingCommands } from './commands/recording';

const program = new Command();

program
  .name('shardkit')
  .description('ShardKit - CLI tools for Shard game developers\n\nGenerate customized Godot addons with Recording, Error Tracking, and Multiplayer features.')
  .version('1.0.0')
  .addHelpText('after', `
Examples:
  $ shardkit init                    Initialize a new Shard SDK project
  $ shardkit generate                Regenerate SDK from existing config
  $ shardkit recording add           Add a new recording event
  $ shardkit recording list          List all recording events

Documentation: https://shard.gg/docs/shardkit`);

// Register command groups
registerInitCommand(program);
registerGenerateCommand(program);
registerRecordingCommands(program);

program.parse();
