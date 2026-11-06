import { useEffect, useMemo, useRef, useState } from 'react';
import { FrameBar } from '../../os/frame';
import type { AppProps } from '../../os/apps';
import { wm } from '../../os/wm';
import { useStore } from '../../lib/store';
import { catalogStore, loadCatalog, useCatalog } from '../../lib/catalog';
import { onAdminEvent } from '../../os/session';
import { StoreIcon, ItemIcon, CartIcon, PackageIcon, SearchIcon, ArrowGlyph, Chevron, HomeIcon, StatusGlyph } from '../../os/icons';
import { HomeView, ProductList, ProductDetail, type SortKey, type ViewMode } from './views';
import { CartView, useCartLines } from './Cart';
import { CheckoutView } from './Checkout';
import { ConfirmationView, TrackView } from './Track';
import type { View } from './common';
import { euro, cls } from '../../lib/format';
import { Spinner } from '../../os/Boot';
import { tr } from '../../lib/i18n';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function StoreApp({ winId, props, nonce }: AppProps) {
  const { data: catalog, error, loading } = useCatalog();
  const [hist, setHist] = useState<View[]>([props.view || { kind: 'home' }]);
  const [pos, setPos] = useState(0);
  const [q, setQ] = useState('');
  const [mode, setMode] = useState<ViewMode>('tiles');
  const [sort, setSort] = useState<SortKey>('name');
  const [navOpen, setNavOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const view = hist[pos];
  const { count, total, valid } = useCartLines(catalog);

  const go = (v: View) => {
    const next = [...hist.slice(0, pos + 1), v].slice(-50);
    setHist(next);
    setPos(next.length - 1);
    setNavOpen(false);
    scrollRef.current?.scrollTo({ top: 0 });
  };

  // Navigation von außen (Startmenü, Hash-Links)
  useEffect(() => {
    if (nonce > 0 && props.view) go(props.view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  useEffect(() => {
    void loadCatalog(true);
    const off = onAdminEvent((ev) => { if (ev === 'catalog.changed') void loadCatalog(true); });
    const t = setInterval(() => void loadCatalog(true), 60_000);
    return () => { off(); clearInterval(t); };
  }, []);

  useEffect(() => { if (view.kind === 'search') setQ(view.q); else if (view.kind !== 'product') setQ(''); }, [view]);

  const category = view.kind === 'category' ? catalog?.categories.find((c) => c.id === view.id) : undefined;
  const product = view.kind === 'product' ? catalog?.products.find((p) => p.id === view.id) : undefined;
  const productCat = product ? catalog?.categories.find((c) => c.id === product.categoryId) : undefined;

  const searchResults = useMemo(() => {
    if (view.kind !== 'search' || !catalog) return [];
    const terms = norm(view.q).split(/\s+/).filter(Boolean);
    return catalog.products.filter((p) => {
      const hay = norm(`${p.name} ${p.description} ${catalog.categories.find((c) => c.id === p.categoryId)?.name ?? ''}`);
      return terms.every((t) => hay.includes(t));
    });
  }, [view, catalog]);

  const crumbs: { label: string; v?: View }[] = [{ label: 'Minecraft Store', v: { kind: 'home' } }];
  let title = 'Minecraft Store';
  switch (view.kind) {
    case 'featured': crumbs.push({ label: tr("Beliebte Items", "Popular items") }); title += tr(" – Beliebte Items", " – Popular items"); break;
    case 'category': crumbs.push({ label: category?.name ?? tr("Kategorie", "Category") }); title += ` – ${category?.name ?? ''}`; break;
    case 'search': crumbs.push({ label: tr(`Suchergebnisse für „${view.q}“`, `Search results for “${view.q}”`) }); title += tr(" – Suche", " – Search"); break;
    case 'product':
      if (productCat) crumbs.push({ label: productCat.name, v: { kind: 'category', id: productCat.id } });
      crumbs.push({ label: product?.name ?? tr("Produkt", "Product") }); title += ` – ${product?.name ?? ''}`; break;
    case 'cart': crumbs.push({ label: tr("Warenkorb", "Cart") }); title += tr(" – Warenkorb", " – Cart"); break;
    case 'checkout': crumbs.push({ label: tr("Warenkorb", "Cart"), v: { kind: 'cart' } }, { label: tr("Kasse", "Checkout") }); title += tr(" – Kasse", " – Checkout"); break;
    case 'confirmation': crumbs.push({ label: tr("Bestellbestätigung", "Order confirmation") }); title += tr(" – Bestellbestätigung", " – Order confirmation"); break;
    case 'track': crumbs.push({ label: tr("Meine Bestellungen", "My orders") }); title += tr(" – Meine Bestellungen", " – My orders"); break;
  }
  useEffect(() => { wm.setTitle(winId, title); }, [winId, title]);

  const listCount =
    view.kind === 'category' ? catalog?.products.filter((p) => p.categoryId === view.id).length
      : view.kind === 'search' ? searchResults.length
        : view.kind === 'featured' ? catalog?.products.filter((p) => p.featured).length
          : view.kind === 'home' ? catalog?.products.length : undefined;
  const showListTools = ['category', 'search', 'featured'].includes(view.kind);

  let body: React.ReactNode;
  if (!catalog) {
    body = error ? (
      <div className="empty-state"><StatusGlyph kind="error" size={40} /><p>{tr("Der Store konnte nicht geladen werden: ", "The store could not be loaded: ")}{error}</p><button className="btn" onClick={() => void loadCatalog(true)}>{tr("Erneut versuchen", "Try again")}</button></div>
    ) : (
      <div className="store-loading"><Spinner dark /><span>{tr("Store wird geladen …", "Loading store …")}</span><div className="progress marquee" style={{ width: 220 }}><div /></div></div>
    );
  } else {
    switch (view.kind) {
      case 'home': body = <HomeView catalog={catalog} go={go} />; break;
      case 'featured':
        body = <ProductList title={tr("Beliebte Items", "Popular items")} subtitle={tr("Die meistbestellten Items unserer Kunden.", "Our customers' most ordered items.")} products={catalog.products.filter((p) => p.featured)} catalog={catalog} go={go} mode={mode} sort={sort} />; break;
      case 'category':
        body = category
          ? <ProductList title={category.name} subtitle={category.description} products={catalog.products.filter((p) => p.categoryId === category.id)} catalog={catalog} go={go} mode={mode} sort={sort} emptyText={tr("In dieser Kategorie gibt es derzeit keine Produkte.", "There are currently no products in this category.")} />
          : <div className="empty-state">{tr("Diese Kategorie existiert nicht mehr.", "This category no longer exists.")}</div>;
        break;
      case 'search':
        body = <ProductList title={tr(`Suchergebnisse für „${view.q}“`, `Search results for “${view.q}”`)} subtitle={tr(`${searchResults.length} Treffer`, `${searchResults.length} results`)} products={searchResults} catalog={catalog} go={go} mode={mode} sort={sort} emptyText={tr("Es wurden keine Produkte gefunden, die mit der Suche übereinstimmen.", "No products match your search.")} />; break;
      case 'product':
        body = product ? <ProductDetail key={product.id} product={product} catalog={catalog} go={go} /> : <div className="empty-state">{tr("Dieses Produkt ist nicht mehr verfügbar.", "This product is no longer available.")}</div>; break;
      case 'cart': body = <CartView catalog={catalog} go={go} winId={winId} />; break;
      case 'checkout': body = <CheckoutView catalog={catalog} go={go} />; break;
      case 'confirmation': body = <ConfirmationView v={view} go={go} />; break;
      case 'track': body = <TrackView key={JSON.stringify(view)} v={view} go={go} />; break;
    }
  }

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) go({ kind: 'search', q: q.trim() });
  };

  return (
    <>
      <FrameBar>
        <div className="nav-bar">
          <div className="nav-arrows">
            <button className="nav-round" disabled={pos === 0} onClick={() => setPos(pos - 1)} title={tr("Zurück", "Back")} aria-label={tr("Zurück", "Back")}><ArrowGlyph dir="left" /></button>
            <button className="nav-round" disabled={pos >= hist.length - 1} onClick={() => setPos(pos + 1)} title={tr("Vor", "Forward")} aria-label={tr("Vor", "Forward")}><ArrowGlyph dir="right" /></button>
          </div>
          <div className="address-bar">
            <span className="ab-ic"><StoreIcon size={16} /></span>
            {crumbs.map((c, i) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                <span className="crumb-sep"><Chevron /></span>
                <span className="crumb" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }} onClick={() => c.v && go(c.v)}>{c.label}</span>
              </span>
            ))}
          </div>
          <form className="search-box" onSubmit={submitSearch}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Store durchsuchen", "Search the store")} aria-label={tr("Store durchsuchen", "Search the store")} />
            <button type="submit" className="sb-ic" style={{ border: 0, background: 'none', padding: 0 }} aria-label={tr("Suchen", "Search")}><SearchIcon /></button>
          </form>
        </div>
      </FrameBar>

      <div className="cmd-bar">
        <button className="cmd-btn mobile-only" onClick={() => setNavOpen(!navOpen)}>{tr("☰ Kategorien", "☰ Categories")}</button>
        <button className={cls('cmd-btn', view.kind === 'home' && 'pressed')} onClick={() => go({ kind: 'home' })}><HomeIcon /> {tr("Startseite", "Home")}</button>
        <button className={cls('cmd-btn', view.kind === 'cart' && 'pressed')} onClick={() => go({ kind: 'cart' })}>
          <CartIcon /> {tr("Warenkorb", "Cart")}{count > 0 && <span className="cart-badge">{valid.length}</span>}
        </button>
        <button className={cls('cmd-btn', view.kind === 'track' && 'pressed')} onClick={() => go({ kind: 'track' })}><PackageIcon /> {tr("Meine Bestellungen", "My orders")}</button>
        <div className="cmd-right">
          {showListTools && (
            <>
              <select className="select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label={tr("Sortieren", "Sort")}>
                <option value="name">{tr("Name (A–Z)", "Name (A–Z)")}</option>
                <option value="price-asc">{tr("Preis aufsteigend", "Price: low to high")}</option>
                <option value="price-desc">{tr("Preis absteigend", "Price: high to low")}</option>
                <option value="category">{tr("Kategorie", "Category")}</option>
              </select>
              <div className="cmd-sep" />
              <button className={cls('cmd-btn', mode === 'tiles' && 'pressed')} onClick={() => setMode('tiles')} title={tr("Große Symbole", "Large icons")}>
                <svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="1" width="5" height="5" fill="#4a7fc0" /><rect x="8" y="1" width="5" height="5" fill="#4a7fc0" /><rect x="1" y="8" width="5" height="5" fill="#4a7fc0" /><rect x="8" y="8" width="5" height="5" fill="#4a7fc0" /></svg>
              </button>
              <button className={cls('cmd-btn', mode === 'details' && 'pressed')} onClick={() => setMode('details')} title="Details">
                <svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="2" width="12" height="2" fill="#4a7fc0" /><rect x="1" y="6" width="12" height="2" fill="#4a7fc0" /><rect x="1" y="10" width="12" height="2" fill="#4a7fc0" /></svg>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="store-body">
        <nav className={cls('nav-pane', navOpen && 'mobile-open')}>
          <div className="nav-group">
            <div className="nav-group-title"><StoreIcon size={16} /> Minecraft Store</div>
            <div className={cls('nav-item', view.kind === 'home' && 'selected')} onClick={() => go({ kind: 'home' })}><span className="ni-ic"><HomeIcon /></span>{tr("Startseite", "Home")}</div>
            <div className={cls('nav-item', view.kind === 'featured' && 'selected')} onClick={() => go({ kind: 'featured' })}><span className="ni-ic"><ItemIcon icon="nether_star" size={16} /></span>{tr("Beliebte Items", "Popular items")}</div>
          </div>
          <div className="nav-group">
            <div className="nav-group-title">{tr("Kategorien", "Categories")}</div>
            {catalog?.categories.map((c) => (
              <div key={c.id} className={cls('nav-item', (view.kind === 'category' && view.id === c.id) || (productCat?.id === c.id) ? 'selected' : '')} onClick={() => go({ kind: 'category', id: c.id })}>
                <span className="ni-ic"><ItemIcon icon={c.icon} size={16} /></span>{c.name}<span className="ni-count">{c.productCount}</span>
              </div>
            ))}
          </div>
          <div className="nav-group">
            <div className="nav-group-title">{tr("Mein Einkauf", "My shopping")}</div>
            <div className={cls('nav-item', view.kind === 'cart' && 'selected')} onClick={() => go({ kind: 'cart' })}><span className="ni-ic"><CartIcon /></span>{tr("Warenkorb", "Cart")}<span className="ni-count">{count > 0 ? valid.length : ''}</span></div>
            <div className={cls('nav-item', view.kind === 'track' && 'selected')} onClick={() => go({ kind: 'track' })}><span className="ni-ic"><PackageIcon /></span>{tr("Meine Bestellungen", "My orders")}</div>
          </div>
        </nav>
        <div className="store-content app-scroll" ref={scrollRef} onClick={() => navOpen && setNavOpen(false)}>
          {body}
        </div>
      </div>

      <div className="status-bar">
        {listCount !== undefined && <span>{listCount} {tr("Elemente", "items")}</span>}
        {loading && catalog && <span><Spinner small dark /></span>}
        <span className="sb-right">
          <CartIcon /> {count > 0 ? tr(`${valid.length} Position(en) · ${euro(total)}`, `${valid.length} item(s) · ${euro(total)}`) : tr("Warenkorb leer", "Cart empty")}
        </span>
      </div>
    </>
  );
}
