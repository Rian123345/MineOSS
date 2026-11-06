import { useEffect } from 'react';
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
