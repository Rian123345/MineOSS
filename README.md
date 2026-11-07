# MineOS – Minecraft Store als Windows‑7‑Betriebssystem

MineOS ist eine vollständige Web-Anwendung, die sich wie ein Windows‑7‑PC anfühlt: Desktop, Aero-Glasfenster, Taskleiste, Startmenü, Kontextmenüs. Die einzige installierte Anwendung ist der **Minecraft Store**, in dem Kunden Items bestellen. Du als Betreiber wirst sofort per **Discord-Webhook** und live in der **Shop-Verwaltung** benachrichtigt.

---

## 🚀 Schnellstart – einfach doppelklicken

**Windows:** Doppelklick auf **`MineOS starten (Windows).bat`**
**Mac:** Rechtsklick auf **`MineOS starten (Mac).command`** → *Öffnen* (beim ersten Mal wegen der Mac-Sicherheitsabfrage)
**Linux:** `bash "MineOS starten (Mac).command"`

Es muss nichts installiert werden. Beim allerersten Start lädt die Startdatei Node.js einmalig herunter (ca. 30 MB, nur in den Ordner `runtime`). Danach öffnet sich MineOS automatisch im Browser.

### Erste Schritte (1 Minute)

1. Im Anmeldebildschirm erscheint **„Neues Konto“**: deinen **Minecraft-Namen** eintragen, Java oder Bedrock wählen und ein **Passwort mit mindestens 8 Zeichen** festlegen.
2. **Das erste Konto, das auf diesem PC erstellt wird, ist automatisch der Administrator.**
3. Danach in der **Shop-Verwaltung → Einstellungen → Discord verbinden** die Webhook-URL einfügen → Speichern (das können nur Admins).

Deine Spieler erstellen ihr Konto genauso selbst („Noch kein Konto? Jetzt Konto erstellen“) und melden sich danach mit Minecraft-Name und Passwort an. Unter **Shop-Verwaltung → Benutzer** kannst du weitere Admins ernennen, Konten sperren oder ein vergessenes Passwort zurücksetzen.

Das schwarze Fenster der Startdatei muss offen bleiben, solange der Shop laufen soll. Alle Daten liegen im Ordner `data`.

> Öffnest du MineOS nicht über `http://localhost:3000`, sondern über eine IP-Adresse oder Domain, brauchst du für das Admin-Konto den **Einrichtungscode** aus dem schwarzen Fenster bzw. aus `data/EINRICHTUNGSCODE.txt` („Ich bin der Betreiber – Einrichtungscode eingeben“).

### Damit Kunden aus dem Internet bestellen können

