#!/usr/bin/env node

import { Command } from 'commander';
import { registerRecordingCommands } from './commands/recording';
import { registerCloudCommands } from './commands/cloud';
import { registerSocialCommands } from './commands/social';

const program = new Command();

program
  .name('shard')
  .description('Shard CLI - Command line tools for game developers')
  .version('1.0.0');

// Register command groups
registerRecordingCommands(program);
registerCloudCommands(program);
registerSocialCommands(program);

program.parse();
