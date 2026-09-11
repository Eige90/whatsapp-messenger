# WhatsApp Messenger Local v1.1.1

Personal localhost-only WhatsApp scheduler controlled through Chromium/Chrome.

## Features

- Persistent local schedules and history in SQLite.
- Persistent Chromium profile for WhatsApp Web login.
- One-time, daily, weekly, selected-weekday and yearly schedules.
- Single or multiple recipients.
- Personalized templates using `{{name}}` and `{{phone}}`.
- Missed-message handling after restart.
- Local dashboard on `http://localhost:3001` by default.
- No cloud database or paid WhatsApp API.

### Personalization

Recipient name: `Name`

Message:

```text
Hello {{name}}, this is your scheduled message.
```

The outgoing message becomes:

```text
Hello Name, this is your scheduled message.
```

For several recipients, use the **Multiple recipients** mode. Each recipient may have a separate name and number.

### Yearly schedules

Choose `Yearly`, then select the month, day and time. There are no hard-coded holiday presets.

## Private local files

The following are intentionally excluded from Git and must never be committed:

- `config.local.json`
- `data/whatsapp.db*`
- `data/chromium-profile/`
- `.env`
- logs and temporary files

## Start

```powershell
npm.cmd install
Copy-Item config.example.json config.local.json
npm.cmd start
```

The application stores paths relative to the project directory and does not contain a hard-coded Windows user name.
