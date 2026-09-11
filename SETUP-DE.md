# Einrichtung – lokale Version

## 1. Installation

```powershell
npm.cmd install
Copy-Item config.example.json config.local.json
```

Standardmäßig läuft die Oberfläche auf `http://localhost:3001`.

## 2. Browser

Die Anwendung sucht lokal nach Chromium, Google Chrome oder Microsoft Edge. Optional kann in `config.local.json` ein Browserpfad angegeben werden.

Die WhatsApp-Web-Sitzung wird ausschließlich lokal in `data/chromium-profile/` gespeichert.

## 3. Personalisierte Nachrichten

Im Nachrichtentext können verwendet werden:

```text
{{name}}
{{phone}}
```

Beispiel:

```text
Hallo {{name}}, dies ist eine automatisch geplante Nachricht.
```

## 4. Mehrere Empfänger

Im Modus **Multiple recipients** können mehrere Namen und Rufnummern hinterlegt werden. Die Vorlage wird für jeden Empfänger separat personalisiert.

## 5. Wiederholungen

Unterstützt werden:

- einmalig
- täglich
- wöchentlich
- ausgewählte Wochentage
- jährlich mit frei wählbarem Monat und Tag

Es gibt keine fest eingebauten Datums-Presets.

## 6. Datenschutz / öffentliches GitHub-Repository

Nicht committen:

- `config.local.json`
- `.env`
- `data/whatsapp.db*`
- `data/chromium-profile/`
- lokale Logs

Alle Anwendungsdaten bleiben lokal.
