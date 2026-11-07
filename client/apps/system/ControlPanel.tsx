import { useEffect, useState } from 'react';
import { FrameBar } from '../../os/frame';
import { ControlPanelIcon, SearchIcon, ArrowGlyph, Chevron, UserPic, ShieldIcon, VolumeIcon, ComputerIcon, StoreIcon } from '../../os/icons';
import { openApp, type AppProps } from '../../os/apps';
import { useStore, settingsStore } from '../../lib/store';
import { WALLPAPER_URL, BLISS_URL, GLASS_COLORS, wallpaperFor } from '../../os/wallpapers';
import { setSkin } from '../../lib/store';
import { playSound } from '../../os/sounds';
import { sessionStore, playChime } from '../../os/session';
import { cls } from '../../lib/format';
import { tr, locale, useLang, setLang } from '../../lib/i18n';

type Page = 'home' | 'personalize' | 'display' | 'datetime' | 'region' | 'sound';
const TITLES: Record<Page, string> = {
  get home() { return tr("Systemsteuerung", "Control Panel"); }, get personalize() { return tr("Anpassung", "Personalization"); }, get display() { return tr("Anzeige", "Display"); }, get datetime() { return tr("Datum und Uhrzeit", "Date and Time"); }, get region() { return tr('Region und Sprache', 'Region and Language'); }, sound: 'Sound',
};

