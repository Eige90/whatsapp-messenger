# Setup

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
