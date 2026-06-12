/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Plugin Marketplace — Permission Manager
 *
 * Validates permission requests, applies permission policies,
 * tracks grants/denials, and supports future user-consent flows.
 */

import type { PluginPermission, PermissionValidation, PermissionPolicy } from './types';

// ---------------------------------------------------------------------------
// Default policy
// ---------------------------------------------------------------------------

const DEFAULT_POLICY: PermissionPolicy = {
  autoGrant: [
    'filesystem:read',
    'filesystem:write',
    'network:outbound',
    'clipboard:read',
    'clipboard:write',
    'ui:notification',
    'screen:capture',
  ],
  alwaysDeny: [
    // Nothing denied by default — user can configure
  ],
  requireConsent: [
    'network:inbound',
    'process:spawn',
    'ui:overlay',
    'audio:input',
    'audio:output',
  ],
};

// ---------------------------------------------------------------------------
// Permission Manager
// ---------------------------------------------------------------------------

class PermissionManager {
  private policy: PermissionPolicy;
  private readonly grants = new Map<string, PluginPermission[]>();

  constructor(policy?: Partial<PermissionPolicy>) {
    this.policy = {
      autoGrant: [...DEFAULT_POLICY.autoGrant, ...(policy?.autoGrant || [])],
      alwaysDeny: [...DEFAULT_POLICY.alwaysDeny, ...(policy?.alwaysDeny || [])],
      requireConsent: [...DEFAULT_POLICY.requireConsent, ...(policy?.requireConsent || [])],
    };
  }

  /**
   * Validate a plugin's permission request against the current policy.
   */
  validate(pluginId: string, requested: PluginPermission[]): PermissionValidation {
    const granted: PluginPermission[] = [];
    const denied: PluginPermission[] = [];
    const denialReasons: Record<string, string> = {};
    let needsConsent = false;

    for (const perm of requested) {
      if (this.policy.alwaysDeny.includes(perm)) {
        denied.push(perm);
        denialReasons[perm] = 'This permission is blocked by system policy.';
      } else if (this.policy.requireConsent.includes(perm)) {
        denied.push(perm);
        denialReasons[perm] = 'This permission requires user consent.';
        needsConsent = true;
      } else if (this.policy.autoGrant.includes(perm)) {
        granted.push(perm);
      } else {
        // Unknown permission — deny
        denied.push(perm);
        denialReasons[perm] = 'This permission is not recognized by the system.';
      }
    }

    const ok = denied.length === 0;

    if (ok) {
      this.grants.set(pluginId, granted);
    }

    return {
      ok,
      pluginId,
      requested,
      granted,
      denied,
      denialReasons,
      needsConsent,
    };
  }

  /**
   * Grant consent for previously denied permissions.
   */
  grantConsent(pluginId: string, permissions: PluginPermission[]): void {
    const existing = this.grants.get(pluginId) || [];
    const updated = [...new Set([...existing, ...permissions])];
    this.grants.set(pluginId, updated);
  }

  /**
   * Revoke permissions from a plugin.
   */
  revoke(pluginId: string, permissions: PluginPermission[]): void {
    const existing = this.grants.get(pluginId) || [];
    this.grants.set(
      pluginId,
      existing.filter((p) => !permissions.includes(p))
    );
  }

  /**
   * Remove all permission grants for a plugin.
   */
  removePlugin(pluginId: string): void {
    this.grants.delete(pluginId);
  }

  /**
   * Get granted permissions for a plugin.
   */
  getGrants(pluginId: string): PluginPermission[] {
    return this.grants.get(pluginId) || [];
  }

  /**
   * Check if a plugin has a specific permission.
   */
  hasPermission(pluginId: string, permission: PluginPermission): boolean {
    return (this.grants.get(pluginId) || []).includes(permission);
  }

  /**
   * Get the current permission policy.
   */
  getPolicy(): PermissionPolicy {
    return { ...this.policy };
  }

  /**
   * Update the permission policy.
   */
  setPolicy(policy: Partial<PermissionPolicy>): void {
    this.policy = {
      autoGrant: policy.autoGrant || this.policy.autoGrant,
      alwaysDeny: policy.alwaysDeny || this.policy.alwaysDeny,
      requireConsent: policy.requireConsent || this.policy.requireConsent,
    };
  }

  /**
   * Get all known permissions in the system.
   */
  static getAllPermissions(): PluginPermission[] {
    return [
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
    ];
  }

  /**
   * Get all known capability strings.
   */
  static getAllCapabilities(): string[] {
    return [
      'browser', 'computer-use', 'clipboard', 'memory', 'voice',
      'ocr', 'scheduler', 'overlay', 'screen', 'notification',
      'filesystem', 'network', 'subprocess', 'ui',
    ];
  }

  /**
   * Get diagnostics.
   */
  getDiagnostics(): { totalGrants: number; totalDenials: number } {
    let totalGrants = 0;
    for (const grants of this.grants.values()) {
      totalGrants += grants.length;
    }
    return { totalGrants, totalDenials: 0 };
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { PermissionManager, DEFAULT_POLICY };