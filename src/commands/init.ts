import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import * as path from 'path';
import {
  GodotVersion,
  GameType,
  ShardFeatures,
  createShardConfig,
  saveShardConfig,
  shardConfigExists,
  SHARD_CONFIG_FILE_NAME,
} from '../utils/shardConfig';
import { generate, GeneratorResult } from '../generator';
import { ForgeError, invalidInputError } from '../utils/errors';
import { warnIfNotGodotProject } from '../utils/godotProject';

export interface InitOptions {
  name?: string;
  godot?: string;
  type?: string;
  features?: string;
  yes?: boolean;
}

export interface InitAnswers {
  gameName: string;
  godotVersion: GodotVersion;
  gameType: GameType;
  features: ('recording' | 'errorTracking')[];
}

/**
 * Parse features string from CLI flag into array
 */
function parseFeatures(featuresStr: string | undefined): ('recording' | 'errorTracking')[] {
  if (!featuresStr) return [];
  
  const features: ('recording' | 'errorTracking')[] = [];
  const parts = featuresStr.split(',').map(f => f.trim().toLowerCase());
  
  for (const part of parts) {
    if (part === 'recording') {
      features.push('recording');
    } else if (part === 'errors' || part === 'errortracking' || part === 'error-tracking') {
      features.push('errorTracking');
    }
  }
  
  return features;
}

/**
 * Validate Godot version input
 */
function parseGodotVersion(version: string | undefined): GodotVersion | null {
  if (!version) return null;
  
  const normalized = version.trim().toLowerCase();
  if (normalized === '3' || normalized === '3.x' || normalized.startsWith('3.')) {
    return '3.x';
  }
  if (normalized === '4' || normalized === '4.x' || normalized.startsWith('4.')) {
    return '4.x';
  }
  
  return null;
}

/**
 * Validate game type input
 */
function parseGameType(type: string | undefined): GameType | null {
  if (!type) return null;
  
  const normalized = type.trim().toLowerCase();
  if (normalized === 'singleplayer' || normalized === 'single') {
    return 'singleplayer';
  }
  if (normalized === 'multiplayer' || normalized === 'multi') {
    return 'multiplayer';
  }
  
  return null;
}



/**
 * Run the init command
 */
