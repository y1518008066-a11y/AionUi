/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Plugin Marketplace — Installer
 *
 * Handles plugin installation lifecycle:
 * - Install from local path (copy directory)
 * - Download from URL (future)
 * - Verify integrity (checksum)
 * - Rollback on failure
 * - Uninstall (move to disabled, or full remove)
 * - Upgrade (install newer version over existing)
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  cpSync,
  renameSync,
} from 'fs';
import { resolve, join, basename, dirname } from 'path';
import { createHash } from 'crypto';
import type { InstallSource, InstallResult, UninstallResult, PluginManifest } from './types';
import { loadManifest } from '../plugin-runtime/manifest';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLUGINS_ROOT = resolve(process.cwd(), 'plugins');
const INSTALLED_DIR = join(PLUGINS_ROOT, 'installed');
const DOWNLOADED_DIR = join(PLUGINS_ROOT, 'downloaded');
const DISABLED_DIR = join(PLUGINS_ROOT, 'disabled');
const CACHE_DIR = join(PLUGINS_ROOT, 'cache');
const BACKUP_DIR = join(PLUGINS_ROOT, 'cache', 'backups');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function computeChecksum(filePath: string): string {
  const data = readFileSync(filePath);
  return createHash('sha256').update(data).digest('hex');
}

function computeDirChecksum(dirPath: string): string {
  const hash = createHash('sha256');
  const files = readdirSync(dirPath, { recursive: true, withFileTypes: true })
    .filter((f) => f.isFile())
    .sort((a, b) => (a.name < b.name ? -1 : 1));
  for (const file of files) {
    const fp = join(file.parentPath || dirPath, file.name);
    hash.update(readFileSync(fp));
  }
  return hash.digest('hex');
}

// ---------------------------------------------------------------------------
// Plugin Installer
// ---------------------------------------------------------------------------

class PluginInstaller {
  private installedVersions = new Map<string, string>();

  constructor() {
    ensureDir(INSTALLED_DIR);
    ensureDir(DOWNLOADED_DIR);
    ensureDir(DISABLED_DIR);
    ensureDir(CACHE_DIR);
    ensureDir(BACKUP_DIR);
  }

  // -----------------------------------------------------------------------
  // Install
  // -----------------------------------------------------------------------

  /**
   * Install a plugin from a source.
   *
   * Supports:
   * - local-path: Copy a local directory into installed/
   * - url: Download and extract (future)
   * - marketplace: Fetch from marketplace and install (future)
   */
  async install(source: InstallSource): Promise<InstallResult> {
    const warnings: string[] = [];

    switch (source.type) {
      case 'local-path':
        return this.installFromPath(source.uri, warnings);
      case 'url':
        warnings.push('URL-based installation is not yet implemented.');
        return {
          ok: false,
          pluginId: '',
          version: '',
          installPath: '',
          warnings,
          error: 'URL installation requires network capabilities (future feature).',
        };
      case 'marketplace':
        warnings.push('Marketplace-based installation is not yet implemented.');
        return {
          ok: false,
          pluginId: source.uri,
          version: source.version || '0.0.0',
          installPath: '',
          warnings,
          error: 'Marketplace installation requires a marketplace backend (future feature).',
        };
      default:
        return {
          ok: false,
          pluginId: '',
          version: '',
          installPath: '',
          warnings,
          error: 'Unknown install source type: ' + (source as InstallSource).type,
        };
    }
  }

