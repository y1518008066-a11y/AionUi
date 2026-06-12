/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Tests for Plugin Manifest Validation
 */

import { describe, it, expect } from 'vitest';
import { validateManifest } from '../../../plugin-runtime/manifest';

describe('validateManifest', () => {
  it('accepts a valid manifest', () => {
    const result = validateManifest({
      id: 'com.jarvis.test',
      name: 'Test Plugin',
      version: '1.0.0',
      author: 'Tester',
      description: 'A test plugin.',
      entry: 'index.js',
      permissions: ['clipboard:read'],
      dependencies: [],
      capabilities: ['clipboard'],
      minimumJarvisVersion: '2.0.0',
      enabledByDefault: false,
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts a minimal valid manifest', () => {
    const result = validateManifest({
      id: 'com.minimal.plugin',
      name: 'Minimal',
      version: '0.1.0',
      author: 'Dev',
      description: 'Bare minimum.',
      entry: 'main.js',
    });

    expect(result.valid).toBe(true);
  });

  it('rejects a missing id', () => {
    const result = validateManifest({
      name: 'No ID',
      version: '1.0.0',
      author: 'Tester',
      description: 'Missing id.',
      entry: 'index.js',
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('id'))).toBe(true);
  });

  it('rejects an invalid semver version', () => {
    const result = validateManifest({
      id: 'com.test.v',
      name: 'Bad Version',
      version: 'not-semver',
      author: 'Tester',
      description: 'Bad version.',
      entry: 'index.js',
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('version'))).toBe(true);
  });

  it('rejects empty name', () => {
    const result = validateManifest({
      id: 'com.test.empty',
      name: '',
      version: '1.0.0',
      author: 'Tester',
      description: 'Empty name.',
      entry: 'index.js',
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('name'))).toBe(true);
  });

  it('rejects invalid plugin id format', () => {
    const result = validateManifest({
      id: 'Invalid ID With Spaces',
      name: 'Bad ID',
      version: '1.0.0',
      author: 'Tester',
      description: 'Bad id format.',
      entry: 'index.js',
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('id'))).toBe(true);
  });

  it('rejects unknown permission', () => {
    const result = validateManifest({
      id: 'com.test.perm',
      name: 'Bad Perm',
      version: '1.0.0',
      author: 'Tester',
      description: 'Bad permission.',
      entry: 'index.js',
      permissions: ['sudo:everything'],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Unknown permission'))).toBe(true);
  });

  it('rejects unknown capability', () => {
    const result = validateManifest({
      id: 'com.test.cap',
      name: 'Bad Cap',
      version: '1.0.0',
      author: 'Tester',
      description: 'Bad capability.',
      entry: 'index.js',
      capabilities: ['time-travel'],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Unknown capability'))).toBe(true);
  });

  it('rejects null input', () => {
    const result = validateManifest(null);
    expect(result.valid).toBe(false);
  });

  it('rejects non-object input', () => {
    const result = validateManifest('not an object');
    expect(result.valid).toBe(false);
  });

  it('accepts semver with pre-release tag', () => {
    const result = validateManifest({
      id: 'com.test.prerelease',
      name: 'Pre-release',
      version: '1.0.0-beta.1',
      author: 'Tester',
      description: 'Pre-release version.',
      entry: 'index.js',
      minimumJarvisVersion: '2.0.0-alpha',
    });

    expect(result.valid).toBe(true);
  });

  it('collects multiple errors', () => {
    const result = validateManifest({
      id: '',
      name: '',
      version: 'bad',
      author: '',
      description: '',
      entry: '',
    });

    expect(result.valid).toBe(false);
    // Should have at least 4 errors (id, name, version, author, description, entry)
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
  });
});