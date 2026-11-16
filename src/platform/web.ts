import type { Platform } from './index';

const baseTitle = 'Life Of Pi';

export const webPlatform: Platform = {
  kind: 'web',

  async notify(title, body) {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
    new Notification(title, { body });
    return true;
  },

  async requestNotificationPermission() {
    if (typeof Notification === 'undefined') return false;
    if (Notification.permission === 'granted') return true;
    return (await Notification.requestPermission()) === 'granted';
  },

  // A browser tab cannot listen for keys while another app is focused.
  registerGlobalShortcut() {
    return () => {};
  },

  // The closest a tab has to a tray icon is its title.
  setTimerIndicator(label) {
    document.title = label ? `${label} · ${baseTitle}` : baseTitle;
  },

  canFloatFocusBar: false,
};
