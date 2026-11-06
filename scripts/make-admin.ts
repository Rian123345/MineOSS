/**
 * Notfall-Werkzeug (im MineOS-Ordner ausführen):
 *   npm run make-admin -- Steve                     → Steve wird Administrator
 *   npm run make-admin -- Steve --remove            → Admin-Rechte entfernen
 *   npm run make-admin -- Steve --password NeuesPW1 → Passwort von Steve neu setzen
 */
import { db } from '../server/db';
import { hashPassword, passwordProblem } from '../server/auth';

const args = process.argv.slice(2);
const pwIndex = args.indexOf('--password');
const newPassword = pwIndex > -1 ? args[pwIndex + 1] : undefined;
const name = args.find((a, i) => !a.startsWith('--') && i !== pwIndex + 1);
const remove = args.includes('--remove');

if (!name) {
  console.log('\nVerwendung:  npm run make-admin -- <Minecraft-Name> [--remove] [--password <neues Passwort>]\n');
  const users = db.prepare('SELECT username, role FROM users WHERE password_hash IS NOT NULL ORDER BY last_login_at DESC LIMIT 30').all() as any[];
  console.log(users.length ? 'Konten:\n' + users.map((u) => `  ${u.role === 'admin' ? '★' : ' '} ${u.username}`).join('\n') : 'Es gibt noch keine Konten.');
  process.exit(1);
}
const user = db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(name) as { id: number } | undefined;
if (!user) { console.error(`Kein Konto „${name}“ gefunden.`); process.exit(1); }
if (newPassword !== undefined) {
  const problem = passwordProblem(newPassword, name);
  if (problem) { console.error(problem); process.exit(1); }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await hashPassword(newPassword), user.id);
  db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(user.id);
  console.log(`✔ Neues Passwort für ${name} gesetzt.`);
}
if (newPassword === undefined || args.includes('--admin')) {
  db.prepare('UPDATE users SET role = ?, blocked = 0 WHERE id = ?').run(remove ? 'customer' : 'admin', user.id);
  console.log(remove ? `✔ ${name} ist kein Administrator mehr.` : `✔ ${name} ist jetzt Administrator.`);
}
