import { useCallback, useEffect, useState } from 'react';
import type { ShopUser } from '../../../shared/types';
import { adminApi } from './common';
import { UserPic, SearchIcon, StatusGlyph } from '../../os/icons';
import { msgbox } from '../../os/wm';
import { useStore } from '../../lib/store';
import { sessionStore } from '../../os/session';
import { fmtDateTime, timeAgo, cls } from '../../lib/format';
import { Spinner } from '../../os/Boot';
import { tr } from '../../lib/i18n';

export function UsersPage({ winId }: { winId: string }) {
  const me = useStore(sessionStore).user;
  const [users, setUsers] = useState<ShopUser[] | null>(null);
  const [q, setQ] = useState('');
  const load = useCallback(() => adminApi<ShopUser[]>('GET', '/api/admin/users').then(setUsers).catch(() => setUsers([])), []);
  useEffect(() => { void load(); }, [load]);

  const change = async (u: ShopUser, body: Partial<Pick<ShopUser, 'role' | 'blocked'>> & { resetPassword?: true }, confirm: { heading: string; text: string }) => {
    const a = await msgbox({ title: tr("Benutzer ändern", "Change user"), heading: confirm.heading, text: confirm.text, icon: 'question', buttons: [tr("Ja", "Yes"), tr("Abbrechen", "Cancel")], parentId: winId });
    if (a !== tr('Ja', 'Yes')) return;
    try {
      const r = await adminApi<{ tempPassword?: string }>('PATCH', `/api/admin/users/${u.id}`, body);
      if (r.tempPassword) {
        await msgbox({ title: tr("Neues Passwort", "New password"), heading: r.tempPassword, text: tr(`Neues Passwort für ${u.name}.\nGib es dem Spieler weiter – er kann es danach unter „Benutzerkonto“ ändern.\nEs wird nur jetzt angezeigt.`, `New password for ${u.name}.\nGive it to the player – they can change it under “User account” afterwards.\nIt is only shown now.`), icon: 'info', parentId: winId });
      }
      void load();
    }
    catch (e) { void msgbox({ title: tr("Fehler", "Error"), text: (e as Error).message, icon: 'error', parentId: winId }); }
  };

  const visible = (users ?? []).filter((u) => !q || u.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="admin-page">
      <div className="page-toolbar">
        <span className="muted">{tr("Alle Konten, die im Shop erstellt wurden.", "All accounts created in the shop.")}</span>
        <div className="search-box" style={{ width: 220, marginLeft: 'auto' }}><input placeholder={tr("Minecraft-Name", "Minecraft name")} value={q} onChange={(e) => setQ(e.target.value)} /><span className="sb-ic"><SearchIcon /></span></div>
      </div>
      <div className="app-scroll">
        {!users ? <div className="empty-state"><Spinner dark /></div> : (
          <table className="list-table">
            <thead><tr><th>Name</th><th>Edition</th><th>{tr("Rolle", "Role")}</th><th className="num">{tr("Bestellungen", "Orders")}</th><th>{tr("Letzte Anmeldung", "Last sign-in")}</th><th /></tr></thead>
            <tbody>
              {visible.map((u) => (
                <tr key={u.id} className={cls(u.blocked && 'inactive-row')}>
                  <td><span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><UserPic size={22} admin={u.role === 'admin'} />{u.name}{u.id === me?.id && <span className="muted">{tr("(du)", "(you)")}</span>}</span></td>
                  <td>{u.edition === 'bedrock' ? 'Bedrock' : u.edition === 'java' ? 'Java' : '—'}</td>
                  <td>{u.blocked ? <span className="err-text">{tr("Gesperrt", "Locked")}</span> : u.role === 'admin' ? <b style={{ fontWeight: 600 }}>{tr("Administrator", "Administrator")}</b> : tr("Kunde", "Customer")}</td>
                  <td className="num">{u.orderCount}</td>
                  <td title={u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : ''}>{u.lastLoginAt ? timeAgo(u.lastLoginAt) : '—'}</td>
                  <td className="num">
                    {u.id !== me?.id && (u.role === 'admin' ? (
                      <button className="cmd-btn" onClick={() => change(u, { role: 'customer' }, { heading: tr(`${u.name} die Admin-Rechte entziehen?`, `Remove admin rights from ${u.name}?`), text: tr("Das Konto kann danach nur noch einkaufen.", "The account will only be able to shop afterwards.") })}>{tr("Admin entfernen", "Remove admin")}</button>
                    ) : (
                      <button className="cmd-btn" onClick={() => change(u, { role: 'admin' }, { heading: tr(`${u.name} zum Administrator machen?`, `Make ${u.name} an administrator?`), text: tr("Administratoren sehen alle Bestellungen, ändern Preise und verwalten Discord und Benutzer.", "Administrators see all orders, change prices and manage Discord and users.") })}>{tr("Zum Admin machen", "Make admin")}</button>
                    ))}
                    <button className="cmd-btn" onClick={() => change(u, { resetPassword: true }, { heading: tr(`Passwort von ${u.name} zurücksetzen?`, `Reset the password of ${u.name}?`), text: tr("Es wird ein neues, zufälliges Passwort erzeugt. Das alte funktioniert dann nicht mehr.", "A new random password is generated. The old one will stop working.") })}>{tr("Passwort zurücksetzen", "Reset password")}</button>
                    {u.id !== me?.id && (u.blocked ? (
                      <button className="cmd-btn" onClick={() => change(u, { blocked: false }, { heading: tr(`${u.name} entsperren?`, `Unblock ${u.name}?`), text: tr("Das Konto kann sich danach wieder anmelden.", "The account will be able to sign in again.") })}>{tr("Entsperren", "Unlock")}</button>
                    ) : (
                      <button className="cmd-btn" style={{ color: '#c0392b' }} onClick={() => change(u, { blocked: true }, { heading: tr(`${u.name} sperren?`, `Block ${u.name}?`), text: tr("Das Konto wird sofort abgemeldet und kann den Shop nicht mehr nutzen.", "The account is signed out immediately and can no longer use the shop.") })}>{tr("Sperren", "Lock")}</button>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="info-bar blue" style={{ margin: 10 }}><StatusGlyph kind="info" size={16} /> {tr("Spieler erstellen ihr Konto selbst im Anmeldebildschirm. Hat jemand sein Passwort vergessen, klicke auf „Passwort zurücksetzen“.", "Players create their own account on the sign-in screen. If someone forgot their password, click “Reset password”.")}</div>
      </div>
    </div>
  );
}
