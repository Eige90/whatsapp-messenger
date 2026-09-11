# WhatsApp Messenger Local

## English

A personal, localhost-only WhatsApp scheduler that controls WhatsApp Web through a Chromium-based browser.

The project does not use a paid WhatsApp API, cloud database, or external hosting service. Messages, schedules, browser sessions, and history stay on the local computer.

### Features

- Local web dashboard, by default at `http://localhost:3001`
- WhatsApp Web controlled through Chromium, Google Chrome, or Microsoft Edge
- Persistent local WhatsApp Web login through a dedicated browser profile
- Local SQLite database for schedules and message history
- One-time messages
- Daily messages
- Weekly messages
- Messages on selected weekdays
- Yearly messages for birthdays, anniversaries, New Year's Eve, or any other fixed date
- Single recipient or multiple recipients
- Personalized messages with `{{name}}` and `{{phone}}`
- Missed-message detection after the computer has been offline
- Choice to send or skip missed messages after restart
- Local send history
- No hard-coded Windows user paths
- No hard-coded holiday presets

### Personalized messages

Use `{{name}}` in the message text to insert the recipient name automatically.

Example recipient:

```text
Name: Anna
Phone: 491234567890
```

Message template:

```text
Hello {{name}}, I hope you have a great day!
```

Message sent:

```text
Hello Anna, I hope you have a great day!
```

You can also use:

```text
{{phone}}
```

### Multiple recipients

Use **Multiple recipients** to send the same personalized template to several WhatsApp numbers.

Example:

```text
Anna;491234567890
Peter;491234567891
Maria;491234567892
```

With this template:

```text
Hello {{name}}, I wish you a happy new year!
```

each recipient receives a separately personalized message.

### Scheduling

Supported schedule types:

- **Once** — one specific date and time
- **Daily** — every day at the selected time
- **Weekly** — once every week
- **Selected weekdays** — for example Monday, Wednesday, and Friday
- **Yearly** — fixed month, day, and time every year

For example, a New Year's Eve message can simply be configured as a yearly schedule for December 31. There is intentionally no hard-coded holiday preset.

### Local data

The application stores its data relative to the project folder:

```text
data/
├── whatsapp.db
└── chromium-profile/
```

The database keeps schedules and history. The Chromium profile keeps the WhatsApp Web login so that the QR code normally only needs to be scanned once.

### Private files

The following files and directories are intentionally excluded from Git and must never be committed:

```text
config.local.json
.env
data/whatsapp.db*
data/chromium-profile/
node_modules/
logs and temporary files
```

### Quick start

```powershell
git clone https://github.com/Eige90/whatsapp-messenger.git
cd whatsapp-messenger
npm.cmd install
Copy-Item config.example.json config.local.json
npm.cmd start
```

On the first start, the application opens a Chromium-based browser with WhatsApp Web and the local dashboard. Scan the WhatsApp Web QR code with your phone via **WhatsApp → Linked devices → Link a device**.

After the first successful login, the WhatsApp Web session is stored locally in `data/chromium-profile/` and is reused on later starts.

For complete installation instructions, see `SETUP.md`.

---

# WhatsApp Messenger Local

## Deutsch

Ein persönlicher WhatsApp-Scheduler, der ausschließlich lokal auf `localhost` läuft und WhatsApp Web über einen Chromium-basierten Browser steuert.

Das Projekt verwendet keine kostenpflichtige WhatsApp-API, keine Cloud-Datenbank und kein externes Hosting. Nachrichten, Zeitpläne, Browser-Sitzung und Verlauf bleiben auf dem lokalen Computer.

### Funktionen

- Lokale Weboberfläche, standardmäßig unter `http://localhost:3001`
- WhatsApp Web über Chromium, Google Chrome oder Microsoft Edge
- Persistente lokale WhatsApp-Web-Anmeldung über ein eigenes Browserprofil
- Lokale SQLite-Datenbank für Zeitpläne und Nachrichtenverlauf
- Einmalige Nachrichten
- Tägliche Nachrichten
- Wöchentliche Nachrichten
- Nachrichten an frei auswählbaren Wochentagen
- Jährliche Nachrichten für Geburtstage, Jahrestage, Silvester oder jedes andere feste Datum
- Einzelne oder mehrere Empfänger
- Personalisierte Nachrichten mit `{{name}}` und `{{phone}}`
- Erkennung verpasster Nachrichten nach ausgeschaltetem PC
- Auswahl nach dem Neustart, ob verpasste Nachrichten nachgeholt oder übersprungen werden sollen
- Lokaler Versandverlauf
- Keine fest codierten Windows-Benutzerpfade
- Keine fest eingebauten Feiertags-Presets

### Personalisierte Nachrichten

Mit `{{name}}` wird der Empfängername automatisch in den Nachrichtentext eingesetzt.

Beispiel-Empfänger:

```text
Name: Anna
Phone: 491234567890
```

Nachrichtenvorlage:

```text
Hallo {{name}}, ich wünsche dir einen schönen Tag!
```

Gesendete Nachricht:

```text
Hallo Anna, ich wünsche dir einen schönen Tag!
```

Zusätzlich kann verwendet werden:

```text
{{phone}}
```

### Mehrere Empfänger

Mit **Multiple recipients** kann dieselbe personalisierte Vorlage an mehrere WhatsApp-Nummern gesendet werden.

Beispiel:

```text
Anna;491234567890
Peter;491234567891
Maria;491234567892
```

Mit dieser Vorlage:

```text
Hallo {{name}}, ich wünsche dir ein frohes neues Jahr!
```

erhält jeder Empfänger eine separat personalisierte Nachricht.

### Zeitplanung

Unterstützte Zeitpläne:

- **Once** — einmal an einem bestimmten Datum und zu einer bestimmten Uhrzeit
- **Daily** — jeden Tag zur gewählten Uhrzeit
- **Weekly** — einmal pro Woche
- **Selected weekdays** — zum Beispiel Montag, Mittwoch und Freitag
- **Yearly** — jedes Jahr an einem festen Monat, Tag und zu einer festen Uhrzeit

Eine Silvesternachricht kann beispielsweise einfach als jährlicher Termin für den 31. Dezember eingerichtet werden. Es gibt bewusst keinen fest eingebauten Feiertags-Preset.

### Lokale Daten

Die Anwendung speichert ihre Daten relativ zum Projektordner:

```text
data/
├── whatsapp.db
└── chromium-profile/
```

Die Datenbank speichert Zeitpläne und Verlauf. Das Chromium-Profil speichert die WhatsApp-Web-Anmeldung, sodass der QR-Code normalerweise nur einmal gescannt werden muss.

### Private Dateien

Die folgenden Dateien und Ordner werden absichtlich nicht in Git gespeichert und dürfen niemals committed werden:

```text
config.local.json
.env
data/whatsapp.db*
data/chromium-profile/
node_modules/
Logs und temporäre Dateien
```

### Schnellstart

```powershell
git clone https://github.com/Eige90/whatsapp-messenger.git
cd whatsapp-messenger
npm.cmd install
Copy-Item config.example.json config.local.json
npm.cmd start
```

Beim ersten Start öffnet die Anwendung einen Chromium-basierten Browser mit WhatsApp Web und der lokalen Oberfläche. Scanne den WhatsApp-Web-QR-Code mit deinem Handy über **WhatsApp → Verknüpfte Geräte → Gerät hinzufügen**.

Nach der ersten erfolgreichen Anmeldung wird die WhatsApp-Web-Sitzung lokal in `data/chromium-profile/` gespeichert und bei späteren Starts wiederverwendet.

Die vollständige Einrichtung steht in `SETUP.md`.
