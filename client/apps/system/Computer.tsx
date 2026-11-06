import { useEffect, useState } from 'react';
import { FrameBar } from '../../os/frame';
import { ComputerIcon, DriveIcon, FolderIcon, StoreIcon, SearchIcon, ArrowGlyph, Chevron, ControlPanelIcon } from '../../os/icons';
import { openApp, type AppProps } from '../../os/apps';
import { msgbox } from '../../os/wm';
import { cls } from '../../lib/format';
import { tr } from '../../lib/i18n';

type Loc = 'computer' | 'c' | 'programs';

const fmtBytes = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(1).replace('.', ',')} GB` : `${Math.round(b / 1e6)} MB`);

export function ComputerApp({ winId }: AppProps) {
  const [hist, setHist] = useState<Loc[]>(['computer']);
  const [pos, setPos] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const [quota, setQuota] = useState<{ usage: number; quota: number } | null>(null);
  void winId;
  const loc = hist[pos];

  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => setQuota({ usage: e.usage ?? 0, quota: e.quota ?? 0 })).catch(() => {});
  }, []);

  const go = (l: Loc) => { setHist([...hist.slice(0, pos + 1), l]); setPos(pos + 1); setSel(null); };
  const crumbs: { label: string; loc: Loc }[] = [{ label: 'Computer', loc: 'computer' }];
  if (loc !== 'computer') crumbs.push({ label: tr("Lokaler Datenträger (C:)", "Local Disk (C:)"), loc: 'c' });
  if (loc === 'programs') crumbs.push({ label: tr('Programme', 'Program Files'), loc: 'programs' });

  const total = quota?.quota || 250e9;
  const used = quota?.usage || 0;
  const cpus = navigator.hardwareConcurrency || 2;
  const mem = (navigator as any).deviceMemory as number | undefined;

  const sysProps = () => msgbox({
    title: 'System',
    heading: tr("Basisinformationen über den Computer", "Basic information about your computer"),
    text: tr(`Edition: MineOS 1.0 – Minecraft Store Edition\nComputername: MINEOS-PC\nProzessor: ${cpus} logische Kerne\n`, `Edition: MineOS 1.0 – Minecraft Store Edition\nComputer name: MINEOS-PC\nProcessor: ${cpus} logical cores\n`) +
      tr(`Arbeitsspeicher: ${mem ? `${mem} GB` : 'unbekannt'}\nBildschirm: ${screen.width} × ${screen.height} Pixel\n`, `Memory: ${mem ? `${mem} GB` : 'unknown'}\nScreen: ${screen.width} × ${screen.height} pixels\n`) +
      `Browser: ${navigator.userAgent.match(/(Firefox|Edg|Chrome|Safari)\/[\d.]+/)?.[0] ?? navigator.userAgent.slice(0, 60)}\n${tr('Sprache', 'Language')}: ${navigator.language}`,
    icon: 'info',
  });

  return (
    <>
      <FrameBar>
        <div className="nav-bar">
          <div className="nav-arrows">
            <button className="nav-round" disabled={pos === 0} onClick={() => setPos(pos - 1)} aria-label={tr("Zurück", "Back")}><ArrowGlyph dir="left" /></button>
            <button className="nav-round" disabled={pos >= hist.length - 1} onClick={() => setPos(pos + 1)} aria-label={tr("Vor", "Forward")}><ArrowGlyph dir="right" /></button>
          </div>
          <div className="address-bar">
            <span className="ab-ic"><ComputerIcon size={16} /></span>
            {crumbs.map((c, i) => (
              <span key={c.loc} style={{ display: 'flex', alignItems: 'center' }}>
                <span className="crumb-sep"><Chevron /></span>
                <span className="crumb" onClick={() => i < crumbs.length - 1 && go(c.loc)}>{c.label}</span>
              </span>
            ))}
          </div>
          <div className="search-box"><input placeholder={tr(`${crumbs[crumbs.length - 1].label} durchsuchen`, `Search ${crumbs[crumbs.length - 1].label}`)} /><span className="sb-ic"><SearchIcon /></span></div>
        </div>
      </FrameBar>
      <div className="cmd-bar">
        <button className="cmd-btn" onClick={sysProps}>{tr("Systemeigenschaften", "System properties")}</button>
        <button className="cmd-btn" onClick={() => openApp('controlpanel')}>{tr("Systemsteuerung öffnen", "Open Control Panel")}</button>
        {loc === 'programs' && <button className="cmd-btn" disabled={!sel} onClick={() => openApp('store')}>{tr("Öffnen", "Open")}</button>}
      </div>
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div className="nav-pane">
          <div className="nav-group">
            <div className="nav-group-title"><FolderIcon /> {tr("Favoriten", "Favorites")}</div>
            <div className="nav-item" onDoubleClick={() => openApp('store')}><span className="ni-ic"><StoreIcon size={16} /></span>Minecraft Store</div>
          </div>
          <div className="nav-group">
            <div className={cls('nav-item', loc === 'computer' && 'selected')} style={{ paddingLeft: 8 }} onClick={() => go('computer')}><span className="ni-ic"><ComputerIcon size={16} /></span>Computer</div>
            <div className={cls('nav-item', loc !== 'computer' && 'selected')} onClick={() => go('c')}><span className="ni-ic"><DriveIcon size={16} /></span>{tr("Lokaler Datenträger (C:)", "Local Disk (C:)")}</div>
            <div className="nav-item" onClick={() => openApp('controlpanel')}><span className="ni-ic"><ControlPanelIcon size={16} /></span>{tr("Systemsteuerung", "Control Panel")}</div>
          </div>
        </div>
        <div className="app-scroll" style={{ padding: '10px 16px' }} onClick={(e) => { if (e.target === e.currentTarget) setSel(null); }}>
          {loc === 'computer' && (
            <>
              <div className="explorer-group">{tr("Festplatten (1)", "Hard Disk Drives (1)")}</div>
              <div className="drive-grid">
                <div className={cls('drive-tile', sel === 'c' && 'selected')} onClick={() => setSel('c')} onDoubleClick={() => go('c')}>
                  <DriveIcon size={44} />
                  <div style={{ flex: 1 }}>
                    <div>{tr("Lokaler Datenträger (C:)", "Local Disk (C:)")}</div>
                    <div className="progress blue" style={{ height: 13, margin: '3px 0' }}><div style={{ width: `${Math.max(2, (used / total) * 100)}%` }} /></div>
                    <div className="muted">{fmtBytes(total - used)} {tr("frei von ", "free of ")}{fmtBytes(total)}</div>
                  </div>
                </div>
              </div>
              <div className="explorer-group">{tr("Geräte mit Wechselmedien (1)", "Devices with Removable Storage (1)")}</div>
              <div className="drive-grid">
                <div className={cls('drive-tile', sel === 'd' && 'selected')} onClick={() => setSel('d')}
                  onDoubleClick={() => msgbox({ title: tr("DVD-RW-Laufwerk (D:)", "DVD RW Drive (D:)"), text: tr("Legen Sie einen Datenträger in Laufwerk D: ein.", "Please insert a disc into drive D:."), icon: 'warning', buttons: [tr("Wiederholen", "Retry"), tr("Abbrechen", "Cancel")] })}>
                  <DriveIcon size={44} kind="dvd" />
                  <div>{tr("DVD-RW-Laufwerk (D:)", "DVD RW Drive (D:)")}</div>
                </div>
              </div>
            </>
          )}
          {loc === 'c' && (
            <div className="file-grid">
              {[tr('Programme', 'Program Files'), tr('Benutzer', 'Users'), 'MineOS'].map((f) => (
                <div key={f} className={cls('file-tile', sel === f && 'selected')} onClick={() => setSel(f)} onDoubleClick={() => (f === tr('Programme', 'Program Files') ? go('programs') : msgbox({ title: f, text: tr(`Sie haben keine Berechtigung für den Zugriff auf „C:\\${f}“.`, `You don't have permission to access “C:\\${f}”.`), icon: 'warning' }))}>
                  <FolderIcon size={48} /><span>{f}</span>
                </div>
              ))}
            </div>
          )}
          {loc === 'programs' && (
            <div className="file-grid">
              <div className={cls('file-tile', sel === 'store' && 'selected')} onClick={() => setSel('store')} onDoubleClick={() => openApp('store')}>
                <StoreIcon size={48} /><span>Minecraft Store</span>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="details-pane">
        <ComputerIcon size={48} />
        <div className="dp-grid">
          <b>MINEOS-PC</b><span />
          <span className="muted">{tr("Arbeitsgruppe:", "Workgroup:")}</span><span>WORKGROUP</span>
          <span className="muted">{tr("Prozessor:", "Processor:")}</span><span>{cpus} {tr("logische Kerne", "logical cores")}</span>
          <span className="muted">{tr("Speicher:", "Memory:")}</span><span>{mem ? `${mem} GB` : '—'}</span>
        </div>
      </div>
    </>
  );
}
