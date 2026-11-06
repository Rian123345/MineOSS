import { useMemo, useState } from 'react';
import type { Catalog, Product } from '../../../shared/types';
import { ItemIcon, CartIcon, StatusGlyph, PackageIcon } from '../../os/icons';
import { Availability, Price, QtySpinner, maxOrderable, type View } from './common';
import { cart } from '../../lib/store';
import { euro, cls } from '../../lib/format';
import { showBalloon, playChime } from '../../os/session';
import { tr, locale } from '../../lib/i18n';

export type SortKey = 'name' | 'price-asc' | 'price-desc' | 'category';
export type ViewMode = 'tiles' | 'details';

export function addToCart(p: Product, qty: number) {
  cart.add(p.id, qty);
  playChime('click');
  showBalloon({ title: tr("Zum Warenkorb hinzugefügt", "Added to cart"), text: `${qty}× ${p.name} (${p.unitLabel}) – ${euro(p.priceCents * qty)}`, icon: 'success' }, 3500);
}

/* ─────────── Startseite ─────────── */

export function HomeView({ catalog, go }: { catalog: Catalog; go: (v: View) => void }) {
  const featured = catalog.products.filter((p) => p.featured).slice(0, 8);
  return (
    <div className="store-home">
      <div className="hero">
        <div className="hero-text">
          <h1>{tr("Willkommen im Minecraft Store", "Welcome to the Minecraft Store")}</h1>
          <p>{tr("Blöcke, Erze, Redstone und seltene Items – bestellt in Sekunden, frisch für dich gefarmt und persönlich in Minecraft übergeben.", "Blocks, ores, redstone and rare items – ordered in seconds, freshly farmed for you and handed over in person in Minecraft.")}</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn green big" onClick={() => go({ kind: 'featured' })}>{tr("Beliebte Items ansehen", "View popular items")}</button>
            <button className="btn big" onClick={() => go({ kind: 'track' })}>{tr("Meine Bestellungen", "My orders")}</button>
          </div>
        </div>
        <div className="hero-items">
          {['diamond', 'grass_block', 'netherite_ingot', 'elytra', 'redstone_dust', 'totem'].map((k, i) => (
            <div key={k} className="hero-slot" style={{ animationDelay: `${i * 0.25}s` }}><ItemIcon icon={k} size={44} /></div>
          ))}
        </div>
      </div>

      <div className="steps-row">
        {[
          ['1', tr("Items auswählen", "Choose items"), tr("Stöbere durch 12 Kategorien und lege Items in den Warenkorb.", "Browse 12 categories and add items to your cart.")],
          ['2', tr("Bestellung abschicken", "Place your order"), tr("Gib deinen Minecraft-Namen an – fertig. Bezahlt wird mit Ingame-Geld bei der Übergabe.", "Enter your Minecraft name – done. You pay with in-game money at the handover.")],
          ['3', tr("Wir farmen", "We farm"), tr("Deine Items werden in Minecraft gesammelt. Den Fortschritt siehst du live.", "Your items are collected in Minecraft. You can watch the progress live.")],
          ['4', tr("Übergabe", "Handover"), tr("Wir treffen uns im Spiel und übergeben dir alles persönlich.", "We meet in the game and hand everything over to you in person.")],
        ].map(([n, t, d]) => (
          <div key={n} className="step-card">
            <div className="step-num">{n}</div>
            <div><b>{t}</b><div className="muted">{d}</div></div>
          </div>
        ))}
      </div>

      <h2 className="section-title">{tr("Beliebte Items", "Popular items")}</h2>
      <div className="product-grid">
        {featured.map((p) => <ProductCard key={p.id} p={p} catalog={catalog} go={go} />)}
      </div>

      <h2 className="section-title">{tr("Kategorien", "Categories")}</h2>
      <div className="category-grid">
        {catalog.categories.map((c) => (
          <button key={c.id} className="category-tile" onClick={() => go({ kind: 'category', id: c.id })}>
            <ItemIcon icon={c.icon} size={40} />
            <div>
              <b>{c.name}</b>
              <div className="muted">{c.productCount} {tr("Produkte", "Products")}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─────────── Produktkarte ─────────── */

export function ProductCard({ p, catalog, go }: { p: Product; catalog: Catalog; go: (v: View) => void }) {
  const max = maxOrderable(p);
  const [qty, setQty] = useState(p.minQty);
  const cat = catalog.categories.find((c) => c.id === p.categoryId);
  const soldOut = max < p.minQty;
  return (
    <div className="product-card" onDoubleClick={() => go({ kind: 'product', id: p.id })}>
      {p.featured && <span className="ribbon">{tr("Beliebt", "Popular")}</span>}
      <button className="pc-slot" onClick={() => go({ kind: 'product', id: p.id })} aria-label={tr(`${p.name} ansehen`, `View ${p.name}`)}>
        <ItemIcon icon={p.icon} imageUrl={p.imageUrl} size={64} />
      </button>
      <div className="pc-body">
        <button className="pc-name" onClick={() => go({ kind: 'product', id: p.id })}>{p.name}</button>
        <div className="pc-cat muted">{cat?.name}</div>
        <Price cents={p.priceCents} unit={p.unitLabel} />
        <Availability p={p} />
      </div>
      <div className="pc-actions" onDoubleClick={(e) => e.stopPropagation()}>
        <QtySpinner value={Math.min(qty, Math.max(max, p.minQty))} min={p.minQty} max={Math.max(p.minQty, max)} onChange={setQty} />
        <button className="btn green" disabled={soldOut} onClick={() => addToCart(p, qty)}>
          <CartIcon size={14} color="#fff" /> {tr("In den Warenkorb", "Add to cart")}</button>
      </div>
    </div>
  );
}

/* ─────────── Produktliste (Kategorie / Suche / Beliebt) ─────────── */

export function ProductList({ products, catalog, go, mode, sort, title, subtitle, emptyText }: {
  products: Product[]; catalog: Catalog; go: (v: View) => void; mode: ViewMode; sort: SortKey;
  title: string; subtitle?: string; emptyText?: string;
}) {
  const sorted = useMemo(() => {
    const arr = [...products];
    if (sort === 'name') arr.sort((a, b) => a.name.localeCompare(b.name, locale()));
    if (sort === 'price-asc') arr.sort((a, b) => a.priceCents - b.priceCents);
    if (sort === 'price-desc') arr.sort((a, b) => b.priceCents - a.priceCents);
    if (sort === 'category') arr.sort((a, b) => a.categoryId - b.categoryId || a.name.localeCompare(b.name, locale()));
    return arr;
  }, [products, sort]);

  return (
    <div className="store-list">
      <div className="list-head">
        <h1 className="h-title">{title}</h1>
        {subtitle && <div className="muted">{subtitle}</div>}
      </div>
      {!sorted.length ? (
        <div className="empty-state">
          <div className="es-ic"><StatusGlyph kind="info" size={40} /></div>
          {emptyText || tr("Keine Produkte gefunden.", "No products found.")}
        </div>
      ) : mode === 'tiles' ? (
        <div className="product-grid">{sorted.map((p) => <ProductCard key={p.id} p={p} catalog={catalog} go={go} />)}</div>
      ) : (
        <DetailsTable products={sorted} catalog={catalog} go={go} />
      )}
    </div>
  );
}

function DetailsRow({ p, catalog, go }: { p: Product; catalog: Catalog; go: (v: View) => void }) {
  const [qty, setQty] = useState(p.minQty);
  const max = maxOrderable(p);
  return (
    <tr onDoubleClick={() => go({ kind: 'product', id: p.id })}>
      <td><span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ItemIcon icon={p.icon} imageUrl={p.imageUrl} size={24} /><button className="link" style={{ color: 'var(--text)' }} onClick={() => go({ kind: 'product', id: p.id })}>{p.name}</button></span></td>
      <td className="muted">{catalog.categories.find((c) => c.id === p.categoryId)?.name}</td>
      <td>{p.unitLabel}</td>
      <td><Availability p={p} /></td>
      <td className="num"><b style={{ fontWeight: 600 }}>{euro(p.priceCents)}</b></td>
      <td onDoubleClick={(e) => e.stopPropagation()}>
        <span style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          <QtySpinner value={qty} min={p.minQty} max={Math.max(p.minQty, max)} onChange={setQty} width={52} />
          <button className="btn" style={{ minWidth: 0 }} disabled={max < p.minQty} onClick={() => addToCart(p, qty)} title={tr("In den Warenkorb", "Add to cart")}><CartIcon size={14} /></button>
        </span>
      </td>
    </tr>
  );
}

function DetailsTable({ products, catalog, go }: { products: Product[]; catalog: Catalog; go: (v: View) => void }) {
  return (
    <table className="list-table">
      <thead>
        <tr><th>Name</th><th>{tr("Kategorie", "Category")}</th><th>{tr("Einheit", "Unit")}</th><th>{tr("Verfügbarkeit", "Availability")}</th><th className="num">{tr("Preis", "Price")}</th><th className="num">{tr("Bestellen", "Order")}</th></tr>
      </thead>
      <tbody>{products.map((p) => <DetailsRow key={p.id} p={p} catalog={catalog} go={go} />)}</tbody>
    </table>
  );
}

/* ─────────── Produktdetails ─────────── */

export function ProductDetail({ product: p, catalog, go }: { product: Product; catalog: Catalog; go: (v: View) => void }) {
  const max = maxOrderable(p);
  const [qty, setQty] = useState(p.minQty);
  const cat = catalog.categories.find((c) => c.id === p.categoryId);
  const related = catalog.products.filter((x) => x.categoryId === p.categoryId && x.id !== p.id).slice(0, 4);
  const quick = [1, 2, 4, 8, 16, 32, 64].filter((n) => n >= p.minQty && n <= max);
  const soldOut = max < p.minQty;
  return (
    <div className="product-detail">
      <div className="pd-main">
        <div className="pd-visual">
          <div className="mc-slot big"><ItemIcon icon={p.icon} imageUrl={p.imageUrl} size={128} /></div>
          <div className="mc-hotbar">
            {[0, 1, 2, 3].map((i) => <div key={i} className="mc-slot small">{i === 0 && <ItemIcon icon={p.icon} imageUrl={p.imageUrl} size={28} />}{i === 0 && <span className="mc-count">{Math.min(qty, 64)}</span>}</div>)}
          </div>
        </div>
        <div className="pd-info">
          <button className="link" onClick={() => cat && go({ kind: 'category', id: cat.id })}>{cat?.name}</button>
          <h1 className="pd-title">{p.name}</h1>
          <div className="pd-price"><Price cents={p.priceCents} unit={p.unitLabel} /></div>
          <Availability p={p} />
          <p className="pd-desc selectable">{p.description}</p>
          <div className="group-box">
            <span className="gb-title">{tr("Bestellen", "Order")}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <label>{tr("Menge:", "Quantity:")}</label>
              <QtySpinner value={qty} min={p.minQty} max={Math.max(p.minQty, max)} onChange={setQty} width={70} />
              <span className="muted">× {p.unitLabel}</span>
            </div>
            {quick.length > 1 && (
              <div className="quick-qty">
                {quick.map((n) => <button key={n} className={cls('cmd-btn', qty === n && 'pressed')} onClick={() => setQty(n)}>{n}×</button>)}
              </div>
            )}
            <div className="pd-total">
              <span>{tr("Zwischensumme:", "Subtotal:")}</span>
              <b>{euro(p.priceCents * qty)}</b>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn green big" disabled={soldOut} onClick={() => addToCart(p, qty)}><CartIcon size={15} color="#fff" /> {tr("In den Warenkorb", "Add to cart")}</button>
              <button className="btn big" disabled={soldOut} onClick={() => { addToCart(p, qty); go({ kind: 'cart' }); }}>{tr("Sofort zur Kasse", "Buy now")}</button>
            </div>
            <div className="muted" style={{ marginTop: 8 }}>{tr("Bestellbar: ", "Orderable: ")}{p.minQty}–{max} {tr("Einheiten pro Bestellung.", "units per order.")}</div>
          </div>
          <div className="pd-facts">
            <div><PackageIcon /> {tr("Persönliche Übergabe in Minecraft", "Personal handover in Minecraft")}</div>
            <div><StatusGlyph kind="success" size={16} /> {tr("Preis wird serverseitig garantiert", "Price guaranteed by the server")}</div>
          </div>
        </div>
      </div>
      {related.length > 0 && (
        <>
          <h2 className="section-title">{tr(`Weitere Produkte aus „${cat?.name}“`, `More products from “${cat?.name}”`)}</h2>
          <div className="product-grid">{related.map((r) => <ProductCard key={r.id} p={r} catalog={catalog} go={go} />)}</div>
        </>
      )}
    </div>
  );
}
