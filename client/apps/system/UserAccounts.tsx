import { useState } from 'react';
import { UserPic, ShieldIcon, PackageIcon, ItemIcon } from '../../os/icons';
import { openApp, type AppProps } from '../../os/apps';
import { useStore } from '../../lib/store';
import { sessionStore, logout } from '../../os/session';
import { post, ApiError } from '../../lib/api';
import { Spinner } from '../../os/Boot';
import { tr } from '../../lib/i18n';

function PasswordChange() {
  const [cur, setCur] = useState('');
  const [n1, setN1] = useState('');
  const [n2, setN2] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (n1.length < 8) { setMsg({ ok: false, text: tr("Das neue Passwort muss mindestens 8 Zeichen lang sein.", "The new password must be at least 8 characters long.") }); return; }
    if (n1 !== n2) { setMsg({ ok: false, text: tr("Die neuen Passwörter stimmen nicht überein.", "The new passwords do not match.") }); return; }
    setBusy(true); setMsg(null);
    try {
      await post('/api/auth/password', { currentPassword: cur, newPassword: n1 });
      setMsg({ ok: true, text: tr("Dein Passwort wurde geändert. Andere Geräte wurden abgemeldet.", "Your password was changed. Other devices were signed out.") });
      setCur(''); setN1(''); setN2('');
    } catch (ex) { setMsg({ ok: false, text: (ex as ApiError).message }); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="group-box" style={{ maxWidth: 420 }}>
      <span className="gb-title">{tr("Passwort ändern", "Change password")}</span>
      <div className="field"><label>{tr("Aktuelles Passwort", "Current password")}</label><input className="input" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} /></div>
      <div className="field"><label>{tr("Neues Passwort", "New password")}</label><input className="input" type="password" autoComplete="new-password" value={n1} onChange={(e) => setN1(e.target.value)} />
        <span className="hint">{tr("Mindestens 8 Zeichen.", "At least 8 characters.")}</span></div>
      <div className="field"><label>{tr("Neues Passwort wiederholen", "Repeat new password")}</label><input className="input" type="password" autoComplete="new-password" value={n2} onChange={(e) => setN2(e.target.value)} /></div>
      {msg && <div className={msg.ok ? 'ok-text' : 'err-text'} style={{ marginBottom: 8 }}>{msg.text}</div>}
      <button className="btn" type="submit" disabled={busy || !cur || !n1 || !n2}>{busy ? <Spinner small dark /> : tr("Passwort ändern", "Change password")}</button>
    </form>
  );
}

export function UserAccountsApp(_: AppProps) {
  const session = useStore(sessionStore);
  const u = session.user;
  return (
    <div className="app-scroll" style={{ padding: '16px 22px', background: 'var(--ua-head, linear-gradient(#fff, #f4f8fc))' }}>
      <h1 className="h-title">{tr("Ihr Benutzerkonto", "Your user account")}</h1>
      <div className="account-card">
        <div className="ws-pic" style={{ width: 70, height: 70, padding: 6 }}><div><UserPic size={56} admin={session.isAdmin} /></div></div>
        <div>
          <div style={{ fontSize: 15 }}>{u?.name ?? tr("Gast", "Guest")}</div>
          <div className="muted" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {u?.edition && <ItemIcon icon={u.edition === 'java' ? 'grass_block' : 'diamond'} size={14} />}
            {u?.edition === 'bedrock' ? 'Minecraft: Bedrock Edition' : u?.edition === 'java' ? 'Minecraft: Java Edition' : tr("Minecraft-Konto", "Minecraft account")}
          </div>
          <div className="muted">{session.isAdmin ? tr("Administrator · darf den Shop verwalten", "Administrator · can manage the shop") : tr("Kunde", "Customer")}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => openApp('store', { view: { kind: 'track' } })}><PackageIcon size={14} /> {tr("Meine Bestellungen", "My orders")}</button>
        {session.isAdmin && <button className="btn" onClick={() => openApp('admin')}><ShieldIcon size={14} /> {tr("Shop-Verwaltung öffnen", "Open Shop Management")}</button>}
        <button className="btn" onClick={() => void logout()}>{tr("Abmelden", "Log off")}</button>
      </div>
      <PasswordChange />
    </div>
  );
}
