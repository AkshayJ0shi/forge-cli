import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'path';
import {
  loadShardConfig,
  validateShardConfig,
  shardConfigExists,
  legacyConfigExists,
  SHARD_CONFIG_FILE_NAME,
} from '../utils/shardConfig';
import { generate, GeneratorResult } from '../generator';
import { 
  ForgeError, 
  configNotFoundError, 
  configInvalidError,
  generationFailedError 
} from '../utils/errors';
import { warnIfNotGodotProject } from '../utils/godotProject';

export interface GenerateOptions {
  force?: boolean;
  clean?: boolean;
}

/**
 * Get the default output directory for the SDK addon
 */
function getDefaultOutputDir(): string {
  return path.join(process.cwd(), 'addons', 'shard_sdk');
}



/**
 * Display generation results
 */
function displayResults(result: GeneratorResult): void {
  console.log('');
  
  if (result.filesGenerated.length > 0) {
    console.log(chalk.green(`✓ Generated ${result.filesGenerated.length} files:`));
    for (const file of result.filesGenerated) {
      const relativePath = path.relative(process.cwd(), file);
      console.log(chalk.gray(`  ${relativePath}`));
    }
  }

  if (result.filesSkipped.length > 0) {
    console.log('');
    console.log(chalk.yellow(`⚠ Skipped ${result.filesSkipped.length} files (already exist):`));
    for (const file of result.filesSkipped) {
      const relativePath = path.relative(process.cwd(), file);
      console.log(chalk.gray(`  ${relativePath}`));
    }
    console.log(chalk.gray('  Use --force to overwrite existing files'));
  }

  if (result.errors.length > 0) {
    console.log('');
    console.log(chalk.red(`✗ ${result.errors.length} errors:`));
    for (const error of result.errors) {
      console.log(chalk.red(`  ${error}`));
    }
  }
}


/**
 * Display next steps after generation
 */
function displayNextSteps(hasRecording: boolean): void {
  console.log('');
  console.log(chalk.cyan('Next steps:'));
  console.log(`  1. Enable the plugin in Godot: Project → Project Settings → Plugins`);
  console.log(`  2. Access the SDK via the ${chalk.yellow('ShardSDK')} autoload singleton`);
  if (hasRecording) {
    console.log(`  3. Add recording events with: ${chalk.yellow('shardkit recording add')}`);
  }
  console.log('');
  console.log(chalk.gray('Documentation: https://shard.gg/docs/shardkit'));
}

/**
 * Run the generate command
 */
export async function runGenerate(options: GenerateOptions): Promise<void> {
  // Check for config file
  if (!shardConfigExists()) {
    if (legacyConfigExists()) {
      throw configNotFoundError(`${SHARD_CONFIG_FILE_NAME} (found legacy shard.recording.json)`);
    }
    throw configNotFoundError(SHARD_CONFIG_FILE_NAME);
  }

  // Load config
  const config = loadShardConfig();
  if (!config) {
    throw generationFailedError(`Failed to load ${SHARD_CONFIG_FILE_NAME}`);
  }

  // Validate config
  const validation = validateShardConfig(config);
  if (!validation.valid) {
    throw configInvalidError(validation.errors);
  }

  // Check if in Godot project directory (warn but allow proceeding)
  warnIfNotGodotProject();

  // Display what we're generating
  console.log(chalk.cyan('Generating Shard SDK...'));
  console.log(`  Game: ${chalk.bold(config.gameName)}`);
  console.log(`  Godot: ${chalk.bold(config.godotVersion)}`);
  console.log(`  Features: ${getEnabledFeaturesString(config)}`);

  // Clean output directory if requested
  const outputDir = getDefaultOutputDir();
  if (options.clean) {
    console.log(chalk.gray(`  Cleaning ${path.relative(process.cwd(), outputDir)}...`));
  }

  // Generate SDK
  const result = await generate(config, outputDir, {
    force: options.force,
    clean: options.clean,
  });

  // Display results
  displayResults(result);

  if (result.success && result.filesGenerated.length > 0) {
    displayNextSteps(config.features.recording);
  } else if (!result.success) {
    throw generationFailedError(result.errors.join(', ') || 'Unknown error');
  }
}

/**
 * Get a string representation of enabled features
 */
function getEnabledFeaturesString(config: { features: { recording: boolean; errorTracking: boolean; multiplayer: boolean } }): string {
  const features: string[] = [];
  if (config.features.recording) features.push('Recording');
  if (config.features.errorTracking) features.push('Error Tracking');
  if (config.features.multiplayer) features.push('Multiplayer');
  return features.length > 0 ? features.join(', ') : 'None';
}

/**
 * Register the generate command with the CLI
 */
export function registerGenerateCommand(program: Command): void {
  program
    .command('generate')
    .description('Regenerate the Shard SDK addon from shard.config.json')
    .option('--force', 'Overwrite existing files without prompting')
    .option('--clean', 'Remove existing addon directory before generating')
    .addHelpText('after', `
Examples:
  $ shardkit generate                Regenerate SDK (skips existing files)
  $ shardkit generate --force        Regenerate and overwrite all files
  $ shardkit generate --clean        Remove addon folder and regenerate fresh

Use this command after:
  - Modifying shard.config.json manually
  - Adding or removing features
  - Updating to a new Godot version

Note: Run 'shardkit init' first if shard.config.json doesn't exist.`)
    .action(async (options: GenerateOptions) => {
      try {
        await runGenerate(options);
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
