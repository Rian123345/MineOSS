import { useMemo } from 'react';
import { iconUrl } from '../lib/itemIcons';
import { mcIcon, MC_GLINT } from '../lib/mcIcons';

type P = { size?: number; className?: string };

/** Icon eines Minecraft-Items/Blocks (Originaltextur), eines hochgeladenen Bildes oder Ersatz-Pixel-Icon */
export function ItemIcon({ icon, imageUrl, size = 48, className }: { icon: string; imageUrl?: string | null; size?: number; className?: string }) {
  const mc = imageUrl ? null : mcIcon(icon);
  const res = size <= 24 ? 32 : size <= 48 ? 64 : 128;
  const src = useMemo(() => (imageUrl ? imageUrl : mc ? mc.src : iconUrl(icon, res)), [icon, imageUrl, res, mc]);
  // Flache Items sind 16×16 → pixelgenau vergrößern; Block-Würfel sind vorgerendert → weich skalieren
  const pixelated = !imageUrl && (!mc || mc.kind === 'i');
  const img = (
    <img
      src={src}
      width={size}
      height={size}
      alt={mc?.name ?? ''}
      title={mc?.name}
      draggable={false}
      loading="lazy"
      decoding="async"
      className={className}
      style={{ imageRendering: pixelated ? 'pixelated' : 'auto', objectFit: 'contain' }}
    />
  );
  if (mc && MC_GLINT.has(mc.id)) {
    return (
      <span className="mc-glint-wrap" style={{ width: size, height: size }}>
        {img}
        <span className="mc-glint" style={{ WebkitMaskImage: `url(${src})`, maskImage: `url(${src})` }} />
      </span>
    );
  }
  return img;
}

/** MineOS-Emblem (eigenes Logo: leuchtender Würfel) */
export function Emblem({ size = 26 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className="orb-emblem">
      <defs>
        <linearGradient id="emT" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c9ff9a" /><stop offset="1" stopColor="#5fd13a" /></linearGradient>
        <linearGradient id="emL" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" stopOpacity=".95" /><stop offset="1" stopColor="#bfe6ff" stopOpacity=".85" /></linearGradient>
        <linearGradient id="emR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d9f0ff" stopOpacity=".9" /><stop offset="1" stopColor="#7fc4ff" stopOpacity=".8" /></linearGradient>
      </defs>
      <path d="M16 3 L28 9.5 L16 16 L4 9.5 Z" fill="url(#emT)" stroke="#fff" strokeOpacity=".7" strokeWidth=".8" />
      <path d="M4 9.5 L16 16 L16 29 L4 22.5 Z" fill="url(#emL)" />
      <path d="M28 9.5 L16 16 L16 29 L28 22.5 Z" fill="url(#emR)" />
      <path d="M16 16 L16 29" stroke="#2a6fd6" strokeOpacity=".5" strokeWidth=".8" />
      <rect x="8.5" y="15" width="3" height="3" fill="#2a6fd6" opacity=".55" transform="skewY(28) translate(0 -5.5)" />
      <rect x="20.5" y="15" width="3" height="3" fill="#2a6fd6" opacity=".45" transform="skewY(-28) translate(0 12.2)" />
    </svg>
  );
}

/** Desktop-/Taskleisten-Icon des Minecraft Stores */
export function StoreIcon({ size = 48 }: P) {
  const s = size;
  return (
    <div style={{ position: 'relative', width: s, height: s }}>
      <ItemIcon icon="grass_block" size={Math.round(s * 0.86)} />
      <svg width={s * 0.52} height={s * 0.52} viewBox="0 0 24 24" style={{ position: 'absolute', right: -s * 0.04, bottom: -s * 0.02 }}>
        <defs>
          <linearGradient id="cartG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe48a" /><stop offset="1" stopColor="#e09a12" /></linearGradient>
        </defs>
        <circle cx="12" cy="12" r="11" fill="url(#cartG)" stroke="#8a5a06" strokeWidth="1.2" />
        <path d="M5.5 7.5h2l1.6 7h7.2l1.4-5H8.4" fill="none" stroke="#5a3a02" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx="10" cy="17.3" r="1.3" fill="#5a3a02" /><circle cx="15.5" cy="17.3" r="1.3" fill="#5a3a02" />
        <ellipse cx="12" cy="6.5" rx="7" ry="3.2" fill="#fff" opacity=".45" />
      </svg>
    </div>
  );
}