  /**
   * Install from a local directory.
   */
  private installFromPath(sourcePath: string, warnings: string[]): InstallResult {
    let absSource = resolve(sourcePath);

    // If source doesn't exist, try to resolve pluginId -> directory name
    if (!existsSync(absSource)) {
      // Try stripping "com.jarvis." prefix
      const shortName = basename(sourcePath).replace(/^com\.jarvis\./, '');
      if (shortName !== basename(sourcePath)) {
        const shortPath = resolve(join(dirname(sourcePath), shortName));
        if (existsSync(shortPath)) {
          absSource = shortPath;
        } else {
          // Scan parent directory for matching plugin.json
          const pluginsDir = resolve(process.cwd(), 'plugins');
          if (existsSync(pluginsDir)) {
            const entries = readdirSync(pluginsDir, { withFileTypes: true });
            for (const entry of entries) {
              if (!entry.isDirectory()) continue;
              const manifestPath = join(pluginsDir, entry.name, 'plugin.json');
              if (existsSync(manifestPath)) {
                try {
                  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
                  if (manifest.id === basename(sourcePath)) {
                    absSource = join(pluginsDir, entry.name);
                    break;
                  }
                } catch { /* skip */ }
              }
            }
          }
        }
      }
    }

    if (!existsSync(absSource)) {
      return {
        ok: false,
        pluginId: '',
        version: '',
        installPath: '',
        warnings,
        error: 'Source path does not exist: ' + absSource,
      };
    }

    // Load and validate manifest
    const manifestResult = loadManifest(absSource);
    if (!manifestResult || !manifestResult.validation.valid) {
      return {
        ok: false,
        pluginId: '',
        version: '',
        installPath: '',
        warnings,
        error: 'Invalid plugin.json: ' + (manifestResult?.validation.errors.join('; ') || 'missing'),
      };
    }

    const manifest = manifestResult.manifest as PluginManifest;
    const pluginId = manifest.id;
    const version = manifest.version;
    const destDir = join(INSTALLED_DIR, pluginId);

    // Check if already installed
    if (existsSync(destDir)) {
      const existingResult = loadManifest(destDir);
      if (existingResult && existingResult.validation.valid) {
        const existingManifest = existingResult.manifest as PluginManifest;
        if (existingManifest.version === version) {
          warnings.push('Plugin ' + pluginId + ' v' + version + ' is already installed.');
          return {
            ok: true,
            pluginId,
            version,
            installPath: destDir,
            warnings,
          };
        }
        // Different version — backup old one
        const backupPath = join(BACKUP_DIR, pluginId + '_v' + existingManifest.version + '_' + Date.now());
        try {
          ensureDir(backupPath);
          cpSync(destDir, backupPath, { recursive: true });
          warnings.push('Previous version ' + existingManifest.version + ' backed up to ' + backupPath);
        } catch {
          warnings.push('Failed to back up previous version (non-fatal).');
        }
        rmSync(destDir, { recursive: true, force: true });
      }
    }

    // Copy plugin to installed/
    try {
      ensureDir(destDir);
      cpSync(absSource, destDir, { recursive: true });
    } catch (err) {
      // Rollback: restore backup if available
      const backups = existsSync(BACKUP_DIR)
        ? readdirSync(BACKUP_DIR).filter((f) => f.startsWith(pluginId + '_'))
        : [];
      if (backups.length > 0) {
        const latestBackup = join(BACKUP_DIR, backups[backups.length - 1]);
        try {
          cpSync(latestBackup, destDir, { recursive: true });
          warnings.push('Rolled back to backup after install failure.');
        } catch {
          warnings.push('Rollback failed.');
        }
      }
      return {
        ok: false,
        pluginId,
        version,
        installPath: destDir,
        warnings,
        error: 'Failed to copy plugin: ' + (err instanceof Error ? err.message : String(err)),
      };
    }

    this.installedVersions.set(pluginId, version);

    console.log('[Installer] Installed: ' + pluginId + ' v' + version + ' -> ' + destDir);

    return {
      ok: true,
      pluginId,
      version,
      installPath: destDir,
      warnings,
    };
  }

  // -----------------------------------------------------------------------
  // Uninstall
  // -----------------------------------------------------------------------

