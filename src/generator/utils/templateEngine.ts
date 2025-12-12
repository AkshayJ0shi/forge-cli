import { GodotVersion } from '../../utils/shardConfig';

export interface TemplateContext {
  gameName: string;
  godotVersion: GodotVersion;
  features: {
    recording: boolean;
    errorTracking: boolean;
    multiplayer: boolean;
  };
}

export interface TemplateFunction {
  (context: TemplateContext): string;
}

/**
 * Registry of template functions by path
 */
type TemplateRegistry = Map<string, TemplateFunction>;

/**
 * Simple template engine for generating GDScript files
 * Uses string interpolation with template functions
 */
export class TemplateEngine {
  private templates: Map<string, TemplateRegistry> = new Map();

  constructor() {
    // Initialize template registries for each Godot version
    this.templates.set('godot3', new Map());
    this.templates.set('godot4', new Map());
  }

  /**
   * Register a template function
   */
  registerTemplate(
    godotVersion: 'godot3' | 'godot4',
    templatePath: string,
    templateFn: TemplateFunction
  ): void {
    const registry = this.templates.get(godotVersion);
    if (registry) {
      registry.set(templatePath, templateFn);
    }
  }

  /**
   * Render a template with the given context
   */
  async render(
    godotVersion: string,
    templatePath: string,
    context: TemplateContext
  ): Promise<string> {
    const registry = this.templates.get(godotVersion);
    if (!registry) {
      throw new Error(`Unknown Godot version: ${godotVersion}`);
    }

    const templateFn = registry.get(templatePath);
    if (!templateFn) {
      throw new Error(`Template not found: ${godotVersion}/${templatePath}`);
    }

    return templateFn(context);
  }


  /**
   * Check if a template exists
   */
  hasTemplate(godotVersion: string, templatePath: string): boolean {
    const registry = this.templates.get(godotVersion);
    if (!registry) {
      return false;
    }
    return registry.has(templatePath);
  }

  /**
   * Get all registered template paths for a Godot version
   */
  getTemplatePaths(godotVersion: string): string[] {
    const registry = this.templates.get(godotVersion);
    if (!registry) {
      return [];
    }
    return Array.from(registry.keys());
  }
}

/**
 * Simple string interpolation helper
 * Replaces {{variable}} with values from the context
 */
export function interpolate(
  template: string,
  variables: Record<string, string | number | boolean>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (key in variables) {
      return String(variables[key]);
    }
    return match;
  });
}

/**
 * Conditional block helper
 * Includes content between {{#if condition}} and {{/if}} only if condition is true
 */
export function processConditionals(
  template: string,
  conditions: Record<string, boolean>
): string {
  // Process {{#if condition}}...{{/if}} blocks
  let result = template;
  
  for (const [key, value] of Object.entries(conditions)) {
    const ifRegex = new RegExp(`\\{\\{#if ${key}\\}\\}([\\s\\S]*?)\\{\\{/if\\}\\}`, 'g');
    const unlessRegex = new RegExp(`\\{\\{#unless ${key}\\}\\}([\\s\\S]*?)\\{\\{/unless\\}\\}`, 'g');
    
    if (value) {
      // Keep content inside {{#if}}, remove the tags
      result = result.replace(ifRegex, '$1');
      // Remove content inside {{#unless}}
      result = result.replace(unlessRegex, '');
    } else {
      // Remove content inside {{#if}}
      result = result.replace(ifRegex, '');
      // Keep content inside {{#unless}}, remove the tags
      result = result.replace(unlessRegex, '$1');
    }
  }
  
  return result;
}

/**
 * Create a template function from a template string
 */
export function createTemplate(templateString: string): TemplateFunction {
  return (context: TemplateContext): string => {
    // First process conditionals
    let result = processConditionals(templateString, {
      recording: context.features.recording,
      errorTracking: context.features.errorTracking,
      multiplayer: context.features.multiplayer,
      isGodot4: context.godotVersion === '4.x',
      isGodot3: context.godotVersion === '3.x',
    });
    
    // Then interpolate variables
    result = interpolate(result, {
      gameName: context.gameName,
      godotVersion: context.godotVersion,
    });
    
    return result;
  };
}

/**
 * Helper to generate GDScript class header
 */
export function gdscriptClassHeader(
  className: string,
  extendsClass: string = 'Node',
  isGodot4: boolean = true
): string {
  if (isGodot4) {
    return `class_name ${className}\nextends ${extendsClass}\n`;
  }
  return `extends ${extendsClass}\nclass_name ${className}\n`;
}

/**
 * Helper to generate signal connection code
 */
export function gdscriptSignalConnect(
  source: string,
  signal: string,
  target: string,
  method: string,
  isGodot4: boolean = true
): string {
  if (isGodot4) {
    return `${source}.${signal}.connect(${target}.${method})`;
  }
  return `${source}.connect("${signal}", ${target}, "${method}")`;
}

/**
 * Helper to generate await/yield code
 */
export function gdscriptAwait(
  expression: string,
  isGodot4: boolean = true
): string {
  if (isGodot4) {
    return `await ${expression}`;
  }
  return `yield(${expression}, "completed")`;
}

/**
 * Helper to check if array/string is empty
 */
export function gdscriptIsEmpty(
  variable: string,
  isGodot4: boolean = true
): string {
  if (isGodot4) {
    return `${variable}.is_empty()`;
  }
  return `${variable}.empty()`;
}