/** MineChat: zwei Sprechblasen (Spieler & Support) */
export function ChatIcon({ size = 32 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <defs>
        <linearGradient id="chB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8fd3ff" /><stop offset="1" stopColor="#2a78d0" /></linearGradient>
        <linearGradient id="chG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c9ff9a" /><stop offset="1" stopColor="#3fa62a" /></linearGradient>
      </defs>
      <path d="M3 4.5h17a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H10l-4.5 3.8V17.5H3a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z" fill="url(#chB)" stroke="#164f93" strokeWidth="1" />
      <path d="M12 12h16a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-1.5v4l-4.8-4H12a2 2 0 0 1-2-2V14a2 2 0 0 1 2-2z" fill="url(#chG)" stroke="#23700f" strokeWidth="1" />
      <ellipse cx="11" cy="6.8" rx="8" ry="1.8" fill="#fff" opacity=".45" />
      <rect x="14.5" y="17" width="3" height="3" fill="#1d5c0c" /><rect x="19.5" y="17" width="3" height="3" fill="#1d5c0c" /><rect x="24.5" y="17" width="3" height="3" fill="#1d5c0c" />
    </svg>
  );
}

export function ComputerIcon({ size = 32 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <defs>
        <linearGradient id="cmpS" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7fd0ff" /><stop offset="1" stopColor="#1f5fb4" /></linearGradient>
        <linearGradient id="cmpB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5a5f66" /><stop offset="1" stopColor="#1f2226" /></linearGradient>
      </defs>
      <rect x="3" y="4" width="26" height="18" rx="1.5" fill="url(#cmpB)" />
      <rect x="5" y="6" width="22" height="14" fill="url(#cmpS)" />
      <path d="M5 6h22L5 16z" fill="#fff" opacity=".25" />
      <path d="M12 22h8l1.5 4h-11z" fill="#3a3e44" />
      <rect x="8" y="26" width="16" height="2.5" rx="1" fill="#2a2d32" />
    </svg>
  );
}

export function ControlPanelIcon({ size = 32 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <defs><linearGradient id="cpB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#c8d6e6" /></linearGradient></defs>
      <rect x="3" y="5" width="26" height="22" rx="2" fill="url(#cpB)" stroke="#6a7f99" />
      <rect x="6" y="9" width="9" height="7" fill="#5aa3e6" /><rect x="17" y="9" width="9" height="7" fill="#7ac943" />
      <rect x="6" y="18" width="9" height="6" fill="#f0a830" /><rect x="17" y="18" width="9" height="6" fill="#e0533b" />
    </svg>
  );
}

export function UserPic({ size = 48, admin = false }: P & { admin?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <defs>
        <linearGradient id={admin ? "upBgA" : "upBgG"} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={admin ? '#ffd27a' : '#9fd8ff'} /><stop offset="1" stopColor={admin ? '#e07d10' : '#2a7fd8'} /></linearGradient>
      </defs>
      <rect width="48" height="48" fill={admin ? "url(#upBgA)" : "url(#upBgG)"} />
      <path d="M0 0h48v18C30 26 14 14 0 22z" fill="#fff" opacity=".22" />
      {/* Pixel-Figur (eigener Avatar) */}
      <rect x="16" y="8" width="16" height="16" fill="#c98e62" />
      <rect x="16" y="8" width="16" height="5" fill="#4a2f1a" />
      <rect x="19" y="16" width="3" height="3" fill="#fff" /><rect x="20" y="17" width="2" height="2" fill="#3b5ec4" />
      <rect x="26" y="16" width="3" height="3" fill="#fff" /><rect x="26" y="17" width="2" height="2" fill="#3b5ec4" />
      <rect x="21" y="21" width="6" height="2" fill="#8a5a3a" />
      <rect x="13" y="26" width="22" height="22" fill={admin ? '#c0392b' : '#3fa7b8'} />
      <rect x="21" y="26" width="6" height="5" fill="#c98e62" />
    </svg>
  );
}

