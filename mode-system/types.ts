/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Mode System 鈥?Type Definitions
 *
 * Defines the complete mode/profile model. Modes control which plugins
 * are active, which provider is preferred, the system prompt, and what
 * permissions are granted.
 *
 * These are TYPE DEFINITIONS ONLY 鈥?no runtime behavior.
 */

import type { PluginId } from '../plugins-core/types';

// ---------------------------------------------------------------------------
// Mode identity
// ---------------------------------------------------------------------------

/** Unique identifier for a mode/profile. */
type ModeId = string;

/** Permission level for mode-restricted operations. */
type PermissionLevel = 'standard' | 'elevated' | 'full';

// ---------------------------------------------------------------------------
// Mode rules
// ---------------------------------------------------------------------------

/**
 * Rules that define what a mode allows and prefers.
 *
 * These are data definitions 鈥?enforcing them is the responsibility
 * of the execution bridge and plugin manager.
 */
type ModeRules = {
  /** Plugin ids to activate automatically when this mode is entered. */
  activePlugins: PluginId[];
  /** Plugin ids allowed in this mode. Empty = all plugins allowed. */
  allowedPlugins: PluginId[];

  /** Plugin ids required for this mode. */
  requiredPlugins: PluginId[];

  /** Preferred provider id for this mode. */
  preferredProviderId: string;

  /** Preferred model for this mode. */
  preferredModel: string;

  /** System prompt that sets the AI's behavior context. */
  systemPrompt: string;

  /** Permission level for this mode. */
  permissionLevel: PermissionLevel;

  /** Whether this mode allows file system access. */
  allowFilesystem: boolean;

  /** Whether this mode allows network access. */
  allowNetwork: boolean;

  /** Whether this mode allows subprocess execution. */
  allowSubprocess: boolean;

  /** Arbitrary key-value overrides. */
  overrides: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Mode profile
// ---------------------------------------------------------------------------

/**
 * A complete mode profile.
 *
 * This is the full definition of a mode 鈥?its identity, display
 * information, and behavioural rules.
 */
type ModeProfile = {
  /** Unique mode id. */
  id: ModeId;

  /** Human-readable label (e.g. "Work Mode"). */
  label: string;

  /** Short description shown in the mode picker. */
  description: string;

  /** Icon identifier (references an @icon-park/react icon name). */
  icon: string;

  /** Behavioural rules for this mode. */
  rules: ModeRules;

  /** Whether this is a built-in (system) mode. */
  builtin: boolean;

  /** Priority for display ordering (lower = first). */
  displayOrder: number;

  /** Tags for categorization. */
  tags: string[];
};

// ---------------------------------------------------------------------------
// Mode context (runtime)
// ---------------------------------------------------------------------------

/**
 * Context passed when switching modes.
 *
 * Carries the previous and next mode so subscribers can react
 * appropriately.
 */
type ModeContext = {
  /** The mode being switched from (null on first activation). */
  previousModeId: ModeId | null;

  /** The mode being switched to. */
  nextModeId: ModeId;

  /** The full profile of the next mode. */
  nextMode: ModeProfile;

  /** Timestamp of the switch. */
  timestamp: number;
};

// ---------------------------------------------------------------------------
// Mode events
// ---------------------------------------------------------------------------

/** Events emitted by the mode system via JarvisCore EventBus. */
type ModeEvent =
  | { type: 'mode:registered'; modeId: ModeId }
  | { type: 'mode:changed'; previousModeId: ModeId | null; nextModeId: ModeId }
  | { type: 'mode:error'; modeId: ModeId; error: string };

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export type { ModeId, PermissionLevel, ModeRules, ModeProfile, ModeContext, ModeEvent };

