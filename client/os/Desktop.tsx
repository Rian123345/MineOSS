import { useRef, useState } from 'react';
import { useStore, settingsStore } from '../lib/store';
import { openContextMenu } from './ContextMenu';
import { openApp } from './apps';
import { wm, msgbox } from './wm';
import { StoreIcon, ControlPanelIcon, ChatIcon } from './icons';
import { sessionStore } from './session';
import { loadCatalog } from '../lib/catalog';
import { cls } from '../lib/format';
import { prefsStore } from './prefs';
import { tr } from '../lib/i18n';

interface DeskIcon { id: string; label: string; icon: (size: number) => React.ReactNode; open: () => void; props: () => void }

export function Desktop() {
  const settings = useStore(settingsStore);
  const prefs = useStore(prefsStore);
  const [selected, setSelected] = useState<string[]>([]);
  const [band, setBand] = useState<null | { x: number; y: number; w: number; h: number }>(null);
  const [flash, setFlash] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const chatUnread = useStore(sessionStore).chatUnread;
  const icons: DeskIcon[] = [
    {
      id: 'store',
      label: 'Minecraft Store',
      icon: (s) => <StoreIcon size={s} />,
      open: () => openApp('store'),
      props: () => void msgbox({
        title: tr("Eigenschaften von Minecraft Store", "Minecraft Store Properties"),
        heading: 'Minecraft Store',
        text: tr("Typ: Anwendung\nBeschreibung: Bestelle Minecraft-Items, Blöcke und Ressourcen.\nVersion: 1.0.0\nHerausgeber: MineOS", "Type: Application\nDescription: Order Minecraft items, blocks and resources.\nVersion: 1.0.0\nPublisher: MineOS"),
        icon: 'info',
      }),
    },
    {
      id: 'chat',
      label: 'MineChat',
      icon: (s) => <span style={{ position: 'relative', display: 'inline-block' }}><ChatIcon size={s} />{chatUnread > 0 && <span className="desk-badge">{chatUnread > 99 ? '99+' : chatUnread}</span>}</span>,
      open: () => openApp('chat'),
      props: () => void msgbox({
        title: tr('Eigenschaften von MineChat', 'MineChat Properties'),
        heading: 'MineChat',
        text: tr('Typ: Anwendung\nBeschreibung: Hilfe-Chat mit dem Support-Team und dem KI-Assistenten MineBot.\nVersion: 1.0.0\nHerausgeber: MineOS', 'Type: Application\nDescription: Help chat with the support team and the AI assistant MineBot.\nVersion: 1.0.0\nPublisher: MineOS'),
        icon: 'info',
      }),
    },
  ];

  const iconSize = settings.iconSize === 'large' ? 72 : settings.iconSize === 'small' ? 32 : 48;

  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || e.target !== e.currentTarget) return;
    wm.deactivateAll();
    setSelected([]);
    const host = ref.current!.getBoundingClientRect();
    const sx = e.clientX - host.left, sy = e.clientY - host.top;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const cx = ev.clientX - host.left, cy = ev.clientY - host.top;
      const r = { x: Math.min(sx, cx), y: Math.min(sy, cy), w: Math.abs(cx - sx), h: Math.abs(cy - sy) };
      setBand(r);
      const hits: string[] = [];
      ref.current!.querySelectorAll<HTMLElement>('[data-icon]').forEach((el) => {
        const b = el.getBoundingClientRect();
        const bx = b.left - host.left, by = b.top - host.top;
        if (bx < r.x + r.w && bx + b.width > r.x && by < r.y + r.h && by + b.height > r.y) hits.push(el.dataset.icon!);
      });
      setSelected(hits);
    };
    const up = () => {
      setBand(null);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const sizeItem = (label: string, size: 'large' | 'medium' | 'small') => ({
    label, checked: settings.iconSize === size, radio: true,
    onClick: () => settingsStore.set((s) => ({ ...s, iconSize: size })),
  });

  const onContext = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-icon]')) return;
    setSelected([]);
    openContextMenu(e, [
      {
        label: tr("Ansicht", "View"), submenu: [
          sizeItem(tr("Große Symbole", "Large icons"), 'large'),
          sizeItem(tr("Mittelgroße Symbole", "Medium icons"), 'medium'),
          sizeItem(tr("Kleine Symbole", "Small icons"), 'small'),
          'sep',
          { label: tr("Desktopsymbole anzeigen", "Show desktop icons"), checked: prefs.showDesktopIcons, onClick: () => prefsStore.set((p) => ({ ...p, showDesktopIcons: !p.showDesktopIcons })) },
        ],
      },
      {
        label: tr("Sortieren nach", "Sort by"), submenu: [
          { label: 'Name', onClick: () => setFlash((f) => f + 1) },
          { label: tr("Elementtyp", "Item type"), onClick: () => setFlash((f) => f + 1) },
          { label: tr("Änderungsdatum", "Date modified"), onClick: () => setFlash((f) => f + 1) },
        ],
      },
      { label: tr("Aktualisieren", "Refresh"), onClick: () => { setFlash((f) => f + 1); void loadCatalog(true); } },
      'sep',
      { label: tr("Einfügen", "Paste"), disabled: true },
      { label: tr("Verknüpfung einfügen", "Paste shortcut"), disabled: true },
      'sep',
      { label: tr("Bildschirmauflösung", "Screen resolution"), icon: <ControlPanelIcon size={16} />, onClick: () => openApp('controlpanel', { page: 'display' }) },
      { label: tr("Anpassen", "Personalize"), icon: <ControlPanelIcon size={16} />, onClick: () => openApp('controlpanel', { page: 'personalize' }) },
    ]);
  };

  const onIconContext = (e: React.MouseEvent, ic: DeskIcon) => {
    e.stopPropagation();
    setSelected([ic.id]);
    const pinned = prefs.pinned.includes(ic.id as any);
    openContextMenu(e, [
      { label: tr("Öffnen", "Open"), bold: true, onClick: ic.open },
      'sep',
      {
        label: pinned ? tr("Von Taskleiste lösen", "Unpin from taskbar") : tr("An Taskleiste anheften", "Pin to taskbar"),
        onClick: () => prefsStore.set((p) => ({ ...p, pinned: pinned ? p.pinned.filter((x) => x !== ic.id) : [...p.pinned, ic.id as any] })),
      },
      'sep',
      { label: tr("Eigenschaften", "Properties"), onClick: ic.props },
    ]);
  };

  return (
    <div
      ref={ref}
      className={cls('desktop', `icons-${settings.iconSize}`)}
      onPointerDown={onDown}
      onContextMenu={onContext}
    >
      {prefs.showDesktopIcons && (
        <div key={flash} className={cls('desktop-icons', flash > 0 && 'desktop-refresh-flash')} onPointerDown={onDown}>
          {icons.map((ic) => (
            <div
              key={ic.id}
              data-icon={ic.id}
              tabIndex={0}
              className={cls('desktop-icon', selected.includes(ic.id) && 'selected')}
              onPointerDown={(e) => { e.stopPropagation(); wm.deactivateAll(); setSelected([ic.id]); }}
              onDoubleClick={ic.open}
              onKeyDown={(e) => { if (e.key === 'Enter') ic.open(); }}
              onContextMenu={(e) => onIconContext(e, ic)}
              onTouchEnd={(e) => {
                // Antippen öffnet auf Touch-Geräten direkt
                if (window.matchMedia('(pointer: coarse)').matches) { e.preventDefault(); ic.open(); }
              }}
            >
              <div className="icon-img">{ic.icon(iconSize)}</div>
              <div className="icon-label">{ic.label}</div>
            </div>
          ))}
        </div>
      )}
      {band && <div className="rubber-band" style={{ left: band.x, top: band.y, width: band.w, height: band.h }} />}
    </div>
  );
}
