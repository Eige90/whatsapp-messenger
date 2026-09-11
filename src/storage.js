import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { DATA_DIR, DB_PATH } from "./config.js";
import { computeNextRun, occurrenceAfter } from "./recurrence.js";

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL,
  recipient_name TEXT NOT NULL DEFAULT '',
  recipients_json TEXT,
  message TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'static',
  automation_json TEXT,
  recurrence_type TEXT NOT NULL,
  once_date TEXT,
  time_of_day TEXT NOT NULL,
  weekly_day INTEGER,
  weekdays_json TEXT,
  yearly_month INTEGER,
  yearly_day INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  next_run_at INTEGER,
  last_sent_at INTEGER,
  last_error TEXT,
  last_attempt_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS message_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  schedule_id INTEGER,
  phone TEXT NOT NULL,
  recipient_name TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  scheduled_for INTEGER,
  sent_at INTEGER,
  resolved_at INTEGER,
  status TEXT NOT NULL,
  trigger_type TEXT NOT NULL DEFAULT 'scheduled',
  error TEXT,
  FOREIGN KEY(schedule_id) REFERENCES schedules(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS missed_occurrences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  schedule_id INTEGER NOT NULL,
  due_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  resolved_at INTEGER,
  UNIQUE(schedule_id, due_at),
  FOREIGN KEY(schedule_id) REFERENCES schedules(id) ON DELETE CASCADE
);
`);

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (columns.some((item) => item.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

ensureColumn("schedules", "last_error", "TEXT");
ensureColumn("schedules", "last_attempt_at", "INTEGER");
ensureColumn("schedules", "recipients_json", "TEXT");
ensureColumn("message_history", "resolved_at", "INTEGER");

function safeJsonArray(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function normalizePhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) {
    throw new Error("Phone number must contain 7 to 15 digits including country code.");
  }
  return digits;
}

function normalizeRecipients(input) {
  const source = Array.isArray(input.recipients) && input.recipients.length
    ? input.recipients
    : [{ name: input.recipient_name || "", phone: input.phone || "" }];

  const recipients = [];
  const seen = new Set();

  for (const item of source) {
    const phone = normalizePhone(item?.phone);
    if (seen.has(phone)) continue;
    seen.add(phone);
    recipients.push({
      name: String(item?.name ?? item?.recipient_name ?? "").trim(),
      phone
    });
  }

  if (!recipients.length) throw new Error("At least one recipient is required.");
  if (recipients.length > 1000) throw new Error("A schedule can contain at most 1000 recipients.");
  return recipients;
}

function hydrate(row) {
  if (!row) return null;
  let recipients = safeJsonArray(row.recipients_json)
    .map((r) => ({ name: String(r?.name || ""), phone: String(r?.phone || "") }))
    .filter((r) => r.phone);

  if (!recipients.length && row.phone) {
    recipients = [{ name: row.recipient_name || "", phone: row.phone }];
  }

  return {
    ...row,
    active: Boolean(row.active),
    weekdays: row.weekdays_json ? safeJsonArray(row.weekdays_json).map(Number) : [],
    recipients,
    recipient_count: recipients.length
  };
}

function normalizeScheduleInput(input) {
  const recurrence = String(input.recurrence_type || "");
  const allowed = new Set(["once", "daily", "weekly", "weekdays", "yearly"]);
  if (!allowed.has(recurrence)) throw new Error("Invalid recurrence type.");

  const message = String(input.message || "").trim();
  if (!message) throw new Error("Message is required.");

  const recipients = normalizeRecipients(input);
  const usesName = /\{\{\s*name\s*\}\}/i.test(message);
  if (usesName && recipients.some((r) => !r.name)) {
    throw new Error('Every recipient needs a name when the message uses {{name}}.');
  }

  const normalized = {
    label: String(input.label || "").trim(),
    phone: recipients[0].phone,
    recipient_name: recipients[0].name,
    recipients,
    message,
    content_type: "static",
    automation_json: null,
    recurrence_type: recurrence,
    once_date: input.once_date || null,
    time_of_day: String(input.time_of_day || ""),
    weekly_day: input.weekly_day === "" || input.weekly_day == null ? null : Number(input.weekly_day),
    weekdays: Array.isArray(input.weekdays) ? input.weekdays.map(Number) : [],
    yearly_month: input.yearly_month == null || input.yearly_month === "" ? null : Number(input.yearly_month),
    yearly_day: input.yearly_day == null || input.yearly_day === "" ? null : Number(input.yearly_day)
  };

  if (!/^\d{2}:\d{2}$/.test(normalized.time_of_day)) throw new Error("Time is required.");
  if (recurrence === "once" && !normalized.once_date) throw new Error("Date is required for a one-time message.");
  if (recurrence === "weekly" && (normalized.weekly_day == null || normalized.weekly_day < 0 || normalized.weekly_day > 6)) throw new Error("Select a weekday.");
  if (recurrence === "weekdays" && normalized.weekdays.length === 0) throw new Error("Select at least one weekday.");
  if (recurrence === "yearly") {
    if (!normalized.yearly_month || normalized.yearly_month < 1 || normalized.yearly_month > 12) throw new Error("Select a valid month.");
    if (!normalized.yearly_day || normalized.yearly_day < 1 || normalized.yearly_day > 31) throw new Error("Select a valid day.");
  }

  const next = computeNextRun(normalized, Date.now());
  if (recurrence === "once" && !next) throw new Error("The one-time date must be in the future.");
  if (!next && recurrence !== "once") throw new Error("Could not calculate the next run.");
  return { ...normalized, next_run_at: next };
}

export function listSchedules() {
  return db.prepare(`
    SELECT * FROM schedules
    ORDER BY CASE WHEN last_error IS NOT NULL AND last_error <> '' THEN 0 ELSE 1 END,
             active DESC,
             COALESCE(next_run_at, 9223372036854775807),
             id DESC
  `).all().map(hydrate);
}

export function getSchedule(id) {
  return hydrate(db.prepare("SELECT * FROM schedules WHERE id = ?").get(Number(id)));
}

export function createSchedule(input) {
  const s = normalizeScheduleInput(input);
  const now = Date.now();
  const result = db.prepare(`
    INSERT INTO schedules (
      label, phone, recipient_name, recipients_json, message, content_type, automation_json,
      recurrence_type, once_date, time_of_day, weekly_day, weekdays_json,
      yearly_month, yearly_day, active, next_run_at, last_error, last_attempt_at,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, NULL, NULL, ?, ?)
  `).run(
    s.label, s.phone, s.recipient_name, JSON.stringify(s.recipients), s.message, s.content_type, s.automation_json,
    s.recurrence_type, s.once_date, s.time_of_day, s.weekly_day, JSON.stringify(s.weekdays),
    s.yearly_month, s.yearly_day, s.next_run_at, now, now
  );
  return getSchedule(result.lastInsertRowid);
}

export function updateSchedule(id, input) {
  const existing = getSchedule(id);
  if (!existing) throw new Error("Schedule not found.");
  const s = normalizeScheduleInput(input);
  db.prepare(`
    UPDATE schedules SET
      label=?, phone=?, recipient_name=?, recipients_json=?, message=?, recurrence_type=?, once_date=?,
      time_of_day=?, weekly_day=?, weekdays_json=?, yearly_month=?, yearly_day=?,
      next_run_at=?, active=1, last_error=NULL, updated_at=?
    WHERE id=?
  `).run(
    s.label, s.phone, s.recipient_name, JSON.stringify(s.recipients), s.message, s.recurrence_type, s.once_date,
    s.time_of_day, s.weekly_day, JSON.stringify(s.weekdays), s.yearly_month, s.yearly_day,
    s.next_run_at, Date.now(), Number(id)
  );
  db.prepare("DELETE FROM missed_occurrences WHERE schedule_id = ? AND status = 'pending'").run(Number(id));
  return getSchedule(id);
}

export function deleteSchedule(id) {
  db.prepare("DELETE FROM schedules WHERE id = ?").run(Number(id));
}

export function setScheduleActive(id, active) {
  const schedule = getSchedule(id);
  if (!schedule) throw new Error("Schedule not found.");
  const next = active ? computeNextRun(schedule, Date.now()) : null;
  if (active && !next) throw new Error("This schedule has no future occurrence. Edit it before activating it again.");
  db.prepare("UPDATE schedules SET active=?, next_run_at=?, last_error=CASE WHEN ? THEN NULL ELSE last_error END, updated_at=? WHERE id=?")
    .run(active ? 1 : 0, next, active ? 1 : 0, Date.now(), Number(id));
  return getSchedule(id);
}

export function listDueSchedules(now = Date.now()) {
  return db.prepare("SELECT * FROM schedules WHERE active=1 AND next_run_at IS NOT NULL AND next_run_at <= ? ORDER BY next_run_at ASC").all(now).map(hydrate);
}

export function advanceAfterSuccess(schedule, dueAt, sentAt) {
  const now = Date.now();
  if (schedule.recurrence_type === "once") {
    db.prepare(`
      UPDATE schedules
      SET active=0, next_run_at=NULL, last_sent_at=?, last_error=NULL, last_attempt_at=?, updated_at=?
      WHERE id=?
    `).run(sentAt, sentAt, now, schedule.id);
    return;
  }
  const next = occurrenceAfter(schedule, dueAt);
  db.prepare(`
    UPDATE schedules
    SET next_run_at=?, last_sent_at=?, last_error=NULL, last_attempt_at=?, updated_at=?
    WHERE id=?
  `).run(next, sentAt, sentAt, now, schedule.id);
}

export function advanceAfterFailure(schedule, dueAt, errorMessage) {
  const now = Date.now();
  if (schedule.recurrence_type === "once") {
    db.prepare(`
      UPDATE schedules
      SET active=0, next_run_at=NULL, last_error=?, last_attempt_at=?, updated_at=?
      WHERE id=?
    `).run(String(errorMessage || "Send failed."), now, now, schedule.id);
    return;
  }
  const next = occurrenceAfter(schedule, dueAt);
  db.prepare(`
    UPDATE schedules
    SET next_run_at=?, last_error=?, last_attempt_at=?, updated_at=?
    WHERE id=?
  `).run(next, String(errorMessage || "Send failed."), now, now, schedule.id);
}

export function clearScheduleError(scheduleId, sentAt = null) {
  if (!scheduleId) return;
  db.prepare(`
    UPDATE schedules
    SET last_error=NULL, last_sent_at=COALESCE(?, last_sent_at), last_attempt_at=?, updated_at=?
    WHERE id=?
  `).run(sentAt, Date.now(), Date.now(), Number(scheduleId));
}

export function noteScheduleError(scheduleId, errorMessage) {
  if (!scheduleId) return;
  db.prepare("UPDATE schedules SET last_error=?, last_attempt_at=?, updated_at=? WHERE id=?")
    .run(String(errorMessage || "Send failed."), Date.now(), Date.now(), Number(scheduleId));
}

export function addHistory({ schedule, recipient = null, renderedMessage = null, dueAt = null, status, triggerType = "scheduled", error = null, sentAt = null, resolvedAt = null }) {
  const result = db.prepare(`
    INSERT INTO message_history (schedule_id, phone, recipient_name, message, scheduled_for, sent_at, resolved_at, status, trigger_type, error)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    schedule?.id ?? null,
    recipient?.phone || schedule?.phone || "",
    recipient?.name ?? schedule?.recipient_name ?? "",
    renderedMessage ?? schedule?.message ?? "",
    dueAt,
    sentAt,
    resolvedAt,
    status,
    triggerType,
    error
  );
  return Number(result.lastInsertRowid);
}

