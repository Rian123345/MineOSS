import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore, settingsStore } from '../lib/store';
import { wmStore, wm } from './wm';
import { Window } from './Window';
import { Desktop } from './Desktop';
import { Taskbar } from './Taskbar';
import { StartMenu } from './StartMenu';
import { ContextMenuHost, closeContextMenu } from './ContextMenu';
import { BootScreen, WelcomeScreen, ShutdownScreen, OffScreen, LockScreen, BootScreenXP, WelcomeScreenXP, ShutdownScreenXP, LockScreenXP } from './Boot';
import { StartMenuXP, XpSessionDialog } from './StartMenuXP';
import { LogonScreen } from './Logon';
import { wallpaperFor } from './wallpapers';
import { checkSession, sessionStore, registerOrderOpener, registerChatOpener, logout, playChime } from './session';
import { loadCatalog } from '../lib/catalog';
import { openApp, APPS } from './apps';
import { tr, useLang } from '../lib/i18n';

type Phase = 'boot' | 'login' | 'welcome' | 'desktop' | 'logoff' | 'shutdown' | 'restart' | 'off' | 'locked';

function handleHash() {
  const h = decodeURIComponent(location.hash.replace(/^#/, ''));
  if (!h) return;
  const m = /^admin(?:\/orders\/(\d+))?/.exec(h);
  if (m && sessionStore.get().isAdmin) openApp('admin', m[1] ? { page: 'orders', orderId: Number(m[1]) } : {});
  if (h === 'chat') openApp('chat');
  const t = /^track(?:=(MC-[A-Z0-9]{6}))?/i.exec(h);
  if (t) openApp('store', { view: { kind: 'track', orderNumber: t[1]?.toUpperCase() } });
  history.replaceState(null, '', location.pathname);
}

export function OS() {
  const settings = useStore(settingsStore);
  const { windows } = useStore(wmStore);
  const session = useStore(sessionStore);
  const fastBoot = (() => { try { return sessionStorage.getItem('mineos.booted') === '1'; } catch { return false; } })();
  const [phase, setPhase] = useState<Phase>('boot');
  const [start, setStart] = useState<'closed' | 'open' | 'closing'>('closed');
  const [xpDialog, setXpDialog] = useState<null | 'logoff' | 'turnoff'>(null);
  const xp = settings.skin === 'xp';
  const startTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const openStart = useCallback(() => { clearTimeout(startTimer.current); setStart('open'); }, []);
  const closeStart = useCallback(() => {
    setStart((s) => {
      if (s !== 'open') return s;
      clearTimeout(startTimer.current);
      startTimer.current = setTimeout(() => setStart('closed'), 140);
      return 'closing';
    });
  }, []);
  const toggleStart = useCallback(() => (start === 'open' ? closeStart() : openStart()), [start, closeStart, openStart]);

  // Systemweite Darstellung (Aero-Farbe, Transparenz)
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--glass-rgb', settings.glassColor);
    root.style.setProperty('--glass-alpha', String(settings.glassAlpha));
    root.classList.toggle('no-transparency', !settings.transparency);
  }, [settings.glassColor, settings.glassAlpha, settings.transparency]);

  // Dunkelmodus
  const themeFirst = useRef(true);
  useEffect(() => {
    const root = document.documentElement;
    if (!themeFirst.current) {
      root.classList.add('theme-anim');
      setTimeout(() => root.classList.remove('theme-anim'), 350);
    }
    themeFirst.current = false;
    const dark = settings.dark;
    root.dataset.theme = dark ? 'dark' : 'light';
    root.dataset.skin = settings.skin;
    root.style.colorScheme = dark ? 'dark' : 'light';
  }, [settings.dark, settings.skin]);

  // Sprache gewechselt → feste Fenstertitel nachziehen (Store/Verwaltung setzen ihren Titel selbst)
  const lang = useLang();
  useEffect(() => {
    for (const w of wmStore.get().windows) {
      if (w.app !== 'store' && w.app !== 'admin' && w.app !== 'msgbox' && APPS[w.app]) wm.setTitle(w.id, APPS[w.app].title);
    }
  }, [lang]);

  useEffect(() => {
    void checkSession();
    registerOrderOpener((id) => openApp('admin', { page: 'orders', orderId: id }));
    registerChatOpener((p) => openApp('chat', p));
    const onResize = () => wm.clampAll();
    window.addEventListener('resize', onResize);
    window.addEventListener('hashchange', handleHash);
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'Meta' && !e.repeat) || (e.ctrlKey && e.key === 'Escape')) {
        setStart((s) => (s === 'open' ? 'closing' : 'open'));
        setTimeout(() => setStart((s) => (s === 'closing' ? 'closed' : s)), 140);
      }
    };
    window.addEventListener('keyup', onKey);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('hashchange', handleHash);
      window.removeEventListener('keyup', onKey);
    };
  }, []);

  // Erfolgreich angemeldet → Willkommensbildschirm → Desktop
  useEffect(() => {
    if (phase === 'login' && session.user) setPhase('welcome');
  }, [phase, session.user]);

  // Sitzung abgelaufen / abgemeldet → zurück zum Anmeldebildschirm
  useEffect(() => {
    if (session.checked && !session.user && (phase === 'desktop' || phase === 'locked')) {
      wm.closeAll();
      setStart('closed');
      setPhase('login');
    }
  }, [session.user, session.checked, phase]);

  useEffect(() => {
    if (start !== 'open') return;
    window.addEventListener('pointerdown', closeStart);
    return () => window.removeEventListener('pointerdown', closeStart);
  }, [start, closeStart]);

  const bootDone = useCallback(async () => {
    const s = sessionStore.get().checked ? sessionStore.get() : await checkSession();
    setPhase(s.user ? 'welcome' : 'login');
  }, []);
  const welcomeDone = useCallback(() => {
    let firstBoot = true;
    try { firstBoot = sessionStorage.getItem('mineos.booted') !== '1'; sessionStorage.setItem('mineos.booted', '1'); } catch { /* egal */ }
    setPhase('desktop');
    playChime(settingsStore.get().skin === 'xp' && firstBoot ? 'startup' : 'logon');
    void loadCatalog(true);
    setTimeout(handleHash, 60);
  }, []);
  const shutdownDone = useCallback(() => setPhase('off'), []);
  const restartDone = useCallback(() => setPhase('boot'), []);
  const logoffDone = useCallback(() => setPhase('login'), []);

  const onShutdown = (mode: 'shutdown' | 'restart' | 'lock' | 'logoff') => {
    closeContextMenu();
    setStart('closed');
    setXpDialog(null);
    if (mode === 'lock') { setPhase('locked'); return; }
    wm.closeAll();
    if (mode === 'logoff') {
      setPhase('logoff');
      playChime('logoff');
      void logout();
      return;
    }
    playChime('shutdown');
    try { sessionStorage.removeItem('mineos.booted'); } catch { /* egal */ }
    setTimeout(() => setPhase(mode === 'restart' ? 'restart' : 'shutdown'), 250);
  };

  const userName = session.user?.name ?? tr("Gast", "Guest");
  const inSession = phase === 'desktop' || phase === 'locked';

  return (
    <div className="os-root">
      <div className={`desktop-wallpaper${xpDialog ? ' xp-gray' : ''}`} style={{ backgroundImage: `url("${wallpaperFor(settings)}")` }} />
      {inSession && (
        <div className={`session-layer${xpDialog ? ' xp-gray' : ''}`}>
          <Desktop />
          <div className="windows-layer" id="windows-layer">
            {windows.map((w) => <Window key={w.id} win={w} />)}
          </div>
          {start !== 'closed' && (xp
            ? <StartMenuXP closing={start === 'closing'} onClose={closeStart} onXpDialog={setXpDialog} />
            : <StartMenu closing={start === 'closing'} onClose={closeStart} onShutdown={onShutdown} />)}
          <Taskbar startOpen={start === 'open'} onStart={toggleStart} />
          <ContextMenuHost />
        </div>
      )}
      {xpDialog && inSession && <XpSessionDialog kind={xpDialog} onChoose={onShutdown} onCancel={() => setXpDialog(null)} />}
      {xp ? (
        <>
          {phase === 'boot' && <BootScreenXP onDone={bootDone} fast={fastBoot} />}
          {phase === 'login' && <LogonScreen onShutdown={() => onShutdown('shutdown')} />}
          {phase === 'welcome' && <WelcomeScreenXP onDone={welcomeDone} />}
          {phase === 'logoff' && <ShutdownScreenXP text={tr('Abmelden …', 'Logging off …')} onDone={logoffDone} />}
          {phase === 'shutdown' && <ShutdownScreenXP text={tr('MineOS wird heruntergefahren …', 'MineOS is shutting down …')} onDone={shutdownDone} />}
          {phase === 'restart' && <ShutdownScreenXP text={tr('MineOS wird neu gestartet …', 'MineOS is restarting …')} onDone={restartDone} />}
          {phase === 'locked' && <LockScreenXP user={userName} admin={session.isAdmin} onUnlock={() => setPhase('desktop')} />}
        </>
      ) : (
        <>
          {phase === 'boot' && <BootScreen onDone={bootDone} fast={fastBoot} />}
          {phase === 'login' && <LogonScreen onShutdown={() => onShutdown('shutdown')} />}
          {phase === 'welcome' && <WelcomeScreen onDone={welcomeDone} user={userName} admin={session.isAdmin} />}
          {phase === 'logoff' && <ShutdownScreen text={tr("Abmelden …", "Logging off …")} onDone={logoffDone} />}
          {phase === 'shutdown' && <ShutdownScreen text={tr("Wird heruntergefahren …", "Shutting down …")} onDone={shutdownDone} />}
          {phase === 'restart' && <ShutdownScreen text={tr("Wird neu gestartet …", "Restarting …")} onDone={restartDone} />}
          {phase === 'locked' && <LockScreen user={userName} admin={session.isAdmin} onUnlock={() => setPhase('desktop')} />}
        </>
      )}
      {phase === 'off' && <OffScreen onPower={() => setPhase('boot')} />}
    </div>
  );
}
