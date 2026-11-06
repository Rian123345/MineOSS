import { useEffect } from 'react';
import type { Catalog, Product } from '../../../shared/types';
import { useStore, cartStore, cart } from '../../lib/store';
import { ItemIcon, CartIcon, StatusGlyph } from '../../os/icons';
import { QtySpinner, maxOrderable, type View } from './common';
import { euro } from '../../lib/format';
import { msgbox } from '../../os/wm';
import { tr } from '../../lib/i18n';

export function useCartLines(catalog: Catalog | null) {
  const { lines } = useStore(cartStore);
  const resolved = lines.map((l) => ({ ...l, product: catalog?.products.find((p) => p.id === l.productId) as Product | undefined }));
  const valid = resolved.filter((l) => l.product) as { productId: number; quantity: number; product: Product }[];
  const total = valid.reduce((s, l) => s + l.product.priceCents * l.quantity, 0);
  const count = valid.reduce((s, l) => s + l.quantity, 0);
  return { lines: resolved, valid, total, count, missing: resolved.length - valid.length };
}

export function CartView({ catalog, go, winId }: { catalog: Catalog; go: (v: View) => void; winId: string }) {
  const { lines, valid, total, count, missing } = useCartLines(catalog);

  // Nicht mehr verfügbare Produkte entfernen, Mengen an Grenzen anpassen
  useEffect(() => {
    lines.forEach((l) => {
      if (!l.product) { cart.remove(l.productId); return; }
      const max = maxOrderable(l.product);
      if (max < l.product.minQty) cart.remove(l.productId);
      else if (l.quantity > max) cart.setQty(l.productId, max);
      else if (l.quantity < l.product.minQty) cart.setQty(l.productId, l.product.minQty);
    });
  }, [lines]);

  if (!valid.length) {
    return (
      <div className="empty-state" style={{ paddingTop: 80 }}>
        <div className="es-ic"><CartIcon size={56} color="#8aa0bb" /></div>
        <div className="h-title" style={{ fontSize: 15 }}>{tr("Dein Warenkorb ist leer", "Your cart is empty")}</div>
        <p>{tr("Füge Items aus dem Store hinzu, um eine Bestellung aufzugeben.", "Add items from the store to place an order.")}</p>
        <button className="btn green big" onClick={() => go({ kind: 'home' })}>{tr("Zum Store", "Go to the store")}</button>
      </div>
    );
  }

  return (
    <div className="cart-view">
      <h1 className="h-title">{tr("Warenkorb", "Cart")}</h1>
      {missing > 0 && (
        <div className="info-bar" style={{ marginBottom: 10 }}>
          <StatusGlyph kind="warning" size={16} /> {tr("Einige Produkte sind nicht mehr verfügbar und wurden entfernt.", "Some products are no longer available and were removed.")}</div>
      )}
      <div className="cart-layout">
        <div className="cart-table-wrap">
          <table className="list-table cart-table">
            <thead>
              <tr><th>{tr("Produkt", "Product")}</th><th>{tr("Einheit", "Unit")}</th><th className="num">{tr("Einzelpreis", "Unit price")}</th><th>{tr("Menge", "Quantity")}</th><th className="num">{tr("Summe", "Total")}</th><th /></tr>
            </thead>
            <tbody>
              {valid.map((l) => (
                <tr key={l.productId}>
                  <td>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <ItemIcon icon={l.product.icon} imageUrl={l.product.imageUrl} size={32} />
                      <button className="link" style={{ color: 'var(--text)' }} onClick={() => go({ kind: 'product', id: l.productId })}>{l.product.name}</button>
                    </span>
                  </td>
                  <td>{l.product.unitLabel}</td>
                  <td className="num">{euro(l.product.priceCents)}</td>
                  <td>
                    <QtySpinner value={l.quantity} min={l.product.minQty} max={Math.max(l.product.minQty, maxOrderable(l.product))} onChange={(v) => cart.setQty(l.productId, v)} />
                  </td>
                  <td className="num"><b style={{ fontWeight: 600 }}>{euro(l.product.priceCents * l.quantity)}</b></td>
                  <td>
                    <button className="cmd-btn" title={tr("Entfernen", "Remove")} onClick={() => cart.remove(l.productId)}>
                      <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="#c0392b" strokeWidth="1.8" /></svg> {tr("Entfernen", "Remove")}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="cart-summary">
          <div className="cs-title">{tr("Zusammenfassung", "Summary")}</div>
          <div className="cs-row"><span>{tr("Positionen", "Items")}</span><span>{valid.length}</span></div>
          <div className="cs-row"><span>{tr("Einheiten", "Units")}</span><span>{count}</span></div>
          <div className="cs-row"><span>{tr("Übergabe", "Handover")}</span><span>{tr("persönlich in Minecraft", "in person in Minecraft")}</span></div>
          <div className="cs-total"><span>{tr("Gesamt", "Total")}</span><span>{euro(total)}</span></div>
          <button className="btn green big" style={{ width: '100%' }} onClick={() => go({ kind: 'checkout' })}>{tr("Zur Kasse", "Checkout")}</button>
          <button className="btn" style={{ width: '100%', marginTop: 6 }} onClick={() => go({ kind: 'home' })}>{tr("Weiter einkaufen", "Continue shopping")}</button>
          <button className="link" style={{ marginTop: 10 }} onClick={async () => {
            const a = await msgbox({ title: tr("Warenkorb leeren", "Empty cart"), heading: tr("Warenkorb wirklich leeren?", "Really empty the cart?"), text: tr("Alle Produkte werden aus dem Warenkorb entfernt.", "All products will be removed from the cart."), icon: 'question', buttons: [tr("Ja", "Yes"), tr("Nein", "No")], parentId: winId });
            if (a === tr('Ja', 'Yes')) cart.clear();
          }}>{tr("Warenkorb leeren", "Empty cart")}</button>
        </div>
      </div>
    </div>
  );
}
