import { webPlatform } from './web';

/**
 * Everything that depends on the operating system goes through this
 * interface. The web build uses browser APIs or does nothing; the Windows
 * build (Phase 8) supplies a native implementation without touching features.
 */
export interface Platform {
  kind: 'web' | 'windows';
  /** Show a system notification. Resolves false if it could not be shown. */
  notify(title: string, body?: string): Promise<boolean>;
  requestNotificationPermission(): Promise<boolean>;
  /** Register a shortcut that works while another app is focused. Returns an unregister function. */
  registerGlobalShortcut(accelerator: string, handler: () => void): () => void;
  /** Show the running timer outside the window (tray on Windows). */
  setTimerIndicator(label: string | null): void;
  /** Whether the focus bar can float above other apps. */
  canFloatFocusBar: boolean;
  /** Hands a text file to the person to save: a download in a browser, a save dialog on Windows. */
  saveTextFile(fileName: string, text: string, mimeType: string): Promise<void>;
}

export const platform: Platform = webPlatform;
