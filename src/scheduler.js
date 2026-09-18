import crypto from "node:crypto";
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
import {
  isUncertainSendError,
  sendWhatsAppMessage,
  verifyWhatsAppSendEvidence
} from "./whatsapp.js";
import { askGemini } from "./gemini.js";
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
    label: row.schedule_label || "",
    phone: row.phone,
    recipient_name: row.recipient_name || "",
    recipients: [{ name: row.recipient_name || "", phone: row.phone }],
    message: row.message,
    content_type: "static",
    automation: null,
    recurrence_type: "once"
  };
}

function schedulePrompt(schedule) {
  return String(schedule?.automation?.prompt || "").trim();
}

function skippedMessagePreview(schedule, recipient) {
  if (schedule.content_type === "gemini") {
    const prompt = renderMessageTemplate(schedulePrompt(schedule), recipient);
    return `[Gemini prompt not generated]\n${prompt}`;
  }
  return renderMessageTemplate(schedule.message, recipient);
}

async function buildMessage(schedule, recipient) {
  if (schedule.content_type === "gemini") {
    const promptTemplate = schedulePrompt(schedule);
    if (!promptTemplate) throw new Error("Gemini schedule has no prompt.");
    const prompt = renderMessageTemplate(promptTemplate, recipient);
    const maxAttempts = Math.max(1, Math.min(Number(config.geminiGenerationRetries || 3), 5));
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const generated = await askGemini(prompt, { newChat: true });
        const answer = String(generated.answer || "").trim();
        if (!answer) throw new Error("Gemini returned an empty response.");
        return { renderedMessage: answer, generatedBy: "gemini", prompt };
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts) {
          console.warn(`Gemini generation attempt ${attempt}/${maxAttempts} failed for ${recipient.name || recipient.phone}: ${error.message}`);
          await sleep(Number(config.geminiGenerationRetryDelayMs || 3000));
        }
      }
    }

    throw new Error(`Gemini generation failed after ${maxAttempts} attempt(s): ${lastError?.message || "unknown error"}`);
  }

  return {
    renderedMessage: renderMessageTemplate(schedule.message, recipient),
    generatedBy: "static",
    prompt: null
  };
}

function publicAttempt(attempt) {
  return {
    round: attempt.round,
    at: attempt.at,
    status: attempt.status,
    error: attempt.error || null,
    confirmation: attempt.confirmation || null,
    recovered: Boolean(attempt.recovered)
  };
}

function createRecipientState(schedule, recipient) {
  return {
    recipient,
    renderedMessage: schedule.content_type === "gemini"
      ? ""
      : renderMessageTemplate(schedule.message, recipient),
    generatedBy: schedule.content_type === "gemini" ? "gemini" : "static",
    prompt: null,
    generationAttempted: schedule.content_type !== "gemini",
    success: false,
    sentAt: null,
    finalStatus: null,
    finalError: null,
    attempts: [],
    lastSendMeta: null
  };
}

async function ensureRecipientMessage(schedule, state) {
  if (state.renderedMessage) return true;
  if (state.generationAttempted) return false;

  state.generationAttempted = true;
  try {
    const built = await buildMessage(schedule, state.recipient);
    state.renderedMessage = built.renderedMessage;
    state.generatedBy = built.generatedBy;
    state.prompt = built.prompt;
    return true;
  } catch (error) {
    state.finalStatus = "failed";
    state.finalError = `Message generation failed: ${error.message}`;
    state.attempts.push({ round: 0, at: Date.now(), status: "generation-failed", error: error.message });
    return false;
  }
}

async function maybeRecoverUncertain(state, round) {
  if (!state.lastSendMeta?.sendAttempted || !Number.isFinite(state.lastSendMeta?.baseline)) return false;

  try {
    const evidence = await verifyWhatsAppSendEvidence(
      state.recipient.phone,
      state.renderedMessage,
      Number(state.lastSendMeta.baseline)
    );
    if (!evidence.confirmed) return false;

    state.success = true;
    state.sentAt = evidence.confirmedAt || Date.now();
    state.finalStatus = "sent";
    state.finalError = null;
    state.attempts.push({
      round,
      at: Date.now(),
      status: "verified-before-retry",
      confirmation: evidence.method,
      recovered: true
    });
    return true;
  } catch {
    return false;
  }
}

async function performRecipientAttempt(state, round) {
  if (state.success || state.finalStatus === "failed" && !state.renderedMessage) return;

  // If the previous attempt reached WhatsApp but confirmation was uncertain,
  // verify the exact outgoing message before sending again. This reduces duplicate sends.
  if (state.finalStatus === "uncertain") {
    const recovered = await maybeRecoverUncertain(state, round);
    if (recovered) return;
  }

  try {
    const result = await sendWhatsAppMessage(state.recipient.phone, state.renderedMessage);
    state.success = true;
    state.sentAt = result.confirmedAt || Date.now();
    state.finalStatus = "sent";
    state.finalError = null;
    state.lastSendMeta = result.sendMeta || null;
    state.attempts.push({
      round,
      at: Date.now(),
      status: "sent",
      confirmation: result.confirmation || null,
      recovered: Boolean(result.recoveredFrom)
    });
  } catch (error) {
    const uncertain = isUncertainSendError(error);
    state.finalStatus = uncertain ? "uncertain" : "failed";
    state.finalError = error.message;
    state.lastSendMeta = error.sendMeta || null;
    state.attempts.push({
      round,
      at: Date.now(),
      status: state.finalStatus,
      error: error.message
    });
  }
}

