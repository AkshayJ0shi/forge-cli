import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

/**
 * Check if the current directory is a Godot project
 * by looking for project.godot file
 */
export function isGodotProject(directory: string = process.cwd()): boolean {
  return fs.existsSync(path.join(directory, 'project.godot'));
}

/**
 * Result of Godot project detection
 */
export interface GodotProjectCheckResult {
  isGodotProject: boolean;
  projectPath: string | null;
  warning: string | null;
}

/**
 * Check for Godot project and return detailed result
 */
export function checkGodotProject(directory: string = process.cwd()): GodotProjectCheckResult {
  const projectGodotPath = path.join(directory, 'project.godot');
  const exists = fs.existsSync(projectGodotPath);
  
  return {
    isGodotProject: exists,
    projectPath: exists ? projectGodotPath : null,
    warning: exists ? null : 'No project.godot found in current directory.',
  };
}

/**
 * Display a warning if not in a Godot project directory
 * Returns true if it's a Godot project, false otherwise
 */
export function warnIfNotGodotProject(directory: string = process.cwd()): boolean {
  const result = checkGodotProject(directory);
  
  if (!result.isGodotProject) {
    console.log(chalk.yellow('⚠ No project.godot found in current directory.'));
    console.log(chalk.gray('  Make sure you run this from your Godot project root.'));
    console.log('');
  }
  
  return result.isGodotProject;
}

/**
 * Try to detect Godot version from project.godot file
 * Returns null if unable to detect
 */
export function detectGodotVersion(directory: string = process.cwd()): '3.x' | '4.x' | null {
  const projectGodotPath = path.join(directory, 'project.godot');
  
  if (!fs.existsSync(projectGodotPath)) {
    return null;
  }
  
  try {
    const content = fs.readFileSync(projectGodotPath, 'utf-8');
    
    // Look for config_version which indicates Godot version
    // Godot 4.x uses config_version=5
    // Godot 3.x uses config_version=4 or lower
    const configVersionMatch = content.match(/config_version\s*=\s*(\d+)/);
    if (configVersionMatch) {
      const configVersion = parseInt(configVersionMatch[1], 10);
      if (configVersion >= 5) {
        return '4.x';
      }
      return '3.x';
    }
    
    // Alternative: check for [gd_resource] format which is Godot 4 specific
    if (content.includes('[gd_resource')) {
      return '4.x';
    }
    
    // Default to 3.x if we can't determine
    return '3.x';
  } catch {
    return null;
  }
}
