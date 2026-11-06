import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Category, Product } from '../../../shared/types';
import { adminApi, Dialog } from './common';
import { onAdminEvent } from '../../os/session';
import { ItemIcon, StatusGlyph, SearchIcon } from '../../os/icons';
import { MC_ICON_LIST } from '../../lib/mcIcons';
import { euro, centsToInput, parseEuro, cls } from '../../lib/format';
import { msgbox } from '../../os/wm';
import { ApiError } from '../../lib/api';
import { Spinner } from '../../os/Boot';
import { loadCatalog, pName, unitText } from '../../lib/catalog';
import { tr, getLang } from '../../lib/i18n';

/* ─────────── Icon-Auswahl ─────────── */

function IconPicker({ value, onChange }: { value: string; onChange: (k: string) => void }) {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<'' | 'i' | 'b'>('');
  const query = q.trim().toLowerCase();
  const list = MC_ICON_LIST.filter((e) => (!kind || e.kind === kind) &&
    (!query || e.name.toLowerCase().includes(query) || e.id.includes(query.replace(/\s+/g, '_'))));
  const shown = list.slice(0, 400);
  const current = MC_ICON_LIST.find((e) => e.id === value);
  return (
    <div className="icon-picker">
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <div className="search-box" style={{ flex: 1 }}>
          <input placeholder={tr("Suchen (englischer Name, z. B. diamond, oak, sword …)", "Search (English name, e.g. diamond, oak, sword …)")} value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="sb-ic"><SearchIcon /></span>
        </div>
        <select className="select" value={kind} onChange={(e) => setKind(e.target.value as '' | 'i' | 'b')}>
          <option value="">{tr("Alle (", "All (")}{MC_ICON_LIST.length})</option>
          <option value="i">Items</option>
          <option value="b">{tr("Blöcke", "Blocks")}</option>
        </select>
      </div>
      <div className="muted" style={{ marginBottom: 4 }}>
        {tr("Ausgewählt: ", "Selected: ")}<b style={{ fontWeight: 600 }}>{current?.name ?? value}</b> · {list.length} {tr("Treffer", "results")}{list.length > shown.length ? tr(` (die ersten ${shown.length} werden angezeigt – Suche verfeinern)`, ` (showing the first ${shown.length} – refine your search)`) : ''}
      </div>
      <div className="icon-grid">
        {shown.map((e) => (
          <button type="button" key={e.id} title={`${e.name} (${e.id})`} className={cls('icon-cell', value === e.id && 'selected')} onClick={() => onChange(e.id)}>
            <ItemIcon icon={e.id} size={32} />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─────────── Produktdialog ─────────── */

interface PForm {
  categoryId: number; name: string; description: string; nameEn: string; descriptionEn: string; price: string; unitLabel: string;
  unlimited: boolean; stock: string; minQty: string; maxQty: string; icon: string; imageUrl: string | null; active: boolean; featured: boolean;
}

function toForm(p: Product | null, categories: Category[]): PForm {
  return p ? {
    categoryId: p.categoryId, name: p.name, description: p.description, nameEn: p.nameEn ?? '', descriptionEn: p.descriptionEn ?? '', price: centsToInput(p.priceCents), unitLabel: p.unitLabel,
    unlimited: p.stock === null, stock: p.stock === null ? '' : String(p.stock), minQty: String(p.minQty), maxQty: String(p.maxQty),
    icon: p.icon, imageUrl: p.imageUrl, active: p.active, featured: p.featured,
  } : {
    categoryId: categories[0]?.id ?? 0, name: '', description: '', nameEn: '', descriptionEn: '', price: '100', unitLabel: '1 Stack (64×)', unlimited: true, stock: '',
    minQty: '1', maxQty: '64', icon: 'chest', imageUrl: null, active: true, featured: false,
  };
}

function ProductDialog({ product, categories, onClose, onSaved }: { product: Product | null; categories: Category[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<PForm>(() => toForm(product, categories));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<'general' | 'en' | 'image'>('general');
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof PForm>(k: K, v: PForm[K]) => setF((x) => ({ ...x, [k]: v }));

  const upload = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) { setErr(tr("Das Bild ist größer als 2 MB.", "The image is larger than 2 MB.")); return; }
    setUploading(true); setErr(null);
    try {
      const dataUrl = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(file); });
      const r = await adminApi<{ url: string }>('POST', '/api/admin/upload', { dataUrl });
      set('imageUrl', r.url);
    } catch (e) { setErr((e as Error).message); } finally { setUploading(false); }
  };

  const save = async () => {
    const e: Record<string, string> = {};
    const priceCents = parseEuro(f.price);
    if (priceCents === null) e.priceCents = tr("Ungültiger Preis (z. B. 250 oder 2.50).", "Invalid price (e.g. 250 or 2.50).");
    if (f.name.trim().length < 2) e.name = tr("Name zu kurz.", "Name too short.");
    const minQty = Number(f.minQty), maxQty = Number(f.maxQty);
    if (!Number.isInteger(minQty) || minQty < 1) e.minQty = tr("Mindestens 1.", "At least 1.");
    if (!Number.isInteger(maxQty) || maxQty < minQty) e.maxQty = tr("Muss ≥ Mindestmenge sein.", "Must be ≥ minimum quantity.");
    const stock = f.unlimited ? null : Number(f.stock);
    if (!f.unlimited && (!Number.isInteger(stock) || (stock as number) < 0)) e.stock = tr("Ganze Zahl ≥ 0.", "Whole number ≥ 0.");
    setErrors(e);
    if (Object.keys(e).length) { setTab('general'); return; }
    setBusy(true); setErr(null);
    const body = {
      categoryId: Number(f.categoryId), name: f.name.trim(), description: f.description.trim(), nameEn: f.nameEn.trim() || null, descriptionEn: f.descriptionEn.trim() || null, priceCents, unitLabel: f.unitLabel.trim(),
      stock, minQty, maxQty, icon: f.icon, imageUrl: f.imageUrl, active: f.active, featured: f.featured,
    };
    try {
      if (product) await adminApi('PUT', `/api/admin/products/${product.id}`, body);
      else await adminApi('POST', '/api/admin/products', body);
      onSaved();
    } catch (ex) {
      const a = ex as ApiError;
      if (a.fields) setErrors(a.fields);
      setErr(a.message);
    } finally { setBusy(false); }
  };

  return (
    <Dialog
      title={product ? tr(`Produkt bearbeiten – ${product.name}`, `Edit product – ${product.name}`) : tr("Neues Produkt", "New product")}
      onClose={onClose}
      width={640}
      footer={<>
        {err && <span className="df-left err-text">{err}</span>}
        <button className="btn default" onClick={save} disabled={busy}>{busy ? <Spinner small dark /> : 'OK'}</button>
        <button className="btn" onClick={onClose}>{tr("Abbrechen", "Cancel")}</button>
      </>}
    >
      <div className="tabs" style={{ marginBottom: 12 }}>
        <button className={cls('tab', tab === 'general' && 'active')} onClick={() => setTab('general')}>{tr("Allgemein", "General")}</button>
        <button className={cls('tab', tab === 'en' && 'active')} onClick={() => setTab('en')}>{tr('Englisch', 'English')}</button>
        <button className={cls('tab', tab === 'image' && 'active')} onClick={() => setTab('image')}>{tr("Produktbild", "Product image")}</button>
      </div>
      {tab === 'general' ? (
        <div className="pform">
          <div className="pform-preview">
            <div className="mc-slot" style={{ width: 84, height: 84 }}><ItemIcon icon={f.icon} imageUrl={f.imageUrl} size={64} /></div>
            <button className="link" onClick={() => setTab('image')}>{tr("Bild ändern…", "Change image…")}</button>
          </div>
          <div className="pform-fields">
            <div className="field"><label className="req">{tr('Name (Deutsch)', 'Name (German)')}</label><input className={cls('input', errors.name && 'invalid')} value={f.name} maxLength={80} onChange={(e) => set('name', e.target.value)} />{errors.name && <span className="ferr">{errors.name}</span>}</div>
            <div className="pform-row">
              <div className="field"><label>{tr("Kategorie", "Category")}</label>
                <select className="select" value={f.categoryId} onChange={(e) => set('categoryId', Number(e.target.value))}>
                  {categories.map((c) => <option key={c.id} value={c.id}>{pName(c)}{!c.active ? tr(' (inaktiv)', ' (inactive)') : ''}</option>)}
                </select>
              </div>
              <div className="field"><label className="req">{tr("Preis ($ Ingame)", "Price ($ in-game)")}</label><input className={cls('input', errors.priceCents && 'invalid')} value={f.price} onChange={(e) => set('price', e.target.value)} style={{ width: 100 }} />{errors.priceCents && <span className="ferr">{errors.priceCents}</span>}</div>
              <div className="field"><label className="req">{tr("Einheit", "Unit")}</label>
                <input className="input" list="unit-list" value={f.unitLabel} maxLength={40} onChange={(e) => set('unitLabel', e.target.value)} />
                <datalist id="unit-list"><option value="1 Stück" /><option value="1 Stack (64×)" /><option value="1 Stack (16×)" /><option value="1 Shulker-Kiste (1728×)" /></datalist>
              </div>
            </div>
            <div className="field"><label>{tr('Beschreibung (Deutsch)', 'Description (German)')}</label><textarea className="textarea" rows={3} maxLength={1000} value={f.description} onChange={(e) => set('description', e.target.value)} /></div>
            <div className="pform-row">
              <div className="field"><label>{tr("Mindestmenge", "Minimum quantity")}</label><input className={cls('input', errors.minQty && 'invalid')} value={f.minQty} onChange={(e) => set('minQty', e.target.value.replace(/\D/g, ''))} style={{ width: 80 }} />{errors.minQty && <span className="ferr">{errors.minQty}</span>}</div>
              <div className="field"><label>{tr("Höchstmenge", "Maximum quantity")}</label><input className={cls('input', errors.maxQty && 'invalid')} value={f.maxQty} onChange={(e) => set('maxQty', e.target.value.replace(/\D/g, ''))} style={{ width: 80 }} />{errors.maxQty && <span className="ferr">{errors.maxQty}</span>}</div>
              <div className="field"><label>{tr("Verfügbare Menge", "Available quantity")}</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input className={cls('input', errors.stock && 'invalid')} disabled={f.unlimited} value={f.stock} onChange={(e) => set('stock', e.target.value.replace(/\D/g, ''))} style={{ width: 80 }} />
                  <label className="check"><input type="checkbox" checked={f.unlimited} onChange={() => set('unlimited', !f.unlimited)} /> {tr("unbegrenzt (wird gefarmt)", "unlimited (farmed to order)")}</label>
                </div>
                {errors.stock && <span className="ferr">{errors.stock}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 18 }}>
              <label className="check"><input type="checkbox" checked={f.active} onChange={() => set('active', !f.active)} /> {tr("Aktiv (im Store sichtbar)", "Active (visible in the store)")}</label>
              <label className="check"><input type="checkbox" checked={f.featured} onChange={() => set('featured', !f.featured)} /> {tr("Als „Beliebt“ hervorheben", "Highlight as “Popular”")}</label>
            </div>
          </div>
        </div>
      ) : tab === 'en' ? (
        <div className="pform-fields">
          <p className="muted" style={{ marginTop: 0 }}>{tr('Diese Texte sieht, wer MineOS auf Englisch nutzt. Leer lassen = der deutsche Text wird angezeigt.', 'These texts are shown to people using MineOS in English. Leave empty to show the German text.')}</p>
          <div className="field"><label>{tr('Name (Englisch)', 'Name (English)')}</label><input className={cls('input', errors.nameEn && 'invalid')} value={f.nameEn} maxLength={80} placeholder={f.name} onChange={(e) => set('nameEn', e.target.value)} />{errors.nameEn && <span className="ferr">{errors.nameEn}</span>}</div>
          <div className="field"><label>{tr('Beschreibung (Englisch)', 'Description (English)')}</label><textarea className="textarea" rows={5} maxLength={1000} value={f.descriptionEn} placeholder={f.description} onChange={(e) => set('descriptionEn', e.target.value)} /></div>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
            <div className="mc-slot" style={{ width: 70, height: 70 }}><ItemIcon icon={f.icon} imageUrl={f.imageUrl} size={52} /></div>
            <div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn" onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? <Spinner small dark /> : tr("Eigenes Bild hochladen…", "Upload your own image…")}</button>
                {f.imageUrl && <button className="btn" onClick={() => set('imageUrl', null)}>{tr("Eigenes Bild entfernen", "Remove own image")}</button>}
              </div>
              <div className="muted" style={{ marginTop: 4 }}>{tr("PNG, JPG, GIF oder WEBP, max. 2 MB. Ohne eigenes Bild wird die gewählte Minecraft-Textur verwendet.", "PNG, JPG, GIF or WEBP, max. 2 MB. Without your own image, the selected Minecraft texture is used.")}</div>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); e.target.value = ''; }} />
            </div>
          </div>
          <IconPicker value={f.icon} onChange={(k) => set('icon', k)} />
        </div>
      )}
    </Dialog>
  );
}