export async function runInit(options: InitOptions): Promise<void> {
  // Check for existing config
  if (shardConfigExists() && !options.yes) {
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: `${SHARD_CONFIG_FILE_NAME} already exists. Overwrite?`,
        default: false,
      },
    ]);
    
    if (!overwrite) {
      console.log(chalk.gray('Cancelled.'));
      return;
    }
  }

  // Check if in Godot project directory (warn but allow proceeding)
  warnIfNotGodotProject();

  let answers: InitAnswers;

  // Non-interactive mode with -y flag
  if (options.yes && options.name && options.godot && options.type) {
    const godotVersion = parseGodotVersion(options.godot);
    const gameType = parseGameType(options.type);
    
    if (!godotVersion) {
      throw invalidInputError('Godot version', 'Use 3 or 4.');
    }
    
    if (!gameType) {
      throw invalidInputError('game type', 'Use singleplayer or multiplayer.');
    }
    
    answers = {
      gameName: options.name,
      godotVersion,
      gameType,
      features: parseFeatures(options.features),
    };
  } else {
    // Interactive mode
    answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'gameName',
        message: 'What is your game name?',
        default: options.name,
        validate: (input: string) => {
          if (!input.trim()) return 'Game name is required';
          if (input.length > 50) return 'Game name must be 50 characters or less';
          return true;
        },
      },
      {
        type: 'list',
        name: 'godotVersion',
        message: 'Which Godot version are you using?',
        choices: [
          { name: 'Godot 4.x (4.0+)', value: '4.x' },
          { name: 'Godot 3.x (3.0-3.5)', value: '3.x' },
        ],
        default: options.godot ? (parseGodotVersion(options.godot) === '3.x' ? 1 : 0) : 0,
      },
      {
        type: 'list',
        name: 'gameType',
        message: 'What type of game are you building?',
        choices: [
          { name: 'Singleplayer', value: 'singleplayer' },
          { name: 'Multiplayer', value: 'multiplayer' },
        ],
        default: options.type ? (parseGameType(options.type) === 'multiplayer' ? 1 : 0) : 0,
      },
      {
        type: 'checkbox',
        name: 'features',
        message: 'Which features do you want to enable?',
        choices: [
          { name: 'Recording - Capture gameplay clips', value: 'recording', checked: true },
          { name: 'Error Tracking - Monitor crashes and errors', value: 'errorTracking', checked: true },
        ],
      },
    ]);
  }

  // Build features object
  const features: Partial<ShardFeatures> = {
    recording: answers.features.includes('recording'),
    errorTracking: answers.features.includes('errorTracking'),
    // multiplayer is auto-set based on gameType in createShardConfig
  };

  // Create and save config
  const config = createShardConfig(
    answers.gameName,
    answers.godotVersion,
    answers.gameType,
    features
  );

  saveShardConfig(config);

  // Display success message
  console.log('');
  console.log(chalk.green(`✓ Created ${SHARD_CONFIG_FILE_NAME}`));
  console.log('');
  console.log(chalk.cyan('Configuration:'));
  console.log(`  Game: ${chalk.bold(config.gameName)}`);
  console.log(`  Godot: ${chalk.bold(config.godotVersion)}`);
  console.log(`  Type: ${chalk.bold(config.gameType)}`);
  console.log('');
  console.log(chalk.cyan('Enabled features:'));
  if (config.features.recording) {
    console.log(`  ${chalk.green('✓')} Recording`);
  }
  if (config.features.errorTracking) {
    console.log(`  ${chalk.green('✓')} Error Tracking`);
  }
  if (config.features.multiplayer) {
    console.log(`  ${chalk.green('✓')} Multiplayer`);
  }
  
  // Generate SDK
  console.log('');
  console.log(chalk.cyan('Generating SDK...'));
  
  const outputDir = path.join(process.cwd(), 'addons', 'shard_sdk');
  const result = await generate(config, outputDir, { force: true });
  
  if (result.success && result.filesGenerated.length > 0) {
    console.log(chalk.green(`✓ Generated ${result.filesGenerated.length} files in addons/shard_sdk/`));
    
    // Display generated file summary
    displayGeneratedFileSummary(result);
  } else if (result.errors.length > 0) {
    console.log(chalk.yellow('⚠ SDK generation completed with errors:'));
    for (const error of result.errors) {
      console.log(chalk.yellow(`  - ${error}`));
    }
  }
  
  // Display next steps
  displayNextSteps(config);
}

/**
 * Display next steps after successful initialization
 */
function displayNextSteps(config: { gameName: string; godotVersion: string; features: { recording: boolean; errorTracking: boolean; multiplayer: boolean } }): void {
  console.log('');
  console.log(chalk.cyan('━━━ Next Steps ━━━'));
  console.log('');
  
  // Step 1: Enable plugin
  console.log(chalk.white('1. Enable the plugin in Godot:'));
  console.log(chalk.gray('   Project → Project Settings → Plugins → Enable "Shard SDK"'));
  console.log('');
  
  // Step 2: Access SDK
  console.log(chalk.white('2. Access the SDK in your game code:'));
  console.log(chalk.gray('   The ShardSDK autoload singleton is available globally'));
  console.log('');
  
  // Feature-specific steps
  let stepNum = 3;
  
  if (config.features.recording) {
    console.log(chalk.white(`${stepNum}. Set up recording events:`));
    console.log(chalk.gray(`   Run: ${chalk.yellow('shardkit recording add')} to create events`));
    console.log(chalk.gray(`   Then use: ${chalk.yellow('ShardSDK.recording.trigger_event("event_id")')}`));
    console.log('');
    stepNum++;
  }
  
  if (config.features.errorTracking) {
    console.log(chalk.white(`${stepNum}. Configure error tracking:`));
    console.log(chalk.gray(`   Errors are captured automatically`));
    console.log(chalk.gray(`   Manual reporting: ${chalk.yellow('ShardSDK.errors.report_error("message")')}`));
    console.log('');
    stepNum++;
  }
  
  if (config.features.multiplayer) {
    console.log(chalk.white(`${stepNum}. Connect to multiplayer server:`));
    console.log(chalk.gray(`   ${chalk.yellow('ShardSDK.multiplayer.connect_to_server("ws://your-server:8080")')}`));
    console.log('');
    stepNum++;
  }
  
  // Documentation links
  console.log(chalk.cyan('━━━ Documentation ━━━'));
  console.log('');
  console.log(chalk.gray('  Getting Started:  ') + chalk.blue('https://shard.gg/docs/getting-started'));
  console.log(chalk.gray('  ShardKit CLI:     ') + chalk.blue('https://shard.gg/docs/shardkit'));
  if (config.features.recording) {
    console.log(chalk.gray('  Recording SDK:    ') + chalk.blue('https://shard.gg/docs/recording'));
  }
  if (config.features.errorTracking) {
    console.log(chalk.gray('  Error Tracking:   ') + chalk.blue('https://shard.gg/docs/error-tracking'));
  }
  if (config.features.multiplayer) {
    console.log(chalk.gray('  Multiplayer SDK:  ') + chalk.blue('https://shard.gg/docs/multiplayer'));
  }
  console.log('');
}

