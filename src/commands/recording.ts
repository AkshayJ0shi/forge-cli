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
  CONFIG_FILE_NAME 
} from '../utils/config';

export function registerRecordingCommands(program: Command): void {
  const recording = program
    .command('recording')
    .description('Manage auto-recording events for your game');

  // shard recording init
  recording
    .command('init')
    .description('Initialize recording configuration for your game')
    .action(async () => {
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
        console.log(`  1. Add events with: ${chalk.yellow('shard recording add')}`);
        console.log(`  2. Export for your game: ${chalk.yellow('shard recording export')}`);
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
      const config = loadConfig();
      if (!config) {
        console.error(chalk.red(`Error: No ${CONFIG_FILE_NAME} found. Run 'shard recording init' first.`));
        process.exit(1);
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
    });

  // shard recording list
  recording
    .command('list')
    .description('List all configured recording events')
    .action(() => {
      const config = loadConfig();
      if (!config) {
        console.error(chalk.red(`Error: No ${CONFIG_FILE_NAME} found. Run 'shard recording init' first.`));
        process.exit(1);
      }

      console.log(chalk.cyan(`Recording events for ${chalk.bold(config.gameName)}:`));
      console.log('');

      if (config.events.length === 0) {
        console.log(chalk.gray('  No events configured yet.'));
        console.log(chalk.gray(`  Add one with: shard recording add`));
        return;
      }

      config.events.forEach((event, index) => {
        console.log(`  ${index + 1}. ${chalk.bold(event.name)}`);
        console.log(chalk.gray(`     ID: ${event.id}`));
      });
    });

  // shard recording remove
  recording
    .command('remove')
    .description('Remove a recording event')
    .action(async () => {
      const config = loadConfig();
      if (!config) {
        console.error(chalk.red(`Error: No ${CONFIG_FILE_NAME} found. Run 'shard recording init' first.`));
        process.exit(1);
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
    });

  // shard recording export
  recording
    .command('export')
    .description('Export events to game_events.json')
    .option('-o, --output <path>', 'Output file path', 'game_events.json')
    .action((options) => {
      const config = loadConfig();
      if (!config) {
        console.error(chalk.red(`Error: No ${CONFIG_FILE_NAME} found. Run 'shard recording init' first.`));
        process.exit(1);
      }

      if (config.events.length === 0) {
        console.log(chalk.yellow('No events to export. Add events first with: shard recording add'));
        return;
      }

      try {
        exportToGameEvents(config, options.output);
        console.log(chalk.green(`✓ Exported ${config.events.length} events to ${options.output}`));
        console.log('');
        console.log(chalk.cyan('Next steps:'));
        console.log(`  1. Include ${options.output} in your game build`);
        console.log(`  2. Use the event IDs in your game code to trigger recordings`);
      } catch (error) {
        console.error(chalk.red(`Error: ${(error as Error).message}`));
        process.exit(1);
      }
    });

  // shard recording validate
  recording
    .command('validate')
    .description('Validate the recording configuration')
    .action(() => {
      const config = loadConfig();
      if (!config) {
        console.error(chalk.red(`Error: No ${CONFIG_FILE_NAME} found. Run 'shard recording init' first.`));
        process.exit(1);
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
    });
}
