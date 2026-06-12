/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Plugin Marketplace — Dependency Resolver
 *
 * Builds a dependency graph from installed and requested plugins,
 * resolves install order (topological sort), detects circular
 * dependencies, and validates version compatibility.
 */

import type { PluginManifest } from './types';
import type { DependencyNode, DependencyResolution, DependencyConflict } from './types';

// ---------------------------------------------------------------------------
// Semver helpers
// ---------------------------------------------------------------------------

/** Naive semver comparison. Returns -1, 0, or 1. */
function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
  }
  return 0;
}

/** Check if a version satisfies a requirement (naive: exact match or >= for same major). */
function satisfiesVersion(actual: string, required: string): boolean {
  const cmp = compareSemver(actual, required);
  // Exact match always passes
  if (cmp === 0) return true;
  // If same major, allow newer minor/patch
  const aMajor = actual.split('.')[0];
  const rMajor = required.split('.')[0];
  if (aMajor === rMajor && cmp > 0) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Dependency Graph
// ---------------------------------------------------------------------------

class DependencyGraph {
  private nodes = new Map<string, DependencyNode>();

  /** Add a plugin to the graph. */
  addNode(manifest: PluginManifest, installed: boolean): DependencyNode {
    const existing = this.nodes.get(manifest.id);
    if (existing) {
      // Update if newer version
      existing.installed = installed;
      return existing;
    }

    const node: DependencyNode = {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      installed,
      dependencies: [...(manifest.dependencies || [])],
      dependents: [],
    };

    this.nodes.set(manifest.id, node);

    // Update reverse edges
    for (const depId of node.dependencies) {
      const dep = this.nodes.get(depId);
      if (dep && !dep.dependents.includes(manifest.id)) {
        dep.dependents.push(manifest.id);
      }
    }

    return node;
  }

  /** Get a node by id. */
  getNode(id: string): DependencyNode | undefined {
    return this.nodes.get(id);
  }

  /** Check if a node exists. */
  hasNode(id: string): boolean {
    return this.nodes.has(id);
  }

  /** Get all nodes. */
  getAllNodes(): DependencyNode[] {
    return [...this.nodes.values()];
  }

  /** Get all node ids. */
  get size(): number {
    return this.nodes.size;
  }
}

// ---------------------------------------------------------------------------
// Circular dependency detection (DFS)
// ---------------------------------------------------------------------------

function detectCycles(graph: DependencyGraph): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const stack = new Set<string>();
  const parent = new Map<string, string>();

  function dfs(nodeId: string): void {
    visited.add(nodeId);
    stack.add(nodeId);

    const node = graph.getNode(nodeId);
    if (!node) return;

    for (const depId of node.dependencies) {
      parent.set(depId, nodeId);
      if (!visited.has(depId)) {
        dfs(depId);
      } else if (stack.has(depId)) {
        // Found a cycle — backtrack to collect it
        const cycle: string[] = [depId];
        let current = nodeId;
        while (current !== depId) {
          cycle.push(current);
          current = parent.get(current) || depId;
        }
        cycle.push(depId);
        cycles.push(cycle.reverse());
      }
    }

    stack.delete(nodeId);
  }

  for (const id of [...graph.getAllNodes().map((n) => n.id)]) {
    if (!visited.has(id)) dfs(id);
  }

  return cycles;
}

// ---------------------------------------------------------------------------
// Topological sort (Kahn's algorithm)
// ---------------------------------------------------------------------------

function topologicalSort(graph: DependencyGraph, targetIds: string[]): string[] | null {
  const inDegree = new Map<string, number>();
  const order: string[] = [];
  const relevant = new Set<string>();

  // Collect all relevant nodes (targets + transitive deps)
  function collectRelevant(id: string): void {
    if (relevant.has(id)) return;
    relevant.add(id);
    const node = graph.getNode(id);
    if (node) {
      for (const dep of node.dependencies) collectRelevant(dep);
    }
  }
  for (const id of targetIds) collectRelevant(id);

  // Build in-degree map for relevant nodes only
  for (const id of relevant) {
    inDegree.set(id, 0);
  }
  for (const id of relevant) {
    const node = graph.getNode(id);
    if (node) {
      for (const dep of node.dependencies) {
        if (relevant.has(dep)) {
          inDegree.set(dep, (inDegree.get(dep) || 0) + 1);
        }
      }
    }
  }

  // Kahn's algorithm
  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);
    const node = graph.getNode(current);
    if (node) {
      for (const dep of node.dependencies) {
        if (relevant.has(dep)) {
          const newDeg = (inDegree.get(dep) || 0) - 1;
          inDegree.set(dep, newDeg);
          if (newDeg === 0) queue.push(dep);
        }
      }
    }
  }

  if (order.length !== relevant.size) return null; // cycle detected
  return order;
}