  /**
   * Uninstall a plugin.
   *
   * @param fullRemove - If true, permanently deletes the plugin directory.
   *   If false, moves it to disabled/.
   */
  uninstall(pluginId: string, fullRemove = false): UninstallResult {
    const warnings: string[] = [];
    const installedPath = join(INSTALLED_DIR, pluginId);
    const disabledPath = join(DISABLED_DIR, pluginId);

    if (!existsSync(installedPath)) {
      if (existsSync(disabledPath)) {
        warnings.push('Plugin ' + pluginId + ' is already disabled.');
        return {
          ok: true,
          pluginId,
          removed: false,
          affectedDependents: [],
          warnings,
        };
      }
      return {
        ok: false,
        pluginId,
        removed: false,
        affectedDependents: [],
        warnings,
      };
    }

    if (fullRemove) {
      try {
        rmSync(installedPath, { recursive: true, force: true });
        this.installedVersions.delete(pluginId);
        console.log('[Installer] Uninstalled (removed): ' + pluginId);
      } catch (err) {
        return {
          ok: false,
          pluginId,
          removed: false,
          affectedDependents: [],
          warnings,
        };
      }
    } else {
      // Move to disabled
      try {
        if (existsSync(disabledPath)) {
          rmSync(disabledPath, { recursive: true, force: true });
        }
        renameSync(installedPath, disabledPath);
        this.installedVersions.delete(pluginId);
        console.log('[Installer] Uninstalled (disabled): ' + pluginId);
      } catch (err) {
        warnings.push('Failed to move plugin to disabled/: ' + (err instanceof Error ? err.message : String(err)));
        return {
          ok: false,
          pluginId,
          removed: false,
          affectedDependents: [],
          warnings,
        };
      }
    }

    return {
      ok: true,
      pluginId,
      removed: fullRemove,
      affectedDependents: [],
      warnings,
    };
  }

  // -----------------------------------------------------------------------
  // Upgrade
  // -----------------------------------------------------------------------

  /**
   * Upgrade a plugin to a newer version from a source.
   */
  async upgrade(pluginId: string, source: InstallSource): Promise<InstallResult> {
    // Uninstall old version (move to disabled)
    this.uninstall(pluginId, false);

    // Install new version
    return this.install(source);
  }

  // -----------------------------------------------------------------------
  // Re-enable a disabled plugin
  // -----------------------------------------------------------------------

  /**
   * Re-enable a previously disabled plugin (move from disabled/ to installed/).
   */
  enableFromDisabled(pluginId: string): { ok: boolean; error?: string } {
    const disabledPath = join(DISABLED_DIR, pluginId);
    const installedPath = join(INSTALLED_DIR, pluginId);

    if (!existsSync(disabledPath)) {
      return { ok: false, error: 'Plugin not found in disabled/: ' + pluginId };
    }

    if (existsSync(installedPath)) {
      return { ok: false, error: 'Plugin is already installed: ' + pluginId };
    }

    try {
      renameSync(disabledPath, installedPath);
      const manifestResult = loadManifest(installedPath);
      if (manifestResult?.validation.valid) {
        const manifest = manifestResult.manifest as PluginManifest;
        this.installedVersions.set(pluginId, manifest.version);
      }
      console.log('[Installer] Re-enabled from disabled: ' + pluginId);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: 'Failed to re-enable: ' + (err instanceof Error ? err.message : String(err)) };
    }
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  /**
   * Check if a plugin is installed.
   */
  isInstalled(pluginId: string): boolean {
    return existsSync(join(INSTALLED_DIR, pluginId));
  }

  /**
   * Check if a plugin is disabled.
   */
  isDisabled(pluginId: string): boolean {
    return existsSync(join(DISABLED_DIR, pluginId));
  }

  /**
   * Get installed version of a plugin.
   */
  getInstalledVersion(pluginId: string): string | null {
    const dir = join(INSTALLED_DIR, pluginId);
    if (!existsSync(dir)) return null;
    const manifestResult = loadManifest(dir);
    if (manifestResult?.validation.valid) {
      return (manifestResult.manifest as PluginManifest).version;
    }
    return null;
  }

  /**
   * List all installed plugin ids.
   */
  listInstalled(): string[] {
    if (!existsSync(INSTALLED_DIR)) return [];
    return readdirSync(INSTALLED_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  }

  /**
   * List all disabled plugin ids.
   */
  listDisabled(): string[] {
    if (!existsSync(DISABLED_DIR)) return [];
    return readdirSync(DISABLED_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  }

  /**
   * Get diagnostics.
   */
  getDiagnostics(): Record<string, unknown> {
    return {
      installedCount: this.listInstalled().length,
      disabledCount: this.listDisabled().length,
      installedDir: INSTALLED_DIR,
      disabledDir: DISABLED_DIR,
    };
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { PluginInstaller };