export function listHistory(limit = 100) {
  const safe = Math.max(1, Math.min(Number(limit) || 100, 500));
  return db.prepare("SELECT * FROM message_history ORDER BY id DESC LIMIT ?").all(safe);
}

export function getHistory(id) {
  return db.prepare("SELECT * FROM message_history WHERE id = ?").get(Number(id)) || null;
}

export function clearHistory() {
  db.prepare("DELETE FROM message_history").run();
}

export function detectMissedOccurrences(now = Date.now()) {
  const schedules = db.prepare("SELECT * FROM schedules WHERE active=1 AND next_run_at IS NOT NULL AND next_run_at < ? ORDER BY next_run_at ASC").all(now).map(hydrate);
  const insert = db.prepare("INSERT OR IGNORE INTO missed_occurrences (schedule_id, due_at, status) VALUES (?, ?, 'pending')");
  const update = db.prepare("UPDATE schedules SET next_run_at=?, active=?, updated_at=? WHERE id=?");

  db.exec("BEGIN IMMEDIATE");
  try {
    for (const schedule of schedules) {
      let due = schedule.next_run_at;
      let count = 0;
      while (due != null && due < now && count < 1000) {
        insert.run(schedule.id, due);
        count += 1;
        if (schedule.recurrence_type === "once") {
          due = null;
          update.run(null, 0, Date.now(), schedule.id);
          break;
        }
        due = occurrenceAfter(schedule, due);
      }
      if (schedule.recurrence_type !== "once") update.run(due, 1, Date.now(), schedule.id);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return listPendingMissed();
}

export function listPendingMissed() {
  return db.prepare(`
    SELECT m.id AS missed_id, m.due_at, m.status AS missed_status,
           s.*
    FROM missed_occurrences m
    JOIN schedules s ON s.id = m.schedule_id
    WHERE m.status = 'pending'
    ORDER BY m.due_at ASC
  `).all().map((row) => ({
    missed_id: row.missed_id,
    due_at: row.due_at,
    schedule: hydrate(row)
  }));
}

export function resolveMissed(id, status) {
  if (!new Set(["caught_up", "skipped"]).has(status)) throw new Error("Invalid missed status.");
  db.prepare("UPDATE missed_occurrences SET status=?, resolved_at=? WHERE id=? AND status='pending'").run(status, Date.now(), Number(id));
}

export function getMissed(id) {
  const row = db.prepare(`
    SELECT m.id AS missed_id, m.due_at, m.status AS missed_status, s.*
    FROM missed_occurrences m JOIN schedules s ON s.id=m.schedule_id
    WHERE m.id=?
  `).get(Number(id));
  if (!row) return null;
  return { missed_id: row.missed_id, due_at: row.due_at, missed_status: row.missed_status, schedule: hydrate(row) };
}

export function counts() {
  const active = db.prepare("SELECT COUNT(*) AS n FROM schedules WHERE active=1").get().n;
  const missed = db.prepare("SELECT COUNT(*) AS n FROM missed_occurrences WHERE status='pending'").get().n;
  const sent = db.prepare("SELECT COUNT(*) AS n FROM message_history WHERE status='sent'").get().n;
  const failed = db.prepare("SELECT COUNT(*) AS n FROM message_history WHERE status='failed'").get().n;
  const uncertain = db.prepare("SELECT COUNT(*) AS n FROM message_history WHERE status='uncertain'").get().n;
  return { active, missed, sent, failed, uncertain };
}

export function closeDatabase() {
  db.close();
}