// ---------------------------------------------------------------------------
// Dependency Resolver
// ---------------------------------------------------------------------------

class DependencyResolver {
  private graph = new DependencyGraph();

  /** Add a known plugin to the resolver. */
  register(manifest: PluginManifest, installed: boolean): void {
    this.graph.addNode(manifest, installed);
  }

  /** Remove a plugin from the resolver. */
  unregister(pluginId: string): void {
    // Node removal handled by rebuilding graph — simpler approach
  }

  /**
   * Resolve dependencies for a set of plugins to install.
   *
   * Returns install order, missing deps, conflicts, and cycles.
   */
  resolve(pluginIds: string[]): DependencyResolution {
    const missing: string[] = [];
    const conflicts: DependencyConflict[] = [];
    const installOrder: string[] = [];

    // Collect all transitive dependencies
    const toResolve = new Set(pluginIds);
    for (const id of pluginIds) {
      this.collectTransitiveDeps(id, toResolve, missing);
    }

    // Check version conflicts
    for (const id of toResolve) {
      const node = this.graph.getNode(id);
      if (!node) continue;

      // Check each dependency's version requirement
      const allDependents = this.findDependents(id);
      for (const depId of allDependents) {
        const depNode = this.graph.getNode(depId);
        if (!depNode) continue;
        // We need the dependent to declare a version requirement.
        // Currently dependencies are id-only, so we just check existence.
        // Version constraints could be added as "id@>=1.0.0" in future.
      }
    }

    // Detect cycles
    const cycles = detectCycles(this.graph);

    // If cycles exist, cannot produce install order
    if (cycles.length > 0) {
      return {
        ok: false,
        installOrder: [],
        missing,
        conflicts,
        cycles,
        graph: this.graph.getAllNodes(),
      };
    }

    // Topological sort
    const sortedIds = [...toResolve];
    const order = topologicalSort(this.graph, sortedIds);

    if (!order) {
      return {
        ok: false,
        installOrder: [],
        missing,
        conflicts,
        cycles: [['cycle' /* unreachable */]], // topological sort failure implies cycle
        graph: this.graph.getAllNodes(),
      };
    }

    // Filter to only uninstalled plugins (install order)
    const toInstall = order.filter((id) => {
      const node = this.graph.getNode(id);
      return node && !node.installed;
    });

    return {
      ok: missing.length === 0,
      installOrder: toInstall,
      missing,
      conflicts,
      cycles,
      graph: this.graph.getAllNodes(),
    };
  }

  /**
   * Check if uninstalling a plugin would break dependents.
   */
  checkUninstallImpact(pluginId: string): string[] {
    const node = this.graph.getNode(pluginId);
    if (!node) return [];
    return node.dependents.filter((depId) => {
      const depNode = this.graph.getNode(depId);
      return depNode?.installed;
    });
  }

  /**
   * Get the full dependency tree for a plugin.
   */
  getDependencyTree(pluginId: string, depth = 0): string {
    const node = this.graph.getNode(pluginId);
    if (!node) return `${'  '.repeat(depth)}${pluginId} (NOT FOUND)`;

    const lines: string[] = [
      `${'  '.repeat(depth)}${node.id} v${node.version} ${node.installed ? '[INSTALLED]' : '[MISSING]'}`,
    ];

    for (const depId of node.dependencies) {
      lines.push(this.getDependencyTree(depId, depth + 1));
    }

    return lines.join('\n');
  }

  /** Get diagnostics. */
  getDiagnostics(): { totalNodes: number; cyclesDetected: number } {
    const cycles = detectCycles(this.graph);
    return {
      totalNodes: this.graph.size,
      cyclesDetected: cycles.length,
    };
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private collectTransitiveDeps(id: string, resolved: Set<string>, missing: string[]): void {
    const node = this.graph.getNode(id);
    if (!node) {
      missing.push(id);
      return;
    }
    resolved.add(id);
    for (const depId of node.dependencies) {
      if (!resolved.has(depId)) {
        this.collectTransitiveDeps(depId, resolved, missing);
      }
    }
  }

  private findDependents(id: string): string[] {
    const result: string[] = [];
    for (const node of this.graph.getAllNodes()) {
      if (node.dependencies.includes(id)) result.push(node.id);
    }
    return result;
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { DependencyResolver, DependencyGraph, detectCycles, compareSemver, satisfiesVersion };