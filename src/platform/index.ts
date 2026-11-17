import { isTauri } from '@tauri-apps/api/core';
import { desktopPlatform } from './desktop';
import type { Platform } from './types';
import { webPlatform } from './web';

export type { Platform } from './types';

/** The desktop shell when running inside it, the browser otherwise. */
export const platform: Platform = isTauri() ? desktopPlatform : webPlatform;
