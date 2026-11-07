import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { wm, wmStore, type WinState, isMobile } from './wm';
import { useStore } from '../lib/store';
import { CapGlyph } from './icons';
import { APPS } from './apps';
import { cls } from '../lib/format';

import { WindowContext } from './frame';
import { tr, useLang } from '../lib/i18n';

const AppHost = memo(function AppHost({ win }: { win: Pick<WinState, 'id' | 'app' | 'props' | 'nonce'> }) {
  useLang(); // beim Sprachwechsel neu zeichnen
  const App = APPS[win.app].component;
  return <App winId={win.id} props={win.props} nonce={win.nonce} />;
}, (a, b) => a.win.id === b.win.id && a.win.props === b.win.props && a.win.nonce === b.win.nonce);

type Dir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/** Symbole der Fensterknöpfe im XP-Stil (werden nur im XP-Theme angezeigt) */
function XpGlyph({ kind }: { kind: 'min' | 'max' | 'restore' | 'close' }) {
  return (
    <svg className="xp-glyph" width="21" height="21" viewBox="0 0 21 21" aria-hidden="true">
      {kind === 'min' && <rect x="5" y="13" width="7" height="3" fill="#fff" />}
      {kind === 'max' && <path d="M5 5h11v11H5z M6 8v7h9V8z" fill="#fff" fillRule="evenodd" />}
      {kind === 'restore' && <path d="M8 4h9v9h-3v-1h2V7H9v1H8z M4 8h9v9H4z M5 11v5h7v-5z" fill="#fff" fillRule="evenodd" />}
      {kind === 'close' && <path d="M5.5 5.5l10 10M15.5 5.5l-10 10" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />}
    </svg>
  );
}

