/**
 * Everything that depends on the operating system goes through this
 * interface. The web build uses browser APIs or does nothing; the desktop
 * build (the Windows app) supplies native versions without touching features.
 */
export interface BackupEntry {
  id: string;
  /** When it was made. */
  at: number;
  /** Size in bytes. */
  size: number;
}

/** Where automatic backups are kept: files in a folder on desktop, a separate store in the browser. */
export interface BackupStore {
  /** The folder, for display; null in the browser. */
  location(): Promise<string | null>;
  /** Lets the person pick another folder; null where there is no choice. Resolves to the new folder, or null if cancelled. */
  chooseLocation: (() => Promise<string | null>) | null;
  list(): Promise<BackupEntry[]>;
  write(at: number, text: string): Promise<void>;
  read(id: string): Promise<string>;
  remove(id: string): Promise<void>;
}

export interface Platform {
  kind: 'web' | 'desktop';
  /** Show a system notification. Resolves false if it could not be shown. */
  notify(title: string, body?: string): Promise<boolean>;
  /** Register a shortcut that works while another app is focused. Resolves to an unregister function. */
  registerGlobalShortcut(accelerator: string, handler: () => void): Promise<() => void>;
  /** Show the running timer outside the window: the tray tooltip on desktop, the tab title on the web. */
  setTimerIndicator(label: string | null): void;
  /** Whether the focus bar can float above other apps. */
  canFloatFocusBar: boolean;
  /** Opens or closes the floating focus bar window. */
  setFloatingFocusBar(open: boolean): Promise<void>;
  /** Brings the main window to the front. */
  showMainWindow(): Promise<void>;
  /** Starting the app when the person signs in; null where that is not possible. */
  launchAtLogin: { get(): Promise<boolean>; set(on: boolean): Promise<void> } | null;
  /** Hands a text file to the person to save. Resolves false if they cancelled. */
  saveTextFile(fileName: string, text: string, mimeType: string): Promise<boolean>;
  backups: BackupStore;
}
