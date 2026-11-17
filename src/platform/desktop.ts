import { invoke } from '@tauri-apps/api/core';
import { currentMonitor } from '@tauri-apps/api/window';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { register, unregister } from '@tauri-apps/plugin-global-shortcut';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { folderBackups } from './folderBackups';
import type { Platform } from './types';

const FOCUS_BAR = 'focusbar';
const BAR_WIDTH = 440;
const BAR_HEIGHT = 52;
const baseTitle = 'Life Of Pi';

let notificationsAllowed: boolean | null = null;

async function canNotify(): Promise<boolean> {
  if (notificationsAllowed !== null) return notificationsAllowed;
  notificationsAllowed = (await isPermissionGranted()) || (await requestPermission()) === 'granted';
  return notificationsAllowed;
}

/** The Windows app (and the same shell on macOS and Linux). */
export const desktopPlatform: Platform = {
  kind: 'desktop',

  async notify(title, body) {
    if (!(await canNotify())) return false;
    sendNotification({ title, body });
    return true;
  },

  async registerGlobalShortcut(accelerator, handler) {
    try {
      await register(accelerator, (event) => {
        if (event.state === 'Pressed') handler();
      });
    } catch {
      // Another app already owns this combination; the in-app shortcuts still work.
      return () => {};
    }
    return () => void unregister(accelerator).catch(() => {});
  },

  setTimerIndicator(label) {
    document.title = label ? `${label} · ${baseTitle}` : baseTitle;
    void invoke('set_tray_status', { label }).catch(() => {});
  },

  canFloatFocusBar: true,

  async setFloatingFocusBar(open) {
    const existing = await WebviewWindow.getByLabel(FOCUS_BAR);
    if (!open) {
      await existing?.close();
      return;
    }
    if (existing) return;
    // Top right of the screen, clear of the edge.
    const monitor = await currentMonitor();
    const scale = monitor?.scaleFactor ?? 1;
    const screenWidth = monitor ? monitor.size.width / scale : 1440;
    new WebviewWindow(FOCUS_BAR, {
      url: '/focusbar',
      title: 'Focus bar',
      width: BAR_WIDTH,
      height: BAR_HEIGHT,
      x: Math.max(0, screenWidth - BAR_WIDTH - 24),
      y: 24,
      resizable: false,
      decorations: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      focus: false,
    });
  },

  async showMainWindow() {
    await invoke('show_main_window');
  },

  launchAtLogin: {
    get: () => isEnabled(),
    set: (on) => (on ? enable() : disable()),
  },

  async saveTextFile(fileName, text) {
    const path = await save({ defaultPath: fileName, filters: [{ name: 'Life Of Pi backup', extensions: ['json'] }] });
    if (!path) return false;
    await writeTextFile(path, text);
    return true;
  },

  backups: folderBackups,
};
