import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface WinCtx { id: string; framebar: HTMLDivElement | null; active: boolean }
export const WindowContext = createContext<WinCtx>({ id: '', framebar: null, active: false });
export const useWindow = () => useContext(WindowContext);

/** Rendert Inhalte auf dem Glas über dem Client-Bereich (z. B. Explorer-Adresszeile). */
export function FrameBar({ children }: { children: ReactNode }) {
  const { framebar } = useWindow();
  return framebar ? createPortal(children, framebar) : null;
}
