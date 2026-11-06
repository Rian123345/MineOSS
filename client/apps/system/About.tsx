import { Emblem } from '../../os/icons';
import { wm } from '../../os/wm';
import type { AppProps } from '../../os/apps';
import { tr } from '../../lib/i18n';

export function AboutApp({ winId }: AppProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="about-banner">
        <Emblem size={64} />
        <div>
          <div className="about-name">MineOS <span>SeñorPollo Shop Order</span></div>
        </div>
      </div>
      <div className="app-scroll" style={{ padding: '14px 22px', lineHeight: '18px' }}>
        <div style={{ borderBottom: '1px solid #d5dfe5', paddingBottom: 10, marginBottom: 10 }}>
          MineOS<br />
          {"Beta 1.0 (Build 7601: Store)"}<br />
          {tr("Ein webbasiertes Betriebssystem mit einer einzigen installierten Anwendung: dem Minecraft Store.", "A web-based operating system with a single installed application: the Minecraft Store.")}</div>
        <p>{tr("So funktioniert der Store:", "How the store works:")}</p>
        <ol style={{ paddingLeft: 18, margin: '4px 0 10px' }}>
          <li>{tr("Öffne den ", "Open the ")}<b>Minecraft Store</b> {tr("auf dem Desktop.", "on the desktop.")}</li>
          <li>{tr("Lege Items in den Warenkorb und schließe die Bestellung ab.", "Add items to your cart and complete the order.")}</li>
          <li>{tr("Bezahlt wird mit Ingame-Geld ($) bei der Übergabe.", "You pay with in-game money ($) at the handover.")}</li>
          <li>{tr("Die Items werden für dich in Minecraft gefarmt und übergeben.", "The items are farmed for you and handed over in Minecraft.")}</li>
          <li>{tr("Unter ", "Under ")}<b>{tr("Meine Bestellungen", "My orders")}</b> {tr("siehst du jederzeit den aktuellen Status.", "you can see the current status at any time.")}</li>
        </ol>
        <p className="muted">{tr("MineOS ist ein unabhängiges Fanprojekt und steht in keiner Verbindung zu Mojang Studios oder Microsoft. „Minecraft“ ist eine Marke von Mojang Synergies AB.", "MineOS is an independent fan project and is not affiliated with Mojang Studios or Microsoft. “Minecraft” is a trademark of Mojang Synergies AB.")}</p>
      </div>
      <div className="dialog-footer"><button className="btn default" onClick={() => wm.close(winId)}>OK</button></div>
    </div>
  );
}