export function ControlPanelApp({ props, nonce }: AppProps) {
  const lang = useLang();
  const [page, setPage] = useState<Page>(props.page || 'home');
  const settings = useStore(settingsStore);
  const session = useStore(sessionStore);
  useEffect(() => { if (props.page) setPage(props.page); }, [nonce, props.page]);

  const set = (patch: Partial<typeof settings>) => settingsStore.set((s) => ({ ...s, ...patch }));

  const categories = [
    { title: tr("Darstellung und Anpassung", "Appearance and Personalization"), icon: <ControlPanelIcon size={48} />, links: [[tr('Dunkelmodus ein- oder ausschalten', 'Turn dark mode on or off'), 'personalize'], [tr("Fensterfarbe ändern", "Change window colors"), 'personalize'], [tr("Transparenz einstellen", "Adjust transparency"), 'personalize'], [tr("Bildschirmauflösung anpassen", "Adjust screen resolution"), 'display']] },
    { title: tr("Zeit, Sprache und Region", "Clock, Language, and Region"), icon: <ComputerIcon size={48} />, links: [[tr('Anzeigesprache ändern', 'Change display language'), 'region'], [tr("Datum und Uhrzeit", "Date and Time"), 'datetime']] },
    { title: tr("Hardware und Sound", "Hardware and Sound"), icon: <VolumeIcon size={44} />, links: [[tr("Systemlautstärke anpassen", "Adjust system volume"), 'sound']] },
  ] as const;

  return (
    <>
      <FrameBar>
        <div className="nav-bar">
          <div className="nav-arrows">
            <button className="nav-round" disabled={page === 'home'} onClick={() => setPage('home')} aria-label={tr("Zurück", "Back")}><ArrowGlyph dir="left" /></button>
            <button className="nav-round" disabled aria-label={tr("Vor", "Forward")}><ArrowGlyph dir="right" /></button>
          </div>
          <div className="address-bar">
            <span className="ab-ic"><ControlPanelIcon size={16} /></span>
            <span className="crumb-sep"><Chevron /></span>
            <span className="crumb" onClick={() => setPage('home')}>{tr("Systemsteuerung", "Control Panel")}</span>
            {page !== 'home' && (<><span className="crumb-sep"><Chevron /></span><span className="crumb">{TITLES[page]}</span></>)}
          </div>
          <div className="search-box"><input placeholder={tr("Systemsteuerung durchsuchen", "Search Control Panel")} /><span className="sb-ic"><SearchIcon /></span></div>
        </div>
      </FrameBar>
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div className="cp-side">
          <button className="link" onClick={() => setPage('home')}>{tr("Startseite der Systemsteuerung", "Control Panel Home")}</button>
          <div className="cp-side-sep" />
          {(['personalize', 'display', 'datetime', 'region', 'sound'] as Page[]).map((p) => (
            <button key={p} className={cls('link', page === p && 'cp-current')} onClick={() => setPage(p)}>{TITLES[p]}</button>
          ))}
          <div className="cp-side-sep" />
          <div className="muted" style={{ marginBottom: 4 }}>{tr("Siehe auch", "See also")}</div>
          <button className="link" onClick={() => openApp('useraccounts')}>{tr("Benutzerkonten", "User Accounts")}</button>
          {session.isAdmin && <button className="link" onClick={() => openApp('admin')}>{tr("Shop-Verwaltung", "Shop Management")}</button>}
        </div>
        <div className="app-scroll cp-main">
          {page === 'home' && (
            <>
              <h1 className="h-title">{tr("Einstellungen des Computers anpassen", "Adjust your computer's settings")}</h1>
              <div className="cp-cats">
                {categories.map((c) => (
                  <div key={c.title} className="cp-cat">
                    <div className="cp-cat-ic">{c.icon}</div>
                    <div>
                      <button className="cp-cat-title" onClick={() => setPage(c.links[0][1] as Page)}>{c.title}</button>
                      {c.links.map(([l, p]) => <div key={l}><button className="link" onClick={() => setPage(p as Page)}>{l}</button></div>)}
                    </div>
                  </div>
                ))}
                <div className="cp-cat">
                  <div className="cp-cat-ic"><UserPic size={48} admin={session.isAdmin} /></div>
                  <div>
                    <button className="cp-cat-title" onClick={() => openApp('useraccounts')}>{tr("Benutzerkonten", "User Accounts")}</button>
                    <div><button className="link" onClick={() => openApp('useraccounts')}>{tr("Passwort ändern", "Change password")}</button></div>
                  </div>
                </div>
                {session.isAdmin && (
                  <div className="cp-cat">
                    <div className="cp-cat-ic"><ShieldIcon size={46} /></div>
                    <div>
                      <button className="cp-cat-title" onClick={() => openApp('admin')}>{tr("Shop-Verwaltung", "Shop Management")}</button>
                      <div><button className="link" onClick={() => openApp('admin')}>{tr("Bestellungen, Preise und Discord verwalten", "Manage orders, prices and Discord")}</button></div>
                    </div>
                  </div>
                )}
                <div className="cp-cat">
                  <div className="cp-cat-ic"><StoreIcon size={48} /></div>
                  <div>
                    <button className="cp-cat-title" onClick={() => openApp('store')}>{tr("Programme", "Programs")}</button>
                    <div><button className="link" onClick={() => openApp('store')}>{tr("Minecraft Store öffnen", "Open Minecraft Store")}</button></div>
                  </div>
                </div>
              </div>
            </>
          )}

          {page === 'personalize' && (
            <>
              <h1 className="h-title">{tr("Ändern der visuellen Effekte und der Sounds auf dem Computer", "Change the visuals and sounds on your computer")}</h1>
              <p className="muted">{tr("Wählen Sie die Farbe der Fensterrahmen, des Startmenüs und der Taskleiste.", "Choose the color of your window borders, Start menu, and taskbar.")}</p>
              <h2 className="h-sub">{tr('Design', 'Theme')}</h2>
              <div className="theme-grid" role="radiogroup" aria-label={tr('Design', 'Theme')}>
                {([['win7', 'Aero', tr('Windows-7-Stil mit Glas-Effekt', 'Windows 7 style with glass effect')], ['xp', 'Luna', tr('Windows-XP-Stil mit eigenem Startbildschirm und Klängen', 'Windows XP style with its own boot screen and sounds')]] as const).map(([skin, name, hint]) => (
                  <button key={skin} role="radio" aria-checked={settings.skin === skin} className={cls('theme-tile', settings.skin === skin && 'selected')}
                    onClick={() => { if (settings.skin !== skin) { setSkin(skin); playSound(skin === 'xp' ? 'logon' : 'click'); } }}>
                    <span className={cls('theme-thumb', skin === 'xp' && 'xp')} style={{ backgroundImage: `url("${skin === 'xp' ? BLISS_URL : WALLPAPER_URL}")` }}>
                      <span className="tt-win"><span className="tt-bar" /><span className="tt-body"><i /><i /><i /></span></span>
                      <span className="tt-task"><span className="tt-start" /></span>
                    </span>
                    <b>{name}</b><small className="muted">{hint}</small>
                  </button>
                ))}
              </div>
              {(
                <>
                  <h2 className="h-sub">{tr('Farbmodus', 'Color mode')}</h2>
                  <div className="theme-grid" role="radiogroup" aria-label={tr('Farbmodus', 'Color mode')}>
                    {([[false, tr('Hell', 'Light'), settings.skin === 'xp' ? tr('Klassisches Blau', 'Classic blue') : tr('Klassisches Windows 7', 'Classic Windows 7')], [true, tr('Dunkel', 'Dark'), tr('Schont die Augen am Abend', 'Easier on the eyes at night')]] as const).map(([dark, name, hint]) => (
                      <button key={name} role="radio" aria-checked={settings.dark === dark} className={cls('theme-tile', settings.dark === dark && 'selected')} onClick={() => set({ dark })}>
                        <span className={cls('theme-thumb', dark && 'dark', settings.skin === 'xp' && 'xp')} style={{ backgroundImage: `url("${wallpaperFor(settings)}")` }}>
                          <span className="tt-win"><span className="tt-bar" /><span className="tt-body"><i /><i /><i /></span></span>
                          <span className="tt-task"><span className="tt-start" /></span>
                        </span>
                        <b>{name}</b><small className="muted">{hint}</small>
                      </button>
                    ))}
                  </div>
                </>
              )}
              <h2 className="h-sub">{tr("Desktophintergrund", "Desktop Background")}</h2>
              <div className="wp-grid">
                {settings.skin === 'xp' ? (
                  ([['bliss', BLISS_URL, 'Bliss'], ['senorpollo', WALLPAPER_URL, 'SenorPollo Network']] as const).map(([id, url, name]) => (
                    <button key={id} className={cls('wp-tile', settings.xpWallpaper === id && 'selected')} onClick={() => set({ xpWallpaper: id })}>
                      <div className="wp-thumb" style={{ backgroundImage: `url("${url}")` }} />
                      <span>{name}</span>
                    </button>
                  ))
                ) : (
                  <div className="wp-tile selected">
                    <div className="wp-thumb" style={{ backgroundImage: `url("${WALLPAPER_URL}")` }} />
                    <span>SenorPollo Network</span>
                  </div>
                )}
              </div>
              {settings.skin === 'xp' && <p className="muted">{tr('Der Bliss-Hintergrund ist nur im Luna-Design verfügbar.', 'The Bliss background is only available in the Luna theme.')}</p>}
              {settings.skin !== 'xp' && <>
              <h2 className="h-sub">{tr("Fensterfarbe und -darstellung", "Window Color and Appearance")}</h2>
              <div className="color-grid">
                {GLASS_COLORS.map((c) => (
                  <button key={c.rgb} title={c.name} className={cls('color-swatch', settings.glassColor === c.rgb && 'selected')} onClick={() => set({ glassColor: c.rgb })}>
                    <span style={{ background: `linear-gradient(rgba(255,255,255,.55), rgba(255,255,255,0) 60%), rgb(${c.rgb})` }} />
                  </button>
                ))}
              </div>
              <p>{tr("Aktuelle Farbe: ", "Current color: ")}<b style={{ fontWeight: 600 }}>{GLASS_COLORS.find((c) => c.rgb === settings.glassColor)?.name ?? tr("Benutzerdefiniert", "Custom")}</b></p>
              <label className="check" style={{ marginBottom: 10 }}>
                <input type="checkbox" checked={settings.transparency} onChange={() => set({ transparency: !settings.transparency })} /> {tr("Transparenz aktivieren", "Enable transparency")}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span>{tr("Farbintensität:", "Color intensity:")}</span>
                <input type="range" min={0.15} max={0.85} step={0.01} value={settings.glassAlpha} onChange={(e) => set({ glassAlpha: Number(e.target.value) })} style={{ width: 220 }} />
              </div>
              </>}
            </>
          )}

          {page === 'display' && (
            <>
              <h1 className="h-title">{tr("Darstellung der Anzeige ändern", "Change the appearance of your display")}</h1>
              <div className="display-mock"><div className="dm-screen" style={{ backgroundImage: `url("${wallpaperFor(settings)}")` }}><span>1</span></div></div>
              <table className="form-table">
                <tbody>
                  <tr><td>{tr("Anzeige:", "Display:")}</td><td>{tr("1. Bildschirm (", "1. Screen (")}{navigator.platform || tr("Standardmonitor", "Generic monitor")})</td></tr>
                  <tr><td>{tr("Auflösung:", "Resolution:")}</td><td>{screen.width} × {screen.height} {tr("(Browserfenster: ", "(browser window: ")}{window.innerWidth} × {window.innerHeight})</td></tr>
                  <tr><td>{tr("Pixeldichte:", "Pixel density:")}</td><td>{Math.round(window.devicePixelRatio * 100)} %</td></tr>
                  <tr><td>{tr("Desktopsymbole:", "Desktop icons:")}</td><td>
                    <select className="select" value={settings.iconSize} onChange={(e) => set({ iconSize: e.target.value as any })}>
                      <option value="large">{tr("Große Symbole", "Large icons")}</option><option value="medium">{tr("Mittelgroße Symbole", "Medium icons")}</option><option value="small">{tr("Kleine Symbole", "Small icons")}</option>
                    </select>
                  </td></tr>
                </tbody>
              </table>
              <p className="muted">{tr("Die Auflösung wird vom Browser vorgegeben. Mit Strg + Plus/Minus kannst du die Darstellung vergrößern oder verkleinern.", "The resolution is set by the browser. Use Ctrl + Plus/Minus to zoom in or out.")}</p>
            </>
          )}

          {page === 'region' && (
            <>
              <h1 className="h-title">{tr('Region und Sprache', 'Region and Language')}</h1>
              <p className="muted">{tr('Wähle die Sprache für Menüs, Fenster und den Minecraft Store. Die Einstellung wird in diesem Browser gespeichert.', 'Choose the language for menus, windows and the Minecraft Store. The setting is saved in this browser.')}</p>
              <h2 className="h-sub">{tr('Anzeigesprache', 'Display language')}</h2>
              <div className="lang-list" role="radiogroup">
                {([['de', 'Deutsch', 'Deutschland · 06.11.2026 · 14:30'], ['en', 'English', 'United States · 11/6/2026 · 2:30 PM']] as const).map(([code, name, sample]) => (
                  <label key={code} className={cls('lang-opt', lang === code && 'selected')}>
                    <input type="radio" name="mineos-lang" checked={lang === code} onChange={() => setLang(code)} />
                    <span className="lang-code big">{code.toUpperCase()}</span>
                    <span><b>{name}</b><small className="muted">{sample}</small></span>
                  </label>
                ))}
              </div>
              <p className="muted" style={{ marginTop: 12 }}>{tr('Tipp: Über das Sprachsymbol „DE/EN“ in der Taskleiste kannst du jederzeit schnell wechseln.', 'Tip: Use the “DE/EN” language icon in the taskbar to switch quickly at any time.')}</p>
            </>
          )}

          {page === 'datetime' && (
            <>
              <h1 className="h-title">{tr("Datum und Uhrzeit", "Date and Time")}</h1>
              <div className="group-box">
                <span className="gb-title">{tr("Uhrzeit", "Time")}</span>
                <div style={{ fontSize: 26, color: 'var(--heading)', fontWeight: 300 }}><LiveClock /></div>
                <p>{tr("Zeitzone: ", "Time zone: ")}{Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
              </div>
              <div className="group-box">
                <span className="gb-title">{tr("Format", "Format")}</span>
                <label className="check" style={{ display: 'flex', marginBottom: 6 }}><input type="checkbox" checked={settings.clock24} onChange={() => set({ clock24: !settings.clock24 })} /> {tr("24-Stunden-Format verwenden", "Use 24-hour clock")}</label>
                <label className="check" style={{ display: 'flex' }}><input type="checkbox" checked={settings.showSeconds} onChange={() => set({ showSeconds: !settings.showSeconds })} /> {tr("Sekunden in der Taskleiste anzeigen", "Show seconds in the taskbar")}</label>
              </div>
            </>
          )}

          {page === 'sound' && (
            <>
              <h1 className="h-title">Sound</h1>
              <div className="group-box">
                <span className="gb-title">{tr("Lautsprecher", "Speakers")}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="range" min={0} max={100} value={settings.volume} onChange={(e) => set({ volume: Number(e.target.value) })} style={{ width: 260 }} />
                  <span>{settings.volume} %</span>
                  <button className="btn" onClick={() => playChime('order')}>{tr("Testen", "Test")}</button>
                </div>
                <label className="check" style={{ marginTop: 10 }}><input type="checkbox" checked={settings.sounds} onChange={() => set({ sounds: !settings.sounds })} /> {tr("Systemklänge (z. B. bei neuen Bestellungen) wiedergeben", "Play system sounds (e.g. for new orders)")}</label>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  return <>{now.toLocaleString(locale(), { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</>;
}
