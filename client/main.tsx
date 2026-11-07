import { createRoot } from 'react-dom/client';
import { OS } from './os/OS';
import './styles/win7.css';
import './styles/store.css';
import './styles/admin.css';
import './styles/polish.css';
import './styles/dark.css';
import './styles/xp.css';
import './styles/chat.css';

// Kontextmenü des Browsers im gesamten OS unterdrücken (außer in Eingabefeldern)
document.addEventListener('contextmenu', (e) => {
  const t = e.target as HTMLElement;
  if (!t.closest('input, textarea, .selectable')) e.preventDefault();
});

createRoot(document.getElementById('root')!).render(<OS />);