export function FolderIcon({ size = 16 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16">
      <path d="M1 3.5h5l1.5 1.5H15v8.5H1z" fill="#e9c35f" stroke="#b08a2e" strokeWidth=".8" />
      <path d="M1 6h14v7.5H1z" fill="#f7d978" />
    </svg>
  );
}

export function DriveIcon({ size = 32, kind = 'hdd' }: P & { kind?: 'hdd' | 'dvd' }) {
  if (kind === 'dvd') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32">
        <rect x="3" y="10" width="26" height="12" rx="2" fill="#d8dde3" stroke="#7c8794" />
        <circle cx="16" cy="16" r="9" fill="#e9eef5" stroke="#9aa6b4" /><circle cx="16" cy="16" r="2.5" fill="#fff" stroke="#9aa6b4" />
        <path d="M9 12a9 9 0 0 1 9-4" stroke="#b3d9ff" strokeWidth="2" fill="none" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <defs><linearGradient id="hddG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f2f4f7" /><stop offset="1" stopColor="#a9b2bd" /></linearGradient></defs>
      <path d="M4 14l4-6h16l4 6v9H4z" fill="url(#hddG)" stroke="#6e7a88" />
      <rect x="4" y="17" width="24" height="6" fill="#8c97a5" />
      <circle cx="24" cy="20" r="1.3" fill="#5ce35c" />
      <rect x="6" y="9.5" width="7" height="3" fill="#2a7fd8" opacity=".55" />
    </svg>
  );
}

export function NetworkIcon({ size = 16 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16">
      <rect x="1" y="10" width="2.5" height="5" fill="#fff" /><rect x="4.5" y="7.5" width="2.5" height="7.5" fill="#fff" />
      <rect x="8" y="5" width="2.5" height="10" fill="#fff" /><rect x="11.5" y="2" width="2.5" height="13" fill="#fff" />
    </svg>
  );
}

export function VolumeIcon({ size = 16, muted = false }: P & { muted?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16">
      <path d="M2 6h3l4-3.5v11L5 10H2z" fill="#fff" stroke="#333" strokeWidth=".5" />
      {muted ? (
        <path d="M11 6l4 4M15 6l-4 4" stroke="#e33" strokeWidth="1.6" />
      ) : (
        <>
          <path d="M11 5.5a3.5 3.5 0 0 1 0 5" stroke="#fff" strokeWidth="1.3" fill="none" />
          <path d="M12.5 3.5a6 6 0 0 1 0 9" stroke="#fff" strokeWidth="1.3" fill="none" />
        </>
      )}
    </svg>
  );
}

export function FlagIcon({ size = 16 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16">
      <path d="M3 1.5v13.5" stroke="#fff" strokeWidth="1.3" />
      <path d="M3.5 2.5c3-1.5 5 1.5 9 0v6c-4 1.5-6-1.5-9 0z" fill="#fff" />
    </svg>
  );
}

export function BellIcon({ size = 16, color = '#fff' }: P & { color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16">
      <path d="M8 1.5c-2.6 0-4.3 2-4.3 4.5v3L2.3 11.5h11.4L12.3 9V6c0-2.5-1.7-4.5-4.3-4.5z" fill={color} stroke="rgba(0,0,0,.45)" strokeWidth=".7" />
      <path d="M6.3 12.5a1.8 1.8 0 0 0 3.4 0z" fill={color} stroke="rgba(0,0,0,.45)" strokeWidth=".6" />
    </svg>
  );
}

export function MoonIcon({ size = 16 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16">
      <path d="M10.6 1.8a6.3 6.3 0 1 0 3.6 9.6A5.2 5.2 0 0 1 10.6 1.8z" fill="#fff" stroke="rgba(0,0,0,.45)" strokeWidth=".7" />
    </svg>
  );
}

export function SunIcon({ size = 16 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16">
      <g stroke="#ffe680" strokeWidth="1.4" strokeLinecap="round">
        <path d="M8 .9v2M8 13.1v2M.9 8h2M13.1 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3" />
      </g>
      <circle cx="8" cy="8" r="3.4" fill="#ffd84a" stroke="rgba(0,0,0,.4)" strokeWidth=".7" />
    </svg>
  );
}

export function UpArrowIcon({ size = 16 }: P) {
  return <svg width={size} height={size} viewBox="0 0 16 16"><path d="M4 10l4-4 4 4" stroke="#fff" strokeWidth="1.6" fill="none" /></svg>;
}

