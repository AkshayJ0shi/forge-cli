import * as fs from 'fs';
import * as path from 'path';
import inquirer from 'inquirer';

export interface FileWriterOptions {
  force?: boolean;
}

export interface WriteResult {
  written: boolean;
  skipped: boolean;
  path: string;
}

/**
 * Utility for writing files with directory creation and overwrite handling
 */
export class FileWriter {
  private options: FileWriterOptions;

  constructor(options: FileWriterOptions = {}) {
    this.options = options;
  }

  /**
   * Ensure a directory exists, creating it recursively if needed
   */
  async ensureDirectory(dirPath: string): Promise<void> {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Check if a file exists
   */
  fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  /**
   * Write content to a file, handling directory creation and overwrite prompts
   */
  async writeFile(filePath: string, content: string): Promise<WriteResult> {
    const result: WriteResult = {
      written: false,
      skipped: false,
      path: filePath,
    };

    // Ensure parent directory exists
    const dirPath = path.dirname(filePath);
    await this.ensureDirectory(dirPath);

    // Check if file exists and handle overwrite
    if (this.fileExists(filePath)) {
      if (!this.options.force) {
        // In non-force mode, prompt for overwrite
        const shouldOverwrite = await this.promptOverwrite(filePath);
        if (!shouldOverwrite) {
          result.skipped = true;
          return result;
        }
      }
    }

    // Write the file
    fs.writeFileSync(filePath, content, 'utf-8');
    result.written = true;
    return result;
  }


  /**
   * Write content to a file without prompting (force mode)
   */
  writeFileSync(filePath: string, content: string): WriteResult {
    const result: WriteResult = {
      written: false,
      skipped: false,
      path: filePath,
    };

    // Ensure parent directory exists
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    // Write the file
    fs.writeFileSync(filePath, content, 'utf-8');
    result.written = true;
    return result;
  }

  /**
   * Prompt user for overwrite confirmation
   */
  private async promptOverwrite(filePath: string): Promise<boolean> {
    // If running in non-interactive mode (e.g., CI), skip prompt and don't overwrite
    if (!process.stdin.isTTY) {
      return false;
    }

    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: `File ${path.basename(filePath)} already exists. Overwrite?`,
        default: false,
      },
    ]);

    return overwrite;
  }

  /**
   * Remove a directory and all its contents
   */
  async removeDirectory(dirPath: string): Promise<void> {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  }

  /**
   * Remove a single file
   */
  async removeFile(filePath: string): Promise<void> {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  /**
   * Copy a file from source to destination
   */
  async copyFile(source: string, destination: string): Promise<WriteResult> {
    const result: WriteResult = {
      written: false,
      skipped: false,
      path: destination,
    };

    // Ensure parent directory exists
    const dirPath = path.dirname(destination);
    await this.ensureDirectory(dirPath);

    // Check if file exists and handle overwrite
    if (this.fileExists(destination)) {
      if (!this.options.force) {
        const shouldOverwrite = await this.promptOverwrite(destination);
        if (!shouldOverwrite) {
          result.skipped = true;
          return result;
        }
      }
    }

    fs.copyFileSync(source, destination);
    result.written = true;
    return result;
  }

  /**
   * Read file contents
   */
  readFile(filePath: string): string | null {
    if (!this.fileExists(filePath)) {
      return null;
    }
    return fs.readFileSync(filePath, 'utf-8');
  }

  /**
   * List files in a directory
   */
  listFiles(dirPath: string): string[] {
    if (!fs.existsSync(dirPath)) {
      return [];
    }
    return fs.readdirSync(dirPath);
  }

  /**
   * Check if path is a directory
   */
  isDirectory(filePath: string): boolean {
    if (!fs.existsSync(filePath)) {
      return false;
    }
    return fs.statSync(filePath).isDirectory();
  }
}

/**
 * Create a file writer with default options
 */
export function createFileWriter(options: FileWriterOptions = {}): FileWriter {
  return new FileWriter(options);
}
