import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { sessionStore, checkSession, login, register } from './session';
import { UserPic, StatusGlyph, ArrowGlyph, Emblem, ItemIcon, PowerIcon } from './icons';
import { Spinner, LogonBackdrop } from './Boot';
import { post, ApiError } from '../lib/api';
import { cls } from '../lib/format';
import { tr, useLang, setLang } from '../lib/i18n';

const NAME_RE = /^[.*]?[A-Za-z0-9_](?:[A-Za-z0-9_]| (?! )){2,15}$/;

export function LogonScreen({ onShutdown }: { onShutdown: () => void }) {
  const s = useStore(sessionStore);
  const [busy, setBusy] = useState(false);

  if (s.error) {
    return (
      <div className="logon-screen">
        <LogonBackdrop />
        <div className="logon-center">
          <div className="logon-tile"><div className="ws-pic big"><div><StatusGlyph kind="warning" size={80} /></div></div></div>
          <div className="logon-name">{tr("MineOS ist nicht erreichbar", "MineOS cannot be reached")}</div>
          <div className="logon-sub" style={{ maxWidth: 460 }}>{s.error}</div>
          <button className="logon-ms-btn" onClick={() => { setBusy(true); void checkSession().finally(() => setBusy(false)); }} disabled={busy}>
            {busy ? <Spinner small /> : null}<span>{tr("Erneut versuchen", "Try again")}</span><span className="logon-go"><ArrowGlyph dir="right" size={12} /></span>
          </button>
        </div>
        <LogonFooter onShutdown={onShutdown} />
      </div>
    );
  }

  return (
    <div className="logon-screen">
      <LogonBackdrop />
      <LoginPanel />
      <LogonFooter onShutdown={onShutdown} />
    </div>
  );
}

function LoginPanel() {
  const s = useStore(sessionStore);
  // Ganz am Anfang (noch niemand registriert, Betreiber am PC) direkt „Konto erstellen“ zeigen
  const [mode, setMode] = useState<'login' | 'register'>(s.noAdmin && s.setupAllowed ? 'register' : 'login');
  const [name, setName] = useState(() => { try { return localStorage.getItem('mineos.lastName') || ''; } catch { return ''; } });
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [edition, setEdition] = useState<'java' | 'bedrock'>('java');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [field, setField] = useState<string | null>(null);
  const pwRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { (name && mode === 'login' ? pwRef : nameRef).current?.focus(); setErr(null); setField(null); }, [mode]); // eslint-disable-line

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setField(null);
    const n = name.trim();
    if (mode === 'register') {
      if (!NAME_RE.test(n)) { setErr(tr("Minecraft-Name: 3–16 Zeichen (Buchstaben, Ziffern, _).", "Minecraft name: 3–16 characters (letters, digits, _).")); setField('username'); return; }
      if (pw.length < 8) { setErr(tr("Das Passwort muss mindestens 8 Zeichen lang sein.", "The password must be at least 8 characters long.")); setField('password'); return; }
      if (pw !== pw2) { setErr(tr("Die Passwörter stimmen nicht überein.", "The passwords do not match.")); setField('password2'); return; }
    }
    setBusy(true);
    try {
      if (mode === 'login') await login(n, pw); else await register(n, pw, edition);
      try { localStorage.setItem('mineos.lastName', n); } catch { /* egal */ }
    } catch (ex) {
      const a = ex as ApiError;
      setErr(a.fields ? Object.values(a.fields)[0] : a.message);
      setField(a.fields ? Object.keys(a.fields)[0] : (a.details?.field ?? (a.status === 401 ? 'password' : null)));
      setPw(''); setPw2('');
      pwRef.current?.focus();
    } finally { setBusy(false); }
  };

  return (
    <div className="logon-center">
      <div className="logon-tile">
        <div className="ws-pic big"><div><UserPic size={110} /></div></div>
      </div>
      <div className="logon-name">{mode === 'login' ? (name.trim() || tr("Minecraft-Spieler", "Minecraft player")) : tr("Neues Konto", "New account")}</div>

      <form className="logon-form" onSubmit={submit} autoComplete="on">
        <div className="logon-pwrow">
          <input
            ref={nameRef}
            className={cls('logon-input', field === 'username' && 'bad')}
            placeholder={tr("Minecraft-Name", "Minecraft name")}
            value={name}
            maxLength={17}
            autoComplete="username"
            spellCheck={false}
            onChange={(e) => setName(e.target.value)}
          />
          <span className="logon-spacer" />
        </div>
        {mode === 'register' && (
          <div className="logon-edition" role="radiogroup" aria-label={tr("Minecraft-Version", "Minecraft version")}>
            {(['java', 'bedrock'] as const).map((ed) => (
              <button key={ed} type="button" role="radio" aria-checked={edition === ed} className={cls(edition === ed && 'on')} onClick={() => setEdition(ed)}>
                <ItemIcon icon={ed === 'java' ? 'grass_block' : 'diamond'} size={18} /> {ed === 'java' ? 'Java' : 'Bedrock'}
              </button>
            ))}
          </div>
        )}
        <div className="logon-pwrow">
          <input
            ref={pwRef}
            className={cls('logon-input', field === 'password' && 'bad')}
            type="password"
            placeholder={mode === 'register' ? tr("Passwort (mind. 8 Zeichen)", "Password (min. 8 characters)") : tr("Passwort", "Password")}
            value={pw}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            onChange={(e) => setPw(e.target.value)}
          />
          {mode === 'login' ? (
            <button className="logon-go big" type="submit" disabled={busy || !name.trim() || !pw} aria-label={tr("Anmelden", "Sign in")} title={tr("Anmelden", "Sign in")}>
              {busy ? <Spinner small /> : <ArrowGlyph dir="right" size={14} />}
            </button>
          ) : <span className="logon-spacer" />}
        </div>
        {mode === 'register' && (
          <div className="logon-pwrow">
            <input
              className={cls('logon-input', field === 'password2' && 'bad')}
              type="password"
              placeholder={tr("Passwort wiederholen", "Repeat password")}
              value={pw2}
              autoComplete="new-password"
              onChange={(e) => setPw2(e.target.value)}
            />
            <button className="logon-go big" type="submit" disabled={busy || !name.trim() || !pw || !pw2} aria-label={tr("Konto erstellen", "Create account")} title={tr("Konto erstellen", "Create account")}>
              {busy ? <Spinner small /> : <ArrowGlyph dir="right" size={14} />}
            </button>
          </div>
        )}
        {err && <div className="logon-error"><StatusGlyph kind="error" size={16} /> {err}</div>}
      </form>

      {mode === 'register' && s.noAdmin && s.setupAllowed && (
        <div className="logon-hint">{tr("Du bist der Erste: Dieses Konto wird automatisch der ", "You're the first one: this account automatically becomes the ")}<b>{tr("Administrator", "administrator")}</b> {tr("des Shops.", "of the shop.")}</div>
      )}
      {mode === 'register' && !(s.noAdmin && s.setupAllowed) && (
        <div className="logon-sub" style={{ fontSize: 12 }}>{tr("Verwende deinen echten Minecraft-Namen – an ihn werden die Items übergeben.", "Use your real Minecraft name – the items will be handed over to it.")}</div>
      )}

      <button className="logon-link" type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
        {mode === 'login' ? tr("Noch kein Konto? Jetzt Konto erstellen", "No account yet? Create one now") : tr("Ich habe schon ein Konto – anmelden", "I already have an account – sign in")}
      </button>
      {s.noAdmin && !s.setupAllowed && <SetupCodeInline />}
    </div>
  );
}