export function ShieldIcon({ size = 16 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16">
      <path d="M8 1l6 2.2v4.3c0 3.7-2.6 6.3-6 7.5-3.4-1.2-6-3.8-6-7.5V3.2z" fill="#2a7fd8" />
      <path d="M8 1v14c3.4-1.2 6-3.8 6-7.5V3.2z" fill="#f0b31a" />
      <path d="M2 7.5h12" stroke="#fff" strokeOpacity=".4" />
    </svg>
  );
}

export function GearIcon({ size = 16 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16">
      <path d="M8 2.2l1 .1.4 1.6 1.1.5 1.4-.9 1.4 1.4-.9 1.4.5 1.1 1.6.4v2l-1.6.4-.5 1.1.9 1.4-1.4 1.4-1.4-.9-1.1.5-.4 1.6H7l-.4-1.6-1.1-.5-1.4.9-1.4-1.4.9-1.4-.5-1.1L1.5 9V7l1.6-.4.5-1.1-.9-1.4 1.4-1.4 1.4.9 1.1-.5L7 2.3z" fill="#7d8a99" stroke="#4a5562" strokeWidth=".6" />
      <circle cx="8" cy="8" r="2.2" fill="#e8eef5" stroke="#4a5562" strokeWidth=".6" />
    </svg>
  );
}

export function CartIcon({ size = 16, color = '#1e395b' }: P & { color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16">
      <path d="M1 2h2l1.8 8h7.4L14 4.5H4" fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="6" cy="13" r="1.3" fill={color} /><circle cx="11.5" cy="13" r="1.3" fill={color} />
    </svg>
  );
}

