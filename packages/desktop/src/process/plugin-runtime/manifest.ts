/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Plugin Runtime — Manifest
 *
 * Defines the plugin.json manifest format, validation rules,
 * and manifest loading from disk.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// Manifest types
// ---------------------------------------------------------------------------

/** All known plugin capabilities. */
type PluginCapability =
  | 'browser'
  | 'computer-use'
  | 'clipboard'
  | 'memory'
  | 'voice'
  | 'ocr'
  | 'scheduler'
  | 'overlay'
  | 'screen'
  | 'notification'
  | 'filesystem'
  | 'network'
  | 'subprocess'
  | 'ui';

/** All known permission types. */
type PluginPermission =
  | 'filesystem:read'
  | 'filesystem:write'
  | 'network:outbound'
  | 'network:inbound'
  | 'clipboard:read'
  | 'clipboard:write'
  | 'process:spawn'
  | 'ui:overlay'
  | 'ui:notification'
  | 'audio:input'
  | 'audio:output'
  | 'screen:capture'
  | 'memory'
  | 'scheduler'
  | 'clipboard';

/** The plugin.json manifest structure. */
type PluginManifest = {
  /** Unique plugin id (reverse-domain style, e.g. "com.jarvis.browser"). */
  id: string;

  /** Human-readable display name. */
  name: string;

  /** Semver version. */
  version: string;

  /** Author name or email. */
  author: string;

  /** Short description. */
  description: string;

  /** Entry point file (relative to plugin directory, e.g. "index.js" or "index.ts"). */
  entry: string;

  /** Required permissions. */
  permissions: PluginPermission[];

  /** Plugin ids this plugin depends on. */
  dependencies: string[];

  /** Capabilities this plugin provides. */
  capabilities: PluginCapability[];

  /** Minimum Jarvis Ultimate version required. */
  minimumJarvisVersion: string;

  /** Whether the plugin should be enabled by default on first install. */
  enabledByDefault: boolean;
};

/** Result of manifest validation. */
type ManifestValidationResult = {
  /** Whether the manifest is valid. */
  valid: boolean;

  /** List of validation errors. */
  errors: string[];
};

// ---------------------------------------------------------------------------
// Known values for validation
// ---------------------------------------------------------------------------

// eslint-disable-next-line unicorn/prefer-set-has
const KNOWN_CAPABILITIES: PluginCapability[] = [
  'browser',
  'computer-use',
  'clipboard',
  'memory',
  'voice',
  'ocr',
  'scheduler',
  'overlay',
  'screen',
  'notification',
  'filesystem',
  'network',
  'subprocess',
  'ui',
];

// eslint-disable-next-line unicorn/prefer-set-has
const KNOWN_PERMISSIONS: PluginPermission[] = [
  'filesystem:read',
  'filesystem:write',
  'network:outbound',
  'network:inbound',
  'clipboard:read',
  'clipboard:write',
  'process:spawn',
  'ui:overlay',
  'ui:notification',
  'audio:input',
  'audio:output',
  'screen:capture',
  'memory',
  'scheduler',
  'clipboard',
];

const SEMVER_REGEX = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$/;
const PLUGIN_ID_REGEX = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*$/;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate a plugin manifest object.
 *
 * Checks required fields, types, known values, and format constraints.
 * Returns a detailed result with all errors found (not just the first).
 */
function validateManifest(manifest: unknown): ManifestValidationResult {
  const errors: string[] = [];

  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, errors: ['Manifest must be a JSON object.'] };
  }

  const m = manifest as Record<string, unknown>;

  // Required fields
  if (typeof m.id !== 'string' || !m.id) {
    errors.push('Field "id" is required and must be a non-empty string.');
  } else if (!PLUGIN_ID_REGEX.test(m.id)) {
    errors.push('Field "id" must be a valid reverse-domain identifier (e.g. "com.jarvis.browser").');
  }

  if (typeof m.name !== 'string' || !m.name) {
    errors.push('Field "name" is required and must be a non-empty string.');
  }

  if (typeof m.version !== 'string' || !SEMVER_REGEX.test(m.version)) {
    errors.push('Field "version" is required and must be valid semver (e.g. "1.0.0").');
  }

  if (typeof m.author !== 'string' || !m.author) {
    errors.push('Field "author" is required and must be a non-empty string.');
  }

  if (typeof m.description !== 'string' || !m.description) {
    errors.push('Field "description" is required and must be a non-empty string.');
  }

  if (typeof m.entry !== 'string' || !m.entry) {
    errors.push('Field "entry" is required and must be a non-empty string.');
  }

  // Optional fields — validate if present
  if (m.minimumJarvisVersion !== undefined) {
    if (typeof m.minimumJarvisVersion !== 'string' || !SEMVER_REGEX.test(m.minimumJarvisVersion as string)) {
      errors.push('Field "minimumJarvisVersion" must be valid semver.');
    }
  }

  if (m.enabledByDefault !== undefined && typeof m.enabledByDefault !== 'boolean') {
    errors.push('Field "enabledByDefault" must be a boolean.');
  }

  // Arrays
  if (m.permissions !== undefined) {
    if (!Array.isArray(m.permissions)) {
      errors.push('Field "permissions" must be an array.');
    } else {
      for (const perm of m.permissions) {
        if (!KNOWN_PERMISSIONS.includes(perm as PluginPermission)) {
          errors.push('Unknown permission: "' + String(perm) + '".');
        }
      }
    }
  }

  if (m.dependencies !== undefined) {
    if (!Array.isArray(m.dependencies)) {
      errors.push('Field "dependencies" must be an array.');
    }
  }

  if (m.capabilities !== undefined) {
    if (!Array.isArray(m.capabilities)) {
      errors.push('Field "capabilities" must be an array.');
    } else {
      for (const cap of m.capabilities) {
        if (!KNOWN_CAPABILITIES.includes(cap as PluginCapability)) {
          errors.push('Unknown capability: "' + String(cap) + '".');
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ---------------------------------------------------------------------------
// File loading
// ---------------------------------------------------------------------------

/**
 * Load and validate a plugin.json manifest from a plugin directory.
 *
 * @param pluginDir — Absolute path to the plugin directory.
 * @returns The parsed manifest and validation result, or null if the file is missing.
 */
function loadManifest(pluginDir: string): { manifest: PluginManifest; validation: ManifestValidationResult } | null {
  const manifestPath = resolve(pluginDir, 'plugin.json');

  if (!existsSync(manifestPath)) {
    return null;
  }

  let raw: string;
  try {
    raw = readFileSync(manifestPath, 'utf-8');
  } catch (error) {
    return {
      manifest: {} as PluginManifest,
      validation: {
        valid: false,
        errors: ['Failed to read plugin.json: ' + (error instanceof Error ? error.message : String(error))],
      },
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return {
      manifest: {} as PluginManifest,
      validation: {
        valid: false,
        errors: ['Failed to parse plugin.json: ' + (error instanceof Error ? error.message : String(error))],
      },
    };
  }

  const validation = validateManifest(parsed);
  return {
    manifest: parsed as PluginManifest,
    validation,
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { loadManifest, validateManifest };
export type { PluginManifest, PluginCapability, PluginPermission, ManifestValidationResult };
