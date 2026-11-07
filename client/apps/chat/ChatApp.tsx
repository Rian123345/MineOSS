import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { AppProps } from '../../os/apps';
import type { AssistantMessage, AssistantStatus, SupportMessage, SupportThread } from '../../../shared/types';
import { useStore } from '../../lib/store';
import { sessionStore, onAdminEvent, clearChatUnread, refreshChatUnread } from '../../os/session';
import { get, post, patch, ApiError } from '../../lib/api';
import { ItemIcon, UserPic, ShieldIcon, StatusGlyph, ArrowGlyph } from '../../os/icons';
import { Spinner } from '../../os/Boot';
import { cls } from '../../lib/format';
import { tr, useLang, locale } from '../../lib/i18n';
import { playSound } from '../../os/sounds';
import { wm } from '../../os/wm';

/**
 * MineChat – Hilfe-Messenger
 *  • MineBot: KI-Assistent für Minecraft- und Shop-Fragen (Verlauf bleibt im Browser)
 *  • Support-Team: echter Chat mit den Admins (gespeichert auf dem Server)
 *  • Admins sehen zusätzlich alle Anfragen der Spieler und antworten dort
 */

type Contact = { kind: 'bot' } | { kind: 'team' } | { kind: 'thread'; id: number };
interface BotMsg extends AssistantMessage { at: string; error?: boolean }

const BOT_ICON = 'command_block';
const botKey = (userId: number) => `mineos.minebot.${userId}`;

function loadBot(userId: number): BotMsg[] {
  try { return JSON.parse(localStorage.getItem(botKey(userId)) || '[]'); } catch { return []; }
}
function saveBot(userId: number, msgs: BotMsg[]) {
  try { localStorage.setItem(botKey(userId), JSON.stringify(msgs.slice(-60))); } catch { /* voll */ }
}

