import { createStore } from '../lib/store';
import type { AppId } from './wm';

export const prefsStore = createStore<{ pinned: AppId[]; showDesktopIcons: boolean; chatPinned?: boolean }>(
  { pinned: ['store', 'chat'], showDesktopIcons: true, chatPinned: true },
  'mineos.prefs',
);

// Ältere Einstellungen: MineChat einmalig neben den Store an die Taskleiste heften
if (!prefsStore.get().chatPinned) {
  prefsStore.set((p) => ({ ...p, chatPinned: true, pinned: p.pinned.includes('chat') ? p.pinned : [...p.pinned.slice(0, 1), 'chat', ...p.pinned.slice(1)] }));
}
