import { useEffect, useState, type ReactNode } from 'react';
import { openApp } from './apps';
import { useStore } from '../lib/store';
import { sessionStore } from './session';
import { StoreIcon, ComputerIcon, ControlPanelIcon, UserPic, ShieldIcon, Emblem, PackageIcon, SearchIcon, FolderIcon, PowerIcon, ChatIcon } from './icons';
import { tr } from '../lib/i18n';
import { playSound } from './sounds';

interface Props {
  closing?: boolean;
  onClose: () => void;
  /** Öffnet den XP-Dialog „Abmelden“ bzw. „Ausschalten“ */
  onXpDialog: (kind: 'logoff' | 'turnoff') => void;
}

interface Entry { id: string; label: string; sub?: string; icon: ReactNode; run: () => void; bold?: boolean }

/** Startmenü im Stil von Windows XP (Luna): blauer Kopf, weiße und hellblaue Spalte, Fußleiste */
export function StartMenuXP({ closing, onClose, onXpDialog }: Props) {
  const session = useStore(sessionStore);
  const [all, setAll] = useState(false);

  useEffect(() => {
    playSound('click');
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);

  const run = (fn: () => void) => () => { onClose(); fn(); };

  const pinned: Entry[] = [
    { id: 'store', label: 'Minecraft Store', sub: tr('Items bestellen', 'Order items'), icon: <StoreIcon size={32} />, run: () => openApp('store') },
    { id: 'chat', label: 'MineChat', sub: tr('Hilfe & KI-Assistent', 'Help & AI assistant'), icon: <ChatIcon size={32} />, run: () => openApp('chat') },
    { id: 'track', label: tr('Meine Bestellungen', 'My orders'), sub: tr('Status deiner Bestellungen', 'Status of your orders'), icon: <PackageIcon size={32} />, run: () => openApp('store', { view: { kind: 'track' } }) },
  ];
  const frequent: Entry[] = [
    ...(session.isAdmin ? [{ id: 'admin', label: tr('Shop-Verwaltung', 'Shop Management'), icon: <ShieldIcon size={30} />, run: () => openApp('admin') }] : []),
    { id: 'cp', label: tr('Systemsteuerung', 'Control Panel'), icon: <ControlPanelIcon size={32} />, run: () => openApp('controlpanel') },
    { id: 'users', label: tr('Benutzerkonten', 'User Accounts'), icon: <UserPic size={32} />, run: () => openApp('useraccounts') },
    { id: 'about', label: tr('Info über MineOS', 'About MineOS'), icon: <Emblem size={30} />, run: () => openApp('about') },
  ];
  const right: (Entry | 'sep')[] = [
    { id: 'r-store', label: 'Minecraft Store', icon: <StoreIcon size={24} />, run: () => openApp('store'), bold: true },
    { id: 'r-track', label: tr('Meine Bestellungen', 'My Orders'), icon: <PackageIcon size={24} />, run: () => openApp('store', { view: { kind: 'track' } }), bold: true },
    { id: 'r-comp', label: tr('Arbeitsplatz', 'My Computer'), icon: <ComputerIcon size={24} />, run: () => openApp('computer'), bold: true },
    'sep',
    { id: 'r-cp', label: tr('Systemsteuerung', 'Control Panel'), icon: <ControlPanelIcon size={24} />, run: () => openApp('controlpanel') },
    { id: 'r-users', label: tr('Benutzerkonten', 'User Accounts'), icon: <UserPic size={24} admin={session.isAdmin} />, run: () => openApp('useraccounts') },
    ...(session.isAdmin ? [{ id: 'r-admin', label: tr('Shop-Verwaltung', 'Shop Management'), icon: <ShieldIcon size={22} />, run: () => openApp('admin') }] : []),
    'sep',
    { id: 'r-help', label: tr('Hilfe und Support', 'Help and Support'), icon: <ChatIcon size={22} />, run: () => openApp('chat') },
    { id: 'r-search', label: tr('Suchen', 'Search'), icon: <SearchIcon size={20} />, run: () => openApp('store', { view: { kind: 'search', q: '' } }) },
  ];
  const allPrograms: Entry[] = [
    ...pinned,
    ...(session.isAdmin ? [{ id: 'admin', label: tr('Shop-Verwaltung', 'Shop Management'), icon: <ShieldIcon size={30} />, run: () => openApp('admin') }] : []),
  ];
  const accessories: Entry[] = [
    { id: 'computer', label: tr('Arbeitsplatz', 'My Computer'), icon: <ComputerIcon size={32} />, run: () => openApp('computer') },
    ...frequent.filter((e) => e.id !== 'admin'),
  ];

  return (
    <div className={`xp-start${closing ? ' closing' : ''}`} onPointerDown={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()} role="menu">
      <div className="xps-head">
        <span className="xps-pic"><UserPic size={44} admin={session.isAdmin} /></span>
        <b>{session.user?.name ?? tr('Gast', 'Guest')}</b>
      </div>
      <div className="xps-body">
        <div className="xps-left">
          {pinned.map((p) => (
            <div key={p.id} className="xps-item big" onClick={run(p.run)} role="menuitem">
              <span className="xps-ic">{p.icon}</span>
              <span><b>{p.label}</b><small>{p.sub}</small></span>
            </div>
          ))}
          <div className="xps-sep" />
          {frequent.map((p) => (
            <div key={p.id} className="xps-item" onClick={run(p.run)} role="menuitem">
              <span className="xps-ic">{p.icon}</span><span>{p.label}</span>
            </div>
          ))}
          <div className="xps-fill" />
          <div className="xps-sep" />
          <div className={`xps-all${all ? ' open' : ''}`} onClick={() => setAll(!all)} onMouseEnter={() => setAll(true)} role="menuitem" aria-haspopup="true">
            <b>{tr('Alle Programme', 'All Programs')}</b><span className="xps-all-arrow" />
          </div>
        </div>
        <div className="xps-right" onMouseEnter={() => setAll(false)}>
          {right.map((it, i) => it === 'sep'
            ? <div key={'s' + i} className="xps-rsep" />
            : (
              <div key={it.id} className={`xps-link${it.bold ? ' bold' : ''}`} onClick={run(it.run)} role="menuitem">
                <span className="xps-ic">{it.icon}</span><span>{it.label}</span>
              </div>
            ))}
        </div>
        {all && (
          <div className="xps-flyout" onMouseLeave={() => setAll(false)} role="menu">
            {allPrograms.map((p) => (
              <div key={p.id} className="xps-fly-item" onClick={run(p.run)} role="menuitem"><span className="xps-ic sm">{p.icon}</span>{p.label}</div>
            ))}
            <div className="xps-fly-item folder"><span className="xps-ic sm"><FolderIcon /></span>{tr('Zubehör', 'Accessories')}</div>
            {accessories.map((p) => (
              <div key={p.id} className="xps-fly-item indent" onClick={run(p.run)} role="menuitem"><span className="xps-ic sm">{p.icon}</span>{p.label}</div>
            ))}
          </div>
        )}
      </div>
      <div className="xps-foot">
        <button onClick={run(() => onXpDialog('logoff'))}><span className="xps-foot-ic logoff"><UserPic size={18} /></span>{tr('Abmelden', 'Log Off')}</button>
        <button onClick={run(() => onXpDialog('turnoff'))}><span className="xps-foot-ic power"><PowerIcon size={14} color="#fff" /></span>{tr('Ausschalten', 'Turn Off Computer')}</button>
      </div>
    </div>
  );
}

/** Die berühmten XP-Dialoge „Ausschalten“ und „Abmelden“ – der Desktop wird dahinter grau */
export function XpSessionDialog({ kind, onChoose, onCancel }: {
  kind: 'logoff' | 'turnoff';
  onChoose: (mode: 'shutdown' | 'restart' | 'lock' | 'logoff') => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onCancel]);
  const buttons = kind === 'turnoff'
    ? [
      { mode: 'lock' as const, cls: 'standby', label: tr('Sperren', 'Stand By') },
      { mode: 'shutdown' as const, cls: 'off', label: tr('Ausschalten', 'Turn Off') },
      { mode: 'restart' as const, cls: 'restart', label: tr('Neu starten', 'Restart') },
    ]
    : [
      { mode: 'lock' as const, cls: 'switch', label: tr('Benutzer wechseln', 'Switch User') },
      { mode: 'logoff' as const, cls: 'logoff', label: tr('Abmelden', 'Log Off') },
    ];
  return (
    <div className="xp-dialog-layer" onPointerDown={(e) => e.stopPropagation()}>
      <div className="xp-sess-dialog" role="dialog" aria-label={kind === 'turnoff' ? tr('MineOS ausschalten', 'Turn off MineOS') : tr('Von MineOS abmelden', 'Log Off MineOS')}>
        <div className="xpsd-head">
          <span>{kind === 'turnoff' ? tr('MineOS ausschalten', 'Turn off MineOS') : tr('Von MineOS abmelden', 'Log Off MineOS')}</span>
          <Emblem size={30} />
        </div>
        <div className="xpsd-body">
          {buttons.map((b, i) => (
            <button key={b.mode} className="xpsd-btn" onClick={() => onChoose(b.mode)} autoFocus={i === 1}>
              <span className={`xpsd-ic ${b.cls}`} />
              <span>{b.label}</span>
            </button>
          ))}
        </div>
        <div className="xpsd-foot"><button className="btn" onClick={onCancel}>{tr('Abbrechen', 'Cancel')}</button></div>
      </div>
    </div>
  );
}