/** Sehr kleines, sicheres Markdown: **fett**, `code`, Listen und Absätze */
function RichText({ text }: { text: string }) {
  const inline = (s: string, k: string): ReactNode[] => {
    const out: ReactNode[] = [];
    const re = /(\*\*[^*]+\*\*|`[^`]+`|https?:\/\/[^\s)]+)/g;
    let last = 0; let m: RegExpExecArray | null; let i = 0;
    while ((m = re.exec(s))) {
      if (m.index > last) out.push(s.slice(last, m.index));
      const t = m[0];
      if (t.startsWith('**')) out.push(<b key={k + i++}>{t.slice(2, -2)}</b>);
      else if (t.startsWith('`')) out.push(<code key={k + i++} className="kbd">{t.slice(1, -1)}</code>);
      else out.push(<a key={k + i++} href={t} target="_blank" rel="noopener noreferrer">{t}</a>);
      last = m.index + t.length;
    }
    if (last < s.length) out.push(s.slice(last));
    return out;
  };
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const L = list.ordered ? 'ol' : 'ul';
    blocks.push(<L key={'l' + blocks.length}>{list.items.map((it, j) => <li key={j}>{inline(it, `li${blocks.length}-${j}-`)}</li>)}</L>);
    list = null;
  };
  text.split('\n').forEach((line, idx) => {
    const ul = /^\s*[-*•]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (ul || ol) {
      const ordered = !!ol;
      if (!list || list.ordered !== ordered) { flush(); list = { ordered, items: [] }; }
      list.items.push((ul ?? ol)![1]);
    } else {
      flush();
      if (line.trim()) blocks.push(<p key={'p' + idx}>{inline(line.replace(/^#+\s*/, ''), `p${idx}-`)}</p>);
    }
  });
  flush();
  return <>{blocks}</>;
}

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
}
function dayOf(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(); y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return tr('Heute', 'Today');
  if (d.toDateString() === y.toDateString()) return tr('Gestern', 'Yesterday');
  return d.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' });
}

/* ─────────── Eingabefeld ─────────── */

function Composer({ onSend, disabled, placeholder, initial, busy }: { onSend: (text: string) => Promise<boolean> | boolean; disabled?: boolean; placeholder: string; initial?: string; busy?: boolean }) {
  const [text, setText] = useState(initial ?? '');
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (initial !== undefined) setText(initial); }, [initial]);
  useEffect(() => { ref.current?.focus(); }, [placeholder]);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(120, el.scrollHeight)}px`;
  }, [text]);
  const send = async () => {
    const t = text.trim();
    if (!t || disabled || busy) return;
    const ok = await onSend(t);
    if (ok !== false) setText('');
    ref.current?.focus();
  };
  return (
    <div className="mc-composer">
      <textarea
        ref={ref} rows={1} value={text} maxLength={2000} placeholder={placeholder} disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
      />
      {text.length > 1700 && <span className="mc-count">{text.length}/2000</span>}
      <button className="btn default mc-send" onClick={() => void send()} disabled={disabled || busy || !text.trim()} title={tr('Senden (Enter)', 'Send (Enter)')}>
        {busy ? <Spinner small dark /> : <>{tr('Senden', 'Send')} <ArrowGlyph dir="right" size={10} /></>}
      </button>
    </div>
  );
}

/* ─────────── Nachrichtenliste ─────────── */

interface Bubble { key: string | number; mine: boolean; who?: string; avatar?: ReactNode; body: string; at: string; rich?: boolean; system?: boolean; error?: boolean; extra?: ReactNode }

function Messages({ items, typing, empty }: { items: Bubble[]; typing?: ReactNode; empty?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: items.length > 1 ? 'smooth' : 'auto' });
  }, [items.length, typing]);
  let lastDay = '';
  return (
    <div className="mc-messages" ref={ref}>
      {!items.length && empty}
      {items.map((m) => {
        const day = dayOf(m.at);
        const sep = day !== lastDay ? <div className="mc-day"><span>{day}</span></div> : null;
        lastDay = day;
        if (m.system) return <Fragment key={m.key}>{sep}<div className="mc-system">{m.body} · {timeOf(m.at)}</div></Fragment>;
        return (
          <Fragment key={m.key}>
            {sep}
            <div className={cls('mc-row', m.mine ? 'mine' : 'theirs')}>
              {!m.mine && <span className="mc-avatar">{m.avatar}</span>}
              <div className={cls('mc-bubble', m.error && 'error')}>
                {m.who && !m.mine && <div className="mc-who">{m.who}</div>}
                <div className="mc-text">{m.rich ? <RichText text={m.body} /> : m.body}</div>
                <div className="mc-time">{timeOf(m.at)}</div>
                {m.extra}
              </div>
            </div>
          </Fragment>
        );
      })}
      {typing}
    </div>
  );
}

/* ─────────── App ─────────── */

export function ChatApp({ winId, props, nonce }: AppProps) {
  const lang = useLang();
  const session = useStore(sessionStore);
  const user = session.user!;
  const isAdmin = session.isAdmin;
  const [contact, setContact] = useState<Contact>(props.threadId ? { kind: 'thread', id: props.threadId } : props.contact === 'team' ? { kind: 'team' } : { kind: 'bot' });
  const [mobileList, setMobileList] = useState(!props.threadId && !props.contact);
  const [draft, setDraft] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (props.threadId) { setContact({ kind: 'thread', id: props.threadId }); setMobileList(false); }
    else if (props.contact === 'team') { setContact({ kind: 'team' }); setMobileList(false); }
  }, [nonce, props.threadId, props.contact]);

  /* KI-Assistent */
  const [ai, setAi] = useState<AssistantStatus | null>(null);
  const [bot, setBot] = useState<BotMsg[]>(() => loadBot(user.id));
  const [botBusy, setBotBusy] = useState(false);
  useEffect(() => { get<AssistantStatus>('/api/assistant/status').then(setAi).catch(() => setAi({ enabled: false, model: null })); }, []);
  useEffect(() => saveBot(user.id, bot), [bot, user.id]);

  const askBot = useCallback(async (text: string) => {
    const next: BotMsg[] = [...bot.filter((m) => !m.error), { role: 'user', content: text, at: new Date().toISOString() }];
    setBot(next);
    setBotBusy(true);
    try {
      const r = await post<{ reply: string }>('/api/assistant/chat', {
        lang,
        messages: next.slice(-16).map(({ role, content }) => ({ role, content })),
      });
      setBot((b) => [...b, { role: 'assistant', content: r.reply, at: new Date().toISOString() }]);
      playSound('ding');
    } catch (e) {
      setBot((b) => [...b, { role: 'assistant', content: (e as ApiError).message, at: new Date().toISOString(), error: true }]);
    } finally { setBotBusy(false); }
    return true;
  }, [bot, lang]);

  /* Support-Chat des Spielers */
  const [mine, setMine] = useState<{ thread: SupportThread | null; messages: SupportMessage[] } | null>(null);
  const [teamBusy, setTeamBusy] = useState(false);
  const [teamErr, setTeamErr] = useState<string | null>(null);
  const loadMine = useCallback(() => get<{ thread: SupportThread | null; messages: SupportMessage[] }>('/api/support/thread').then((r) => { setMine(r); clearChatUnread(); }).catch((e) => setTeamErr(e.message)), []);
  useEffect(() => { if (contact.kind === 'team') void loadMine(); }, [contact.kind, loadMine]);

  const sendTeam = async (text: string) => {
    setTeamBusy(true); setTeamErr(null);
    try {
      const r = await post<{ thread: SupportThread; message: SupportMessage }>('/api/support/messages', { body: text });
      setMine((m) => { const prev = m?.messages ?? []; return { thread: r.thread, messages: prev.some((x) => x.id === r.message.id) ? prev : [...prev, r.message] }; });
      playSound('click');
      return true;
    } catch (e) { setTeamErr((e as ApiError).message); return false; } finally { setTeamBusy(false); }
  };

  /* Admin: alle Anfragen */
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [open, setOpen] = useState<{ thread: SupportThread; messages: SupportMessage[] } | null>(null);
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminErr, setAdminErr] = useState<string | null>(null);
  const loadThreads = useCallback(() => {
    if (!isAdmin) return;
    void get<{ threads: SupportThread[] }>(`/api/admin/support/threads${filter === 'open' ? '?status=open' : ''}`).then((r) => setThreads(r.threads)).catch(() => {});
  }, [isAdmin, filter]);
  useEffect(() => { loadThreads(); }, [loadThreads]);
  const loadThread = useCallback((id: number) => get<{ thread: SupportThread; messages: SupportMessage[] }>(`/api/admin/support/threads/${id}`).then((r) => {
    setOpen(r); setAdminErr(null);
    setThreads((ts) => ts.map((t) => (t.id === id ? r.thread : t)));
    void refreshChatUnread();
  }).catch((e) => setAdminErr(e.message)), []);
  useEffect(() => { if (contact.kind === 'thread') void loadThread(contact.id); else setOpen(null); }, [contact, loadThread]);

  const sendAdmin = async (text: string) => {
    if (!open) return false;
    setAdminBusy(true); setAdminErr(null);
    try {
      const r = await post<{ thread: SupportThread; message: SupportMessage }>(`/api/admin/support/threads/${open.thread.id}/messages`, { body: text });
      setOpen((o) => (o ? { thread: r.thread, messages: o.messages.some((x) => x.id === r.message.id) ? o.messages : [...o.messages, r.message] } : o));
      setThreads((ts) => [r.thread, ...ts.filter((t) => t.id !== r.thread.id)]);
      playSound('click');
      return true;
    } catch (e) { setAdminErr((e as ApiError).message); return false; } finally { setAdminBusy(false); }
  };
  const toggleStatus = async () => {
    if (!open) return;
    try {
      const r = await patch<{ thread: SupportThread }>(`/api/admin/support/threads/${open.thread.id}`, { status: open.thread.status === 'open' ? 'closed' : 'open' });
      void loadThread(r.thread.id); loadThreads();
    } catch (e) { setAdminErr((e as ApiError).message); }
  };

  /* Live-Updates */
  const contactRef = useRef(contact);
  contactRef.current = contact;
  useEffect(() => onAdminEvent((event, data) => {
    if (event !== 'support.message' && event !== 'support.read') return;
    const c = contactRef.current;
    if (isAdmin) {
      if (event === 'support.message') {
        const t: SupportThread = data.thread;
        setThreads((ts) => {
          const rest = ts.filter((x) => x.id !== t.id);
          return filter === 'open' && t.status === 'closed' ? rest : [t, ...rest];
        });
        if (c.kind === 'thread' && c.id === t.id) {
          setOpen((o) => (o && !o.messages.some((m) => m.id === data.message.id) ? { thread: t, messages: [...o.messages, data.message] } : o));
          if (data.message.sender === 'user' && wm.get(winId)) void loadThread(t.id); // als gelesen markieren
        }
      }
    } else if (event === 'support.message') {
      setMine((m) => (m && !m.messages.some((x) => x.id === data.message.id) ? { ...m, messages: [...m.messages, data.message] } : m));
      if (c.kind === 'team') { void get('/api/support/thread').then(() => clearChatUnread()).catch(() => {}); }
    }
  }), [isAdmin, filter, winId, loadThread]);

  /* Aufbau */
  const pickContact = (c: Contact) => { setContact(c); setMobileList(false); setDraft(undefined); };
  const handOff = (question: string) => { setDraft(question); setContact({ kind: 'team' }); setMobileList(false); };
  const lastUserQuestion = [...bot].reverse().find((m) => m.role === 'user')?.content;

  const botAvatar = <ItemIcon icon={BOT_ICON} size={30} />;
  const teamAvatar = <span className="mc-team-av"><ShieldIcon size={24} /></span>;
  const suggestions = [
    tr('Wie bestelle ich hier?', 'How do I order here?'),
    tr('Was gibt es gerade bei den Daily Quest Items?', 'What is in the Daily Quest Items right now?'),
    tr('Wie baue ich eine effiziente Eisenfarm?', 'How do I build an efficient iron farm?'),
    tr('Welche Verzauberungen sind am besten für ein Schwert?', 'Which enchantments are best for a sword?'),
  ];

  const lastBotIdx = bot.map((m) => m.role).lastIndexOf('assistant');
  const botItems: Bubble[] = bot.map((m, i) => ({
    key: i, mine: m.role === 'user', body: m.content, at: m.at, rich: m.role === 'assistant' && !m.error, error: m.error,
    avatar: botAvatar, who: 'MineBot',
    extra: i === lastBotIdx && !botBusy && lastUserQuestion
      ? <button className="mc-handoff" onClick={() => handOff(lastUserQuestion)}>{tr('Hat nicht geholfen? Frage an das Support-Team schicken', 'Didn\'t help? Send the question to the support team')}</button>
      : undefined,
  }));

  const supportBubbles = (msgs: SupportMessage[], meIsAdmin: boolean): Bubble[] => msgs.map((m) => ({
    key: m.id, mine: meIsAdmin ? m.sender === 'admin' : m.sender === 'user', body: m.body, at: m.createdAt, system: m.sender === 'system',
    who: m.sender === 'admin' ? (meIsAdmin ? m.authorName ?? 'Admin' : `${m.authorName ?? 'Admin'} · Support`) : m.authorName ?? '',
    avatar: m.sender === 'admin' ? teamAvatar : <UserPic size={30} />,
  }));

  const header = (avatar: ReactNode, name: string, status: ReactNode, actions?: ReactNode) => (
    <div className="mc-head">
      <button className="mc-back" onClick={() => setMobileList(true)} aria-label={tr('Zurück', 'Back')}><ArrowGlyph dir="left" size={12} /></button>
      <span className="mc-head-av">{avatar}</span>
      <div className="mc-head-text"><b>{name}</b><span>{status}</span></div>
      {actions}
    </div>
  );

  let pane: ReactNode;
  if (contact.kind === 'bot') {
    pane = (
      <>
        {header(botAvatar, 'MineBot', ai?.enabled ? tr('KI-Assistent · antwortet sofort', 'AI assistant · replies instantly') : tr('KI-Assistent · noch nicht eingerichtet', 'AI assistant · not set up yet'),
          bot.length > 0 && <button className="btn mc-clear" onClick={() => setBot([])}>{tr('Verlauf leeren', 'Clear chat')}</button>)}
        <Messages
          items={botItems}
          typing={botBusy && <div className="mc-row theirs"><span className="mc-avatar">{botAvatar}</span><div className="mc-bubble typing"><i /><i /><i /></div></div>}
          empty={
            <div className="mc-intro">
              <ItemIcon icon={BOT_ICON} size={64} />
              <h2>{tr('Hi, ich bin MineBot!', 'Hi, I\'m MineBot!')}</h2>
              <p>{tr('Frag mich alles über Minecraft – Crafting, Redstone, Farmen, Verzauberungen – oder wie der Shop funktioniert.', 'Ask me anything about Minecraft – crafting, redstone, farms, enchanting – or how the shop works.')}</p>
              {ai && !ai.enabled ? (
                <div className="info-bar" style={{ textAlign: 'left' }}>
                  <StatusGlyph kind="info" size={16} />
                  {isAdmin
                    ? tr(' Der KI-Assistent ist noch nicht eingerichtet. Trag in der Shop-Verwaltung unter „Einstellungen“ einen Claude-API-Schlüssel ein.', ' The AI assistant isn\'t set up yet. Add a Claude API key in Shop Management under “Settings”.')
                    : tr(' Der KI-Assistent ist noch nicht eingeschaltet. Schreib solange dem Support-Team.', ' The AI assistant isn\'t switched on yet. Write to the support team in the meantime.')}
                </div>
              ) : (
                <div className="mc-suggest">{suggestions.map((s) => <button key={s} onClick={() => void askBot(s)} disabled={!ai?.enabled || botBusy}>{s}</button>)}</div>
              )}
              <p className="muted" style={{ fontSize: 11 }}>{tr('MineBot ist eine KI und kann sich irren. Bei Problemen mit Bestellungen hilft dir das Support-Team.', 'MineBot is an AI and can make mistakes. For problems with orders, the support team will help you.')}</p>
            </div>
          }
        />
        <Composer onSend={askBot} busy={botBusy} disabled={!ai?.enabled} placeholder={tr('Frag MineBot etwas über Minecraft …', 'Ask MineBot something about Minecraft …')} />
      </>
    );
  } else if (contact.kind === 'team') {
    pane = (
      <>
        {header(teamAvatar, tr('Support-Team', 'Support team'), tr('Admins · antworten so schnell sie können', 'Admins · reply as soon as they can'))}
        {!mine ? <div className="mc-loading"><Spinner dark /></div> : (
          <Messages
            items={supportBubbles(mine.messages, false)}
            empty={
              <div className="mc-intro">
                <span className="mc-team-av big"><ShieldIcon size={46} /></span>
                <h2>{tr('Wie können wir helfen?', 'How can we help?')}</h2>
                <p>{tr('Schreib uns dein Anliegen – zum Beispiel zu einer Bestellung, zur Bezahlung oder zur Übergabe. Ein Admin antwortet dir hier, und du bekommst eine Benachrichtigung.', 'Tell us what you need – for example about an order, the payment or the handover. An admin will reply here and you\'ll get a notification.')}</p>
                <p className="muted" style={{ fontSize: 11 }}>{tr('Tipp: Nenne gleich deine Bestellnummer (MC-…), dann geht es schneller.', 'Tip: Include your order number (MC-…) so we can help faster.')}</p>
              </div>
            }
          />
        )}
        {teamErr && <div className="mc-error"><StatusGlyph kind="error" size={14} /> {teamErr}</div>}
        <Composer onSend={sendTeam} busy={teamBusy} initial={draft} placeholder={tr('Nachricht an das Support-Team …', 'Message to the support team …')} />
      </>
    );
  } else {
    pane = !open ? <div className="mc-loading">{adminErr ? <span className="err-text">{adminErr}</span> : <Spinner dark />}</div> : (
      <>
        {header(<UserPic size={32} />, open.thread.userName,
          open.thread.status === 'open' ? <span className="mc-status open">{tr('Offen', 'Open')}</span> : <span className="mc-status closed">{tr('Erledigt', 'Resolved')}</span>,
          <button className="btn mc-clear" onClick={toggleStatus}>{open.thread.status === 'open' ? tr('✔ Als erledigt markieren', '✔ Mark as resolved') : tr('Wieder öffnen', 'Reopen')}</button>)}
        <Messages items={supportBubbles(open.messages, true)} />
        {adminErr && <div className="mc-error"><StatusGlyph kind="error" size={14} /> {adminErr}</div>}
        <Composer onSend={sendAdmin} busy={adminBusy} placeholder={tr(`Antwort an ${open.thread.userName} …`, `Reply to ${open.thread.userName} …`)} />
      </>
    );
  }

  const teamUnread = !isAdmin && contact.kind !== 'team' ? session.chatUnread : 0;
  const preview = (t: SupportThread) => (t.lastSender === 'admin' ? tr('Du: ', 'You: ') : '') + (t.lastMessage ?? '');

  return (
    <div className={cls('minechat', mobileList ? 'show-list' : 'show-chat')}>
      <aside className="mc-side">
        <div className="mc-side-title">{tr('Kontakte', 'Contacts')}</div>
        <button className={cls('mc-contact', contact.kind === 'bot' && 'active')} onClick={() => pickContact({ kind: 'bot' })}>
          <span className="mc-c-av">{botAvatar}<i className={cls('mc-dot', ai?.enabled ? 'on' : 'off')} /></span>
          <span className="mc-c-text"><b>MineBot</b><small>{tr('KI-Assistent für Minecraft', 'AI assistant for Minecraft')}</small></span>
        </button>
        {!isAdmin && (
          <button className={cls('mc-contact', contact.kind === 'team' && 'active')} onClick={() => pickContact({ kind: 'team' })}>
            <span className="mc-c-av">{teamAvatar}<i className="mc-dot on" /></span>
            <span className="mc-c-text"><b>{tr('Support-Team', 'Support team')}</b><small>{tr('Schreib einem Admin', 'Write to an admin')}</small></span>
            {teamUnread > 0 && <span className="mc-badge">{teamUnread}</span>}
          </button>
        )}
        {isAdmin && (
          <>
            <div className="mc-side-title row">
              <span>{tr('Anfragen der Spieler', 'Player requests')}</span>
              <select className="select" value={filter} onChange={(e) => setFilter(e.target.value as 'open' | 'all')} aria-label={tr('Filter', 'Filter')}>
                <option value="open">{tr('Offen', 'Open')}</option>
                <option value="all">{tr('Alle', 'All')}</option>
              </select>
            </div>
            <div className="mc-threads">
              {!threads.length && <div className="mc-none">{filter === 'open' ? tr('Keine offenen Anfragen. 🎉', 'No open requests. 🎉') : tr('Noch keine Anfragen.', 'No requests yet.')}</div>}
              {threads.map((t) => (
                <button key={t.id} className={cls('mc-contact', contact.kind === 'thread' && contact.id === t.id && 'active', t.status === 'closed' && 'closed')} onClick={() => pickContact({ kind: 'thread', id: t.id })}>
                  <span className="mc-c-av"><UserPic size={30} /></span>
                  <span className="mc-c-text"><b>{t.userName}</b><small>{preview(t)}</small></span>
                  <span className="mc-c-meta">
                    <small>{timeOf(t.lastMessageAt)}</small>
                    {t.adminUnread > 0 && <span className="mc-badge">{t.adminUnread}</span>}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </aside>
      <section className="mc-main">{pane}</section>
    </div>
  );
}
