import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { generateEventId, isValidEventId } from '../utils/eventId';
import { 
  initConfig, 
  loadConfig, 
  saveConfig, 
  exportToGameEvents, 
  validateConfig,
  CONFIG_FILE_NAME,
  RecordingConfig
} from '../utils/config';
import {
  loadShardConfig,
  saveShardConfig,
  shardConfigExists,
  SHARD_CONFIG_FILE_NAME,
  RecordingEvent
} from '../utils/shardConfig';
import { 
  ForgeError, 
  configNotFoundError, 
  featureNotEnabledError 
} from '../utils/errors';

/**
 * Display a ForgeError with proper formatting
 */
function handleForgeError(error: ForgeError): never {
  console.error(chalk.red(`Error: ${error.message}`));
  if (error.suggestion) {
    console.log(chalk.gray(error.suggestion));
  }
  process.exit(1);
}

/**
 * Check if recording feature is enabled, throw if not
 */
function requireRecordingFeature(shardConfig: { features: { recording: boolean } }): void {
  if (!shardConfig.features.recording) {
    throw featureNotEnabledError('Recording', SHARD_CONFIG_FILE_NAME);
  }
}

/**
 * Require a config file exists, throw if not
 */
function requireConfig(): never {
  throw configNotFoundError(`${SHARD_CONFIG_FILE_NAME} or ${CONFIG_FILE_NAME}`);
}

