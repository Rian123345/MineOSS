import type { ComponentType, ReactNode } from 'react';
import { wm, type AppId, type OpenOptions } from './wm';
import { StoreIcon, ComputerIcon, ControlPanelIcon, UserPic, StatusGlyph, ShieldIcon, Emblem } from './icons';
import { StoreApp } from '../apps/store/StoreApp';
import { AdminApp } from '../apps/admin/AdminApp';
import { ComputerApp } from '../apps/system/Computer';
import { ControlPanelApp } from '../apps/system/ControlPanel';
import { UserAccountsApp } from '../apps/system/UserAccounts';
import { AboutApp } from '../apps/system/About';
import { MessageBox } from './MessageBox';
import { tr } from '../lib/i18n';

export interface AppProps { winId: string; props: Record<string, any>; nonce: number }

interface AppDef {
  title: string;
  component: ComponentType<AppProps>;
  smallIcon: () => ReactNode;
  largeIcon: (size?: number) => ReactNode;
  options: Omit<OpenOptions, 'title'>;
  /** Farbe für das Hot-Tracking-Leuchten in der Taskleiste */
  hot: string;
}

export const APPS: Record<AppId, AppDef> = {
  store: {
    title: 'Minecraft Store',
    component: StoreApp,
    smallIcon: () => <StoreIcon size={16} />,
    largeIcon: (s = 32) => <StoreIcon size={s} />,
    options: { w: 1060, h: 700, minW: 520, minH: 380 },
    hot: '110, 200, 70',
  },
  admin: {
    get title() { return tr("Shop-Verwaltung", "Shop Management"); },
    component: AdminApp,
    smallIcon: () => <ShieldIcon size={16} />,
    largeIcon: (s = 32) => <ShieldIcon size={s} />,
    options: { w: 1120, h: 720, minW: 560, minH: 400 },
    hot: '255, 190, 60',
  },
  computer: {
    title: 'Computer',
    component: ComputerApp,
    smallIcon: () => <ComputerIcon size={16} />,
    largeIcon: (s = 32) => <ComputerIcon size={s} />,
    options: { w: 780, h: 500, minW: 420, minH: 300 },
    hot: '90, 170, 255',
  },
  controlpanel: {
    get title() { return tr("Systemsteuerung", "Control Panel"); },
    component: ControlPanelApp,
    smallIcon: () => <ControlPanelIcon size={16} />,
    largeIcon: (s = 32) => <ControlPanelIcon size={s} />,
    options: { w: 860, h: 580, minW: 480, minH: 340 },
    hot: '120, 200, 255',
  },
  useraccounts: {
    get title() { return tr("Benutzerkonten", "User Accounts"); },
    component: UserAccountsApp,
    smallIcon: () => <UserPic size={16} />,
    largeIcon: (s = 32) => <UserPic size={s} />,
    options: { w: 680, h: 500, minW: 420, minH: 320 },
    hot: '100, 190, 255',
  },
  about: {
    get title() { return tr("Info über MineOS", "About MineOS"); },
    component: AboutApp,
    smallIcon: () => <Emblem size={16} />,
    largeIcon: (s = 32) => <Emblem size={s} />,
    options: { w: 480, h: 420, resizable: false, maximizable: false, minW: 400, minH: 300, center: true },
    hot: '120, 200, 255',
  },
  msgbox: {
    title: '',
    component: MessageBox,
    smallIcon: () => <StatusGlyph kind="info" size={16} />,
    largeIcon: (s = 32) => <StatusGlyph kind="info" size={s} />,
    options: { w: 440, h: 200 },
    hot: '120, 200, 255',
  },
};

export function openApp(app: AppId, props: Record<string, any> = {}) {
  const def = APPS[app];
  return wm.open(app, { title: def.title, ...def.options }, props);
}
