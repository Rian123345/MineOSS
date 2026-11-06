import { createStore } from '../lib/store';
import type { AppId } from './wm';

export const prefsStore = createStore<{ pinned: AppId[]; showDesktopIcons: boolean }>(
  { pinned: ['store'], showDesktopIcons: true },
  'mineos.prefs',
);