/**
 * Display a summary of generated files grouped by category
 */
function displayGeneratedFileSummary(result: GeneratorResult): void {
  const coreFiles: string[] = [];
  const recordingFiles: string[] = [];
  const errorTrackingFiles: string[] = [];
  const multiplayerFiles: string[] = [];
  const otherFiles: string[] = [];

  for (const file of result.filesGenerated) {
    const relativePath = path.relative(process.cwd(), file);
    const fileName = path.basename(file);
    
    if (relativePath.includes('/recording/')) {
      recordingFiles.push(fileName);
    } else if (relativePath.includes('/error_tracking/')) {
      errorTrackingFiles.push(fileName);
    } else if (relativePath.includes('/multiplayer/')) {
      multiplayerFiles.push(fileName);
    } else if (['plugin.cfg', 'plugin.gd', 'ShardSDK.gd'].includes(fileName)) {
      coreFiles.push(fileName);
    } else {
      otherFiles.push(fileName);
    }
  }

  console.log(chalk.gray('  Files:'));
  if (coreFiles.length > 0) {
    console.log(chalk.gray(`    Core: ${coreFiles.join(', ')}`));
  }
  if (recordingFiles.length > 0) {
    console.log(chalk.gray(`    Recording: ${recordingFiles.join(', ')}`));
  }
  if (errorTrackingFiles.length > 0) {
    console.log(chalk.gray(`    Error Tracking: ${errorTrackingFiles.join(', ')}`));
  }
  if (multiplayerFiles.length > 0) {
    console.log(chalk.gray(`    Multiplayer: ${multiplayerFiles.length} files`));
  }
  if (otherFiles.length > 0) {
    console.log(chalk.gray(`    Other: ${otherFiles.join(', ')}`));
  }
}

/**
 * Register the init command with the CLI
 */
export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize Shard SDK configuration and generate the Godot addon')
    .option('--name <name>', 'Game name (used for event ID generation)')
    .option('--godot <version>', 'Godot version: 3 or 4')
    .option('--type <type>', 'Game type: singleplayer or multiplayer')
    .option('--features <features>', 'Comma-separated features: recording,errors')
    .option('-y, --yes', 'Accept defaults and skip interactive prompts')
    .addHelpText('after', `
Examples:
  $ shardkit init                                    Interactive setup
  $ shardkit init --name "My Game" --godot 4         Partial flags (prompts for rest)
  $ shardkit init --name "My Game" --godot 4 --type singleplayer -y
                                                  Non-interactive with all flags

Features:
  recording      Capture gameplay clips and highlights
  errors         Monitor crashes and runtime errors

The command will:
  1. Create shard.config.json with your settings
  2. Generate addons/shard_sdk/ with selected features
  3. Display next steps for enabling the plugin`)
    .action(async (options: InitOptions) => {
      try {
        await runInit(options);
      } catch (error) {
        if (ForgeError.isForgeError(error)) {
          console.error(chalk.red(`Error: ${error.message}`));
          if (error.suggestion) {
            console.log(chalk.gray(error.suggestion));
          }
        } else {
          console.error(chalk.red(`Error: ${(error as Error).message}`));
        }
        process.exit(1);
      }
    });
}
