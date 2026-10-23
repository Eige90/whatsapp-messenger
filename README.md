> **Website / Projektseite:** [whatsapp-messenger](https://eige90.github.io/whatsapp-messenger/) · Projektbeschreibung und lokale Startanleitung.

# WhatsApp Messenger Local

**Source version / Version im Code:** `v1.4.2`

A personal, local-first WhatsApp automation project that runs entirely on `localhost`.

The application uses a persistent Chromium profile to control **WhatsApp Web** and, optionally, **Google Gemini Web**. Scheduled messages, contacts, birthdays, recurrence rules, and send history are stored locally in SQLite.

> Current version: **v1.4.2**

## Start the application

If the project is already installed, open PowerShell in the project folder and start it with:

```powershell
npm.cmd start
```

That is the normal command to start **WhatsApp Messenger Local**.

On the first installation, install the dependencies once:

```powershell
npm.cmd install
npm.cmd start
```

A `config.local.json` file is **optional**. The application has built-in defaults in `src/config.js`; create `config.local.json` only if you want local overrides.

The dashboard normally runs at:

```text
http://localhost:3001
```

---

## Why I built this

I wanted a small personal automation tool that helps me send useful, recurring WhatsApp messages without having to remember and write every message manually.

One important use case is creating **a different message every day with Gemini**. For example, Gemini can generate a short daily reminder so that I do not forget to enter something into a list, complete a routine, or remember a recurring task.

Another use case is sending **personalized messages automatically**. For example:

- birthday messages for saved contacts
- yearly greetings on specific dates
- New Year's Eve greetings
- recurring reminders
- messages on selected weekdays
- weekly or daily messages
- one-time scheduled messages

Because Gemini can generate the text dynamically, the message does not have to be identical every day. A prompt can contain placeholders such as `{{name}}`, so every recipient can receive a personalized message.

The goal is not to build a cloud service or a multi-user platform. This is a **personal localhost project** that keeps its data on the local computer.

---

## Main features

- Local web dashboard
- Runs on `localhost`
- WhatsApp Web controlled through Chromium
- Persistent Chromium profile
- Local SQLite database
- No external application database
- No WhatsApp Business API required
- Static or Gemini-generated messages
- Personalized placeholders such as `{{name}}`
- Single-recipient messages
- Multiple recipients
- Local contact book
- Optional birthday field for contacts
- One-time schedules
- Daily schedules
- Weekly schedules
- Selected weekdays
- Yearly schedules
- Pause / resume / edit / delete schedules
- Missed-message detection after restarting the application
- Interactive choice to catch up or skip missed messages
- Send history
- Automatic retry rounds for failed recipients
- Up to 3 send attempts / rounds
- Gemini prompt testing before scheduling
- Local-only data storage

---

## How it works

```text
Local dashboard
      |
      v
SQLite database
      |
      v
Scheduler
      |
      +----------------------+
      |                      |
      v                      v
Gemini Web              Static message
      |                      |
      +----------+-----------+
                 |
                 v
          WhatsApp Web
                 |
                 v
             Recipient
```

For Gemini messages, the application works recipient by recipient:

```text
Recipient 1
-> create personalized Gemini prompt
-> get Gemini response
-> open WhatsApp chat
-> insert message
-> click Send
-> confirm send

Recipient 2
-> repeat
```

If sending fails, unsuccessful recipients are retried in later rounds. Successfully sent recipients are not sent the same message again.

---

## Local data

The application stores local data inside the project folder:

```text
data/
├── whatsapp.db
└── chromium-profile/
```

### `data/whatsapp.db`

Contains, among other things:

- contacts
- phone numbers
- birthdays
- scheduled messages
- recurrence settings
- next run times
- send history
- retry information

### `data/chromium-profile/`

Contains the local Chromium browser profile, including the persistent browser sessions used by WhatsApp Web and Gemini Web.

These files are private and should **not** be committed to GitHub.

---

## Contacts

Contacts are created manually inside the application. They are **not imported from WhatsApp**.

A contact can contain:

```text
Name
Phone number
Birthday (optional)
```

Example:

```text
Name: Anna
Phone: 491701234567
Birthday: 1992-04-17
```

Saved contacts can be reused when creating scheduled messages.

---

## Personalization

You can use placeholders inside static messages or Gemini prompts.

Example:

```text
Good morning {{name}}!
Please remember to update today's list.
```

For a recipient named Anna:

```text
Good morning Anna!
Please remember to update today's list.
```

---

## Gemini Web

Gemini is used through the normal Gemini website in Chromium.

Example prompt:

```text
Write a short, friendly daily reminder for {{name}}.
The reminder should motivate the person to enter today's information into their list.
Use different wording every day.
Return only the final WhatsApp message.
```

This allows the application to create a different message each day instead of repeatedly sending the exact same text.

Gemini can also be used for birthday or yearly greetings, for example:

```text
Write a warm but not overly sentimental birthday message for {{name}}.
Return only the final WhatsApp message.
```

---

## Scheduling

Supported schedule types:

### Once

Send once at a specific date and time.

### Daily

Send every day at a selected time.

### Weekly

Send once per week.

### Selected weekdays

Example:

```text
Monday
Wednesday
Friday
```

at a selected time.

### Yearly

Useful for:

- birthdays
- anniversaries
- New Year's Eve
- other fixed yearly dates

There is no hard-coded holiday preset. The date is freely configurable.

---

## Missed messages

Because this is a localhost application, the computer and application must be running at the actual send time.

If the computer was turned off and scheduled messages were missed, the application detects them after the next start and asks what should happen.

You can choose to:

- catch up missed messages
- skip missed messages
- decide individually for each missed message

The application does not silently decide this for you.

---

## Retry behavior

For multiple recipients, sending is processed in rounds.

Example:

```text
Round 1:
Anna  -> sent
Peter -> failed
Maria -> failed

Round 2:
Peter -> sent
Maria -> failed

Round 3:
Maria -> failed
```

Only failed recipients continue to the next round.

The default maximum is **3 rounds**.

---

## Installation

Requirements: Node.js 24+, Git, Chromium/Chrome/Edge, and a phone with WhatsApp. Configuration is optional: to customize settings, copy `config.example.json` to `config.local.json`. Never commit the local configuration or browser profile.

Quick start on Windows PowerShell:

```powershell
git clone https://github.com/Eige90/whatsapp-messenger.git
cd whatsapp-messenger
npm.cmd install
npm.cmd start
```

On the first start, WhatsApp Web will require pairing.

On your phone:

```text
WhatsApp
-> Linked devices
-> Link a device
-> Scan the QR code shown in Chromium
```

The browser session is then stored locally in the persistent Chromium profile.

---

## Privacy

This project is designed to keep personal data local.

Do not commit the following to GitHub:

```text
config.local.json
data/whatsapp.db
data/whatsapp.db-wal
data/whatsapp.db-shm
data/chromium-profile/
.env
node_modules/
```

The repository should only contain the application code and public documentation.

---

## Important note

This is a personal automation project using WhatsApp Web and Gemini Web through Chromium.

It is not an official WhatsApp or Google product.

Use automation responsibly and only message recipients who expect or want the messages.

---

## Roadmap / Open verification items

- [ ] Run end-to-end tests for multiple recipients, per-recipient Gemini generation and send confirmation.
- [ ] Test Chromium persistence and Gemini login after restart.
- [ ] Test missed-message review and retry rounds with failures.
- [ ] Keep SQLite database, browser profile and local configuration private.


# Deutsch

# WhatsApp Messenger Local

Ein persönliches, lokal ausgeführtes WhatsApp-Automatisierungsprojekt, das vollständig auf `localhost` läuft.

Die Anwendung steuert **WhatsApp Web** und optional **Google Gemini Web** über ein persistentes Chromium-Profil. Geplante Nachrichten, Kontakte, Geburtstage, Wiederholungsregeln und der Versandverlauf werden lokal in SQLite gespeichert.

> Aktuelle Version: **v1.4.2**

## Anwendung starten

Wenn das Projekt bereits installiert ist, PowerShell im Projektordner öffnen und die Anwendung mit folgendem Befehl starten:

```powershell
npm.cmd start
```

Das ist der normale Startbefehl für **WhatsApp Messenger Local**.

Bei einer neuen Installation müssen die Abhängigkeiten einmalig installiert werden:

```powershell
npm.cmd install
npm.cmd start
```

Eine `config.local.json` ist **optional**. Die Anwendung besitzt Standardwerte in `src/config.js`. Eine `config.local.json` wird nur benötigt, wenn lokale Einstellungen überschrieben werden sollen.

Das Dashboard läuft normalerweise unter:

```text
http://localhost:3001
```

---

## Warum ich dieses Projekt entwickelt habe

Ich wollte ein kleines persönliches Automatisierungsprogramm, das mir dabei hilft, nützliche und wiederkehrende WhatsApp-Nachrichten zu verschicken, ohne jedes Mal selbst daran denken und jede Nachricht neu schreiben zu müssen.

Ein wichtiger Anwendungsfall ist, mit **Gemini jeden Tag eine andere Nachricht erzeugen zu lassen**. Gemini kann zum Beispiel täglich eine kurze Erinnerung formulieren, damit ich nicht vergesse, etwas in eine Liste einzutragen, eine Routine zu erledigen oder an eine regelmäßig wiederkehrende Aufgabe zu denken.

Ein weiterer Anwendungsfall sind **automatisch personalisierte Nachrichten**. Zum Beispiel:

- Geburtstagsnachrichten für gespeicherte Kontakte
- jährliche Grüße an bestimmten Tagen
- Silvestergrüße
- wiederkehrende Erinnerungen
- Nachrichten an bestimmten Wochentagen
- wöchentliche oder tägliche Nachrichten
- einmalig geplante Nachrichten

Da Gemini den Text dynamisch erzeugen kann, muss nicht jeden Tag exakt dieselbe Nachricht verschickt werden. In einem Prompt können Platzhalter wie `{{name}}` verwendet werden, sodass jeder Empfänger eine personalisierte Nachricht erhalten kann.

Das Ziel ist ausdrücklich **kein Cloud-Dienst und keine Multi-User-Plattform**. Es handelt sich um ein **persönliches Localhost-Projekt**, bei dem die Daten auf dem eigenen Computer bleiben.

---

## Hauptfunktionen

- Lokales Web-Dashboard
- Läuft auf `localhost`
- WhatsApp Web über Chromium
- Persistentes Chromium-Profil
- Lokale SQLite-Datenbank
- Keine externe Anwendungsdatenbank
- Keine WhatsApp Business API erforderlich
- Feste oder von Gemini erzeugte Nachrichten
- Personalisierung mit Platzhaltern wie `{{name}}`
- Einzelne Empfänger
- Mehrere Empfänger
- Lokales Kontaktbuch
- Optionales Geburtstagsfeld pro Kontakt
- Einmalige Termine
- Tägliche Termine
- Wöchentliche Termine
- Frei auswählbare Wochentage
- Jährliche Termine
- Termine pausieren / aktivieren / bearbeiten / löschen
- Erkennung verpasster Nachrichten nach einem Neustart
- Interaktive Auswahl: nachholen oder überspringen
- Versandverlauf
- Automatische Wiederholungsversuche
- Bis zu 3 Versanddurchläufe
- Gemini-Prompts vorab testen
- Lokale Datenspeicherung

---

## Funktionsweise

```text
Lokales Dashboard
       |
       v
SQLite-Datenbank
       |
       v
Scheduler
       |
       +----------------------+
       |                      |
       v                      v
Gemini Web              Feste Nachricht
       |                      |
       +----------+-----------+
                  |
                  v
           WhatsApp Web
                  |
                  v
              Empfänger
```

Bei Gemini-Nachrichten wird Empfänger für Empfänger verarbeitet:

```text
Empfänger 1
-> personalisierten Gemini-Prompt erstellen
-> Gemini-Antwort abrufen
-> WhatsApp-Chat öffnen
-> Nachricht einfügen
-> Senden klicken
-> Versand bestätigen

Empfänger 2
-> gleicher Ablauf
```

Schlägt ein Versand fehl, werden nur die noch nicht erfolgreich belieferten Empfänger in einer späteren Runde erneut versucht.

---

## Lokale Daten

Die Anwendung speichert ihre lokalen Daten innerhalb des Projektordners:

```text
data/
├── whatsapp.db
└── chromium-profile/
```

### `data/whatsapp.db`

Enthält unter anderem:

- Kontakte
- Telefonnummern
- Geburtstage
- geplante Nachrichten
- Wiederholungseinstellungen
- nächste Versandzeitpunkte
- Versandverlauf
- Retry-Informationen

### `data/chromium-profile/`

Enthält das lokale Chromium-Profil und damit die persistenten Browser-Sitzungen für WhatsApp Web und Gemini Web.

Diese Dateien sind privat und dürfen **nicht nach GitHub hochgeladen werden**.

---

## Kontakte

Kontakte werden direkt in der Anwendung selbst angelegt. Sie werden **nicht aus WhatsApp übernommen**.

Ein Kontakt kann enthalten:

```text
Name
Telefonnummer
Geburtstag (optional)
```

Beispiel:

```text
Name: Anna
Telefon: 491701234567
Geburtstag: 17.04.1992
```

Gespeicherte Kontakte können anschließend beim Erstellen geplanter Nachrichten wiederverwendet werden.

---

## Personalisierung

In statischen Nachrichten und Gemini-Prompts können Platzhalter verwendet werden.

Beispiel:

```text
Guten Morgen {{name}}!
Denk bitte daran, heute deine Liste zu aktualisieren.
```

Für einen Kontakt namens Anna wird daraus:

```text
Guten Morgen Anna!
Denk bitte daran, heute deine Liste zu aktualisieren.
```

---

## Gemini Web

Gemini wird über die normale Gemini-Webseite in Chromium verwendet.

Beispiel-Prompt:

```text
Schreibe eine kurze, freundliche tägliche Erinnerung für {{name}}.
Die Nachricht soll die Person daran erinnern, die heutigen Informationen
in ihre Liste einzutragen.
Formuliere die Nachricht jeden Tag etwas anders.
Gib ausschließlich die fertige WhatsApp-Nachricht aus.
```

Dadurch kann die Anwendung **jeden Tag einen anderen Text** erzeugen, statt immer dieselbe Nachricht zu verschicken.

Gemini kann beispielsweise auch für Geburtstagsnachrichten verwendet werden:

```text
Schreibe eine herzliche, aber nicht übertrieben kitschige
Geburtstagsnachricht für {{name}}.
Gib ausschließlich die fertige WhatsApp-Nachricht aus.
```

---

## Zeitplanung

Unterstützte Varianten:

### Einmalig

Eine Nachricht wird an einem bestimmten Datum und zu einer bestimmten Uhrzeit verschickt.

### Täglich

Die Nachricht wird jeden Tag zur ausgewählten Uhrzeit verschickt.

### Wöchentlich

Die Nachricht wird einmal pro Woche verschickt.

### Bestimmte Wochentage

Beispiel:

```text
Montag
Mittwoch
Freitag
```

jeweils zu einer bestimmten Uhrzeit.

### Jährlich

Geeignet zum Beispiel für:

- Geburtstage
- Jahrestage
- Silvester
- andere feste jährliche Termine

Es gibt bewusst keinen fest eingebauten Feiertags-Preset. Das Datum kann frei gewählt werden.

---

## Verpasste Nachrichten

Da es sich um eine Localhost-Anwendung handelt, müssen der Computer und die Anwendung zum eigentlichen Versandzeitpunkt laufen.

War der Computer ausgeschaltet und wurden dadurch geplante Nachrichten verpasst, erkennt die Anwendung diese beim nächsten Start und fragt nach, was passieren soll.

Mögliche Entscheidungen:

- verpasste Nachrichten nachholen
- verpasste Nachrichten überspringen
- für jede Nachricht einzeln entscheiden

Die Anwendung trifft diese Entscheidung nicht automatisch.

---

## Wiederholungsversuche

Bei mehreren Empfängern erfolgt der Versand in mehreren Durchläufen.

Beispiel:

```text
Durchlauf 1:
Anna  -> gesendet
Peter -> fehlgeschlagen
Maria -> fehlgeschlagen

Durchlauf 2:
Peter -> gesendet
Maria -> fehlgeschlagen

Durchlauf 3:
Maria -> fehlgeschlagen
```

Nur fehlgeschlagene Empfänger gehen in den nächsten Durchlauf.

Standardmäßig werden maximal **3 Durchläufe** durchgeführt.

---

## Installation

Voraussetzungen: Node.js 24+, Git, Chromium/Chrome/Edge und WhatsApp auf dem Handy. Die Konfiguration ist optional: Für eigene Einstellungen `config.example.json` als `config.local.json` kopieren. Lokale Konfiguration und Browserprofil niemals committen.

Schnellstart unter Windows PowerShell:

```powershell
git clone https://github.com/Eige90/whatsapp-messenger.git
cd whatsapp-messenger
npm.cmd install
npm.cmd start
```

Beim ersten Start muss WhatsApp Web einmal gekoppelt werden.

Auf dem Handy:

```text
WhatsApp
-> Verknüpfte Geräte
-> Gerät hinzufügen
-> QR-Code aus Chromium scannen
```

Anschließend bleibt die Sitzung im persistenten Chromium-Profil lokal gespeichert.

---

## Datenschutz

Das Projekt ist so aufgebaut, dass persönliche Daten lokal bleiben.

Folgende Dateien bzw. Ordner dürfen nicht nach GitHub:

```text
config.local.json
data/whatsapp.db
data/whatsapp.db-wal
data/whatsapp.db-shm
data/chromium-profile/
.env
node_modules/
```

Im öffentlichen Repository sollen nur Programmcode und öffentliche Dokumentation liegen.

---

## Hinweis

Dies ist ein persönliches Automatisierungsprojekt, das WhatsApp Web und Gemini Web über Chromium verwendet.

Es handelt sich weder um ein offizielles WhatsApp- noch um ein offizielles Google-Produkt.

Automatisierte Nachrichten sollten verantwortungsvoll und nur an Empfänger verschickt werden, die diese Nachrichten erwarten oder wünschen.

---

## Additional setup / Ergänzende Einrichtung

**English:** Optional configuration (PowerShell): `Copy-Item config.example.json config.local.json`. Check syntax with `npm.cmd run check`. If Google blocks sign-in in an automated browser, stop the application, run `npm.cmd run gemini-login`, sign in manually, close the browser, then restart with `npm.cmd start`. Update by stopping the app, running `git pull` and `npm.cmd install`, then starting it again. Chromium sessions and SQLite data must remain local. A send is attempted recipient by recipient; failed recipients are retried in up to three rounds.

**Deutsch:** Optionale Konfiguration (PowerShell): `Copy-Item config.example.json config.local.json`. Syntax mit `npm.cmd run check` prüfen. Falls Google die Anmeldung im automatisierten Browser blockiert, Anwendung beenden, `npm.cmd run gemini-login` ausführen, manuell anmelden, Browser schließen und anschließend `npm.cmd start` ausführen. Aktualisieren: Anwendung stoppen, `git pull` und `npm.cmd install` ausführen, erneut starten. Chromium-Sitzungen und SQLite-Daten bleiben lokal. Der Versand erfolgt Empfänger für Empfänger; fehlgeschlagene Empfänger werden in bis zu drei Durchläufen erneut versucht.


---

# Detailed installation reference / Ausführliche Installationsreferenz

The following additional reference preserves the detailed configuration and setup steps from the former SETUP.md. / Die folgende Referenz enthält die ausführlichen Konfigurations- und Einrichtungshinweise der bisherigen SETUP.md.

## Setup details / Einrichtungsdetails

> **v1.4.2:** Multi-recipient Gemini sends are now processed recipient-by-recipient: generate one Gemini response, send and confirm it in WhatsApp, then continue with the next recipient. WhatsApp now clicks the visible send button first and uses Enter only as a fallback, which avoids the focus problem seen after switching between Gemini and WhatsApp tabs. Existing three-round retry behavior remains unchanged.

> **v1.4.2 (Deutsch):** Gemini-Mehrfachversand wird jetzt Empfänger für Empfänger abgearbeitet: eine Gemini-Antwort erzeugen, in WhatsApp senden und bestätigen und erst danach mit dem nächsten Empfänger fortfahren. WhatsApp klickt primär den sichtbaren Senden-Button; Enter dient nur noch als Fallback. Dadurch wird das Fokusproblem nach dem Wechsel zwischen Gemini- und WhatsApp-Tab vermieden. Die bestehende Retry-Logik mit bis zu drei Durchläufen bleibt erhalten.

## English

### 1. Requirements

Install the following software before starting:

- Git
- Node.js with npm
- A Chromium-based browser such as Chromium, Google Chrome, or Microsoft Edge
- WhatsApp on your phone

The application runs locally. The computer must be running when scheduled messages are due.

### 2. Clone the repository

Open PowerShell and run:

```powershell
git clone https://github.com/Eige90/whatsapp-messenger.git
cd whatsapp-messenger
```

### 3. Install dependencies

```powershell
npm.cmd install
```

`node_modules` is created locally and is intentionally excluded from Git.

### 4. Create the local configuration

```powershell
Copy-Item config.example.json config.local.json
```

The local configuration is private and is intentionally excluded from Git.

A typical configuration looks like this:

```json
{
  "port": 3001,
  "chromiumPath": "",
  "openDashboard": true,
  "openDevTools": false,
  "schedulerIntervalMs": 1000,
  "suspendDetectionMs": 30000,
  "protocolTimeoutMs": 120000,
  "navigationTimeoutMs": 90000,
  "actionTimeoutMs": 90000,
  "sendConfirmationTimeoutMs": 30000,
  "postTimeoutVerificationMs": 15000,
  "batchDelayMs": 2000,
  "sendRetryRounds": 3,
  "retryRoundDelayMs": 4000,
  "openGemini": true,
  "geminiResponseTimeoutMs": 120000,
  "geminiStableMs": 1800,
  "remoteDebuggingStartupTimeoutMs": 20000
}
```

If `chromiumPath` is empty, the application tries to find Chromium, Google Chrome, or Microsoft Edge automatically.

### 5. Optional syntax check

```powershell
npm.cmd run check
```

### 6. Start the application

```powershell
npm.cmd start
```

The application normally opens one Chromium-based browser window with:

1. WhatsApp Web
2. the local dashboard at `http://localhost:3001`
3. Gemini Web at `https://gemini.google.com/app`

### 7. Link WhatsApp on the first start

On the first start, WhatsApp Web displays a QR code.

On your phone:

1. Open WhatsApp.
2. Open **Linked devices**.
3. Choose **Link a device**.
4. Scan the QR code shown in the Chromium window.
5. Wait until WhatsApp Web has fully loaded.

The linked-device session is stored locally in:

```text
data/chromium-profile/
```

Normally, the QR code does not need to be scanned again on later starts.

Do not upload or commit this folder. Anyone with access to a valid browser session could potentially access the linked WhatsApp Web account.


### 8. Sign in to Gemini once

Google can refuse sign-in while a browser is controlled by automation software. Do the initial Gemini authentication without Puppeteer.

First stop the WhatsApp Messenger completely. Then run:

```powershell
npm.cmd run gemini-login
```

A normal Chromium/Chrome/Edge window opens using the same dedicated project profile but without remote debugging. Sign in to Google/Gemini manually and verify that `https://gemini.google.com/app` works. Then close the browser window completely.

Start the application again:

```powershell
npm.cmd start
```

The application then reuses the authenticated local profile. No Google password is stored in the source code. The project does not bypass Google's account security checks. If Google also rejects the normal manual login session, Gemini web automation cannot reliably use that account without switching to another supported authentication method.


### Automatic retries

The default configuration uses `sendRetryRounds: 3`. A multi-recipient send is processed in full rounds: every pending recipient is tried once, then the app starts the next round only for recipients that still need delivery. Successful recipients are not sent again.

`retryRoundDelayMs` controls the pause between full rounds and `batchDelayMs` controls the pause between recipients inside one round.

### 9. Local database

Schedules and message history are stored locally in:

```text
data/whatsapp.db
```

The database remains on the computer when the application is stopped or the PC is restarted. Existing schedules are loaded again on the next start.

If messages became due while the computer was offline, the application asks whether the missed messages should be sent or skipped.

### 10. Personalized messages

Use these placeholders in a message:

```text
{{name}}
{{phone}}
```

Example:

```text
Hello {{name}}, this is your scheduled message.
```

For recipient `Anna`, the sent message becomes:

```text
Hello Anna, this is your scheduled message.
```

### 11. Multiple recipients

Select **Multiple recipients** in the dashboard.

Recipients can be entered individually or as a list, for example:

```text
Anna;491234567890
Peter;491234567891
Maria;491234567892
```

The message template is personalized separately for every recipient.

### 12. Schedule types

The application supports:

- one-time messages
- daily messages
- weekly messages
- selected weekdays
- yearly messages

For a birthday, anniversary, or New Year's Eve message, create a yearly schedule and choose the required month, day, and time.

### 13. Updating the project

Stop the application first, then run:

```powershell
git pull
npm.cmd install
npm.cmd start
```

Local files such as the database, browser profile, and `config.local.json` remain local and are not replaced by Git.

### 14. Files that must stay private

Never commit these files or folders:

```text
config.local.json
.env
data/whatsapp.db*
data/chromium-profile/
node_modules/
logs and temporary files
```

---

# Einrichtung

## Deutsch

### 1. Voraussetzungen

Vor dem Start sollten folgende Programme installiert sein:

- Git
- Node.js inklusive npm
- ein Chromium-basierter Browser wie Chromium, Google Chrome oder Microsoft Edge
- WhatsApp auf dem Handy

Die Anwendung läuft ausschließlich lokal. Der Computer muss eingeschaltet sein, wenn eine geplante Nachricht fällig wird.

### 2. Repository klonen

PowerShell öffnen und ausführen:

```powershell
git clone https://github.com/Eige90/whatsapp-messenger.git
cd whatsapp-messenger
```

### 3. Abhängigkeiten installieren

```powershell
npm.cmd install
```

`node_modules` wird nur lokal erstellt und bewusst nicht in Git gespeichert.

### 4. Lokale Konfiguration erstellen

```powershell
Copy-Item config.example.json config.local.json
```

Die lokale Konfiguration ist privat und wird bewusst nicht in Git gespeichert.

Eine typische Konfiguration sieht so aus:

```json
{
  "port": 3001,
  "chromiumPath": "",
  "openDashboard": true,
  "openDevTools": false,
  "schedulerIntervalMs": 1000,
  "suspendDetectionMs": 30000,
  "protocolTimeoutMs": 120000,
  "navigationTimeoutMs": 90000,
  "actionTimeoutMs": 90000,
  "sendConfirmationTimeoutMs": 30000,
  "postTimeoutVerificationMs": 15000,
  "batchDelayMs": 2000,
  "sendRetryRounds": 3,
  "retryRoundDelayMs": 4000,
  "openGemini": true,
  "geminiResponseTimeoutMs": 120000,
  "geminiStableMs": 1800,
  "remoteDebuggingStartupTimeoutMs": 20000
}
```

Wenn `chromiumPath` leer bleibt, versucht die Anwendung Chromium, Google Chrome oder Microsoft Edge automatisch zu finden.

### 5. Optionaler Syntax-Check

```powershell
npm.cmd run check
```

### 6. Anwendung starten

```powershell
npm.cmd start
```

Normalerweise öffnet sich ein Chromium-basiertes Browserfenster mit drei Tabs:

1. WhatsApp Web
2. die lokale Oberfläche unter `http://localhost:3001`
3. Gemini Web unter `https://gemini.google.com/app`

### 7. WhatsApp beim ersten Start verknüpfen

Beim ersten Start zeigt WhatsApp Web einen QR-Code an.

Auf dem Handy:

1. WhatsApp öffnen.
2. **Verknüpfte Geräte** öffnen.
3. **Gerät hinzufügen** auswählen.
4. Den QR-Code aus dem Chromium-Fenster scannen.
5. Warten, bis WhatsApp Web vollständig geladen ist.

Die Sitzung des verknüpften Geräts wird lokal gespeichert unter:

```text
data/chromium-profile/
```

Bei späteren Starts muss der QR-Code normalerweise nicht erneut gescannt werden.

Diesen Ordner niemals hochladen oder committen. Wer Zugriff auf eine gültige Browser-Sitzung erhält, könnte möglicherweise auf das verknüpfte WhatsApp-Web-Konto zugreifen.


### 8. Einmalig bei Gemini anmelden

Google kann eine Anmeldung verweigern, solange der Browser von Automationssoftware gesteuert wird. Deshalb erfolgt die erste Gemini-Anmeldung bewusst ohne Puppeteer.

Zuerst den WhatsApp Messenger vollständig beenden. Danach ausführen:

```powershell
npm.cmd run gemini-login
```

Es öffnet sich ein normales Chromium-/Chrome-/Edge-Fenster mit demselben lokalen Projektprofil, aber ohne Remote-Debugging. Dort manuell bei Google/Gemini anmelden und prüfen, ob `https://gemini.google.com/app` funktioniert. Danach das Browserfenster vollständig schließen.

Anschließend die Anwendung wieder starten:

```powershell
npm.cmd start
```

Die Anwendung verwendet danach die bereits angemeldete lokale Sitzung. Das Google-Passwort wird nicht im Quellcode gespeichert. Das Projekt umgeht keine Google-Sicherheitsprüfung. Wenn Google auch die normale manuelle Anmeldung ablehnt, kann die Gemini-Webautomation dieses Konto nicht zuverlässig nutzen, ohne auf eine andere unterstützte Authentifizierung umzusteigen.


### Automatische Wiederholungen

Die Standardkonfiguration verwendet `sendRetryRounds: 3`. Ein Versand an mehrere Empfänger wird in vollständigen Runden abgearbeitet: Jeder noch offene Empfänger wird einmal versucht. Erst danach startet die nächste Runde ausschließlich für Empfänger, deren Versand noch nicht bestätigt wurde. Bereits erfolgreich angeschriebene Empfänger werden nicht erneut gesendet.

`retryRoundDelayMs` legt die Pause zwischen den vollständigen Runden fest; `batchDelayMs` steuert die Pause zwischen einzelnen Empfängern innerhalb einer Runde.

### 9. Lokale Datenbank

Zeitpläne und Nachrichtenverlauf werden lokal gespeichert unter:

```text
data/whatsapp.db
```

Die Datenbank bleibt erhalten, wenn die Anwendung beendet oder der PC neu gestartet wird. Bestehende Zeitpläne werden beim nächsten Start wieder geladen.

Wenn während der Offline-Zeit Nachrichten fällig geworden sind, fragt die Anwendung nach dem Start, ob die verpassten Nachrichten nachgeholt oder übersprungen werden sollen.

### 10. Personalisierte Nachrichten

Im Nachrichtentext können folgende Platzhalter verwendet werden:

```text
{{name}}
{{phone}}
```

Beispiel:

```text
Hallo {{name}}, dies ist deine geplante Nachricht.
```

Für den Empfänger `Anna` wird daraus:

```text
Hallo Anna, dies ist deine geplante Nachricht.
```

### 11. Mehrere Empfänger

Im Dashboard **Multiple recipients** auswählen.

Empfänger können einzeln oder als Liste eingegeben werden, zum Beispiel:

```text
Anna;491234567890
Peter;491234567891
Maria;491234567892
```

Die Nachrichtenvorlage wird für jeden Empfänger separat personalisiert.

### 12. Zeitplanarten

Unterstützt werden:

- einmalige Nachrichten
- tägliche Nachrichten
- wöchentliche Nachrichten
- frei auswählbare Wochentage
- jährliche Nachrichten

Für einen Geburtstag, Jahrestag oder eine Silvesternachricht einfach einen jährlichen Zeitplan mit gewünschtem Monat, Tag und Uhrzeit anlegen.

### 13. Projekt aktualisieren

Anwendung zuerst beenden und anschließend ausführen:

```powershell
git pull
npm.cmd install
npm.cmd start
```

Lokale Dateien wie Datenbank, Chromium-Profil und `config.local.json` bleiben lokal und werden durch Git nicht ersetzt.

### 14. Dateien, die privat bleiben müssen

Diese Dateien und Ordner niemals committen:

```text
config.local.json
.env
data/whatsapp.db*
data/chromium-profile/
node_modules/
Logs und temporäre Dateien
```


---

## v1.4 contacts note / Kontakt-Hinweis

**English:** Contacts are entered manually in the dashboard and stored only in `data/whatsapp.db`. The application does not import contacts from WhatsApp. A contact contains a name, phone number, and optional birthday.

**Deutsch:** Kontakte werden im Dashboard manuell eingetragen und ausschließlich in `data/whatsapp.db` gespeichert. Die Anwendung importiert keine Kontakte aus WhatsApp. Ein Kontakt enthält Name, Telefonnummer und optionalen Geburtstag.

## Roadmap / Offene Prüfpunkte

- [ ] Mehrfachempfängerversand, individuelle Gemini-Texte und Versandbestätigung praktisch testen.
- [ ] Chromium-Sitzung und Gemini-Anmeldung nach Neustart überprüfen.
- [ ] Dialog für verpasste Nachrichten und Wiederholungsversuche unter Fehlerbedingungen testen.
- [ ] SQLite-Datenbank, Browserprofil und lokale Konfiguration privat halten.

