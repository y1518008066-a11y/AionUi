/**
 * Adapter Layer — Module Entry
 *
 * Provides the contract interfaces for all external capability backends.
 * Also exports the BackendManager for runtime backend selection,
 * and the local fallback implementations.
 */

// Core types
export type {
  AdapterId,
  AdapterBackend,
  AdapterStatus,
  IAdapter,
  AdapterHealth,
  AdapterDiagnostics,
} from './types';

// Computer Use adapter
export type {
  DisplayInfo,
  WindowInfo,
  CursorInfo,
  Screenshot,
  ScreenshotOptions,
  DesktopInfo,
  IComputerUseAdapter,
} from './computer-use';

// Browser adapter
export type {
  BrowserTab,
  NavigationResult,
  FindOptions,
  ElementRef,
  ClickOptions,
  TypeOptions,
  ScrollOptions,
  BrowserCookie,
  BrowserLaunchOptions,
  IBrowserAdapter,
} from './browser';

// Backend Manager
export { BackendManager, getBackendManager, resetBackendManager } from './backend-manager';
export type { BackendRegistry, BackendConfig } from './backend-manager';

// Backend implementations
export { PlaywrightBrowserBackend } from './playwright-backend';
export { LocalComputerUseBackend } from './local-computer-use-backend';