export function SearchIcon({ size = 14 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14">
      <circle cx="5.5" cy="5.5" r="4" fill="none" stroke="#4a5a70" strokeWidth="1.5" />
      <path d="M8.5 8.5l4 4" stroke="#4a5a70" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function PowerIcon({ size = 16, color = '#fff' }: P & { color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16">
      <path d="M5 3.8A5.5 5.5 0 1 0 11 3.8" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 1.5v6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function PackageIcon({ size = 16 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16">
      <path d="M8 1.5l6 3v7l-6 3-6-3v-7z" fill="#d9a55a" stroke="#8a5f22" strokeWidth=".7" />
      <path d="M2 4.5l6 3 6-3M8 7.5v7" stroke="#8a5f22" strokeWidth=".7" fill="none" />
      <path d="M5 3l6 3" stroke="#f5dca8" strokeWidth="1.2" />
    </svg>
  );
}

export function HomeIcon({ size = 16 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16">
      <path d="M2 8l6-5.5L14 8" fill="none" stroke="#b04a2a" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M3.5 7.5V14h9V7.5L8 3.5z" fill="#f2e6c8" stroke="#8a6a3a" strokeWidth=".7" />
      <rect x="6.5" y="9.5" width="3" height="4.5" fill="#7a4a1f" />
    </svg>
  );
}

export function StatusGlyph({ kind, size = 32 }: P & { kind: 'info' | 'warning' | 'error' | 'question' | 'success' }) {
  if (kind === 'warning') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32">
        <defs><linearGradient id="wg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe36a" /><stop offset="1" stopColor="#f2b100" /></linearGradient></defs>
        <path d="M16 2.5L30.5 28.5H1.5z" fill="url(#wg)" stroke="#a87a00" strokeLinejoin="round" />
        <rect x="14.3" y="10" width="3.4" height="10" rx="1.2" fill="#1e1e1e" /><circle cx="16" cy="24" r="1.9" fill="#1e1e1e" />
      </svg>
    );
  }
  const color = kind === 'error' ? ['#ff8a72', '#d0240c'] : kind === 'success' ? ['#9fe47a', '#2f9a16'] : ['#8fd3ff', '#1f6fd0'];
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <defs>
        <radialGradient id={`sg-${kind}`} cx=".4" cy=".3" r=".8"><stop offset="0" stopColor={color[0]} /><stop offset="1" stopColor={color[1]} /></radialGradient>
      </defs>
      <circle cx="16" cy="16" r="14" fill={`url(#sg-${kind})`} stroke="rgba(0,0,0,.35)" />
      <ellipse cx="16" cy="9" rx="9" ry="5" fill="#fff" opacity=".35" />
      {kind === 'error' && <path d="M10.5 10.5l11 11M21.5 10.5l-11 11" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />}
      {kind === 'info' && (<><circle cx="16" cy="9.5" r="2" fill="#fff" /><rect x="14.2" y="13" width="3.6" height="11" rx="1.2" fill="#fff" /></>)}
      {kind === 'question' && <text x="16" y="23" textAnchor="middle" fontSize="18" fontWeight="700" fill="#fff" fontFamily="Segoe UI, Arial">?</text>}
      {kind === 'success' && <path d="M9.5 16.5l4.5 4.5 8.5-9" stroke="#fff" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

/** Kleine Glyphen für die Fensterschaltflächen */
export function CapGlyph({ kind }: { kind: 'min' | 'max' | 'restore' | 'close' }) {
  if (kind === 'min') return <svg width="11" height="10" viewBox="0 0 11 10"><rect x="1.5" y="6" width="8" height="2.5" fill="#fff" stroke="#2b2b2b" strokeWidth=".8" /></svg>;
  if (kind === 'max') return <svg width="11" height="10" viewBox="0 0 11 10"><rect x="1.4" y="1.4" width="8.2" height="7.2" fill="none" stroke="#2b2b2b" strokeWidth="2.6" /><rect x="1.4" y="1.4" width="8.2" height="7.2" fill="none" stroke="#fff" strokeWidth="1.2" /><rect x="1.4" y="1.4" width="8.2" height="2" fill="#fff" /></svg>;
  if (kind === 'restore') return <svg width="12" height="11" viewBox="0 0 12 11"><rect x="4" y="1" width="7" height="6" fill="none" stroke="#2b2b2b" strokeWidth="2.2" /><rect x="4" y="1" width="7" height="6" fill="none" stroke="#fff" strokeWidth="1" /><rect x="1" y="4" width="7" height="6" fill="#5a8fd0" stroke="#2b2b2b" strokeWidth="2.2" /><rect x="1" y="4" width="7" height="6" fill="none" stroke="#fff" strokeWidth="1" /></svg>;
  return <svg width="13" height="11" viewBox="0 0 13 11"><path d="M2.5 1.5l8 8M10.5 1.5l-8 8" stroke="#2b2b2b" strokeWidth="3.4" strokeLinecap="square" /><path d="M2.5 1.5l8 8M10.5 1.5l-8 8" stroke="#fff" strokeWidth="1.8" strokeLinecap="square" /></svg>;
}

export function ArrowGlyph({ dir, size = 12, color = '#fff' }: { dir: 'left' | 'right' | 'down' | 'up'; size?: number; color?: string }) {
  const rot = { left: 180, right: 0, down: 90, up: -90 }[dir];
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" style={{ transform: `rotate(${rot}deg)` }}>
      <path d="M2 6h7M6 2.5L9.5 6 6 9.5" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Chevron({ dir = 'right', size = 8, color = '#333' }: { dir?: 'right' | 'down' | 'left'; size?: number; color?: string }) {
  const rot = dir === 'down' ? 90 : dir === 'left' ? 180 : 0;
  return <svg width={size} height={size} viewBox="0 0 8 8" style={{ transform: `rotate(${rot}deg)` }}><path d="M2 1l4 3-4 3z" fill={color} /></svg>;
}

/** Luna-Symbole für die Fenster-Knöpfe im XP-Theme */
export function XpGlyph({ kind }: { kind: 'min' | 'max' | 'restore' | 'close' }) {
  return (
    <svg className="xp-glyph" width="21" height="21" viewBox="0 0 21 21" aria-hidden="true">
      {kind === 'min' && <rect x="5" y="13" width="7" height="3" fill="#fff" />}
      {kind === 'max' && <path d="M5 5h11v11H5z M6 8v7h9V8z" fill="#fff" fillRule="evenodd" />}
      {kind === 'restore' && <path d="M8 4h9v9h-3v-1h2V7H9v1H8z M4 8h9v9H4z M5 11v5h7v-5z" fill="#fff" fillRule="evenodd" />}
      {kind === 'close' && <path d="M5.5 5.5l10 10M15.5 5.5l-10 10" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />}
    </svg>
  );
}