export function registerRecordingCommands(program: Command): void {
  const recording = program
    .command('recording')
    .description('Manage auto-recording events for your game');

  // shard recording init (DEPRECATED)
  recording
    .command('init')
    .description('Initialize recording configuration for your game (DEPRECATED: use "shardkit init" instead)')
    .action(async () => {
      // Show deprecation warning
      console.log(chalk.yellow('⚠️  Warning: "shardkit recording init" is deprecated.'));
      console.log(chalk.yellow(`   Use ${chalk.bold('shardkit init')} instead to create a unified SDK configuration.`));
      console.log('');

      // Check if shard.config.json already exists
      if (shardConfigExists()) {
        console.error(chalk.red(`Error: ${SHARD_CONFIG_FILE_NAME} already exists.`));
        console.error(chalk.yellow(`Use 'shardkit recording add' to add events to your existing configuration.`));
        process.exit(1);
      }

      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'gameName',
          message: 'What is your game name?',
          validate: (input: string) => {
            if (!input.trim()) return 'Game name is required';
            if (input.length > 50) return 'Game name must be 50 characters or less';
            return true;
          }
        }
      ]);

      try {
        initConfig(answers.gameName);
        console.log(chalk.green(`✓ Created ${CONFIG_FILE_NAME}`));
        console.log(chalk.gray(`  Game: ${answers.gameName}`));
        console.log('');
        console.log(chalk.cyan('Next steps:'));
        console.log(`  1. Add events with: ${chalk.yellow('shardkit recording add')}`);
        console.log(`  2. Export for your game: ${chalk.yellow('shardkit recording export')}`);
        console.log('');
        console.log(chalk.gray(`Tip: Consider migrating to ${chalk.bold('shardkit init')} for unified SDK generation.`));
      } catch (error) {
        console.error(chalk.red(`Error: ${(error as Error).message}`));
        process.exit(1);
      }
    });

  // shard recording add
  recording
    .command('add')
    .description('Add a new recording event')
    .action(async () => {
      try {
        // Try new shard.config.json first
        const shardConfig = loadShardConfig();
        if (shardConfig) {
          // Check if recording feature is enabled
          requireRecordingFeature(shardConfig);

        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'eventName',
            message: 'Event name (e.g., "Boss Defeated"):',
            validate: (input: string) => {
              if (!input.trim()) return 'Event name is required';
              if (input.length < 3) return 'Event name must be at least 3 characters';
              if (input.length > 50) return 'Event name must be 50 characters or less';
              return true;
            }
          }
        ]);

        const eventId = generateEventId(shardConfig.gameName);
        const newEvent: RecordingEvent = {
          id: eventId,
          name: answers.eventName.trim(),
          createdAt: new Date().toISOString()
        };

        // Initialize recording.events if not present
        if (!shardConfig.recording) {
          shardConfig.recording = { events: [] };
        }
        shardConfig.recording.events.push(newEvent);

        saveShardConfig(shardConfig);
        console.log(chalk.green(`✓ Added event: ${answers.eventName}`));
        console.log(chalk.gray(`  Event ID: ${eventId}`));
        console.log('');
          console.log(chalk.cyan('Copy this ID to use in your game code:'));
          console.log(chalk.yellow(`  "${eventId}"`));
          return;
        }

        // Fall back to legacy shard.recording.json
        const config = loadConfig();
        if (!config) {
          requireConfig();
        }

        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'eventName',
            message: 'Event name (e.g., "Boss Defeated"):',
            validate: (input: string) => {
              if (!input.trim()) return 'Event name is required';
              if (input.length < 3) return 'Event name must be at least 3 characters';
              if (input.length > 50) return 'Event name must be 50 characters or less';
              return true;
            }
          }
        ]);

        const eventId = generateEventId(config.gameName);
        config.events.push({
          id: eventId,
          name: answers.eventName.trim(),
          createdAt: new Date().toISOString()
        });

        saveConfig(config);
        console.log(chalk.green(`✓ Added event: ${answers.eventName}`));
        console.log(chalk.gray(`  Event ID: ${eventId}`));
        console.log('');
        console.log(chalk.cyan('Copy this ID to use in your game code:'));
        console.log(chalk.yellow(`  "${eventId}"`));
      } catch (error) {
        if (ForgeError.isForgeError(error)) {
          handleForgeError(error);
        }
        throw error;
      }
    });

  // shard recording list
  recording
    .command('list')
    .description('List all configured recording events')
    .action(() => {
      try {
        // Try new shard.config.json first
        const shardConfig = loadShardConfig();
        if (shardConfig) {
          // Check if recording feature is enabled
          requireRecordingFeature(shardConfig);

          console.log(chalk.cyan(`Recording events for ${chalk.bold(shardConfig.gameName)}:`));
          console.log('');

          const events = shardConfig.recording?.events || [];
          if (events.length === 0) {
            console.log(chalk.gray('  No events configured yet.'));
            console.log(chalk.gray(`  Add one with: shardkit recording add`));
            return;
          }

          events.forEach((event, index) => {
            console.log(`  ${index + 1}. ${chalk.bold(event.name)}`);
            console.log(chalk.gray(`     ID: ${event.id}`));
          });
          return;
        }

        // Fall back to legacy shard.recording.json
        const config = loadConfig();
        if (!config) {
          requireConfig();
        }

        console.log(chalk.cyan(`Recording events for ${chalk.bold(config.gameName)}:`));
        console.log('');

        if (config.events.length === 0) {
          console.log(chalk.gray('  No events configured yet.'));
          console.log(chalk.gray(`  Add one with: shardkit recording add`));
          return;
        }

        config.events.forEach((event, index) => {
          console.log(`  ${index + 1}. ${chalk.bold(event.name)}`);
          console.log(chalk.gray(`     ID: ${event.id}`));
        });
      } catch (error) {
        if (ForgeError.isForgeError(error)) {
          handleForgeError(error);
        }
        throw error;
      }
    });

  // shardkit recording remove
  recording
    .command('remove')
    .description('Remove a recording event')
    .action(async () => {
      try {
        // Try new shard.config.json first
        const shardConfig = loadShardConfig();
        if (shardConfig) {
          // Check if recording feature is enabled
          requireRecordingFeature(shardConfig);

          const events = shardConfig.recording?.events || [];
          if (events.length === 0) {
            console.log(chalk.yellow('No events to remove.'));
            return;
          }

          const choices = events.map((event, index) => ({
            name: `${event.name} (${event.id})`,
            value: index
          }));

          const answers = await inquirer.prompt([
            {
              type: 'list',
              name: 'eventIndex',
              message: 'Select event to remove:',
              choices
            },
            {
              type: 'confirm',
              name: 'confirm',
              message: 'Are you sure?',
              default: false
            }
          ]);

          if (answers.confirm) {
            const removed = events.splice(answers.eventIndex, 1)[0];
            shardConfig.recording!.events = events;
            saveShardConfig(shardConfig);
            console.log(chalk.green(`✓ Removed event: ${removed.name}`));
          } else {
            console.log(chalk.gray('Cancelled.'));
          }
          return;
        }

        // Fall back to legacy shard.recording.json
        const config = loadConfig();
        if (!config) {
          requireConfig();
        }

        if (config.events.length === 0) {
          console.log(chalk.yellow('No events to remove.'));
          return;
        }

        const choices = config.events.map((event, index) => ({
          name: `${event.name} (${event.id})`,
          value: index
        }));

        const answers = await inquirer.prompt([
          {
            type: 'list',
            name: 'eventIndex',
            message: 'Select event to remove:',
            choices
          },
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Are you sure?',
            default: false
          }
        ]);

        if (answers.confirm) {
          const removed = config.events.splice(answers.eventIndex, 1)[0];
          saveConfig(config);
          console.log(chalk.green(`✓ Removed event: ${removed.name}`));
        } else {
          console.log(chalk.gray('Cancelled.'));
        }
      } catch (error) {
        if (ForgeError.isForgeError(error)) {
          handleForgeError(error);
        }
        throw error;
      }
    });

  // shard recording export
  recording
    .command('export')
    .description('Export events to game_events.json')
    .option('-o, --output <path>', 'Output file path', 'game_events.json')
    .action((options) => {
      try {
        // Try new shard.config.json first
        const shardConfig = loadShardConfig();
        if (shardConfig) {
          // Check if recording feature is enabled
          requireRecordingFeature(shardConfig);

          const events = shardConfig.recording?.events || [];
          if (events.length === 0) {
            console.log(chalk.yellow('No events to export. Add events first with: shardkit recording add'));
            return;
          }

          // Convert to legacy format for export
          const legacyConfig: RecordingConfig = {
            gameName: shardConfig.gameName,
            events: events
          };
          exportToGameEvents(legacyConfig, options.output);
          console.log(chalk.green(`✓ Exported ${events.length} events to ${options.output}`));
          console.log('');
          console.log(chalk.cyan('Next steps:'));
          console.log(`  1. Include ${options.output} in your game build`);
          console.log(`  2. Use the event IDs in your game code to trigger recordings`);
          return;
        }

        // Fall back to legacy shard.recording.json
        const config = loadConfig();
        if (!config) {
          requireConfig();
        }

        if (config.events.length === 0) {
          console.log(chalk.yellow('No events to export. Add events first with: shardkit recording add'));
          return;
        }

        exportToGameEvents(config, options.output);
        console.log(chalk.green(`✓ Exported ${config.events.length} events to ${options.output}`));
        console.log('');
        console.log(chalk.cyan('Next steps:'));
        console.log(`  1. Include ${options.output} in your game build`);
        console.log(`  2. Use the event IDs in your game code to trigger recordings`);
      } catch (error) {
        if (ForgeError.isForgeError(error)) {
          handleForgeError(error);
        }
        console.error(chalk.red(`Error: ${(error as Error).message}`));
        process.exit(1);
      }
    });

  // shard recording validate
  recording
    .command('validate')
    .description('Validate the recording configuration')
    .action(() => {
      try {
        // Try new shard.config.json first
        const shardConfig = loadShardConfig();
        if (shardConfig) {
          // Check if recording feature is enabled
          requireRecordingFeature(shardConfig);

          // Validate recording events
          const events = shardConfig.recording?.events || [];
          const errors: string[] = [];
          const seenIds = new Set<string>();

          for (const event of events) {
            if (!isValidEventId(event.id)) {
              errors.push(`Invalid event ID format: ${event.id}`);
            }
            
            if (seenIds.has(event.id)) {
              errors.push(`Duplicate event ID: ${event.id}`);
            }
            seenIds.add(event.id);

            if (!event.name || event.name.length < 3) {
              errors.push(`Event name too short: "${event.name}" (minimum 3 characters)`);
            }

            if (event.name && event.name.length > 50) {
              errors.push(`Event name too long: "${event.name}" (maximum 50 characters)`);
            }
          }

          if (errors.length === 0) {
            console.log(chalk.green('✓ Recording configuration is valid'));
            console.log(chalk.gray(`  Game: ${shardConfig.gameName}`));
            console.log(chalk.gray(`  Events: ${events.length}`));
          } else {
            console.log(chalk.red('✗ Recording configuration has errors:'));
            errors.forEach(error => {
              console.log(chalk.red(`  - ${error}`));
            });
            process.exit(1);
          }
          return;
        }

        // Fall back to legacy shard.recording.json
        const config = loadConfig();
        if (!config) {
          requireConfig();
        }

        const result = validateConfig(config);
        
        if (result.valid) {
          console.log(chalk.green('✓ Configuration is valid'));
          console.log(chalk.gray(`  Game: ${config.gameName}`));
          console.log(chalk.gray(`  Events: ${config.events.length}`));
        } else {
          console.log(chalk.red('✗ Configuration has errors:'));
          result.errors.forEach(error => {
            console.log(chalk.red(`  - ${error}`));
          });
          process.exit(1);
        }
      } catch (error) {
        if (ForgeError.isForgeError(error)) {
          handleForgeError(error);
        }
        throw error;
      }
    });
}