/* ─────────── Produktverwaltung ─────────── */

function InlinePrice({ p, onSaved }: { p: Product; onSaved: (p: Product) => void }) {
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(centsToInput(p.priceCents));
  const [bad, setBad] = useState(false);
  const commit = async () => {
    const c = parseEuro(v);
    if (c === null) { setBad(true); return; }
    setEdit(false);
    if (c === p.priceCents) return;
    try { onSaved(await adminApi<Product>('PATCH', `/api/admin/products/${p.id}`, { priceCents: c })); } catch (e) { void msgbox({ title: tr("Fehler", "Error"), text: (e as Error).message, icon: 'error' }); }
  };
  if (!edit) return <button className="price-edit" title={tr("Klicken zum Ändern", "Click to change")} onClick={() => { setV(centsToInput(p.priceCents)); setEdit(true); setBad(false); }}>{euro(p.priceCents)}</button>;
  return (
    <input className={cls('input', bad && 'invalid')} autoFocus value={v} style={{ width: 100, textAlign: 'right' }}
      onChange={(e) => { setV(e.target.value); setBad(false); }} onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') void commit(); if (e.key === 'Escape') setEdit(false); }} />
  );
}

export function ProductsPage({ winId }: { winId: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState(0);
  const [q, setQ] = useState('');
  const [onlyInactive, setOnlyInactive] = useState(false);
  const [dialog, setDialog] = useState<null | { product: Product | null }>(null);

  const load = useCallback(async () => {
    const [p, c] = await Promise.all([adminApi<Product[]>('GET', '/api/admin/products'), adminApi<Category[]>('GET', '/api/admin/categories')]);
    setProducts(p); setCategories(c); setLoading(false);
  }, []);
  useEffect(() => { void load(); return onAdminEvent((ev) => { if (ev === 'catalog.changed') void load(); }); }, [load]);

  const patch = async (p: Product, body: Partial<Product>) => {
    try {
      const r = await adminApi<Product>('PATCH', `/api/admin/products/${p.id}`, body);
      setProducts((l) => l.map((x) => (x.id === r.id ? r : x)));
      void loadCatalog(true);
    } catch (e) { void msgbox({ title: tr("Fehler", "Error"), text: (e as Error).message, icon: 'error', parentId: winId }); }
  };

  const remove = async (p: Product) => {
    const a = await msgbox({ title: tr("Produkt löschen", "Delete product"), heading: tr(`„${p.name}“ löschen?`, `Delete “${p.name}”?`), text: tr("Das Produkt wird endgültig entfernt. Bestehende Bestellungen behalten ihre Angaben.\nTipp: Du kannst Produkte auch nur deaktivieren.", "The product will be removed permanently. Existing orders keep their details.\nTip: You can also just deactivate products."), icon: 'warning', buttons: [tr("Löschen", "Delete"), tr("Abbrechen", "Cancel")], defaultButton: 1, parentId: winId });
    if (a !== tr('Löschen', 'Delete')) return;
    try { await adminApi('DELETE', `/api/admin/products/${p.id}`); setProducts((l) => l.filter((x) => x.id !== p.id)); void loadCatalog(true); }
    catch (e) { void msgbox({ title: tr("Fehler", "Error"), text: (e as Error).message, icon: 'error', parentId: winId }); }
  };

  const visible = useMemo(() => products.filter((p) =>
    (!catFilter || p.categoryId === catFilter) && (!onlyInactive || !p.active) && (!q || pName(p).toLowerCase().includes(q.toLowerCase()))), [products, catFilter, q, onlyInactive]);

  return (
    <div className="admin-page">
      <div className="page-toolbar">
        <button className="btn" onClick={() => setDialog({ product: null })}>{tr("＋ Neues Produkt", "＋ New product")}</button>
        <select className="select" value={catFilter} onChange={(e) => setCatFilter(Number(e.target.value))}>
          <option value={0}>{tr("Alle Kategorien", "All categories")}</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{pName(c)}</option>)}
        </select>
        <label className="check"><input type="checkbox" checked={onlyInactive} onChange={() => setOnlyInactive(!onlyInactive)} /> {tr("nur deaktivierte", "deactivated only")}</label>
        <div className="search-box" style={{ width: 200, marginLeft: 'auto' }}><input placeholder={tr("Produkt suchen", "Search products")} value={q} onChange={(e) => setQ(e.target.value)} /><span className="sb-ic"><SearchIcon /></span></div>
      </div>
      <div className="app-scroll">
        {loading ? <div className="empty-state"><Spinner dark /></div> : (
          <table className="list-table">
            <thead><tr><th>{tr("Produkt", "Product")}</th><th>{tr("Kategorie", "Category")}</th><th>{tr("Einheit", "Unit")}</th><th className="num">{tr("Preis", "Price")}</th><th className="num">{tr("Bestand", "Stock")}</th><th>{tr("Menge", "Quantity")}</th><th>{tr("Aktiv", "Active")}</th><th>{tr("Beliebt", "Popular")}</th><th /></tr></thead>
            <tbody>
              {visible.map((p) => (
                <tr key={p.id} className={cls(!p.active && 'inactive-row')} onDoubleClick={() => setDialog({ product: p })}>
                  <td><span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ItemIcon icon={p.icon} imageUrl={p.imageUrl} size={24} />{pName(p)}</span></td>
                  <td className="muted">{(() => { const c = categories.find((x) => x.id === p.categoryId); return c ? pName(c) : ''; })()}</td>
                  <td>{unitText(p.unitLabel)}</td>
                  <td className="num"><InlinePrice p={p} onSaved={(r) => { setProducts((l) => l.map((x) => (x.id === r.id ? r : x))); void loadCatalog(true); }} /></td>
                  <td className="num">{p.stock === null ? <span className="muted">∞</span> : p.stock}</td>
                  <td className="muted">{p.minQty}–{p.maxQty}</td>
                  <td><label className="check"><input type="checkbox" checked={p.active} onChange={() => patch(p, { active: !p.active })} aria-label={tr("Aktiv", "Active")} /></label></td>
                  <td>{p.featured ? '★' : ''}</td>
                  <td className="num">
                    <button className="cmd-btn" onClick={() => setDialog({ product: p })}>{tr("Bearbeiten", "Edit")}</button>
                    <button className="cmd-btn" onClick={() => remove(p)} style={{ color: '#c0392b' }}>{tr("Löschen", "Delete")}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="status-bar"><span>{visible.length} {tr("von ", "of ")}{products.length} {tr("Produkten", "products")}</span><span className="sb-right muted">{tr("Tipp: Auf einen Preis klicken, um ihn direkt zu ändern.", "Tip: Click a price to change it directly.")}</span></div>
      {dialog && <ProductDialog product={dialog.product} categories={categories} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); void load(); void loadCatalog(true); }} />}
    </div>
  );
}

/* ─────────── Kategorienverwaltung ─────────── */

function CategoryDialog({ cat, onClose, onSaved, nextSort }: { cat: Category | null; onClose: () => void; onSaved: () => void; nextSort: number }) {
  const [name, setName] = useState(cat?.name ?? '');
  const [slug, setSlug] = useState(cat?.slug ?? '');
  const [description, setDescription] = useState(cat?.description ?? '');
  const [nameEn, setNameEn] = useState(cat?.nameEn ?? '');
  const [descriptionEn, setDescriptionEn] = useState(cat?.descriptionEn ?? '');
  const [icon, setIcon] = useState(cat?.icon ?? 'chest');
  const [sortOrder, setSortOrder] = useState(String(cat?.sortOrder ?? nextSort));
  const [active, setActive] = useState(cat?.active ?? true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true); setErr(null);
    const body = { name: name.trim(), slug: slug.trim() || undefined, description: description.trim(), nameEn: nameEn.trim() || null, descriptionEn: descriptionEn.trim() || null, icon, sortOrder: Number(sortOrder) || 0, active };
    try {
      if (cat) await adminApi('PUT', `/api/admin/categories/${cat.id}`, body);
      else await adminApi('POST', '/api/admin/categories', body);
      onSaved();
    } catch (e) {
      const a = e as ApiError;
      setErr(a.fields ? Object.values(a.fields).join(' ') : a.message);
    } finally { setBusy(false); }
  };
  return (
    <Dialog title={cat ? tr(`Kategorie bearbeiten – ${cat.name}`, `Edit category – ${cat.name}`) : tr("Neue Kategorie", "New category")} onClose={onClose} width={560}
      footer={<>{err && <span className="df-left err-text">{err}</span>}<button className="btn default" onClick={save} disabled={busy || name.trim().length < 2}>OK</button><button className="btn" onClick={onClose}>{tr("Abbrechen", "Cancel")}</button></>}>
      <div className="pform-row">
        <div className="field" style={{ flex: 1 }}><label className="req">{tr('Name (Deutsch)', 'Name (German)')}</label><input className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field"><label>{tr("Kurzname (URL)", "Short name (URL)")}</label><input className="input" value={slug} placeholder={tr('automatisch', 'automatic')} onChange={(e) => setSlug(e.target.value)} /></div>
        <div className="field"><label>{tr("Reihenfolge", "Order")}</label><input className="input" style={{ width: 70 }} value={sortOrder} onChange={(e) => setSortOrder(e.target.value.replace(/\D/g, ''))} /></div>
      </div>
      <div className="field"><label>{tr('Beschreibung (Deutsch)', 'Description (German)')}</label><input className="input" value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} /></div>
      <div className="pform-row">
        <div className="field" style={{ flex: 1 }}><label>{tr('Name (Englisch)', 'Name (English)')}</label><input className="input" value={nameEn} maxLength={60} placeholder={name} onChange={(e) => setNameEn(e.target.value)} /></div>
        <div className="field" style={{ flex: 2 }}><label>{tr('Beschreibung (Englisch)', 'Description (English)')}</label><input className="input" value={descriptionEn} maxLength={300} placeholder={description} onChange={(e) => setDescriptionEn(e.target.value)} /></div>
      </div>
      <label className="check" style={{ marginBottom: 10 }}><input type="checkbox" checked={active} onChange={() => setActive(!active)} /> {tr("Aktiv (im Store sichtbar)", "Active (visible in the store)")}</label>
      <div className="field"><label>{tr("Symbol", "Icon")}</label><IconPicker value={icon} onChange={setIcon} /></div>
    </Dialog>
  );
}

