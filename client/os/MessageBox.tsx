import { useEffect, useRef } from 'react';
import { wm } from './wm';
import { StatusGlyph } from './icons';
import type { AppProps } from './apps';
import { tr } from '../lib/i18n';

export function MessageBox({ winId, props }: AppProps) {
  const { text, heading, icon = 'info', buttons = ['OK'], defaultButton = 0, resolve } = props;
  const btnRef = useRef<HTMLButtonElement>(null);
  const done = useRef(false);

  const finish = (answer: string) => {
    if (done.current) return;
    done.current = true;
    resolve?.(answer);
    wm.close(winId);
  };

  useEffect(() => {
    btnRef.current?.focus();
    wm.setProps(winId, { onCloseRequest: () => finish(buttons.includes(tr("Abbrechen", "Cancel")) ? tr("Abbrechen", "Cancel") : buttons[buttons.length - 1]) });
    const onKey = (e: KeyboardEvent) => {
      if (wm.get(winId) && document.activeElement?.closest(`[data-win="${winId}"]`)) {
        if (e.key === 'Escape') finish(buttons.includes(tr("Abbrechen", "Cancel")) ? tr("Abbrechen", "Cancel") : buttons[buttons.length - 1]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="msgbox-body">
        <div className="mb-ic"><StatusGlyph kind={icon} /></div>
        <div className="mb-text">
          {heading && <strong>{heading}</strong>}
          {text}
        </div>
      </div>
      <div className="dialog-footer">
        {buttons.map((b: string, i: number) => (
          <button key={b} ref={i === defaultButton ? btnRef : undefined} className={`btn${i === defaultButton ? ' default' : ''}`} onClick={() => finish(b)}>
            {b}
          </button>
        ))}
      </div>
    </div>
  );
}