function LogonFooter({ onShutdown }: { onShutdown: () => void }) {
  const lang = useLang();
  return (
    <div className="logon-footer">
      <div className="logon-brand"><Emblem size={22} /> <span>MineOS</span> <small>Minecraft Store Edition</small></div>
      <div className="logon-lang" role="group" aria-label={tr('Sprache', 'Language')}>
        <button className={cls(lang === 'de' && 'on')} onClick={() => setLang('de')} title="Deutsch">DE</button>
        <button className={cls(lang === 'en' && 'on')} onClick={() => setLang('en')} title="English">EN</button>
      </div>
      <button className="logon-power" onClick={onShutdown} title={tr("Herunterfahren", "Shut down")} aria-label={tr("Herunterfahren", "Shut down")}><PowerIcon size={18} /></button>
    </div>
  );
}

/* ─────────── Einrichtungscode (Besitzer-Konto über IP-Adresse / Domain / Handy anlegen) ─────────── */

function SetupCodeInline() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { await post('/api/auth/setup-code', { code }); await checkSession(); }
    catch (ex) { setErr((ex as ApiError).message); }
    finally { setBusy(false); }
  };
  if (!open) return <button className="logon-link" onClick={() => setOpen(true)}>{tr("Ich bin der Betreiber – Einrichtungscode eingeben", "I'm the owner – enter setup code")}</button>;
  return (
    <form className="logon-hint" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
      <span>{tr("Einrichtungscode aus dem schwarzen MineOS-Fenster (oder ", "Setup code from the black MineOS window (or ")}<span className="kbd">data/EINRICHTUNGSCODE.txt</span>):</span>
      <div style={{ display: 'flex', gap: 6 }}>
        <input className="input kbd" value={code} onChange={(e) => setCode(e.target.value)} maxLength={40} autoFocus style={{ width: 140, letterSpacing: 2, textTransform: 'uppercase' }} />
        <button className="btn" type="submit" disabled={busy}>OK</button>
      </div>
      {err && <span style={{ color: '#ffb3a6' }}>{err}</span>}
      <span style={{ opacity: .85 }}>{tr("Danach erstellst du dein Konto – es wird Administrator.", "Then create your account – it becomes the administrator.")}</span>
    </form>
  );
}
