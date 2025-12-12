import * as path from 'path';
import { ShardConfig } from '../utils/shardConfig';
import { FileWriter, FileWriterOptions } from './utils/fileWriter';
import { TemplateEngine, TemplateContext } from './utils/templateEngine';
import { registerGodot4Templates } from './templates/godot4';
import { registerGodot3Templates } from './templates/godot3';

export interface GeneratorOptions {
  force?: boolean;
  clean?: boolean;
}

export interface GeneratorResult {
  success: boolean;
  filesGenerated: string[];
  filesSkipped: string[];
  errors: string[];
}

/**
 * Main SDK generator orchestrator
 * Coordinates template generation based on config features
 */
export class SDKGenerator {
  private config: ShardConfig;
  private outputDir: string;
  private fileWriter: FileWriter;
  private templateEngine: TemplateEngine;
  private options: GeneratorOptions;

  constructor(
    config: ShardConfig,
    outputDir: string,
    options: GeneratorOptions = {}
  ) {
    this.config = config;
    this.outputDir = outputDir;
    this.options = options;
    this.fileWriter = new FileWriter({
      force: options.force ?? false,
    });
    this.templateEngine = new TemplateEngine();
    
    // Register templates for both Godot versions
    registerGodot4Templates(this.templateEngine);
    registerGodot3Templates(this.templateEngine);
  }

  /**
   * Get the template context from config
   */
  private getTemplateContext(): TemplateContext {
    return {
      gameName: this.config.gameName,
      godotVersion: this.config.godotVersion,
      features: {
        recording: this.config.features.recording,
        errorTracking: this.config.features.errorTracking,
        multiplayer: this.config.features.multiplayer,
      },
    };
  }

  /**
   * Get the template directory based on Godot version
   */
  private getTemplateDir(): string {
    return this.config.godotVersion === '4.x' ? 'godot4' : 'godot3';
  }


  /**
   * Clean the output directory if --clean flag is set
   */
  async cleanOutputDir(): Promise<void> {
    if (this.options.clean) {
      await this.fileWriter.removeDirectory(this.outputDir);
    }
  }

  /**
   * Generate the SDK based on config
   */
  async generate(): Promise<GeneratorResult> {
    const result: GeneratorResult = {
      success: true,
      filesGenerated: [],
      filesSkipped: [],
      errors: [],
    };

    try {
      // Clean output directory if requested
      await this.cleanOutputDir();

      const context = this.getTemplateContext();
      const templateDir = this.getTemplateDir();

      // Generate core plugin files
      await this.generateCoreFiles(context, templateDir, result);

      // Generate feature-specific files based on enabled features
      if (this.config.features.recording) {
        await this.generateRecordingFiles(context, templateDir, result);
      }

      if (this.config.features.errorTracking) {
        await this.generateErrorTrackingFiles(context, templateDir, result);
      }

      if (this.config.features.multiplayer) {
        await this.generateMultiplayerFiles(context, templateDir, result);
      }

      // Generate README
      await this.generateReadme(context, result);

    } catch (error) {
      result.success = false;
      result.errors.push((error as Error).message);
    }

    return result;
  }

  /**
   * Generate core plugin files (plugin.cfg, plugin.gd, ShardSDK.gd)
   */
  private async generateCoreFiles(
    context: TemplateContext,
    templateDir: string,
    result: GeneratorResult
  ): Promise<void> {
    const coreFiles = [
      { name: 'plugin.cfg', template: 'plugin.cfg' },
      { name: 'plugin.gd', template: 'plugin.gd' },
      { name: 'ShardSDK.gd', template: 'ShardSDK.gd' },
    ];

    for (const file of coreFiles) {
      const outputPath = path.join(this.outputDir, file.name);
      const content = await this.templateEngine.render(templateDir, file.template, context);
      
      const writeResult = await this.fileWriter.writeFile(outputPath, content);
      if (writeResult.written) {
        result.filesGenerated.push(outputPath);
      } else if (writeResult.skipped) {
        result.filesSkipped.push(outputPath);
      }
    }
  }

  /**
   * Generate recording SDK files
   */
  private async generateRecordingFiles(
    context: TemplateContext,
    templateDir: string,
    result: GeneratorResult
  ): Promise<void> {
    const recordingDir = path.join(this.outputDir, 'recording');
    const files = ['RecordingSDK.gd'];

    for (const file of files) {
      const outputPath = path.join(recordingDir, file);
      const templatePath = `recording/${file}`;
      const content = await this.templateEngine.render(templateDir, templatePath, context);
      
      const writeResult = await this.fileWriter.writeFile(outputPath, content);
      if (writeResult.written) {
        result.filesGenerated.push(outputPath);
      } else if (writeResult.skipped) {
        result.filesSkipped.push(outputPath);
      }
    }
  }

