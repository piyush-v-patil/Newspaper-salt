import { browserBackups } from './browserBackups';
import type { Platform } from './types';

const baseTitle = 'Life Of Pi';

export const webPlatform: Platform = {
  kind: 'web',

  // A tab only notifies if the person already allowed it; asking needs a click on something that explains why.
  async notify(title, body) {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
    new Notification(title, { body });
    return true;
  },

  // A browser tab cannot listen for keys while another app is focused.
  async registerGlobalShortcut() {
    return () => {};
  },

  // The closest a tab has to a tray icon is its title.
  setTimerIndicator(label) {
    document.title = label ? `${label} · ${baseTitle}` : baseTitle;
  },

  canFloatFocusBar: false,
  async setFloatingFocusBar() {},

  async showMainWindow() {
    window.focus();
  },

  launchAtLogin: null,

  async saveTextFile(fileName, text, mimeType) {
    const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.append(link);
    link.click();
    link.remove();
    // Give the browser a moment to start the download before releasing the file.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return true;
  },

  backups: browserBackups,
};
