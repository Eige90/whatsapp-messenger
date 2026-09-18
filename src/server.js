import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config, DB_PATH, ROOT_DIR } from "./config.js";
import {
  closeDatabase,
  clearHistory,
  counts,
  createContact,
  createSchedule,
  deleteContact,
  deleteSchedule,
  getContact,
  getSchedule,
  listContacts,
  listHistory,
  listPendingMissed,
  listSchedules,
  setScheduleActive,
  updateContact,
  updateSchedule
} from "./storage.js";
import { recurrenceLabel } from "./recurrence.js";
import { ensureDashboardOpen, focusChromium, focusDashboard, focusGemini, onChromiumClosed, stopChromium } from "./chromium.js";
import { ensureWhatsAppOpen, whatsappStatus } from "./whatsapp.js";
import { askGemini, geminiStatus, initializeGemini } from "./gemini.js";
import { resolveMissedActions, retryHistory, sendNow, startScheduler, stopScheduler } from "./scheduler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(ROOT_DIR, "public")));

function jsonError(res, error, status = 400) {
  console.error(error);
  res.status(status).json({ error: error.message || String(error) });
}

app.get("/api/status", (_req, res) => {
  res.json({
    ok: true,
    version: "1.4.2",
    localhostOnly: true,
    whatsapp: whatsappStatus(),
    gemini: geminiStatus(),
    counts: counts(),
    now: Date.now()
  });
});


app.get("/api/contacts", (_req, res) => {
  try { res.json(listContacts()); }
  catch (error) { jsonError(res, error, 500); }
});

app.post("/api/contacts", (req, res) => {
  try { res.status(201).json(createContact(req.body)); }
  catch (error) { jsonError(res, error); }
});

app.put("/api/contacts/:id", (req, res) => {
  try { res.json(updateContact(req.params.id, req.body)); }
  catch (error) { jsonError(res, error); }
});

app.delete("/api/contacts/:id", (req, res) => {
  try { deleteContact(req.params.id); res.status(204).end(); }
  catch (error) { jsonError(res, error, 500); }
});

app.get("/api/schedules", (_req, res) => {
  const rows = listSchedules().map((s) => ({ ...s, recurrence_label: recurrenceLabel(s) }));
  res.json(rows);
});

app.post("/api/schedules", (req, res) => {
  try { res.status(201).json(createSchedule(req.body)); }
  catch (error) { jsonError(res, error); }
});

app.put("/api/schedules/:id", (req, res) => {
  try { res.json(updateSchedule(req.params.id, req.body)); }
  catch (error) { jsonError(res, error); }
});

app.delete("/api/schedules/:id", (req, res) => {
  try { deleteSchedule(req.params.id); res.status(204).end(); }
  catch (error) { jsonError(res, error); }
});

app.post("/api/schedules/:id/toggle", (req, res) => {
  try { res.json(setScheduleActive(req.params.id, Boolean(req.body.active))); }
  catch (error) { jsonError(res, error); }
});

app.post("/api/schedules/:id/send-now", async (req, res) => {
  try {
    const schedule = getSchedule(req.params.id);
    if (!schedule) return res.status(404).json({ error: "Schedule not found." });
    const result = await sendNow(schedule);
    res.status(result.ok ? 200 : 500).json(result);
  } catch (error) { jsonError(res, error, 500); }
});

app.get("/api/history", (req, res) => res.json(listHistory(req.query.limit)));
app.delete("/api/history", (_req, res) => {
  try { clearHistory(); res.status(204).end(); }
  catch (error) { jsonError(res, error, 500); }
});
app.post("/api/history/:id/retry", async (req, res) => {
  try {
    const result = await retryHistory(req.params.id);
    res.status(result.ok ? 200 : 500).json(result);
  } catch (error) { jsonError(res, error, 500); }
});

app.get("/api/missed", (_req, res) => res.json(listPendingMissed()));
app.post("/api/missed/resolve", async (req, res) => {
  try {
    const actions = Array.isArray(req.body.actions) ? req.body.actions : [];
    res.json(await resolveMissedActions(actions));
  } catch (error) { jsonError(res, error, 500); }
});


app.get("/api/gemini/status", (_req, res) => {
  res.json(geminiStatus());
});

app.post("/api/gemini/focus", async (_req, res) => {
  try { await focusGemini(); res.json({ ok: true }); }
  catch (error) { jsonError(res, error, 500); }
});

app.post("/api/gemini/ask", async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || "").trim();
    if (!prompt) return res.status(400).json({ error: "Prompt is required." });
    const result = await askGemini(prompt, { newChat: req.body?.newChat !== false });
    res.json(result);
  } catch (error) { jsonError(res, error, 500); }
});

app.post("/api/chromium/focus", async (_req, res) => {
  try { await focusChromium(); res.json({ ok: true }); }
  catch (error) { jsonError(res, error, 500); }
});

app.use((_req, res) => res.sendFile(path.join(ROOT_DIR, "public", "index.html")));

const server = app.listen(Number(config.port), "127.0.0.1", async () => {
  const url = `http://localhost:${config.port}`;
  console.log(`\nWhatsApp Messenger Local v1.4.2`);
  console.log(`Dashboard: ${url}`);
  console.log(`Data: ${DB_PATH}`);
  console.log(`Scheduler interval: ${config.schedulerIntervalMs} ms`);
  console.log("Localhost only. No cloud service is used.\n");

  startScheduler();
  try {
    await ensureWhatsAppOpen();
    await initializeGemini().catch((error) => console.error("Gemini:", error.message));
    await ensureDashboardOpen(url);
    await focusDashboard();
  } catch (error) {
    console.error("Chromium / WhatsApp:", error.message);
  }
});

let shuttingDown = false;

async function shutdown(reason = "signal") {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(reason === "chromium"
    ? "\nChromium was closed. Stopping WhatsApp Messenger…"
    : "\nShutting down…");
  stopScheduler();
  await new Promise((resolve) => server.close(resolve));
  if (reason !== "chromium") await stopChromium();
  closeDatabase();
  process.exit(0);
}

onChromiumClosed(() => shutdown("chromium"));
process.on("SIGINT", () => shutdown("signal"));
process.on("SIGTERM", () => shutdown("signal"));
