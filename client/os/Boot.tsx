import { useEffect, type ReactNode } from 'react';
import { Emblem, UserPic, PowerIcon } from './icons';
import { tr } from '../lib/i18n';

export function Spinner({ small, dark }: { small?: boolean; dark?: boolean }) {
  return (
    <div className={`spinner${small ? ' small' : ''}${dark ? ' dark' : ''}`} aria-label={tr("Wird geladen", "Loading")}>
      {[0, 1, 2, 3, 4, 5].map((i) => <i key={i} style={{ animationDelay: `${i * 0.13}s` }} />)}
    </div>
  );
}

/** Hintergrund für Anmelde-, Willkommens- und Abmeldebildschirm: das Hintergrundbild, weich und abgedunkelt */
export function LogonBackdrop() {
  return <div className="logon-backdrop" />;
}

export function BootScreen({ onDone, fast }: { onDone: () => void; fast: boolean }) {
  useEffect(() => {
    const t = setTimeout(onDone, fast ? 700 : 2600);
    return () => clearTimeout(t);
  }, [onDone, fast]);
  return (
    <div className="boot-screen">
      <div className="boot-emblem"><Emblem size={110} /></div>
      <div className="boot-text">{tr("MineOS wird gestartet", "Starting MineOS")}</div>
      <div className="boot-dots"><span /><span /><span /><span /><span /></div>
      <div className="boot-foot">© MineOS · Minecraft Store Edition</div>
    </div>
  );
}

export function WelcomeScreen({ onDone, user, admin }: { onDone: () => void; user: string; admin: boolean }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1300);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="welcome-screen">
      <LogonBackdrop />
      <div className="ws-user">
        <div className="ws-pic"><div><UserPic size={106} admin={admin} /></div></div>
        <div>{user}</div>
      </div>
      <div className="ws-status">
        <Spinner />
        <span>{tr("Willkommen", "Welcome")}</span>
      </div>
    </div>
  );
}

export function ShutdownScreen({ text, onDone }: { text: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="shutdown-screen">
      <LogonBackdrop />
      <Spinner />
      <span>{text}</span>
    </div>
  );
}

export function LockScreen({ user, admin, onUnlock }: { user: string; admin: boolean; onUnlock: () => void }) {
  return (
    <div className="welcome-screen" onClick={onUnlock} style={{ cursor: 'pointer' }}>
      <LogonBackdrop />
      <div className="ws-user">
        <div className="ws-pic"><div><UserPic size={106} admin={admin} /></div></div>
        <div>{user}</div>
        <div style={{ fontSize: 14, opacity: 0.85 }}>{tr("Gesperrt", "Locked")}</div>
        <button className="btn primary big" style={{ marginTop: 10 }} onClick={onUnlock} autoFocus>{tr("Entsperren", "Unlock")}</button>
      </div>
    </div>
  );
}

export function OffScreen({ onPower }: { onPower: () => void }) {
  return (
    <div className="off-screen">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <button className="power-btn" onClick={onPower} aria-label={tr("Einschalten", "Power on")} autoFocus><PowerIcon size={30} color="#4aa8ff" /></button>
        <div className="off-hint">{tr("Der Computer wurde heruntergefahren.", "The computer has been shut down.")}<br />{tr("Zum Einschalten auf die Taste klicken.", "Click the button to turn it on.")}</div>
      </div>
    </div>
  );
}

/* ═══════════════════ XP-Theme ═══════════════════ */

/** MineOS-Schriftzug im XP-Stil (eigenes Logo, kein Microsoft-Logo) */
export function XpWordmark({ size = 1 }: { size?: number }) {
  return (
    <div className="xp-wordmark" style={{ fontSize: `${size}em` }}>
      <Emblem size={Math.round(64 * size)} />
      <div className="xpw-text">
        <span className="xpw-small">SeñorPollo</span>
        <span className="xpw-big">MineOS<sup>XP</sup></span>
      </div>
    </div>
  );
}

/** Der klassische schwarze Ladebildschirm mit dem wandernden blauen Balken */
export function BootScreenXP({ onDone, fast }: { onDone: () => void; fast: boolean }) {
  useEffect(() => {
    const t = setTimeout(onDone, fast ? 1600 : 4600);
    return () => clearTimeout(t);
  }, [onDone, fast]);
  return (
    <div className="xp-boot">
      <div className="xp-boot-center">
        <XpWordmark size={1.15} />
        <div className="xp-boot-bar" role="progressbar" aria-label={tr('MineOS wird gestartet', 'Starting MineOS')}><i><span /><span /><span /></i></div>
      </div>
      <div className="xp-boot-foot">
        <span>Copyright © MineOS · SeñorPollo Shop Order</span>
        <span className="xpb-brand">MineOS</span>
      </div>
    </div>
  );
}

/** Blauer Rahmen von Anmelde-, Willkommens- und Abmeldebildschirm */
export function XpFrame({ children, bottom }: { children: ReactNode; bottom?: ReactNode }) {
  return (
    <div className="xp-frame">
      <div className="xpf-top" />
      <div className="xpf-mid">{children}</div>
      <div className="xpf-bottom">{bottom}</div>
    </div>
  );
}

export function WelcomeScreenXP({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1700);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <XpFrame>
      <div className="xp-welcome-text">{tr('willkommen', 'welcome')}</div>
    </XpFrame>
  );
}

export function ShutdownScreenXP({ text, onDone }: { text: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <XpFrame>
      <div className="xp-status">
        <XpWordmark size={0.9} />
        <div className="xp-status-text">{text}</div>
      </div>
    </XpFrame>
  );
}

export function LockScreenXP({ user, admin, onUnlock }: { user: string; admin: boolean; onUnlock: () => void }) {
  return (
    <XpFrame bottom={<span className="xpf-hint">{tr('Dieser Computer ist gesperrt.', 'This computer is locked.')}</span>}>
      <div className="xp-logon-split">
        <div className="xpl-left">
          <XpWordmark />
          <div className="xpl-tagline">{tr('Klicke auf deinen Benutzernamen, um fortzufahren.', 'Click your user name to continue.')}</div>
        </div>
        <div className="xpl-divider" />
        <div className="xpl-right">
          <button className="xp-user-tile selected" onClick={onUnlock} autoFocus>
            <span className="xput-pic"><UserPic size={48} admin={admin} /></span>
            <span className="xput-name">{user}<small>{tr('Gesperrt – zum Entsperren klicken', 'Locked – click to unlock')}</small></span>
          </button>
        </div>
      </div>
    </XpFrame>
  );
}
