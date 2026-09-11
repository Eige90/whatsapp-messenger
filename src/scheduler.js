import {
  addHistory,
  advanceAfterFailure,
  advanceAfterSuccess,
  clearScheduleError,
  detectMissedOccurrences,
  getHistory,
  getMissed,
  listDueSchedules,
  listPendingMissed,
  noteScheduleError,
  resolveMissed
} from "./storage.js";
import { isUncertainSendError, sendWhatsAppMessage } from "./whatsapp.js";
import { renderMessageTemplate } from "./template.js";
import { config } from "./config.js";

let timer = null;
let running = false;
let lastTickAt = Date.now();
let queue = Promise.resolve();
let onMissedChanged = () => {};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function enqueue(task) {
  const next = queue.then(task, task);
  queue = next.catch(() => {});
  return next;
}

function scheduleRecipients(schedule) {
  if (Array.isArray(schedule.recipients) && schedule.recipients.length) return schedule.recipients;
  return [{ name: schedule.recipient_name || "", phone: schedule.phone }];
}

function syntheticScheduleFromHistory(row) {
  return {
    id: row.schedule_id || null,
    phone: row.phone,
    recipient_name: row.recipient_name || "",
    recipients: [{ name: row.recipient_name || "", phone: row.phone }],
    message: row.message,
    recurrence_type: "once"
  };
}

async function sendOne(schedule, recipient, dueAt, triggerType) {
  const renderedMessage = renderMessageTemplate(schedule.message, recipient);
  try {
    const result = await sendWhatsAppMessage(recipient.phone, renderedMessage);
    const sentAt = result.confirmedAt || Date.now();
    addHistory({ schedule, recipient, renderedMessage, dueAt, status: "sent", triggerType, sentAt });
    return { ok: true, sentAt, result, recipient, renderedMessage };
  } catch (error) {
    const status = isUncertainSendError(error) ? "uncertain" : "failed";
    addHistory({ schedule, recipient, renderedMessage, dueAt, status, triggerType, error: error.message });
    return { ok: false, status, error: error.message, recipient, renderedMessage };
  }
}

async function sendSchedule(schedule, dueAt, triggerType = "scheduled") {
  return enqueue(async () => {
    const recipients = scheduleRecipients(schedule);
    const results = [];

    for (let i = 0; i < recipients.length; i += 1) {
      results.push(await sendOne(schedule, recipients[i], dueAt, triggerType));
      if (i < recipients.length - 1) await sleep(Number(config.batchDelayMs || 1500));
    }

    const failed = results.filter((r) => !r.ok);
    const lastSent = results.filter((r) => r.ok).map((r) => r.sentAt).sort((a, b) => b - a)[0] || null;
    if (!failed.length) {
      return { ok: true, sentAt: lastSent || Date.now(), results, recipientCount: recipients.length };
    }

    const uncertain = failed.filter((r) => r.status === "uncertain").length;
    const hardFailed = failed.length - uncertain;
    const summary = `${failed.length} of ${recipients.length} recipient(s) need attention (${hardFailed} failed, ${uncertain} uncertain).`;
    return { ok: false, error: summary, results, sentAt: lastSent, recipientCount: recipients.length };
  });
}

async function normalTick() {
  if (running) return;
  running = true;
  try {
    const now = Date.now();
    const gap = now - lastTickAt;
    lastTickAt = now;

    if (gap > Number(config.suspendDetectionMs || 30000)) {
      detectMissedOccurrences(now);
      onMissedChanged();
      return;
    }

    const due = listDueSchedules(now);
    for (const schedule of due) {
      const dueAt = schedule.next_run_at;
      const result = await sendSchedule(schedule, dueAt, "scheduled");
      if (result.ok) advanceAfterSuccess(schedule, dueAt, result.sentAt);
      else advanceAfterFailure(schedule, dueAt, result.error);
    }
  } finally {
    running = false;
  }
}

export function startScheduler({ missedChanged } = {}) {
  if (typeof missedChanged === "function") onMissedChanged = missedChanged;
  detectMissedOccurrences(Date.now());
  timer = setInterval(normalTick, Number(config.schedulerIntervalMs || 1000));
  timer.unref?.();
  return listPendingMissed();
}

export function stopScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}

export async function resolveMissedActions(actions) {
  const results = [];
  for (const action of actions) {
    const item = getMissed(action.id);
    if (!item || item.missed_status !== "pending") continue;
    if (action.action === "skip") {
      resolveMissed(item.missed_id, "skipped");
      for (const recipient of scheduleRecipients(item.schedule)) {
        const renderedMessage = renderMessageTemplate(item.schedule.message, recipient);
        addHistory({
          schedule: item.schedule,
          recipient,
          renderedMessage,
          dueAt: item.due_at,
          status: "skipped",
          triggerType: "startup",
          resolvedAt: Date.now()
        });
      }
      results.push({ id: item.missed_id, ok: true, action: "skip" });
      continue;
    }
    if (action.action === "send") {
      const result = await sendSchedule(item.schedule, item.due_at, "catch_up");
      if (result.ok) {
        resolveMissed(item.missed_id, "caught_up");
        clearScheduleError(item.schedule.id, result.sentAt);
      } else {
        noteScheduleError(item.schedule.id, result.error);
      }
      results.push({ id: item.missed_id, action: "send", ...result });
    }
  }
  onMissedChanged();
  return results;
}

export async function sendNow(schedule) {
  const result = await sendSchedule(schedule, Date.now(), "manual");
  if (result.ok) clearScheduleError(schedule.id, result.sentAt);
  else noteScheduleError(schedule.id, result.error);
  return result;
}

export async function retryHistory(historyId) {
  const previous = getHistory(historyId);
  if (!previous) throw new Error("History entry not found.");
  if (!new Set(["failed", "uncertain"]).has(previous.status)) {
    throw new Error("Only failed or uncertain messages can be retried.");
  }

  const schedule = syntheticScheduleFromHistory(previous);
  const result = await sendSchedule(schedule, previous.scheduled_for || Date.now(), "retry");
  if (result.ok) clearScheduleError(previous.schedule_id, result.sentAt);
  else noteScheduleError(previous.schedule_id, result.error);
  return result;
}
