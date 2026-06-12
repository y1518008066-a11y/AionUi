/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Mode System 鈥?Predefined Modes
 *
 * Provides the three built-in mode profiles:
 * - DefaultMode: unrestricted fallback
 * - WorkMode: productivity-optimized, restrictive
 * - GameMode: entertainment-optimized, permissive
 *
 * These are DATA DEFINITIONS ONLY 鈥?no runtime behavior.
 */

import type { ModeProfile } from './types';

// ---------------------------------------------------------------------------
// Default Mode (fallback)
// ---------------------------------------------------------------------------


/**
 * The default mode is the system fallback.
 *
 * It has no restrictions — all plugins, providers, and actions are
 * allowed. Used when no other mode is active.
 *
 * Plugin orchestration: loads all available plugins.
 */
const DefaultMode: ModeProfile = {
  id: 'default',
  label: 'Default',
  description: 'Unrestricted fallback mode. All plugins and actions are allowed.',
  icon: 'setting-config',
  rules: {
    activePlugins: [
    'com.jarvis.memory',
    'com.jarvis.scheduler',
    'com.jarvis.clipboard',
  ],
  allowedPlugins: [],
    requiredPlugins: [],
    preferredProviderId: '',
    preferredModel: '',
    systemPrompt: 'You are Jarvis, a helpful AI assistant. Respond concisely and accurately.',
    permissionLevel: 'full',
    allowFilesystem: true,
    allowNetwork: true,
    allowSubprocess: true,
    overrides: {},
  },
  builtin: true,
  displayOrder: 100,
  tags: ['system', 'default'],
};

// ---------------------------------------------------------------------------
// Work Mode
// ---------------------------------------------------------------------------

/**
 * Work mode is optimized for productivity and development.
 *
 * Restrictions:
 * - Elevated permission level (file + network access, no subprocess auto-run)
 * - Professional system prompt
 * - Prefers OpenAI provider by convention (can be overridden)
 */
const WorkMode: ModeProfile = {
  id: 'work',
  label: 'Work Mode',
  description: 'Productivity mode focused on development, analysis, and professional tasks.',
  icon: 'briefcase',
  rules: {
    activePlugins: [
    'com.jarvis.browser',
    'com.jarvis.memory',
    'com.jarvis.scheduler',
    'com.jarvis.overlay',
    'com.jarvis.voice',
    'com.jarvis.clipboard',
  ],
  allowedPlugins: [],
    requiredPlugins: [],
    preferredProviderId: 'openai',
    preferredModel: 'gpt-4o',
    systemPrompt:
      'You are Jarvis in Work Mode. You are a professional AI assistant focused on ' +
      'software development, data analysis, technical writing, and productivity. ' +
      'Be precise, thorough, and reference sources when applicable. ' +
      'Prefer code examples over descriptions. Use tools efficiently.',
    permissionLevel: 'elevated',
    allowFilesystem: true,
    allowNetwork: true,
    allowSubprocess: false,
    overrides: {
      temperature: 0.3,
      maxTokens: 8192,
    },
  },
  builtin: true,
  displayOrder: 0,
  tags: ['productivity', 'development', 'professional'],
};

// ---------------------------------------------------------------------------
// Game Mode
// ---------------------------------------------------------------------------

/**
 * Game mode is optimized for entertainment and creativity.
 *
 * Characteristics:
 * - Standard permission level (restricted subprocess access)
 * - Casual, creative system prompt
 * - Higher temperature for more creative responses
 * - Allows filesystem for game saves, screenshots, etc.
 */
const GameMode: ModeProfile = {
  id: 'game',
  label: 'Game Mode',
  description: 'Entertainment mode for gaming, creative projects, and casual interaction.',
  icon: 'game-ps',
  rules: {
    activePlugins: [
    'com.jarvis.overlay',
    'com.jarvis.voice',
    'com.jarvis.computer-use',
    'com.jarvis.memory',
    'com.jarvis.vision',
  ],
  allowedPlugins: [],
    requiredPlugins: [],
    preferredProviderId: '',
    preferredModel: '',
    systemPrompt:
      'You are Jarvis in Game Mode. You are a fun, creative, and engaging AI companion. ' +
      'Help with gaming strategies, creative writing, world-building, and casual conversation. ' +
      'Be imaginative, playful, and encouraging. Use humor when appropriate.',
    permissionLevel: 'standard',
    allowFilesystem: true,
    allowNetwork: true,
    allowSubprocess: false,
    overrides: {
      temperature: 0.8,
      maxTokens: 4096,
    },
  },
  builtin: true,
  displayOrder: 10,
  tags: ['entertainment', 'gaming', 'creative', 'casual'],
};

// ---------------------------------------------------------------------------
// Built-in modes registry
// ---------------------------------------------------------------------------

/**
 * All built-in mode profiles.
 *
 * Third-party plugins can register additional modes via the ModeManager.
 */
const BUILTIN_MODES: ModeProfile[] = [DefaultMode, WorkMode, GameMode];

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { DefaultMode, WorkMode, GameMode, BUILTIN_MODES };