export function CategoriesPage({ winId }: { winId: string }) {
  const [cats, setCats] = useState<Category[]>([]);
  const [dialog, setDialog] = useState<null | { cat: Category | null }>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { setCats(await adminApi<Category[]>('GET', '/api/admin/categories')); setLoading(false); }, []);
  useEffect(() => { void load(); return onAdminEvent((ev) => { if (ev === 'catalog.changed') void load(); }); }, [load]);

  const toggle = async (c: Category) => {
    try {
      await adminApi('PUT', `/api/admin/categories/${c.id}`, { name: c.name, slug: c.slug, description: c.description, nameEn: c.nameEn ?? null, descriptionEn: c.descriptionEn ?? null, icon: c.icon, sortOrder: c.sortOrder, active: !c.active });
      void load(); void loadCatalog(true);
    } catch (e) { void msgbox({ title: tr("Fehler", "Error"), text: (e as Error).message, icon: 'error', parentId: winId }); }
  };
  const remove = async (c: Category) => {
    const a = await msgbox({ title: tr("Kategorie löschen", "Delete category"), heading: tr(`„${c.name}“ löschen?`, `Delete “${c.name}”?`), text: tr("Nur leere Kategorien können gelöscht werden.", "Only empty categories can be deleted."), icon: 'warning', buttons: [tr("Löschen", "Delete"), tr("Abbrechen", "Cancel")], defaultButton: 1, parentId: winId });
    if (a !== tr('Löschen', 'Delete')) return;
    try { await adminApi('DELETE', `/api/admin/categories/${c.id}`); void load(); void loadCatalog(true); }
    catch (e) { void msgbox({ title: tr("Kategorie löschen", "Delete category"), text: (e as Error).message, icon: 'error', parentId: winId }); }
  };

  return (
    <div className="admin-page">
      <div className="page-toolbar"><button className="btn" onClick={() => setDialog({ cat: null })}>{tr("＋ Neue Kategorie", "＋ New category")}</button></div>
      <div className="app-scroll">
        {loading ? <div className="empty-state"><Spinner dark /></div> : (
          <table className="list-table">
            <thead><tr><th>{tr("Kategorie", "Category")}</th><th>{tr("Kurzname", "Short name")}</th><th>{tr("Beschreibung", "Description")}</th><th className="num">{tr("Produkte", "Products")}</th><th className="num">{tr("Reihenfolge", "Order")}</th><th>{tr("Aktiv", "Active")}</th><th /></tr></thead>
            <tbody>
              {cats.map((c) => (
                <tr key={c.id} className={cls(!c.active && 'inactive-row')} onDoubleClick={() => setDialog({ cat: c })}>
                  <td><span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ItemIcon icon={c.icon} size={24} />{pName(c)}</span></td>
                  <td className="kbd muted">{c.slug}</td>
                  <td className="muted" style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }}>{(getLang() === 'en' && c.descriptionEn) || c.description}</td>
                  <td className="num">{c.productCount}</td>
                  <td className="num">{c.sortOrder}</td>
                  <td><label className="check"><input type="checkbox" checked={c.active} onChange={() => toggle(c)} aria-label={tr("Aktiv", "Active")} /></label></td>
                  <td className="num">
                    <button className="cmd-btn" onClick={() => setDialog({ cat: c })}>{tr("Bearbeiten", "Edit")}</button>
                    <button className="cmd-btn" style={{ color: '#c0392b' }} onClick={() => remove(c)}>{tr("Löschen", "Delete")}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && <div className="info-bar blue" style={{ margin: 10 }}><StatusGlyph kind="info" size={16} /> {tr("Deaktivierte Kategorien und ihre Produkte werden im Store ausgeblendet.", "Deactivated categories and their products are hidden in the store.")}</div>}
      </div>
      {dialog && <CategoryDialog cat={dialog.cat} nextSort={(cats[cats.length - 1]?.sortOrder ?? 0) + 10} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); void load(); void loadCatalog(true); }} />}
    </div>
  );
}
