# WhatsApp Messenger Local

A personal, local-first WhatsApp automation project that runs entirely on `localhost`.

The application uses a persistent Chromium profile to control **WhatsApp Web** and, optionally, **Google Gemini Web**. Scheduled messages, contacts, birthdays, recurrence rules, and send history are stored locally in SQLite.

> Current version: **v1.4.2**

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

See [SETUP.md](SETUP.md) for the complete installation guide.

Quick start on Windows PowerShell:

```powershell
git clone https://github.com/Eige90/whatsapp-messenger.git
cd whatsapp-messenger
npm.cmd install
Copy-Item config.example.json config.local.json
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

# Deutsch

# WhatsApp Messenger Local

Ein persönliches, lokal ausgeführtes WhatsApp-Automatisierungsprojekt, das vollständig auf `localhost` läuft.

Die Anwendung steuert **WhatsApp Web** und optional **Google Gemini Web** über ein persistentes Chromium-Profil. Geplante Nachrichten, Kontakte, Geburtstage, Wiederholungsregeln und der Versandverlauf werden lokal in SQLite gespeichert.

> Aktuelle Version: **v1.4.2**

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

Die vollständige Installationsanleitung befindet sich in [SETUP.md](SETUP.md).

Schnellstart unter Windows PowerShell:

```powershell
git clone https://github.com/Eige90/whatsapp-messenger.git
cd whatsapp-messenger
npm.cmd install
Copy-Item config.example.json config.local.json
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