async function sendSchedule(schedule, dueAt, triggerType = "scheduled") {
  return enqueue(async () => {
    const recipients = scheduleRecipients(schedule);
    const runId = crypto.randomUUID();
    const maxRounds = Math.max(1, Math.min(Number(config.sendRetryRounds || 3), 5));
    const states = recipients.map((recipient) => createRecipientState(schedule, recipient));

    // Gemini batches are intentionally processed recipient-by-recipient:
    // generate for one recipient, send it, confirm it, then move to the next.
    // This avoids leaving WhatsApp with a filled composer while Gemini work for
    // other recipients is still happening in another tab.
    // Retry strategy: complete a full pass across all pending recipients first.
    // Only after that pass do we start the next retry round. This is gentler on WhatsApp Web
    // and matches the dashboard model of one campaign with several recipients.
    for (let round = 1; round <= maxRounds; round += 1) {
      const pending = states.filter((state) =>
        !state.success && (state.renderedMessage || !state.generationAttempted)
      );
      if (!pending.length) break;

      console.log(`WhatsApp send run ${runId}: round ${round}/${maxRounds}, ${pending.length} recipient(s) pending.`);

      for (let i = 0; i < pending.length; i += 1) {
        const state = pending[i];
        const messageReady = await ensureRecipientMessage(schedule, state);
        if (messageReady) await performRecipientAttempt(state, round);
        if (i < pending.length - 1) await sleep(Number(config.batchDelayMs || 2000));
      }

      const stillPending = states.filter((state) => !state.success && state.renderedMessage);
      if (stillPending.length && round < maxRounds) {
        await sleep(Number(config.retryRoundDelayMs || 4000));
      }
    }

    const results = states.map((state) => ({
      ok: state.success,
      status: state.success ? "sent" : (state.finalStatus || "failed"),
      error: state.success ? null : (state.finalError || "Send failed."),
      recipient: state.recipient,
      renderedMessage: state.renderedMessage || skippedMessagePreview(schedule, state.recipient),
      sentAt: state.sentAt,
      attemptCount: state.attempts.filter((a) => ["sent", "failed", "uncertain"].includes(a.status)).length,
      attempts: state.attempts.map(publicAttempt),
      generatedBy: state.generatedBy
    }));

    for (const result of results) {
      addHistory({
        schedule,
        recipient: result.recipient,
        renderedMessage: result.renderedMessage,
        dueAt,
        status: result.status,
        triggerType,
        error: result.error,
        sentAt: result.sentAt,
        runId,
        attemptCount: result.attemptCount,
        attempts: result.attempts
      });
    }

    const failed = results.filter((r) => !r.ok);
    const lastSent = results.filter((r) => r.ok).map((r) => r.sentAt).sort((a, b) => b - a)[0] || null;

    if (!failed.length) {
      return {
        ok: true,
        sentAt: lastSent || Date.now(),
        results,
        recipientCount: recipients.length,
        runId,
        rounds: maxRounds
      };
    }

    const uncertain = failed.filter((r) => r.status === "uncertain").length;
    const hardFailed = failed.length - uncertain;
    const summary = `${failed.length} of ${recipients.length} recipient(s) still need attention after up to ${maxRounds} round(s) (${hardFailed} failed, ${uncertain} uncertain).`;
    return {
      ok: false,
      error: summary,
      results,
      sentAt: lastSent,
      recipientCount: recipients.length,
      runId,
      rounds: maxRounds
    };
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
      const runId = crypto.randomUUID();
      for (const recipient of scheduleRecipients(item.schedule)) {
        addHistory({
          schedule: item.schedule,
          recipient,
          renderedMessage: skippedMessagePreview(item.schedule, recipient),
          dueAt: item.due_at,
          status: "skipped",
          triggerType: "startup",
          resolvedAt: Date.now(),
          runId,
          attemptCount: 0,
          attempts: []
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

  // Retry sends the exact text that was already generated/stored in history.
  // It still uses the same three-round retry strategy, but never regenerates Gemini text.
  const schedule = syntheticScheduleFromHistory(previous);
  const result = await sendSchedule(schedule, previous.scheduled_for || Date.now(), "retry");
  if (result.ok) clearScheduleError(previous.schedule_id, result.sentAt);
  else noteScheduleError(previous.schedule_id, result.error);
  return result;
}
