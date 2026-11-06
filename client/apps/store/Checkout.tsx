import { useEffect, useRef, useState } from 'react';
import type { Catalog, OrderCreated } from '../../../shared/types';
import { EDITION_LABELS, type Edition } from '../../../shared/constants';
import { useCartLines } from './Cart';
import { ItemIcon, StatusGlyph, ArrowGlyph } from '../../os/icons';
import { cart } from '../../lib/store';
import { euro, cls } from '../../lib/format';
import { get, post, ApiError } from '../../lib/api';
import { loadCatalog } from '../../lib/catalog';
import { Spinner } from '../../os/Boot';
import type { View } from './common';
import { tr } from '../../lib/i18n';

interface Form { playerName: string; edition: Edition | ''; discordName: string; deliveryTime: string; notes: string; website: string }

function validate(f: Form, step: number): Record<string, string> {
  const e: Record<string, string> = {};
  if (step >= 0) {
    const name = f.playerName.trim();
    if (!f.edition) e.edition = tr("Bitte wähle deine Minecraft-Version.", "Please choose your Minecraft version.");
    if (!name) e.playerName = tr("Bitte gib deinen Minecraft-Spielernamen ein.", "Please enter your Minecraft player name.");
    else if (f.edition === 'java' && !/^[A-Za-z0-9_]{3,16}$/.test(name)) e.playerName = tr("Java-Namen: 3–16 Zeichen, nur Buchstaben, Ziffern und _.", "Java names: 3–16 characters, only letters, digits and _.");
    else if (f.edition === 'bedrock' && !/^[A-Za-z0-9][A-Za-z0-9 ]{1,14}[A-Za-z0-9]$/.test(name)) e.playerName = tr("Bedrock-Gamertags: 3–16 Zeichen, Buchstaben, Ziffern, Leerzeichen.", "Bedrock gamertags: 3–16 characters, letters, digits, spaces.");
    const d = f.discordName.trim();
    if (d && !/^[A-Za-z0-9_.]{2,32}(#\d{4})?$/.test(d)) e.discordName = tr("Ungültiger Discord-Name (2–32 Zeichen: Buchstaben, Ziffern, _ und .).", "Invalid Discord name (2–32 characters: letters, digits, _ and .).");
  }
  if (step >= 1) {
    if (f.deliveryTime.length > 100) e.deliveryTime = tr("Maximal 100 Zeichen.", "Maximum 100 characters.");
    if (f.notes.length > 1000) e.notes = tr("Maximal 1000 Zeichen.", "Maximum 1000 characters.");
  }
  return e;
}

const STEPS = () => [tr('Spielerdaten', 'Player details'), tr('Übergabe', 'Handover'), tr('Überprüfen', 'Review')];

export function CheckoutView({ catalog, go }: { catalog: Catalog; go: (v: View) => void }) {
  const { valid, total, count } = useCartLines(catalog);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>({ playerName: '', edition: '', discordName: '', deliveryTime: '', notes: '', website: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverErr, setServerErr] = useState<string | null>(null);
  const startedAt = useRef(Date.now());

  // Angaben der letzten Bestellung dieses Kontos vorschlagen
  useEffect(() => {
    get<{ lastDetails: { playerName: string; edition: string; discordName: string } | null }>('/api/me/orders').then((r) => {
      const d = r.lastDetails;
      if (d) setForm((f) => (f.playerName ? f : { ...f, playerName: d.playerName, edition: (d.edition as Edition) || '', discordName: d.discordName || '' }));
    }).catch(() => {});
  }, []);

  if (!valid.length) {
    return (
      <div className="empty-state">
        <p>{tr("Dein Warenkorb ist leer.", "Your cart is empty.")}</p>
        <button className="btn" onClick={() => go({ kind: 'home' })}>{tr("Zum Store", "Go to the store")}</button>
      </div>
    );
  }

  const set = (k: keyof Form, v: string) => {
    const next = { ...form, [k]: v };
    setForm(next);
    if (touched) setErrors(validate(next, step));
  };

  const next = () => {
    const e = validate(form, step);
    setErrors(e);
    setTouched(true);
    if (Object.keys(e).length) return;
    setTouched(false);
    setStep(step + 1);
  };

  const submit = async () => {
    setBusy(true); setServerErr(null);
    try {
      const res = await post<OrderCreated>('/api/orders', {
        items: valid.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        playerName: form.playerName.trim(),
        edition: form.edition,
        discordName: form.discordName.trim() || null,
        deliveryTime: form.deliveryTime.trim() || null,
        notes: form.notes.trim() || null,
        website: form.website,
        formStartedAt: startedAt.current,
      });
      cart.clear();
      void loadCatalog(true);
      go({ kind: 'confirmation', ...res });
    } catch (ex) {
      const err = ex as ApiError;
      if (err.fields) {
        setErrors(err.fields);
        if (err.fields.playerName || err.fields.edition || err.fields.discordName) setStep(0);
      }
      setServerErr(err.message);
      if (err.status === 409) void loadCatalog(true);
    } finally { setBusy(false); }
  };

  const field = (k: keyof Form) => cls(errors[k] && 'invalid');

  return (
    <div className="wizard">
      <div className="wizard-head">
        <h1 className="h-title" style={{ margin: 0 }}>{tr("Bestellung abschließen", "Checkout")}</h1>
        <div className="wizard-steps">
          {STEPS().map((s, i) => (
            <div key={s} className={cls('wz-step', i === step && 'current', i < step && 'done')}>
              <span className="wz-dot">{i < step ? '✔' : i + 1}</span>{s}
            </div>
          ))}
        </div>
      </div>

      <div className="wizard-body">
        {/* Honeypot – für Menschen unsichtbar */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hp-field" value={form.website} onChange={(e) => set('website', e.target.value)} aria-hidden="true" />

        {step === 0 && (
          <div className="wz-page">
            <h2 className="h-sub" style={{ marginTop: 0 }}>{tr("Wer bekommt die Items?", "Who receives the items?")}</h2>
            <p className="muted">{tr("Wir benötigen deinen genauen Spielernamen, damit wir dich in Minecraft finden.", "We need your exact player name so we can find you in Minecraft.")}</p>
            <div className="field">
              <label className="req">{tr("Minecraft-Version", "Minecraft version")}</label>
              <div className="edition-pick">
                {(['java', 'bedrock'] as Edition[]).map((ed) => (
                  <label key={ed} className={cls('edition-opt', form.edition === ed && 'selected')}>
                    <input type="radio" name="edition" checked={form.edition === ed} onChange={() => set('edition', ed)} />
                    <ItemIcon icon={ed === 'java' ? 'grass_block' : 'diamond'} size={32} />
                    <span><b>{EDITION_LABELS[ed]}</b><small className="muted">{ed === 'java' ? tr("PC (Windows, macOS, Linux)", "PC (Windows, macOS, Linux)") : tr("Konsole, Handy, Windows-App", "Console, phone, Windows app")}</small></span>
                  </label>
                ))}
              </div>
              {errors.edition && <span className="ferr">{errors.edition}</span>}
            </div>
            <div className="field" style={{ maxWidth: 340 }}>
              <label htmlFor="pn" className="req">{tr("Minecraft-Spielername", "Minecraft player name")}</label>
              <input id="pn" className={cls('input', field('playerName'))} value={form.playerName} maxLength={16} autoComplete="nickname" placeholder={tr("z. B. Steve_123", "e.g. Steve_123")} onChange={(e) => set('playerName', e.target.value)} />
              {errors.playerName ? <span className="ferr">{errors.playerName}</span> : <span className="hint">{tr("Groß-/Kleinschreibung beachten.", "Case-sensitive.")}</span>}
            </div>
            <div className="field" style={{ maxWidth: 340 }}>
              <label htmlFor="dn">{tr("Discord-Name ", "Discord name ")}<span className="muted">{tr("(optional)", "(optional)")}</span></label>
              <input id="dn" className={cls('input', field('discordName'))} value={form.discordName} maxLength={40} placeholder={tr("z. B. steve.mc", "e.g. steve.mc")} onChange={(e) => set('discordName', e.target.value)} />
              {errors.discordName ? <span className="ferr">{errors.discordName}</span> : <span className="hint">{tr("Damit wir dich für die Übergabe kontaktieren können.", "So we can contact you about the handover.")}</span>}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="wz-page">
            <h2 className="h-sub" style={{ marginTop: 0 }}>{tr("Wann und wie soll übergeben werden?", "When and how should we hand it over?")}</h2>
            <div className="field" style={{ maxWidth: 420 }}>
              <label htmlFor="dt">{tr("Gewünschte Übergabezeit ", "Preferred handover time ")}<span className="muted">{tr("(optional)", "(optional)")}</span></label>
              <input id="dt" className={cls('input', field('deliveryTime'))} value={form.deliveryTime} maxLength={100} placeholder={tr("z. B. Samstag ab 18 Uhr", "e.g. Saturday from 6 pm")} onChange={(e) => set('deliveryTime', e.target.value)} />
              {errors.deliveryTime && <span className="ferr">{errors.deliveryTime}</span>}
            </div>
            <div className="field" style={{ maxWidth: 520 }}>
              <label htmlFor="nt">{tr("Zusätzliche Informationen ", "Additional information ")}<span className="muted">{tr("(optional)", "(optional)")}</span></label>
              <textarea id="nt" className={cls('textarea', field('notes'))} rows={5} value={form.notes} maxLength={1000} placeholder={tr("Server-Adresse, Koordinaten, Wünsche zu Verzauberungen …", "Server address, coordinates, enchantment requests …")} onChange={(e) => set('notes', e.target.value)} />
              <span className="hint">{form.notes.length}{tr("/1000 Zeichen", "/1000 characters")}</span>
              {errors.notes && <span className="ferr">{errors.notes}</span>}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="wz-page">
            <h2 className="h-sub" style={{ marginTop: 0 }}>{tr("Bitte überprüfe deine Bestellung", "Please review your order")}</h2>
            <div className="review-grid">
              <div className="group-box">
                <span className="gb-title">{tr("Bestellte Items", "Ordered items")}</span>
                <table className="review-table">
                  <tbody>
                    {valid.map((l) => (
                      <tr key={l.productId}>
                        <td><ItemIcon icon={l.product.icon} imageUrl={l.product.imageUrl} size={24} /></td>
                        <td>{l.quantity}× {l.product.name}<div className="muted">{l.product.unitLabel} {tr('à', '@')} {euro(l.product.priceCents)}</div></td>
                        <td className="num">{euro(l.product.priceCents * l.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr><td /><td>{tr("Gesamt (", "Total (")}{count} {tr("Einheiten)", "units)")}</td><td className="num"><b>{euro(total)}</b></td></tr>
                  </tfoot>
                </table>
              </div>
              <div className="group-box">
                <span className="gb-title">{tr("Deine Angaben", "Your details")}</span>
                <dl className="review-dl">
                  <dt>{tr("Spielername", "Player name")}</dt><dd>{form.playerName}</dd>
                  <dt>Version</dt><dd>{form.edition && EDITION_LABELS[form.edition]}</dd>
                  <dt>Discord</dt><dd>{form.discordName || '—'}</dd>
                  <dt>{tr("Übergabezeit", "Handover time")}</dt><dd>{form.deliveryTime || '—'}</dd>
                  <dt>{tr("Informationen", "Information")}</dt><dd className="selectable" style={{ whiteSpace: 'pre-wrap' }}>{form.notes || '—'}</dd>
                </dl>
                <button className="link" onClick={() => setStep(0)}>{tr("Angaben ändern", "Change details")}</button>
              </div>
            </div>
            <div className="info-bar blue" style={{ marginTop: 12 }}>
              <StatusGlyph kind="info" size={16} />
              {tr("Bezahlt wird mit Ingame-Geld ($) bei der Übergabe auf dem Server. Den genauen Termin sprechen wir nach Annahme der Bestellung mit dir ab.", "You pay with in-game money ($) at the handover on the server. We'll arrange the exact time with you once the order is accepted.")}</div>
            <label className="check" style={{ marginTop: 12 }}>
              <input type="checkbox" checked={confirmed} onChange={() => setConfirmed(!confirmed)} />
              {tr("Ich habe meine Angaben überprüft und möchte die Bestellung verbindlich absenden.", "I have checked my details and want to place this order.")}</label>
          </div>
        )}

        {serverErr && (
          <div className="info-bar red" style={{ marginTop: 12 }}>
            <StatusGlyph kind="error" size={16} /> {serverErr}
          </div>
        )}
      </div>

      <div className="dialog-footer">
        <div className="df-left muted">{tr("Summe: ", "Total: ")}<b style={{ color: 'var(--text)' }}>{euro(total)}</b> · {valid.length} {tr("Position(en)", "item(s)")}</div>
        {step === 0 ? (
          <button className="btn" onClick={() => go({ kind: 'cart' })}><ArrowGlyph dir="left" color="#333" size={10} /> {tr("Warenkorb", "Cart")}</button>
        ) : (
          <button className="btn" onClick={() => setStep(step - 1)} disabled={busy}><ArrowGlyph dir="left" color="#333" size={10} /> {tr("Zurück", "Back")}</button>
        )}
        {step < 2 ? (
          <button className="btn default" onClick={next}>{tr("Weiter", "Next")}</button>
        ) : (
          <button className="btn green" onClick={submit} disabled={!confirmed || busy}>
            {busy ? <><Spinner small /> {tr("Wird gesendet …", "Sending …")}</> : tr("Bestellung absenden", "Place order")}
          </button>
        )}
      </div>
    </div>
  );
}