  /**
   * Generate error tracking SDK files
   */
  private async generateErrorTrackingFiles(
    context: TemplateContext,
    templateDir: string,
    result: GeneratorResult
  ): Promise<void> {
    const errorTrackingDir = path.join(this.outputDir, 'error_tracking');
    const files = ['ErrorTrackingSDK.gd'];

    for (const file of files) {
      const outputPath = path.join(errorTrackingDir, file);
      const templatePath = `error_tracking/${file}`;
      const content = await this.templateEngine.render(templateDir, templatePath, context);
      
      const writeResult = await this.fileWriter.writeFile(outputPath, content);
      if (writeResult.written) {
        result.filesGenerated.push(outputPath);
      } else if (writeResult.skipped) {
        result.filesSkipped.push(outputPath);
      }
    }
  }

  /**
   * Generate multiplayer SDK files
   */
  private async generateMultiplayerFiles(
    context: TemplateContext,
    templateDir: string,
    result: GeneratorResult
  ): Promise<void> {
    const multiplayerDir = path.join(this.outputDir, 'multiplayer');
    const files = [
      'ShardMultiplayer.gd',
      'ShardConnection.gd',
      'ShardLobby.gd',
      'ShardMatch.gd',
      'ShardInput.gd',
      'ShardState.gd',
      'ShardPrediction.gd',
      'ShardProtocol.gd',
      'ShardEvents.gd',
    ];

    for (const file of files) {
      const outputPath = path.join(multiplayerDir, file);
      const templatePath = `multiplayer/${file}`;
      
      try {
        const content = await this.templateEngine.render(templateDir, templatePath, context);
        const writeResult = await this.fileWriter.writeFile(outputPath, content);
        if (writeResult.written) {
          result.filesGenerated.push(outputPath);
        } else if (writeResult.skipped) {
          result.filesSkipped.push(outputPath);
        }
      } catch (error) {
        // Template may not exist yet, skip for now
        result.errors.push(`Template not found: ${templatePath}`);
      }
    }
  }

  /**
   * Generate README.md with enabled features documentation
   */
  private async generateReadme(
    context: TemplateContext,
    result: GeneratorResult
  ): Promise<void> {
    const outputPath = path.join(this.outputDir, 'README.md');
    const content = this.generateReadmeContent(context);
    
    const writeResult = await this.fileWriter.writeFile(outputPath, content);
    if (writeResult.written) {
      result.filesGenerated.push(outputPath);
    } else if (writeResult.skipped) {
      result.filesSkipped.push(outputPath);
    }
  }