Solange MineOS nur auf deinem PC läuft, erreichst nur du es (und Geräte in deinem WLAN über `http://<PC-IP>:3000`). Für Kunden aus dem Internet muss MineOS auf einem Server laufen, der immer an ist (z. B. ein kleiner VPS) – am einfachsten mit [Render](#online-stellen-mit-render), sonst siehe [Betrieb auf einem Server](#betrieb-auf-einem-server). Mit HTTPS (z. B. über Caddy) sind die Passwörter beim Anmelden verschlüsselt unterwegs.

### Preise

Alle Preise sind **Ingame-Geld in Dollar ($)**. Bezahlt wird bei der Übergabe auf dem Minecraft-Server. Preise änderst du in der Shop-Verwaltung unter *Produkte* (Preis anklicken, Wert eintippen, Enter). Du kannst `250`, `2500`, `$2,500` oder `2.50` eingeben.

### Hintergrundbild

Das Hintergrundbild liegt in `dist/public/wallpaper.jpg` (Quelle: `client/assets/wallpaper.jpg`) und hat 1920×1080 Pixel. Zum Austauschen einfach die Datei ersetzen (Name `wallpaper.jpg`, am besten 1920×1080 oder größer) und die Seite neu laden. Das mitgelieferte Bild wurde aus einer kleinen Vorlage (516×297) hochgerechnet. Wenn du das Original in voller Größe hast, wird es damit noch schärfer.

### Sprache (Deutsch / Englisch)

MineOS gibt es auf Deutsch und Englisch. Umschalten kannst du an drei Stellen:

- im Anmeldebildschirm unten rechts mit **DE | EN**,
- in der Taskleiste mit dem Sprachsymbol **DE/EN** (wie die Windows-7-Sprachleiste),
- unter *Systemsteuerung → Region und Sprache*.

Die Wahl wird im Browser gespeichert. Beim ersten Besuch übernimmt MineOS die Sprache des Browsers. Produkte und Kategorien haben zusätzlich einen englischen Namen und eine englische Beschreibung. Du trägst sie in der Shop-Verwaltung im Reiter *Englisch* ein. Bleibt das Feld leer, wird der deutsche Text angezeigt. Discord-Nachrichten bleiben auf Deutsch.

### Dunkelmodus

Den Dunkelmodus schaltest du mit dem **Mond-Symbol** in der Taskleiste ein und mit dem Sonnen-Symbol wieder aus. Alternativ geht das unter *Systemsteuerung → Anpassung → Design*. Fensterrahmen bleiben Aero-Glas, nur dunkler, und alle Fensterinhalte werden dunkel. Die Einstellung wird pro Browser gespeichert.

### XP-Theme (Luna)

Unter *Systemsteuerung → Anpassung → Design* kannst du zwischen **Aero** (Windows-7-Stil) und **Luna** (Windows-XP-Stil) wählen. Mit Luna bekommt MineOS:

- den schwarzen Ladebildschirm mit dem wandernden blauen Balken,
- den blauen Anmelde- und „willkommen“-Bildschirm,
- blaue Fenster und die blaue Taskleiste mit grünem Start-Knopf und Schnellstartleiste,
- das zweispaltige Startmenü und die Dialoge „Ausschalten“ und „Abmelden“, bei denen der Desktop grau wird,
- eigene XP-artige Klänge für Hochfahren, Anmelden, Abmelden, Herunterfahren, Hinweise und Fehlermeldungen.

Nur im Luna-Design kannst du zwischen dem **Bliss**-Hintergrund und dem SenorPollo-Bild wechseln. Statt des Windows-Logos zeigt MineOS überall sein eigenes Logo. Den Dunkelmodus gibt es nur im Aero-Design.

**Eigene Klänge:** Die XP-Klänge erzeugt MineOS selbst. Möchtest du andere Sounddateien verwenden, lege sie als MP3, WAV oder OGG in `client/assets/sounds/xp/` und baue neu, z. B. `startup.mp3`, `logon.wav` oder `notify.ogg`. Alle Namen stehen in der Datei `LIESMICH.txt` in diesem Ordner.

Hinweis: Browser spielen Töne erst nach dem ersten Klick oder Tastendruck ab. Wer schon angemeldet ist und die Seite neu lädt, hört den Startklang deshalb nicht.

### Minecraft-Texturen

Alle Items und Blöcke im Shop zeigen die **Original-Texturen** aus dem Minecraft-Resource-Pack (1.21.11): 1254 Icons, davon 716 Items (flach, pixelgenau) und 538 Blöcke (als 3D-Würfel gerendert). Sie liegen gebündelt in `client/mc-textures.json` (eine Datei statt 1254, praktisch für GitHub); beim Build entstehen daraus die Bilder in `dist/public/mc/`. Verzauberte Items wie das Verzauberte Buch oder der Netherstern schimmern lila.

In der Shop-Verwaltung wählst du beim Bearbeiten eines Produkts unter *Produktbild* eines der 1254 Icons aus. Du kannst nach dem englischen Namen suchen (z. B. `diamond`, `oak`, `sword`) und nach Items oder Blöcken filtern. Ein eigenes hochgeladenes Bild hat weiterhin Vorrang.

Die Texturen gehören Mojang/Microsoft. Bei einem neuen Minecraft-Update kannst du sie selbst neu erzeugen. Dafür brauchst du Python 3 und Pillow (`pip install pillow`):

```bash
# Resource-Pack-ZIP entpacken, dann:
python3 scripts/mc-icons.py /pfad/zum/entpackten/pack
npm run build
```

Treppen, Zäune, Wände und ähnliche Sonderformen erzeugt das Skript nicht. Diese Blöcke fehlen deshalb in der Icon-Auswahl.

---

## Inhalt

1. [Funktionen](#funktionen)
2. [Voraussetzungen](#voraussetzungen)
3. [Installation für Entwickler](#installation-für-entwickler-mit-npm)
4. [Discord-Webhook einrichten](#discord-webhook-einrichten)
5. [Online stellen mit Render](#online-stellen-mit-render)
6. [Betrieb auf einem Server](#betrieb-auf-einem-server)
7. [Bedienung](#bedienung)
8. [Sicherheit](#sicherheit)
9. [Projektstruktur](#projektstruktur)
10. [Datensicherung & Updates](#datensicherung--updates)
11. [Häufige Fragen](#häufige-fragen)

---

## Funktionen

**Betriebssystem**
- Startbildschirm, Willkommensbildschirm, Herunterfahren, Neu starten, Sperren
- Desktop mit Symbol-Auswahl (Klick, Auswahlrahmen), Doppelklick zum Öffnen, Rechtsklick-Kontextmenü (Ansicht, Sortieren, Aktualisieren, Anpassen …)
- Aero-Fenster mit echtem Glas-Effekt: verschieben, Größe an allen Kanten ändern, minimieren (Animation zur Taskleiste), maximieren (auch Doppelklick auf die Titelleiste), Aero Snap (an Bildschirmrand ziehen)
- Taskleiste mit angehefteten Programmen, Hot-Tracking-Leuchten, **Live-Vorschau** beim Überfahren, Aero Peek, Sprunglisten (Rechtsklick)
- Infobereich mit Uhr + Kalender, Lautstärke, Netzwerkstatus, Benachrichtigungsglocke, „Desktop anzeigen“
- Startmenü mit Suche (findet auch Produkte), Benutzerbild, „Alle Programme“, Herunterfahren-Menü
- Windows-7-Anmeldebildschirm: Konto mit Minecraft-Name + Passwort, eigenes Server-Hintergrundbild
- Systemsteuerung (Fensterfarbe, Transparenz, Symbolgröße, Uhrzeitformat, Sound), Computer, Benutzerkonten
- Angepasste Darstellung für Smartphones (Fenster automatisch maximiert, Touch-Bedienung)

**Minecraft Store**
- Kategorien „Daily Quest Items“ und „Weekly Quest Items“ plus die automatische Liste „Meist gekaufte Sachen“, Preise in Ingame-Dollar ($)
- Suche, Sortierung, Kachel- und Detailansicht, Produktdetails, Mengenwahl
- Warenkorb (bleibt im Browser gespeichert), Mengen ändern, Positionen entfernen
- Checkout-Assistent: Spielername, Java/Bedrock, Discord (optional), Übergabezeit (optional), Infos (optional), Zusammenfassung vor dem Absenden
- Bestellbestätigung mit Bestellnummer und geheimem Zugriffscode (druckbar)
- Bestellverfolgung mit Fortschrittsbalken, Zeitleiste und Nachrichten vom Shop (aktualisiert sich automatisch)

**Shop-Verwaltung (nur Administrator)**
- Dashboard: Gesamt, neu, offen, in Bearbeitung, abgeschlossen, Umsatz, 14-Tage-Diagramm, letzte Bestellungen, Top-Produkte
- Bestellungen: Filter nach Status, Suche, Detailansicht mit allen Kundendaten, Status ändern (mit Nachricht an den Kunden), interne Notizen, neuen Zugriffscode erzeugen, Löschen
- Produkte: anlegen, bearbeiten, löschen, Preise direkt in der Tabelle ändern, aktivieren/deaktivieren, Lagerbestand, Min./Max.-Menge, Icon wählen oder eigenes Bild hochladen
- Kategorien: anlegen, bearbeiten, sortieren, aktivieren/deaktivieren, löschen
- **Echtzeit**: neue Bestellungen erscheinen sofort (Server-Sent Events) – Glocke, Sprechblase am Infobereich, Signalton und optional Browser-Benachrichtigung
- **Discord**: Embed mit Bestellnummer, Spieler, Items, Mengen, Gesamtpreis, Zeitpunkt und Erwähnung (@here, Rolle oder Benutzer)

---

## Voraussetzungen

- **Node.js 22.13 oder neuer** (empfohlen: Node.js 22 LTS oder 24). Prüfen mit `node -v`.
  Download: https://nodejs.org
- Keine separate Datenbank nötig: MineOS nutzt die in Node.js eingebaute SQLite-Datenbank (`node:sqlite`). Alle Daten liegen in `data/mineos.db`.

---

## Installation für Entwickler (mit npm)

Nur nötig, wenn du den Code verändern willst. Zum Benutzen reicht der Schnellstart oben.

```bash
# 1. Projekt entpacken und in den Ordner wechseln
cd mineos

# 2. Abhängigkeiten installieren
npm install

# 3. Konfiguration anlegen
cp .env.example .env          # Windows: copy .env.example .env
#    → .env öffnen und mindestens DISCORD_WEBHOOK_URL eintragen (siehe unten)

# 4. Starten und im Browser das erste Konto (= Administrator) erstellen

# 5a. Entwicklungsmodus (automatischer Neustart bei Änderungen)
npm run dev

# 5b. ODER Produktionsmodus
npm run build
npm start
```

Danach im Browser öffnen: **http://localhost:3000**

Beim ersten Start werden automatisch alle Tabellen und die Kategorien „Daily Quest Items“ und „Weekly Quest Items“ angelegt (noch ohne Produkte). Produkte legst du in der Shop-Verwaltung unter *Preise & Produkte → Neues Produkt* an.

„Meist gekaufte Sachen“ ist keine normale Kategorie, sondern wird automatisch aus den Bestellungen berechnet: Die 12 am häufigsten bestellten Produkte, stornierte Bestellungen zählen nicht. Solange es noch wenige Bestellungen gibt, wird die Liste mit Produkten aufgefüllt, bei denen du *„Beliebt“* angehakt hast.

**Tests ausführen** (startet einen eigenen Testserver mit temporärer Datenbank und Discord-Attrappe, 69 Prüfungen):

```bash
npm test
```

---

## Discord-Webhook einrichten

**Am einfachsten direkt in MineOS:** Shop-Verwaltung → **Einstellungen → Discord verbinden** → URL einfügen → Speichern. Dort wählst du auch, wer erwähnt wird (@here, niemand, bestimmte Person/Rolle) und ob Statusänderungen gemeldet werden.

1. In Discord: **Servereinstellungen → Integrationen → Webhooks → Neuer Webhook**
2. Kanal auswählen (z. B. `#bestellungen`), Namen vergeben, **Webhook-URL kopieren**
3. In MineOS einfügen – oder alternativ in der `.env` eintragen (hat dann Vorrang):
   ```env
   DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/123456789/AbCdEf...
   DISCORD_MENTION=@here
   ```
   - `DISCORD_MENTION=@here` erwähnt alle Online-Mitglieder des Kanals
   - `DISCORD_MENTION=<@DEINE_BENUTZER_ID>` erwähnt nur dich (Benutzer-ID: Discord → Einstellungen → Erweitert → Entwicklermodus, dann Rechtsklick auf deinen Namen → „ID kopieren“)
   - `DISCORD_MENTION=<@&ROLLEN_ID>` erwähnt eine Rolle
   - leer lassen = keine Erwähnung
4. Optional `DISCORD_NOTIFY_STATUS=true`, wenn auch Statusänderungen gemeldet werden sollen
5. MineOS neu starten
6. Testen: Shop-Verwaltung → **Einstellungen → Testnachricht senden**

Die Webhook-URL bleibt ausschließlich auf dem Server (in der Datenbank bzw. `.env`). Sie wird nie an Kunden ausgeliefert und auch in der Shop-Verwaltung nur maskiert angezeigt.

---

## Online stellen mit Render

Das Projekt enthält eine fertige `render.yaml`. Damit richtet Render alles automatisch ein.

**Kosten:** Du brauchst den Tarif *Starter* (ca. 7 $/Monat) plus 1 GB Festplatte (ca. 0,25 $/Monat). Der kostenlose Tarif funktioniert technisch auch, er hat aber keine Festplatte. Dann gehen **alle Konten, Bestellungen und Preisänderungen bei jedem Neustart verloren**, und kostenlose Dienste schlafen nach 15 Minuten ohne Besucher ein. Für einen echten Shop taugt das nicht.

1. **Code auf GitHub bringen:** Lege auf github.com ein neues Repository an, z. B. `mineos` (privat ist okay).
   - Ohne Programme: *Add file → Upload files* und den **Inhalt** von `mineos-github.zip` hineinziehen (entpackt, alle Ordner und Dateien). Danach *Commit changes* klicken.
   - Oder mit der App *GitHub Desktop*.
   - Die Ordner `dist`, `data`, `node_modules` und `runtime` gehören **nicht** zu GitHub.
2. **Render verbinden:** Melde dich auf render.com an (geht mit dem GitHub-Konto) und wähle *New → Blueprint*. Wähle dein Repository aus, Render findet die `render.yaml`.
3. **Werte eintragen:** Render fragt nach drei Werten:
   - `MINEOS_SETUP_CODE`: ein Code, den du dir ausdenkst (6–40 Zeichen, z. B. `Pollo2026`). Damit legst du gleich dein Admin-Konto an.
   - `PUBLIC_URL` und `DISCORD_WEBHOOK_URL` sind optional und dürfen leer bleiben. Den Webhook kannst du auch später in der Shop-Verwaltung eintragen.
4. **Deploy:** Klicke *Apply*. Der erste Build dauert ein paar Minuten. Danach ist der Shop unter `https://<name>.onrender.com` erreichbar.
5. **Admin werden:** Öffne die Adresse und klicke im Anmeldebildschirm auf *„Ich bin der Betreiber – Einrichtungscode eingeben“*. Gib deinen Code ein und erstelle dann dein Konto. Es wird Administrator.
   - Hast du keinen Code gesetzt, steht er in Render unter *Logs*.

Updates: Lade die geänderten Dateien wieder auf GitHub hoch. Render baut und startet automatisch neu, Datenbank und Uploads auf der Festplatte (`/var/data`) bleiben erhalten. Render macht außerdem jeden Tag eine Sicherung der Festplatte.

Eigene Domain (z. B. `shop.senorpollo.net`): In Render unter *Settings → Custom Domains* eintragen und danach `PUBLIC_URL` auf diese Adresse setzen.

## Betrieb auf einem Server

### Mit PM2 (empfohlen für VPS)

```bash
npm install
npm run build
npm install -g pm2
pm2 start npm --name mineos -- start
pm2 save && pm2 startup
```

### Mit Docker

```bash
cp .env.example .env    # Werte eintragen
docker compose up -d --build
# Admin: im Browser mit dem Einrichtungscode aus  docker compose logs mineos  das erste Konto erstellen
```

Die Datenbank liegt im Docker-Volume `mineos-data`.

### HTTPS über Reverse-Proxy (nginx)

Setze in der `.env`:

```env
PUBLIC_URL=https://shop.deine-domain.de
TRUST_PROXY=true
COOKIE_SECURE=true
HOST=127.0.0.1
```

nginx-Beispiel (wichtig: Pufferung für Echtzeit-Updates abschalten):

```nginx
server {
    server_name shop.deine-domain.de;
    client_max_body_size 4m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
    }

    location /api/admin/events {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_read_timeout 1h;
    }
    # SSL-Zertifikat z. B. mit: certbot --nginx -d shop.deine-domain.de
}
```

Caddy ist noch einfacher: `shop.deine-domain.de { reverse_proxy 127.0.0.1:3000 }` (HTTPS automatisch, SSE funktioniert ohne weitere Einstellungen).

---

## Bedienung

### Für Kunden
1. Doppelklick auf **Minecraft Store** (auf dem Smartphone: antippen)
2. Items auswählen → **In den Warenkorb**
3. **Warenkorb → Zur Kasse** → Angaben ausfüllen → Zusammenfassung prüfen → **Bestellung absenden**
4. Bestellnummer und Zugriffscode notieren (werden zusätzlich im Browser gemerkt)
5. **Bestellung verfolgen** zeigt jederzeit den aktuellen Status

### Für dich als Betreiber
- Mit deinem Minecraft-Namen anmelden – als Admin erscheint **Shop-Verwaltung** im Startmenü und eine **Glocke** im Infobereich
- Neue Bestellungen: Signalton + Sprechblase rechts unten → anklicken öffnet die Bestellung
- Link aus der Discord-Nachricht öffnet die Bestellung direkt in der Shop-Verwaltung
- Status weiterschalten mit den grünen Schnellknöpfen: **Annehmen → Farmen starten → Bereit zur Übergabe → Abschließen**
- Die „Nachricht an den Kunden“ sieht der Kunde in seiner Bestellverfolgung; die „interne Notiz“ nur du
- Preise ändern: **Produkte** → auf einen Preis klicken → neuen Wert eingeben → Enter
- Benutzer verwalten: **Shop-Verwaltung → Benutzer** (Admin ernennen, sperren, Passwort zurücksetzen).
- Eigenes Passwort vergessen? Ein anderer Admin kann es zurücksetzen. Bist du der einzige Admin: MineOS schließen, im MineOS-Ordner eine Eingabeaufforderung öffnen und eingeben
  `node dist/tools.js DeinName --password NeuesPasswort123` (Windows ohne installiertes Node: `runtime\node\node.exe dist\tools.js DeinName --password NeuesPasswort123`).

---

## Sicherheit

| Bereich | Umsetzung |
|---|---|
| Passwörter | mindestens 8 Zeichen, keine Allerwelts-Passwörter; gespeichert nur als scrypt-Hash (N=2¹⁵, r=8, p=1) mit zufälligem Salt |
| Anmeldung | 10 Versuche / 15 min pro IP, zusätzlich Bremse pro Konto, gleiche Antwortzeit bei unbekannten Namen; max. 10 neue Konten pro Stunde und IP |
| Rollen | Kunden sehen nur den Shop und ihre eigenen Bestellungen; Shop-Verwaltung, Discord-Einstellungen und Benutzerverwaltung nur für Admins (serverseitig geprüft) |
| Sitzungen | 256-Bit-Zufallstoken, in der DB nur als SHA-256-Hash, Cookie `HttpOnly` + `SameSite=Strict` (+ `Secure` bei HTTPS), Ablauf nach 12 h, gesperrte Konten werden sofort abgemeldet |
| CSRF | Pflicht-Header `X-Requested-With`, Prüfung des `Origin`-Headers, SameSite-Cookies |
| Bestellungen | Preise, Mengen, Bestand und Summen werden **nur serverseitig** aus der Datenbank berechnet; unbekannte Felder werden abgelehnt (strikte zod-Schemas) |
| Spam-Schutz | Rate-Limit pro IP (Standard: 5 Bestellungen / 10 min), Honeypot-Feld, Mindest-Ausfülldauer, max. 3 unbearbeitete Bestellungen pro Spielername, Obergrenze für Bestellwert |
| Kundendaten | Bestellungen nur mit Bestellnummer **und** Zugriffscode abrufbar (Code wird nur gehasht gespeichert), keine internen Notizen in der Kundenansicht; IP-Adressen werden nur als HMAC-Hash gespeichert |
| Uploads | nur PNG/JPG/GIF/WEBP, Prüfung der Dateisignatur, max. 2 MB, zufällige Dateinamen |
| HTTP-Header | Content-Security-Policy, X-Frame-Options, nosniff, Referrer-Policy |
| Geheimnisse | Webhook-URL nur auf dem Server (Datenbank oder `.env`), in der Oberfläche nur maskiert |

---

## Projektstruktur

```
mineos/
├── render.yaml             Render-Blueprint (Online stellen mit einem Klick)
├── client/                 Frontend (React + TypeScript)
│   ├── os/                 Betriebssystem: Fenster-Manager, Desktop, Taskleiste, Startmenü, Boot …
│   ├── apps/store/         Minecraft Store: Katalog, Warenkorb, Checkout, Bestellverfolgung
│   ├── apps/admin/         Shop-Verwaltung: Dashboard, Bestellungen, Produkte, Kategorien
│   ├── apps/system/        Computer, Systemsteuerung, Benutzerkonten, Info
│   ├── lib/                API-Client, Zustände, Übersetzung (i18n.ts, serverText.ts), Icons, Formatierung
│   └── styles/             Windows-7-Aero-Stylesheets (dark.css = Dunkelmodus)
├── server/                 Backend (Node.js + TypeScript)
│   ├── index.ts            HTTP-Server, Routing, statische Dateien
│   ├── db.ts               SQLite-Schema und Migrationen
│   ├── auth.ts             Passwörter, Sitzungen, Rollen
│   ├── accounts.ts         Konto erstellen, Anmelden, Einrichtungscode
│   ├── security.ts         Rate-Limits, CSRF, Hashing
│   ├── validation.ts       Serverseitige Validierung (zod)
│   ├── discord.ts          Discord-Webhook mit Embeds
│   ├── events.ts           Echtzeit-Kanal (Server-Sent Events)
│   ├── seed.ts             Start-Kategorien beim ersten Start (start-categories.ts)
│   └── routes/             Öffentliche und Admin-API
├── shared/                 Gemeinsame Typen und Status-Definitionen
├── scripts/                Build, Dev-Modus, Admin anlegen, API-Tests
└── data/                   Datenbank + hochgeladene Bilder (wird automatisch erstellt)
```

**Architektur-Entscheidungen**
- *Kein Next.js:* MineOS ist eine einzige Desktop-Oberfläche ohne Seitenwechsel – ein schlanker Node-Server mit React-Frontend ist hier einfacher zu betreiben und braucht nur 3 Laufzeit-Abhängigkeiten (`react`, `react-dom`, `zod`).
- *Kein Tailwind:* Die originalgetreue Aero-Optik besteht aus vielen Verläufen, Glas-Effekten und Schatten, die als eigenes Stylesheet übersichtlicher sind als Utility-Klassen.
- *Anmeldung mit Minecraft-Name:* Keine externen Dienste nötig – Spieler erstellen ihr Konto direkt in MineOS. Der Name wird beim Bestellen vorausgefüllt.
- *SQLite statt PostgreSQL:* Für einen Shop mit einem Betreiber ist eine Datei-Datenbank ideal – keine Installation, Transaktionen und Fremdschlüssel inklusive, Backup = Datei kopieren. Alle Datenbankzugriffe liegen gebündelt in `server/`, ein späterer Umstieg ist möglich.

---

## Datensicherung & Updates

- **Backup:** Den Ordner `data/` sichern (enthält `mineos.db`, `mineos.db-wal` und `uploads/`). Am sichersten bei gestopptem Server oder mit `sqlite3 data/mineos.db ".backup backup.db"`.
- **Update:** Neue Version entpacken, `data/` und `.env` übernehmen, dann `npm install && npm run build` und neu starten. Datenbank-Migrationen laufen automatisch.

---

## Häufige Fragen

**Startdatei zeigt „dist\server.js wurde nicht gefunden“** – Die ZIP wurde nicht entpackt. Rechtsklick auf `mineos.zip` → *Alle extrahieren…* und dann im entpackten Ordner starten.

**Windows meldet „Der Computer wurde durch Windows geschützt“** – Auf *Weitere Informationen* → *Trotzdem ausführen* klicken (die Startdatei ist nicht signiert).

**Eine ältere MineOS-Version läuft noch** – Wird beim Start automatisch erkannt, beendet und durch die neue ersetzt. Ist der Port von einem anderen Programm belegt, weicht MineOS automatisch auf 3001, 3002 … aus.

**Etwas funktioniert nicht** – Im Ordner `data` liegt `mineos-log.txt` mit allen Meldungen. Diese Datei hilft bei der Fehlersuche.

**Mein Konto wurde nicht Administrator** – Admin wird nur das erste Konto, das direkt am MineOS-PC (`http://localhost:3000`) oder mit dem Einrichtungscode erstellt wird. Hast du es über eine IP-Adresse erstellt: am PC über `http://localhost:3000` einmal mit diesem Konto anmelden – solange es noch keinen Admin gibt, wirst du dabei Admin.

**Die Startdatei schließt sich sofort / Download schlägt fehl** – Internetverbindung prüfen. Alternativ Node.js 22 LTS von https://nodejs.org installieren; die Startdatei nutzt es dann automatisch.

**„Port 3000 ist bereits belegt“** – MineOS läuft schon in einem anderen Fenster. Einfach http://localhost:3000 öffnen.

**„MineOS wurde noch nicht gebaut“** – Nur bei der Entwickler-Variante: vor `npm start` einmal `npm run build` ausführen.

**Fehler `node:sqlite` nicht gefunden** – Node.js ist zu alt. Mindestens Version 22.13 installieren.

**Keine Discord-Nachricht** – In der Shop-Verwaltung unter *Einstellungen* die Testnachricht senden; die Fehlermeldung zeigt die Ursache. In der Bestelldetailansicht steht unter „Discord-Meldung“, ob die Nachricht gesendet wurde.

**Echtzeit-Updates kommen verzögert** – Hinter nginx `proxy_buffering off` für `/api/admin/events` setzen (siehe oben).

**Bezahlung?** – Bezahlt wird mit Ingame-Geld ($) bei der Übergabe auf dem Minecraft-Server. MineOS nimmt kein echtes Geld entgegen.

---

MineOS ist ein unabhängiges Fanprojekt und steht in keiner Verbindung zu Mojang Studios oder Microsoft. Alle Icons, Hintergründe und Logos in MineOS sind eigene Gestaltungen.
