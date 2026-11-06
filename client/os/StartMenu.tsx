import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { openApp } from './apps';
import { useStore } from '../lib/store';
import { sessionStore } from './session';
import { catalogStore, loadCatalog, useCatalog } from '../lib/catalog';
import {
  StoreIcon, ComputerIcon, ControlPanelIcon, UserPic, ShieldIcon, Emblem, PackageIcon, ItemIcon,
  SearchIcon, Chevron, FolderIcon, PowerIcon,
} from './icons';
import { openContextMenu } from './ContextMenu';
import { euro } from '../lib/format';
import { tr } from '../lib/i18n';

interface Props { closing?: boolean; onClose: () => void; onShutdown: (mode: 'shutdown' | 'restart' | 'lock' | 'logoff') => void }

export function StartMenu({ closing, onClose, onShutdown }: Props) {
  const session = useStore(sessionStore);
  const catalog = useCatalog().data;
  const [q, setQ] = useState('');
  const [all, setAll] = useState(false);
  const [pic, setPic] = useState<ReactNode>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    void loadCatalog();
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);

  const run = (fn: () => void) => () => { onClose(); fn(); };

  const programs = [
    { id: 'store', label: 'Minecraft Store', sub: tr("Items bestellen", "Order items"), icon: <StoreIcon size={32} />, run: () => openApp('store') },
    { id: 'track', label: tr("Meine Bestellungen", "My orders"), sub: tr("Status deiner Bestellungen", "Status of your orders"), icon: <PackageIcon size={32} />, run: () => openApp('store', { view: { kind: 'track' } }) },
    ...(session.isAdmin ? [{ id: 'admin', label: tr("Shop-Verwaltung", "Shop Management"), sub: tr("Bestellungen & Produkte", "Orders & products"), icon: <ShieldIcon size={30} />, run: () => openApp('admin') }] : []),
  ];
  const accessories = [
    { id: 'computer', label: 'Computer', icon: <ComputerIcon size={32} />, run: () => openApp('computer') },
    { id: 'cp', label: tr("Systemsteuerung", "Control Panel"), icon: <ControlPanelIcon size={32} />, run: () => openApp('controlpanel') },
    { id: 'users', label: tr("Benutzerkonten", "User Accounts"), icon: <UserPic size={32} />, run: () => openApp('useraccounts') },
    { id: 'about', label: tr("Info über MineOS", "About MineOS"), icon: <Emblem size={30} />, run: () => openApp('about') },
  ];

  const query = q.trim().toLowerCase();
  const progHits = useMemo(() => (query ? [...programs, ...accessories].filter((p) => p.label.toLowerCase().includes(query)) : []), [query, session.isAdmin]); // eslint-disable-line
  const productHits = useMemo(() => (query && catalog ? catalog.products.filter((p) => p.name.toLowerCase().includes(query)).slice(0, 6) : []), [query, catalog]);

  const rightItems: { label: string; icon: ReactNode; run: () => void; bold?: boolean }[] = [
    { label: session.user?.name ?? tr("Gast", "Guest"), icon: <UserPic size={48} admin={session.isAdmin} />, run: () => openApp('useraccounts'), bold: true },
    { label: 'Minecraft Store', icon: <StoreIcon size={44} />, run: () => openApp('store') },
    { label: tr("Meine Bestellungen", "My orders"), icon: <PackageIcon size={44} />, run: () => openApp('store', { view: { kind: 'track' } }) },
    { label: tr("Benutzerkonto", "User account"), icon: <UserPic size={48} admin={session.isAdmin} />, run: () => openApp('useraccounts') },
    { label: 'Computer', icon: <ComputerIcon size={44} />, run: () => openApp('computer') },
    { label: tr("Systemsteuerung", "Control Panel"), icon: <ControlPanelIcon size={44} />, run: () => openApp('controlpanel') },
    ...(session.isAdmin ? [{ label: tr("Shop-Verwaltung", "Shop Management"), icon: <ShieldIcon size={42} />, run: () => openApp('admin') }] : []),
    { label: tr("Hilfe und Support", "Help and Support"), icon: <Emblem size={42} />, run: () => openApp('about') },
  ];

  const powerMenu = (e: React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    openContextMenu({ clientX: r.right - 2, clientY: r.top - 82 }, [
      { label: tr("Benutzer wechseln / Abmelden", "Switch user / Log off"), onClick: run(() => onShutdown('logoff')) },
      { label: tr("Sperren", "Lock"), onClick: run(() => onShutdown('lock')) },
      'sep',
      { label: tr("Neu starten", "Restart"), onClick: run(() => onShutdown('restart')) },
    ]);
  };

  return (
    <div className={`start-menu${closing ? ' closing' : ''}`} onPointerDown={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()} role="menu">
      <div className="sm-left">
        <div className="sm-programs">
          {query ? (
            <>
              {progHits.length > 0 && <div className="nav-group-title" style={{ paddingLeft: 6 }}>{tr("Programme (", "Programs (")}{progHits.length})</div>}
              {progHits.map((p) => (
                <div key={p.id} className="sm-item" onClick={run(p.run)}><span className="sm-ic">{p.icon}</span>{p.label}</div>
              ))}
              {productHits.length > 0 && <div className="nav-group-title" style={{ paddingLeft: 6 }}>{tr("Produkte im Store (", "Products in the store (")}{productHits.length})</div>}
              {productHits.map((p) => (
                <div key={p.id} className="sm-item" onClick={run(() => openApp('store', { view: { kind: 'product', id: p.id } }))}>
                  <span className="sm-ic"><ItemIcon icon={p.icon} imageUrl={p.imageUrl} size={28} /></span>
                  <div>{p.name}<small>{euro(p.priceCents)} · {p.unitLabel}</small></div>
                </div>
              ))}
              {!progHits.length && !productHits.length && <div className="sm-empty">{tr("Es wurden keine Elemente gefunden, die mit der Suche übereinstimmen.", "No items match your search.")}</div>}
              {productHits.length > 0 && (
                <div className="sm-item" onClick={run(() => openApp('store', { view: { kind: 'search', q } }))}>
                  <span className="sm-ic"><SearchIcon size={16} /></span>{tr("Weitere Ergebnisse im Store anzeigen", "See more results in the store")}</div>
              )}
            </>
          ) : all ? (
            <>
              {programs.map((p) => (
                <div key={p.id} className="sm-item" style={{ height: 26 }} onClick={run(p.run)}>
                  <span className="sm-ic" style={{ width: 20, height: 20, transform: 'scale(.6)' }}>{p.icon}</span>{p.label}
                </div>
              ))}
              <div className="sm-item" style={{ height: 26 }}><span className="sm-ic" style={{ width: 20, height: 20 }}><FolderIcon /></span><b style={{ fontWeight: 400 }}>{tr("Zubehör", "Accessories")}</b></div>
              {accessories.map((p) => (
                <div key={p.id} className="sm-item" style={{ height: 26, paddingLeft: 24 }} onClick={run(p.run)}>
                  <span className="sm-ic" style={{ width: 20, height: 20, transform: 'scale(.6)' }}>{p.icon}</span>{p.label}
                </div>
              ))}
            </>
          ) : (
            <>
              {programs.map((p) => (
                <div key={p.id} className="sm-item" onClick={run(p.run)}>
                  <span className="sm-ic">{p.icon}</span>
                  <div>{p.label}<small>{p.sub}</small></div>
                </div>
              ))}
              <div className="sm-sep" />
              {accessories.slice(0, 2).map((p) => (
                <div key={p.id} className="sm-item" onClick={run(p.run)}><span className="sm-ic">{p.icon}</span>{p.label}</div>
              ))}
            </>
          )}
        </div>
        {!query && (
          <>
            <div className="sm-sep" style={{ margin: '0 6px 4px' }} />
            <div className="sm-allprograms" onClick={() => setAll(!all)}>
              <Chevron dir={all ? 'left' : 'right'} color="#1e3287" />
              {all ? tr("Zurück", "Back") : tr("Alle Programme", "All Programs")}
            </div>
          </>
        )}
        <div className="sm-search">
          <div className="search-box">
            <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Programme/Produkte durchsuchen", "Search programs and products")}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (progHits[0]) run(progHits[0].run)();
                  else if (productHits.length) run(() => openApp('store', { view: { kind: 'search', q } }))();
                }
              }} />
            <span className="sb-ic"><SearchIcon /></span>
          </div>
        </div>
      </div>

      <div className="sm-right">
        <div className="sm-userpic"><div key={pic ? 'hover' : 'user'} className="sm-pic-fade">{pic ?? <UserPic size={48} admin={session.isAdmin} />}</div></div>
        {rightItems.map((it, i) => (
          <div key={it.label}>
            <div
              className={`sm-link${it.bold ? ' username' : ''}`}
              onMouseEnter={() => setPic(it.icon)}
              onMouseLeave={() => setPic(null)}
              onClick={run(it.run)}
            >
              {it.label}
            </div>
            {(i === 0 || i === 2 || i === 5) && <div className="sm-rsep" />}
          </div>
        ))}
        <div className="sm-power">
          <button className="pw-main" onClick={run(() => onShutdown('shutdown'))} onMouseEnter={() => setPic(<PowerIcon size={34} color="#c0392b" />)} onMouseLeave={() => setPic(null)}>
            {tr("Herunterfahren", "Shut down")}</button>
          <button className="pw-arrow" aria-label={tr("Weitere Optionen", "More options")} onClick={powerMenu}><Chevron color="#fff" /></button>
        </div>
      </div>
    </div>
  );
}
