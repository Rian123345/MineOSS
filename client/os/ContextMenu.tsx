import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createStore, useStore } from '../lib/store';
import { Chevron } from './icons';
import { cls } from '../lib/format';

export type MenuItem =
  | 'sep'
  | {
      label: string;
      icon?: ReactNode;
      bold?: boolean;
      disabled?: boolean;
      checked?: boolean;
      radio?: boolean;
      onClick?: () => void;
      submenu?: MenuItem[];
    };

const menuStore = createStore<{ menu: { x: number; y: number; items: MenuItem[] } | null }>({ menu: null });

export function openContextMenu(e: { clientX: number; clientY: number; preventDefault?: () => void }, items: MenuItem[]) {
  e.preventDefault?.();
  menuStore.set({ menu: { x: e.clientX, y: e.clientY, items } });
}
export const closeContextMenu = () => menuStore.set({ menu: null });

function Menu({ x, y, altX, items, level = 0 }: { x: number; y: number; altX?: number; items: MenuItem[]; level?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });
  const [open, setOpen] = useState<{ idx: number; x: number; y: number; altX: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let nx = x, ny = y;
    if (nx + r.width > window.innerWidth - 2) nx = level && altX !== undefined ? altX - r.width : window.innerWidth - r.width - 2;
    if (ny + r.height > window.innerHeight - 2) ny = Math.max(2, window.innerHeight - r.height - 2);
    setPos({ x: Math.max(2, nx), y: ny });
  }, [x, y, level, altX]);

  return (
    <div ref={ref} className="ctx-menu" style={{ left: pos.x, top: pos.y }} onContextMenu={(e) => e.preventDefault()} onPointerDown={(e) => e.stopPropagation()}>
      {items.map((it, i) => {
        if (it === 'sep') return <div key={i} className="ctx-sep" />;
        return (
          <div
            key={i}
            className={cls('ctx-item', it.bold && 'bold', it.disabled && 'disabled', open?.idx === i && 'open')}
            onMouseEnter={(e) => {
              clearTimeout(timer.current);
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              timer.current = setTimeout(() => setOpen(it.submenu && !it.disabled ? { idx: i, x: r.right - 3, y: r.top - 3, altX: r.left + 3 } : null), it.submenu ? 250 : 350);
            }}
            onClick={() => {
              if (it.disabled) return;
              if (it.submenu) {
                const el = ref.current!.children[i] as HTMLElement;
                const r = el.getBoundingClientRect();
                setOpen({ idx: i, x: r.right - 3, y: r.top - 3, altX: r.left + 3 });
                return;
              }
              closeContextMenu();
              it.onClick?.();
            }}
          >
            {it.checked && <span className="ctx-check">{it.radio ? '●' : '✔'}</span>}
            {it.icon && !it.checked && <span className="ctx-ic">{it.icon}</span>}
            {it.label}
            {it.submenu && <span className="ctx-arrow"><Chevron color={it.disabled ? '#999' : '#000'} /></span>}
          </div>
        );
      })}
      {open && (items[open.idx] as any)?.submenu && (
        <Menu x={open.x} y={open.y} altX={open.altX} items={(items[open.idx] as any).submenu} level={level + 1} />
      )}
    </div>
  );
}

export function ContextMenuHost() {
  const { menu } = useStore(menuStore);
  useEffect(() => {
    if (!menu) return;
    const close = () => closeContextMenu();
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', key);
    window.addEventListener('blur', close);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', key);
      window.removeEventListener('blur', close);
      window.removeEventListener('resize', close);
    };
  }, [menu]);
  if (!menu) return null;
  return <Menu key={`${menu.x}-${menu.y}`} x={menu.x} y={menu.y} items={menu.items} />;
}
