/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Jarvis Control Layer — Event Bus
 *
 * Thin pub/sub wrapper for Jarvis system events.
 * Operates in-process only — does not cross IPC or WebSocket boundaries.
 */

import type { IEventBus, JarvisEvent, EventHandler } from './interfaces';

function createEventBus(): IEventBus {
  const subscribers = new Map<string, Set<EventHandler>>();
  const wildcardSubscribers = new Set<EventHandler>();

  const bus: IEventBus = {
    on<T extends JarvisEvent>(eventType: T['type'], handler: EventHandler<T>): () => void {
      let set = subscribers.get(eventType);
      if (!set) {
        set = new Set();
        subscribers.set(eventType, set);
      }
      set.add(handler as EventHandler);
      return () => {
        set?.delete(handler as EventHandler);
      };
    },

    onAny(handler: EventHandler): () => void {
      wildcardSubscribers.add(handler);
      return () => {
        wildcardSubscribers.delete(handler);
      };
    },

    emit(event: JarvisEvent): void {
      // Notify type-specific subscribers
      const set = subscribers.get(event.type);
      if (set) {
        for (const handler of set) {
          try {
            handler(event);
          } catch (error) {
            console.error(`[Jarvis:EventBus] Error in handler for "${event.type}":`, error);
          }
        }
      }
      // Notify wildcard subscribers
      for (const handler of wildcardSubscribers) {
        try {
          handler(event);
        } catch (error) {
          console.error('[Jarvis:EventBus] Error in wildcard handler:', error);
        }
      }
    },

    clear(): void {
      subscribers.clear();
      wildcardSubscribers.clear();
    },

    get subscriberCount(): number {
      let count = wildcardSubscribers.size;
      for (const set of subscribers.values()) {
        count += set.size;
      }
      return count;
    },
  };

  return bus;
}

export { createEventBus };