export function Window({ win }: { win: WinState }) {
  const activeId = useStore(wmStore).activeId;
  const hasModalChild = useStore(wmStore).windows.some((c) => c.parentId === win.id && c.phase !== 'closing');
  const active = activeId === win.id;
  const ref = useRef<HTMLDivElement>(null);
  const [framebar, setFramebar] = useState<HTMLDivElement | null>(null);
  const [snapPreview, setSnapPreview] = useState<null | { x: number; y: number; w: number; h: number }>(null);
  const [flashing, setFlashing] = useState(false);
  const app = APPS[win.app];

  useEffect(() => {
    if (!win.flash) return;
    setFlashing(true);
    const t = setTimeout(() => setFlashing(false), 600);
    return () => clearTimeout(t);
  }, [win.flash]);

  // Wiederherstellen: aus der Taskleisten-Schaltfläche herauswachsen
  useLayoutEffect(() => {
    const el = ref.current;
    if (win.phase !== 'restoring' || !el || !el.animate) return;
    const btn = document.querySelector(`[data-taskbtn="${win.app}"]`) as HTMLElement | null;
    if (!btn) return;
    const b = btn.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const dx = b.left + b.width / 2 - (r.left + r.width / 2);
    const dy = b.top + b.height / 2 - (r.top + r.height / 2);
    el.animate([
      { transform: `translate(${dx}px, ${dy}px) scale(0.08)`, opacity: 0 },
      { transform: `translate(${dx * 0.3}px, ${dy * 0.3}px) scale(0.7)`, opacity: 0.85, offset: 0.45 },
      { transform: 'none', opacity: 1 },
    ], { duration: 340, easing: 'cubic-bezier(.16, 1, .3, 1)' });
  }, [win.phase, win.app]);

  // Maximieren / Andocken / Verkleinern: weiches Morphing (FLIP) statt Layout-Animation
  const lastRect = useRef<DOMRect | null>(null);
  const lastKey = useRef('');
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const key = `${win.maximized}|${win.snapped}|${win.x}|${win.y}|${win.w}|${win.h}|${win.minimized}`;
    if (key === lastKey.current) return;
    lastKey.current = key;
    const now = el.getBoundingClientRect();
    const prev = lastRect.current;
    lastRect.current = now;
    if (win.anim !== 'geometry' || !prev || !el.animate || now.width <= 0 || now.height <= 0) return;
    if (Math.abs(prev.left - now.left) + Math.abs(prev.top - now.top) + Math.abs(prev.width - now.width) + Math.abs(prev.height - now.height) < 3) return;
    el.animate([
      { transformOrigin: '0 0', transform: `translate(${prev.left - now.left}px, ${prev.top - now.top}px) scale(${prev.width / now.width}, ${prev.height / now.height})` },
      { transformOrigin: '0 0', transform: 'none' },
    ], { duration: 260, easing: 'cubic-bezier(.2, .9, .25, 1)' });
  });

  /* ── Verschieben ── */
  const onTitleDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button, input, a')) return;
    wm.focus(win.id);
    if (isMobile()) return;
    const el = ref.current!;
    let startX = e.clientX, startY = e.clientY;
    const downX = e.clientX;
    let rect = { x: win.x, y: win.y, w: win.w, h: win.h };
    let detached = !(win.maximized || win.snapped);
    let moved = false;
    let snap: null | 'left' | 'right' | 'max' = null;
    let raf = 0;
    let pendingPos: { x: number; y: number } | null = null;
    const W = window.innerWidth, H = window.innerHeight - (window.innerWidth <= 760 ? 44 : 40);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 4) return;
      moved = true;
      if (!detached) {
        // Aus maximiertem Zustand lösen: Fenster unter dem Mauszeiger wiederherstellen
        const r = win.restoreRect || rect;
        const ratio = (downX - (win.maximized ? 0 : win.x)) / (win.maximized ? W : win.w);
        rect = { w: r.w, h: r.h, x: Math.round(ev.clientX - r.w * ratio), y: Math.max(0, ev.clientY - 14) };
        wm.setRect(win.id, { ...rect, maximized: false, snapped: null });
        startX = ev.clientX; startY = ev.clientY;
        detached = true;
        return;
      }
      const nx = rect.x + dx, ny = Math.max(-2, rect.y + dy);
      pendingPos = { x: nx, y: ny };
      if (!raf) raf = requestAnimationFrame(() => {
        raf = 0;
        if (pendingPos) el.style.transform = `translate3d(${pendingPos.x - rect.x}px, ${pendingPos.y - rect.y}px, 0)`;
      });
      snap = ev.clientY <= 1 ? 'max' : ev.clientX <= 1 ? 'left' : ev.clientX >= W - 2 ? 'right' : null;
      setSnapPreview(
        snap === 'max' ? { x: 4, y: 4, w: W - 8, h: H - 8 }
          : snap === 'left' ? { x: 4, y: 4, w: W / 2 - 8, h: H - 8 }
            : snap === 'right' ? { x: W / 2 + 4, y: 4, w: W / 2 - 8, h: H - 8 } : null,
      );
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setSnapPreview(null);
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      if (!moved) return;
      if (detached && pendingPos) {
        const nx = pendingPos.x, ny = pendingPos.y;
        el.style.transform = '';
        const fresh = wm.get(win.id)!;
        // Titelleiste muss erreichbar bleiben
        const x = Math.max(-fresh.w + 100, Math.min(nx, W - 100));
        const y = Math.max(0, Math.min(ny, H - 30));
        rect = { ...rect, x, y };
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        wm.setRect(win.id, { x, y, snapped: null });
        if (snap) wm.snap(win.id, snap);
      }
      void ev;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  /* ── Größe ändern ── */
  const onResizeDown = (dir: Dir) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    wm.focus(win.id);
    const el = ref.current!;
    const sx = e.clientX, sy = e.clientY;
    const start = { x: win.x, y: win.y, w: win.w, h: win.h };
    let cur = { ...start };
    let rraf = 0;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      if (rraf) cancelAnimationFrame(rraf);
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      cur = { ...start };
      if (dir.includes('e')) cur.w = Math.max(win.minW, start.w + dx);
      if (dir.includes('s')) cur.h = Math.max(win.minH, start.h + dy);
      if (dir.includes('w')) { cur.w = Math.max(win.minW, start.w - dx); cur.x = start.x + (start.w - cur.w); }
      if (dir.includes('n')) { cur.h = Math.max(win.minH, start.h - dy); cur.y = Math.max(0, start.y + (start.h - cur.h)); }
      const c = cur;
      rraf = requestAnimationFrame(() => { rraf = 0; Object.assign(el.style, { left: `${c.x}px`, top: `${c.y}px`, width: `${c.w}px`, height: `${c.h}px` }); });
    };
    const up = () => {
      if (rraf) { cancelAnimationFrame(rraf); Object.assign(el.style, { left: `${cur.x}px`, top: `${cur.y}px`, width: `${cur.w}px`, height: `${cur.h}px` }); }
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      wm.setRect(win.id, { ...cur, snapped: null });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const style: React.CSSProperties = win.maximized
    ? { left: 0, top: 0, width: '100%', height: '100%', zIndex: win.z }
    : { left: win.x, top: win.y, width: win.w, height: win.app === 'msgbox' ? 'auto' : win.h, zIndex: win.z };

  const layer = typeof document !== 'undefined' ? document.getElementById('windows-layer') : null;

  return (
    <div
      ref={ref}
      data-win={win.id}
      className={cls(
        'win',
        active ? 'active' : 'inactive',
        win.maximized && 'maximized',
        win.app === 'msgbox' && 'dialog',
        win.phase === 'opening' && 'anim-open',
        win.phase === 'closing' && 'anim-close',
        win.phase === 'minimizing' && 'anim-minimize',
        win.phase === 'restoring' && 'anim-restore',
        win.minimized && 'minimized',
        flashing && 'flash-frame',
      )}
      style={style}
      onPointerDownCapture={() => { if (!active) wm.focus(win.id); }}
      role="dialog"
      aria-label={win.title}
    >
      <div className="win-glass" />
      <div className="win-inner">
        <div className="win-titlebar" onPointerDown={onTitleDown} onDoubleClick={() => win.maximizable && wm.toggleMax(win.id)}>
          {win.app !== 'msgbox' && <span className="win-icon">{app.smallIcon()}</span>}
          <span className="win-title">{win.title}</span>
        </div>
        <div className="win-caption">
          {win.minimizable && (
            <button className="cap-min" title={tr("Minimieren", "Minimize")} aria-label={tr("Minimieren", "Minimize")} onClick={() => wm.minimize(win.id)}><CapGlyph kind="min" /><XpGlyph kind="min" /></button>
          )}
          {win.maximizable && (
            <button className="cap-max" data-state={win.maximized ? 'restore' : 'max'} title={win.maximized ? tr("Verkleinern", "Restore Down") : tr("Maximieren", "Maximize")} aria-label={tr("Maximieren", "Maximize")} onClick={() => wm.toggleMax(win.id)}>
              <CapGlyph kind={win.maximized ? 'restore' : 'max'} /><XpGlyph kind={win.maximized ? 'restore' : 'max'} />
            </button>
          )}
          <button
            className="cap-close"
            title={tr("Schließen", "Close")}
            aria-label={tr("Schließen", "Close")}
            onClick={() => (win.props?.onCloseRequest ? win.props.onCloseRequest() : wm.close(win.id))}
            style={!win.minimizable && !win.maximizable ? { width: 43, borderRadius: '0 0 5px 5px' } : undefined}
          >
            <CapGlyph kind="close" /><XpGlyph kind="close" />
          </button>
        </div>
        <div className="win-framebar" ref={setFramebar} />
        <div className="win-client">
          <WindowContext.Provider value={{ id: win.id, framebar, active }}>
            <AppHost win={win} />
          </WindowContext.Provider>
          {hasModalChild && (
            <div className="modal-shield" onPointerDown={(e) => { e.stopPropagation(); wm.focus(win.id); }} />
          )}
        </div>
      </div>
      {win.resizable && !win.maximized && (['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as Dir[]).map((d) => (
        <div key={d} className={`rz rz-${d}`} onPointerDown={onResizeDown(d)} />
      ))}
      {snapPreview && layer && createPortal(
        <div className="snap-preview" style={{ left: snapPreview.x, top: snapPreview.y, width: snapPreview.w, height: snapPreview.h, zIndex: win.z - 1 }} />,
        layer,
      )}
    </div>
  );
}