  /**
   * Generate README content based on enabled features
   */
  private generateReadmeContent(context: TemplateContext): string {
    const lines: string[] = [
      `# Shard SDK for ${context.gameName}`,
      '',
      `> Generated for Godot ${context.godotVersion} by [ShardKit CLI](https://shard.gg/docs/shardkit)`,
      '',
      '## Enabled Features',
      '',
    ];

    if (context.features.recording) {
      lines.push('- ✅ **Recording** - Capture gameplay clips and highlights');
    }
    if (context.features.errorTracking) {
      lines.push('- ✅ **Error Tracking** - Monitor crashes and runtime errors');
    }
    if (context.features.multiplayer) {
      lines.push('- ✅ **Multiplayer** - Real-time multiplayer networking');
    }

    lines.push('');
    lines.push('## Quick Start');
    lines.push('');
    lines.push('### 1. Enable the Plugin');
    lines.push('');
    lines.push('1. Open your Godot project');
    lines.push('2. Go to **Project → Project Settings → Plugins**');
    lines.push('3. Find "Shard SDK" and click **Enable**');
    lines.push('');
    lines.push('### 2. Access the SDK');
    lines.push('');
    lines.push('The `ShardSDK` autoload singleton is available globally in your project:');
    lines.push('');
    lines.push('```gdscript');
    lines.push('func _ready():');
    lines.push('    # SDK is ready to use');
    lines.push('    print("Shard SDK initialized")');
    lines.push('```');
    lines.push('');

    // Recording usage section
    if (context.features.recording) {
      lines.push('## Recording');
      lines.push('');
      lines.push('Capture gameplay clips when interesting events happen.');
      lines.push('');
      lines.push('### Basic Usage');
      lines.push('');
      lines.push('```gdscript');
      lines.push('# Trigger a recording when something interesting happens');
      lines.push('func _on_boss_defeated():');
      lines.push('    ShardSDK.recording.trigger_event("boss_defeated_abc123")');
      lines.push('');
      lines.push('# Manual recording control');
      lines.push('func start_manual_recording():');
      lines.push('    ShardSDK.recording.start_recording()');
      lines.push('');
      lines.push('func stop_manual_recording():');
      lines.push('    ShardSDK.recording.stop_recording()');
      lines.push('```');
      lines.push('');
      lines.push('### Managing Events');
      lines.push('');
      lines.push('Use ShardKit CLI to manage recording events:');
      lines.push('');
      lines.push('```bash');
      lines.push('# Add a new event');
      lines.push('shardkit recording add');
      lines.push('');
      lines.push('# List all events');
      lines.push('shardkit recording list');
      lines.push('');
      lines.push('# Export events for your game');
      lines.push('shardkit recording export');
      lines.push('```');
      lines.push('');
    }

    // Error tracking usage section
    if (context.features.errorTracking) {
      lines.push('## Error Tracking');
      lines.push('');
      lines.push('Monitor crashes and errors in your game.');
      lines.push('');
      lines.push('### Basic Usage');
      lines.push('');
      lines.push('```gdscript');
      lines.push('# Errors are captured automatically, but you can report manually');
      lines.push('func _on_unexpected_state():');
      lines.push('    ShardSDK.errors.report_error("Unexpected game state detected")');
      lines.push('');
      lines.push('# Report with additional context');
      lines.push('func _on_save_failed(reason: String):');
      lines.push('    ShardSDK.errors.report_error("Save failed: " + reason)');
      lines.push('```');
      lines.push('');
    }

    // Multiplayer usage section
    if (context.features.multiplayer) {
      lines.push('## Multiplayer');
      lines.push('');
      lines.push('Real-time multiplayer networking for your game.');
      lines.push('');
      lines.push('### Connecting to Server');
      lines.push('');
      lines.push('```gdscript');
      lines.push('func _ready():');
      lines.push('    # Connect signals');
      lines.push('    ShardSDK.multiplayer.connected.connect(_on_connected)');
      lines.push('    ShardSDK.multiplayer.disconnected.connect(_on_disconnected)');
      lines.push('    ');
      lines.push('    # Connect to server');
      lines.push('    ShardSDK.multiplayer.connect_to_server("ws://your-server:8080")');
      lines.push('');
      lines.push('func _on_connected():');
      lines.push('    print("Connected to server!")');
      lines.push('');
      lines.push('func _on_disconnected():');
      lines.push('    print("Disconnected from server")');
      lines.push('```');
      lines.push('');
      lines.push('### Joining a Lobby');
      lines.push('');
      lines.push('```gdscript');
      lines.push('# Create a new lobby');
      lines.push('func create_lobby():');
      lines.push('    ShardSDK.multiplayer.create_lobby("My Game Room")');
      lines.push('');
      lines.push('# Join an existing lobby');
      lines.push('func join_lobby(lobby_id: String):');
      lines.push('    ShardSDK.multiplayer.join_lobby(lobby_id)');
      lines.push('```');
      lines.push('');
    }

    // Regenerating section
    lines.push('## Regenerating the SDK');
    lines.push('');
    lines.push('If you modify `shard.config.json`, regenerate the SDK:');
    lines.push('');
    lines.push('```bash');
    lines.push('# Regenerate (preserves existing files)');
    lines.push('shardkit generate');
    lines.push('');
    lines.push('# Regenerate and overwrite all files');
    lines.push('shardkit generate --force');
    lines.push('');
    lines.push('# Clean regenerate (removes addon folder first)');
    lines.push('shardkit generate --clean');
    lines.push('```');
    lines.push('');

    // Documentation links
    lines.push('## Documentation');
    lines.push('');
    lines.push('- [Getting Started](https://shard.gg/docs/getting-started)');
    lines.push('- [ShardKit CLI Reference](https://shard.gg/docs/shardkit)');
    if (context.features.recording) {
      lines.push('- [Recording SDK Guide](https://shard.gg/docs/recording)');
    }
    if (context.features.errorTracking) {
      lines.push('- [Error Tracking Guide](https://shard.gg/docs/error-tracking)');
    }
    if (context.features.multiplayer) {
      lines.push('- [Multiplayer SDK Guide](https://shard.gg/docs/multiplayer)');
    }
    lines.push('');

    // Support section
    lines.push('## Support');
    lines.push('');
    lines.push('Need help? Join our community:');
    lines.push('');
    lines.push('- [Discord](https://discord.gg/shard)');
    lines.push('- [GitHub Issues](https://github.com/shard-gg/shardkit/issues)');
    lines.push('');

    return lines.join('\n');
  }
}

/**
 * Main generate function - convenience wrapper
 */
export async function generate(
  config: ShardConfig,
  outputDir: string,
  options: GeneratorOptions = {}
): Promise<GeneratorResult> {
  const generator = new SDKGenerator(config, outputDir, options);
  return generator.generate();
}
