import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useStore, settingsStore, setDark } from '../lib/store';
import { wm, wmStore, type AppId, type WinState } from './wm';
import { APPS, openApp } from './apps';
import { prefsStore } from './prefs';
import { openContextMenu } from './ContextMenu';
import { Emblem, NetworkIcon, VolumeIcon, FlagIcon, BellIcon, UpArrowIcon, MoonIcon, SunIcon, CapGlyph, StatusGlyph, Chevron } from './icons';
import { sessionStore, balloonStore, playChime } from './session';
import { cls } from '../lib/format';
import { tr, getLang, locale, useLang, setLang } from '../lib/i18n';

/* ─────────── Uhr ─────────── */

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

const WEEKDAYS = () => (getLang() === 'en' ? ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] : ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']);

function CalendarPopup({ onClose }: { onClose: () => void }) {
  const now = useNow();
  const [month, setMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const first = new Date(month);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first); start.setDate(1 - offset);
  const days = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  const today = new Date().toDateString();
  return (
    <div className="tray-popup calendar-pop" onPointerDown={(e) => e.stopPropagation()}>
      <div className="cal-time">{now.toLocaleTimeString(locale())}</div>
      <div className="cal-date">{now.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
      <div className="cal-head">
        <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label={tr("Vorheriger Monat", "Previous month")}><Chevron dir="left" color="#1e3287" /></button>
        <span>{month.toLocaleDateString(locale(), { month: 'long', year: 'numeric' })}</span>
        <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label={tr("Nächster Monat", "Next month")}><Chevron color="#1e3287" /></button>
      </div>
      <table>
        <thead><tr>{WEEKDAYS().map((d) => <th key={d}>{d}</th>)}</tr></thead>
        <tbody>
          {Array.from({ length: 6 }, (_, w) => (
            <tr key={w}>
              {days.slice(w * 7, w * 7 + 7).map((d) => (
                <td key={d.toISOString()} className={cls(d.getMonth() !== month.getMonth() && 'other', d.toDateString() === today && 'today')}>
                  <span>{d.getDate()}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="cal-foot">
        <button className="link" onClick={() => { onClose(); openApp('controlpanel', { page: 'datetime' }); }}>{tr("Datums- und Uhrzeiteinstellungen ändern…", "Change date and time settings…")}</button>
      </div>
    </div>
  );
}

/* ─────────── Taskleisten-Vorschau ─────────── */

function Thumb({ win }: { win: WinState }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const host = ref.current;
    const src = document.querySelector(`[data-win="${win.id}"]`) as HTMLElement | null;
    if (!host || !src) return;
    const clone = src.cloneNode(true) as HTMLElement;
    clone.removeAttribute('data-win');
    clone.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
    clone.classList.remove('minimized', 'anim-open', 'anim-minimize', 'anim-restore');
    const w = win.maximized ? window.innerWidth : win.w;
    const h = win.maximized ? window.innerHeight - 40 : src.offsetHeight || win.h;
    clone.style.width = `${w}px`;
    clone.style.height = `${h}px`;
    const scale = Math.min(200 / w, 128 / h);
    const wrap = document.createElement('div');
    wrap.className = 'thumb-scale';
    wrap.style.transform = `scale(${scale})`;
    wrap.style.left = `${(200 - w * scale) / 2}px`;
    wrap.style.top = `${(128 - h * scale) / 2}px`;
    wrap.style.width = `${w}px`;
    wrap.style.height = `${h}px`;
    wrap.appendChild(clone);
    host.replaceChildren(wrap);
  }, [win.id, win.w, win.h, win.maximized]);
  return <div className="tb-preview-thumb" ref={ref} />;
}

function Preview({ app, wins, left, onLeave, onEnter }: { app: AppId; wins: WinState[]; left: number; onLeave: () => void; onEnter: () => void }) {
  const [peek, setPeek] = useState<string | null>(null);
  useEffect(() => {
    // Aero Peek: beim Überfahren einer Vorschau alle anderen Fenster ausblenden
    document.querySelectorAll<HTMLElement>('[data-win]').forEach((el) => {
      el.classList.toggle('peek-hidden', !!peek && el.dataset.win !== peek);
    });
    return () => document.querySelectorAll<HTMLElement>('[data-win]').forEach((el) => el.classList.remove('peek-hidden'));
  }, [peek]);
  return (
    <div className="tb-preview" style={{ left: Math.max(4, left - 110) }} onMouseLeave={onLeave} onMouseEnter={onEnter} onPointerDown={(e) => e.stopPropagation()}>
      <div style={{ display: 'flex', gap: 6 }}>
        {wins.map((w) => (
          <div
            key={w.id}
            className="tb-preview-item"
            onMouseEnter={() => !w.minimized && setPeek(w.id)}
            onMouseLeave={() => setPeek(null)}
            onClick={() => { setPeek(null); onLeave(); if (w.minimized) wm.restore(w.id); else wm.focus(w.id); }}
          >
            <div className="tb-preview-head">
              {APPS[app].smallIcon()}
              <span>{w.title}</span>
              <div className="tb-preview-close" onClick={(e) => { e.stopPropagation(); wm.close(w.id); if (wins.length === 1) onLeave(); }}>
                <CapGlyph kind="close" />
              </div>
            </div>
            <Thumb win={w} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────── Taskleiste ─────────── */

export function Taskbar({ startOpen, onStart }: { startOpen: boolean; onStart: () => void }) {
  const { windows, activeId } = useStore(wmStore);
  const { pinned } = useStore(prefsStore);
  const session = useStore(sessionStore);
  const settings = useStore(settingsStore);
  const now = useNow(settings.showSeconds ? 1000 : 5000);
  const [popup, setPopup] = useState<null | 'clock' | 'volume' | 'network' | 'hidden' | 'lang'>(null);
  const lang = useLang();
  const [preview, setPreview] = useState<null | { app: AppId; left: number }>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  useEffect(() => {
    if (!popup) return;
    const close = () => setPopup(null);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [popup]);

  const appWins = (app: AppId) => windows.filter((w) => w.app === app && w.phase !== 'closing');
  const running = [...new Set(windows.filter((w) => w.app !== 'msgbox' && w.phase !== 'closing').map((w) => w.app))];
  const buttons: AppId[] = [...pinned, ...running.filter((a) => !pinned.includes(a))];

  const clickApp = (app: AppId) => {
    setPreview(null);
    const wins = appWins(app);
    if (!wins.length) { openApp(app); return; }
    const top = wins.reduce((a, b) => (a.z > b.z ? a : b));
    if (wins.length > 1 && activeId !== top.id) { wm.focus(top.id); return; }
    wm.toggleMinimize(top.id);
  };

  const appContext = (e: React.MouseEvent, app: AppId) => {
    e.preventDefault();
    setPreview(null);
    const isPinned = pinned.includes(app);
    const wins = appWins(app);
    openContextMenu({ clientX: e.clientX, clientY: e.clientY - 4 }, [
      { label: APPS[app].title, icon: APPS[app].smallIcon(), onClick: () => openApp(app) },
      'sep',
      {
        label: isPinned ? tr("Dieses Programm von der Taskleiste lösen", "Unpin this program from taskbar") : tr("Dieses Programm an Taskleiste anheften", "Pin this program to taskbar"),
        onClick: () => prefsStore.set((p) => ({ ...p, pinned: isPinned ? p.pinned.filter((x) => x !== app) : [...p.pinned, app] })),
      },
      ...(wins.length ? [{ label: wins.length > 1 ? tr("Alle Fenster schließen", "Close all windows") : tr("Fenster schließen", "Close window"), icon: <CapGlyph kind="close" />, onClick: () => wins.forEach((w) => wm.close(w.id)) }] : []),
    ]);
  };

  const timeStr = now.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit', second: settings.showSeconds ? '2-digit' : undefined, hour12: !settings.clock24 });
  const dateStr = now.toLocaleDateString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <>
      <div
        className="taskbar"
        onContextMenu={(e) => {
          if ((e.target as HTMLElement).closest('.task-btn, .start-orb')) return;
          openContextMenu(e, [
            { label: tr("Alle Fenster minimieren", "Minimize all windows"), onClick: () => wm.minimizeAll() },
            { label: tr("Alle Fenster schließen", "Close all windows"), onClick: () => wm.closeAll() },
            'sep',
            { label: tr("Eigenschaften", "Properties"), onClick: () => openApp('controlpanel', { page: 'personalize' }) },
          ]);
        }}
      >
        <button className={cls('start-orb', startOpen && 'open')} onPointerDown={(e) => e.stopPropagation()} onClick={onStart} title={tr("Starten", "Start")} aria-label={tr("Startmenü", "Start menu")}>
          <span className="orb"><Emblem /></span>
        </button>

        <div className="task-buttons">
          {buttons.map((app) => {
            const wins = appWins(app);
            const isActive = wins.some((w) => w.id === activeId);
            return (
              <button
                key={app}
                data-taskbtn={app}
                className={cls('task-btn', wins.length > 0 && 'running', isActive && 'active')}
                style={{ ['--hot' as any]: APPS[app].hot }}
                title={wins.length ? undefined : APPS[app].title}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => clickApp(app)}
                onContextMenu={(e) => appContext(e, app)}
                onMouseMove={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
                }}
                onMouseEnter={(e) => {
                  clearTimeout(leaveTimer.current);
                  if (!wins.length) return;
                  const r = e.currentTarget.getBoundingClientRect();
                  clearTimeout(hoverTimer.current);
                  hoverTimer.current = setTimeout(() => setPreview({ app, left: r.left + r.width / 2 }), preview ? 0 : 450);
                }}
                onMouseLeave={() => {
                  clearTimeout(hoverTimer.current);
                  leaveTimer.current = setTimeout(() => setPreview(null), 300);
                }}
              >
                <span className="tb-icon">{APPS[app].largeIcon(32)}</span>
              </button>
            );
          })}
        </div>

        <div className="tray">
          <button className="tray-icon hide-mobile" title={tr("Ausgeblendete Symbole einblenden", "Show hidden icons")} onPointerDown={(e) => e.stopPropagation()} onClick={() => setPopup(popup === 'hidden' ? null : 'hidden')}><UpArrowIcon /></button>
          {session.isAdmin && (
            <button
              className="tray-icon"
              title={tr(`Shop-Verwaltung: ${session.unread} ungelesene Benachrichtigung(en)\nEchtzeit: ${session.live === 'live' ? 'verbunden' : 'verbinde …'}`, `Shop Management: ${session.unread} unread notification(s)\nReal-time: ${session.live === 'live' ? 'connected' : 'connecting …'}`)}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => openApp('admin', { page: 'notifications' })}
            >
              <BellIcon color={session.live === 'live' ? '#fff' : '#ccc'} />
              {session.unread > 0 && <span className="badge">{session.unread > 99 ? '99+' : session.unread}</span>}
            </button>
          )}
          <button className="tray-lang" title={tr('Eingabesprache: Deutsch (Deutschland)', 'Input language: English (United States)')} onPointerDown={(e) => e.stopPropagation()} onClick={() => setPopup(popup === 'lang' ? null : 'lang')}>{lang.toUpperCase()}</button>
          <button className="tray-icon" title={settings.dark ? tr('Dunkelmodus ausschalten', 'Turn off dark mode') : tr('Dunkelmodus einschalten', 'Turn on dark mode')} aria-pressed={settings.dark} onPointerDown={(e) => e.stopPropagation()}
            onClick={() => { setDark(!settings.dark); playChime('click'); }}>{settings.dark ? <SunIcon /> : <MoonIcon />}</button>
          <button className="tray-icon hide-mobile" title={tr("Wartungscenter: Keine Probleme gefunden", "Action Center: No issues found")} onPointerDown={(e) => e.stopPropagation()}
            onClick={() => openApp('about')}><FlagIcon /></button>
          <button className="tray-icon" title={online ? tr("Internetzugriff", "Internet access") : tr("Keine Verbindung", "No connection")} onPointerDown={(e) => e.stopPropagation()} onClick={() => setPopup(popup === 'network' ? null : 'network')}>
            <span style={{ opacity: online ? 1 : 0.45 }}><NetworkIcon /></span>
          </button>
          <button className="tray-icon" title={tr(`Lautsprecher: ${settings.volume} %`, `Speakers: ${settings.volume}%`)} onPointerDown={(e) => e.stopPropagation()} onClick={() => setPopup(popup === 'volume' ? null : 'volume')}>
            <VolumeIcon muted={!settings.sounds || settings.volume === 0} />
          </button>
          <button className="tray-clock" onPointerDown={(e) => e.stopPropagation()} onClick={() => setPopup(popup === 'clock' ? null : 'clock')} title={now.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}>
            <span>{timeStr}</span>
            <span>{dateStr}</span>
          </button>
          <button className="show-desktop" title={tr("Desktop anzeigen", "Show desktop")} onPointerDown={(e) => e.stopPropagation()} onClick={() => wm.minimizeAll()}
            onMouseEnter={() => document.querySelectorAll<HTMLElement>('[data-win]').forEach((el) => el.classList.add('peek-hidden'))}
            onMouseLeave={() => document.querySelectorAll<HTMLElement>('[data-win]').forEach((el) => el.classList.remove('peek-hidden'))} />
        </div>
      </div>

      {preview && appWins(preview.app).length > 0 && (
        <Preview
          app={preview.app}
          wins={appWins(preview.app)}
          left={preview.left}
          onEnter={() => clearTimeout(leaveTimer.current)}
          onLeave={() => setPreview(null)}
        />
      )}

      {popup === 'clock' && <CalendarPopup onClose={() => setPopup(null)} />}
      {popup === 'volume' && (
        <div className="tray-popup volume-pop" style={{ right: 110 }} onPointerDown={(e) => e.stopPropagation()}>
          <span className="muted">{tr("Lautsprecher", "Speakers")}</span>
          <input type="range" min={0} max={100} value={settings.volume} onChange={(e) => settingsStore.set((s) => ({ ...s, volume: Number(e.target.value) }))} onPointerUp={() => playChime('click')} aria-label={tr("Lautstärke", "Volume")} />
          <span>{settings.volume}</span>
          <label className="check"><input type="checkbox" checked={settings.sounds} onChange={() => settingsStore.set((s) => ({ ...s, sounds: !s.sounds }))} /> {tr("Töne", "Sounds")}</label>
        </div>
      )}
      {popup === 'network' && (
        <div className="tray-popup net-pop" style={{ right: 130 }} onPointerDown={(e) => e.stopPropagation()}>
          <div className="muted" style={{ marginBottom: 6 }}>{tr("Derzeit verbunden mit:", "Currently connected to:")}</div>
          <div className="net-row">
            <NetworkIcon size={22} />
            <div>
              <div style={{ fontWeight: 600 }}>{online ? tr("MineOS-Netzwerk", "MineOS network") : tr("Nicht verbunden", "Not connected")}</div>
              <div className="muted">{online ? tr("Internetzugriff", "Internet access") : tr("Keine Verbindungen verfügbar", "No connections are available")}</div>
            </div>
          </div>
          {session.isAdmin && (
            <div className="net-row">
              <BellIcon size={20} color="#2a7fd8" />
              <div>
                <div style={{ fontWeight: 600 }}>{tr("Echtzeit-Benachrichtigungen", "Real-time notifications")}</div>
                <div className="muted">{session.live === 'live' ? tr("Verbunden – neue Bestellungen erscheinen sofort", "Connected – new orders appear instantly") : tr("Verbindung wird hergestellt …", "Connecting …")}</div>
              </div>
            </div>
          )}
        </div>
      )}
      {popup === 'lang' && (
        <div className="tray-popup lang-pop" style={{ right: 200 }} onPointerDown={(e) => e.stopPropagation()}>
          {([['de', 'DE', 'Deutsch (Deutschland)'], ['en', 'EN', 'English (United States)']] as const).map(([code, short, name]) => (
            <button key={code} className={cls('lang-row', lang === code && 'selected')} onClick={() => { setPopup(null); setLang(code); }}>
              <span className="lang-check">{lang === code ? '✓' : ''}</span><span className="lang-code">{short}</span><span>{name}</span>
            </button>
          ))}
          <div className="lang-sep" />
          <button className="lang-row" onClick={() => { setPopup(null); openApp('controlpanel', { page: 'region' }); }}><span className="lang-check" /><span className="lang-code" /><span>{tr('Sprachleiste einstellen…', 'Language settings…')}</span></button>
        </div>
      )}
      {popup === 'hidden' && (
        <div className="tray-popup" style={{ right: 250, padding: 8, display: 'flex', gap: 4 }} onPointerDown={(e) => e.stopPropagation()}>
          <button className="btn" onClick={() => { setPopup(null); openApp('computer'); }}>Computer</button>
          <button className="btn" onClick={() => { setPopup(null); openApp('controlpanel'); }}>{tr("Systemsteuerung", "Control Panel")}</button>
        </div>
      )}
      <BalloonTip />
    </>
  );
}

function BalloonTip() {
  const { current } = useStore(balloonStore);
  if (!current) return null;
  return (
    <div
      key={current.id}
      className="balloon"
      role="alert"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => { current.action?.(); balloonStore.set({ current: null }); }}
      style={{ cursor: current.action ? 'pointer' : 'default' }}
    >
      <div className="balloon-title"><StatusGlyph kind={current.icon} size={16} />{current.title}</div>
      <div className="balloon-body">{current.text}</div>
      <button className="balloon-close" aria-label={tr("Schließen", "Close")} onClick={(e) => { e.stopPropagation(); balloonStore.set({ current: null }); }}>
        <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1 1l6 6M7 1L1 7" stroke="#333" strokeWidth="1.4" /></svg>
      </button>
    </div>
  );
}
