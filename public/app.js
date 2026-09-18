const $ = (id) => document.getElementById(id);
const state = {
  schedules: [],
  contacts: [],
  missed: [],
  editingId: null,
  editingContactId: null,
  recipientMode: "single",
  contentSource: "static"
};

const fmt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const timeFmt = new Intl.DateTimeFormat(undefined, { timeStyle: "medium" });
const fmtDate = (ms) => ms ? fmt.format(new Date(ms)) : "—";

function fmtDelay(scheduled, sent) {
  if (!scheduled || !sent) return "—";
  const seconds = Math.round((sent - scheduled) / 1000);
  if (Math.abs(seconds) < 60) return `${seconds >= 0 ? "+" : ""}${seconds}s`;
  const minutes = Math.round(seconds / 60);
  return `${minutes >= 0 ? "+" : ""}${minutes}m`;
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    cache: "no-store",
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `${response.status} ${response.statusText}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[c]));
}

function setDefaultDateTime() {
  const d = new Date(Date.now() + 5 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  $("onceDate").value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  $("timeOfDay").value = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fillDateSelectors() {
  const month = $("yearlyMonth");
  const day = $("yearlyDay");
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  month.innerHTML = months.map((m, i) => `<option value="${i+1}">${m}</option>`).join("");
  day.innerHTML = Array.from({length:31}, (_, i) => `<option value="${i+1}">${i+1}</option>`).join("");
}

function updateDynamicFields() {
  const type = $("recurrenceType").value;
  $("onceFields").classList.toggle("hidden", type !== "once");
  $("weeklyFields").classList.toggle("hidden", type !== "weekly");
  $("weekdaysFields").classList.toggle("hidden", type !== "weekdays");
  $("yearlyFields").classList.toggle("hidden", type !== "yearly");
}

function addRecipientRow(name = "", phone = "") {
  const row = document.createElement("div");
  row.className = "recipient-row";
  row.innerHTML = `
    <input class="recipient-row-name" placeholder="Name" maxlength="120" value="${escapeHtml(name)}" />
    <input class="recipient-row-phone" placeholder="491234567890" inputmode="tel" value="${escapeHtml(phone)}" />
    <button type="button" class="danger remove-recipient" title="Remove recipient">×</button>
  `;
  row.querySelector(".remove-recipient").addEventListener("click", () => {
    row.remove();
    if (!$("recipientRows").children.length) addRecipientRow();
  });
  $("recipientRows").appendChild(row);
}

function setRecipientMode(mode) {
  state.recipientMode = mode === "multiple" ? "multiple" : "single";
  $("singleRecipientFields").classList.toggle("hidden", state.recipientMode !== "single");
  $("multipleRecipientFields").classList.toggle("hidden", state.recipientMode !== "multiple");
  document.querySelectorAll(".mode-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === state.recipientMode);
  });
  if (state.recipientMode === "multiple" && !$("recipientRows").children.length) addRecipientRow();
}

function setContentSource(source) {
  state.contentSource = source === "gemini" ? "gemini" : "static";
  $("staticMessageFields").classList.toggle("hidden", state.contentSource !== "static");
  $("geminiMessageFields").classList.toggle("hidden", state.contentSource !== "gemini");
  document.querySelectorAll(".source-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.source === state.contentSource);
  });
}

function collectRecipients() {
  if (state.recipientMode === "single") {
    return [{ name: $("recipientName").value.trim(), phone: $("phone").value.trim() }];
  }
  return [...document.querySelectorAll(".recipient-row")]
    .map((row) => ({
      name: row.querySelector(".recipient-row-name").value.trim(),
      phone: row.querySelector(".recipient-row-phone").value.trim()
    }))
    .filter((item) => item.name || item.phone);
}

function formData() {
  const recipients = collectRecipients();
  return {
    label: $("label").value,
    recipient_name: recipients[0]?.name || "",
    phone: recipients[0]?.phone || "",
    recipients,
    content_type: state.contentSource,
    message: state.contentSource === "static" ? $("message").value : "",
    gemini_prompt: state.contentSource === "gemini" ? $("geminiPrompt").value : "",
    recurrence_type: $("recurrenceType").value,
    time_of_day: $("timeOfDay").value,
    once_date: $("onceDate").value || null,
    weekly_day: $("weeklyDay").value,
    weekdays: [...document.querySelectorAll('input[name="weekday"]:checked')].map((el) => Number(el.value)),
    yearly_month: $("yearlyMonth").value,
    yearly_day: $("yearlyDay").value
  };
}

function resetRecipients() {
  $("recipientName").value = "";
  $("phone").value = "";
  $("recipientRows").innerHTML = "";
  addRecipientRow();
  $("bulkRecipients").value = "";
  setRecipientMode("single");
}

function resetForm() {
  state.editingId = null;
  $("scheduleId").value = "";
  $("scheduleForm").reset();
  $("formTitle").textContent = "Create message";
  $("saveButton").textContent = "Save schedule";
  $("cancelEdit").classList.add("hidden");
  document.querySelectorAll('input[name="weekday"]').forEach((el) => el.checked = false);
  resetRecipients();
  setContentSource("static");
  $("geminiPreview").value = "";
  $("geminiTestMessage").textContent = "";
  setDefaultDateTime();
  updateDynamicFields();
  $("formMessage").textContent = "";
}

function editSchedule(id) {
  const s = state.schedules.find((x) => x.id === id);
  if (!s) return;
  state.editingId = id;
  $("label").value = s.label || "";
  setContentSource(s.content_type === "gemini" ? "gemini" : "static");
  $("message").value = s.message || "";
  $("geminiPrompt").value = s.automation?.prompt || "";
  $("geminiPreview").value = "";
  $("recurrenceType").value = s.recurrence_type;
  $("timeOfDay").value = s.time_of_day;
  $("onceDate").value = s.once_date || "";
  $("weeklyDay").value = s.weekly_day ?? 1;
  $("yearlyMonth").value = s.yearly_month ?? 1;
  $("yearlyDay").value = s.yearly_day ?? 1;
  document.querySelectorAll('input[name="weekday"]').forEach((el) => el.checked = (s.weekdays || []).includes(Number(el.value)));

  const recipients = Array.isArray(s.recipients) && s.recipients.length
    ? s.recipients
    : [{ name: s.recipient_name || "", phone: s.phone }];

  if (recipients.length > 1) {
    setRecipientMode("multiple");
    $("recipientRows").innerHTML = "";
    recipients.forEach((r) => addRecipientRow(r.name, r.phone));
  } else {
    setRecipientMode("single");
    $("recipientName").value = recipients[0]?.name || "";
    $("phone").value = recipients[0]?.phone || "";
  }

  $("formTitle").textContent = "Edit message";
  $("saveButton").textContent = "Save changes";
  $("cancelEdit").classList.remove("hidden");
  updateDynamicFields();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function loadStatus() {
  const data = await api(`/api/status?_=${Date.now()}`);
  const wa = data.whatsapp;
  $("waState").textContent = wa.phase === "connected" ? "WhatsApp connected" : `WhatsApp ${wa.phase}`;
  $("waDetail").textContent = wa.detail || wa.chromium?.detail || "";
  $("waDot").className = `dot ${wa.phase}`;

  const gemini = data.gemini || { phase: "waiting", detail: "Gemini status unavailable." };
  $("geminiState").textContent = gemini.phase === "ready" ? "Gemini ready" : `Gemini ${gemini.phase}`;
  $("geminiDetail").textContent = gemini.detail || "";
  $("geminiDot").className = `dot ${gemini.phase === "ready" ? "connected" : gemini.phase}`;

  const c = data.counts;
  $("stats").innerHTML = [
    ["Active schedules", c.active],
    ["Missed waiting", c.missed],
    ["Sent", c.sent],
    ["Uncertain", c.uncertain ?? 0],
    ["Failed", c.failed]
  ].map(([label, value]) => `<div class="stat"><span>${label}</span><strong>${value}</strong></div>`).join("");
}

function recipientsSummary(s) {
  const recipients = Array.isArray(s.recipients) ? s.recipients : [];
  if (recipients.length <= 1) return escapeHtml(recipients[0]?.phone || s.phone);
  const named = recipients.slice(0, 3).map((r) => r.name || r.phone).join(", ");
  return `${recipients.length} recipients · ${escapeHtml(named)}${recipients.length > 3 ? "…" : ""}`;
}

function schedulePreview(s) {
  if (s.content_type === "gemini") {
    return `<div class="source-chip gemini-chip">Gemini Web</div><div class="message-preview">${escapeHtml(s.automation?.prompt || "")}</div>`;
  }
  return `<div class="source-chip">Static text</div><div class="message-preview">${escapeHtml(s.message || "")}</div>`;
}

async function loadSchedules() {
  state.schedules = await api(`/api/schedules?_=${Date.now()}`);
  const box = $("schedules");
  if (!state.schedules.length) {
    box.innerHTML = '<div class="empty">No schedules yet.</div>';
    return;
  }
  box.innerHTML = state.schedules.map((s) => {
    const needsAttention = Boolean(s.last_error);
    const badge = needsAttention ? "Needs attention" : (s.active ? "Active" : "Paused / complete");
    return `
    <div class="schedule ${s.active ? "" : "inactive"} ${needsAttention ? "needs-attention" : ""}">
      <div class="schedule-top">
        <div>
          <div class="schedule-title">${escapeHtml(s.label || s.recipient_name || s.phone)}</div>
          <div class="schedule-meta">${recipientsSummary(s)} · ${escapeHtml(s.recurrence_label)}</div>
          <div class="schedule-meta">Next: ${fmtDate(s.next_run_at)}</div>
          ${s.last_sent_at ? `<div class="schedule-meta">Last sent: ${fmtDate(s.last_sent_at)}</div>` : ""}
        </div>
        <span class="badge ${s.active && !needsAttention ? "on" : ""} ${needsAttention ? "warning-badge" : ""}">${badge}</span>
      </div>
      ${needsAttention ? `<div class="schedule-error">${escapeHtml(s.last_error)}</div>` : ""}
      ${schedulePreview(s)}
      <div class="schedule-actions">
        <button class="ghost" data-action="edit" data-id="${s.id}">Edit</button>
        ${s.active ? `<button class="ghost" data-action="toggle" data-id="${s.id}">Pause</button>` : (s.recurrence_type !== "once" ? `<button class="ghost" data-action="toggle" data-id="${s.id}">Activate</button>` : "")}
        <button class="ghost" data-action="send" data-id="${s.id}">Send now</button>
        <button class="danger" data-action="delete" data-id="${s.id}">Delete</button>
      </div>
    </div>`;
  }).join("");
}

function historyGroups(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = row.run_id || `legacy-${row.id}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        runId: row.run_id || null,
        label: row.schedule_label || "",
        scheduledFor: row.scheduled_for || null,
        triggerType: row.trigger_type || "scheduled",
        rows: []
      });
    }
    map.get(key).rows.push(row);
  }
  return [...map.values()].sort((a, b) => {
    const aId = Math.max(...a.rows.map((r) => Number(r.id) || 0));
    const bId = Math.max(...b.rows.map((r) => Number(r.id) || 0));
    return bId - aId;
  });
}

function statusCounts(rows) {
  const counts = { sent: 0, failed: 0, uncertain: 0, skipped: 0 };
  for (const row of rows) counts[row.status] = (counts[row.status] || 0) + 1;
  return counts;
}

function runStatusClass(counts) {
  if (counts.failed) return "failed";
  if (counts.uncertain) return "uncertain";
  if (counts.sent) return "sent";
  return "skipped";
}

function attemptsLabel(h) {
  const n = Number(h.attempt_count || 0);
  if (!n) return "—";
  return `${n}/3`;
}

function runSummaryText(group, counts) {
  const total = group.rows.length;
  const parts = [`${total} recipient${total === 1 ? "" : "s"}`];
  if (counts.sent) parts.push(`${counts.sent} sent`);
  if (counts.failed) parts.push(`${counts.failed} failed`);
  if (counts.uncertain) parts.push(`${counts.uncertain} uncertain`);
  if (counts.skipped) parts.push(`${counts.skipped} skipped`);
  return parts.join(" · ");
}

async function loadHistory() {
  const rows = await api(`/api/history?limit=2000&_=${Date.now()}`);
  const groups = historyGroups(rows);
  const box = $("history");

  if (!groups.length) {
    box.innerHTML = '<div class="empty">No activity yet.</div>';
    return;
  }

  box.innerHTML = groups.map((group) => {
    const counts = statusCounts(group.rows);
    const statusClass = runStatusClass(counts);
    const title = group.label || (group.rows.length > 1 ? "Multi-recipient message" : (group.rows[0].recipient_name || group.rows[0].phone));
    const maxAttempts = Math.max(...group.rows.map((r) => Number(r.attempt_count || 0)), 0);
    const firstMessage = group.rows[0]?.message || "";
    const personalized = group.rows.some((r) => r.message !== firstMessage);

    const details = group.rows.map((h) => `
      <div class="history-recipient status-${escapeHtml(h.status)}">
        <div class="history-recipient-main">
          <div>
            <strong>${escapeHtml(h.recipient_name || h.phone)}</strong>
            <small>${escapeHtml(h.phone)}</small>
          </div>
          <span class="history-status-pill ${escapeHtml(h.status)}">${escapeHtml(h.status)}</span>
        </div>
        <div class="history-recipient-grid">
          <div><span>Message</span><p>${escapeHtml(h.message)}</p></div>
          <div><span>Attempts</span><p>${attemptsLabel(h)}</p></div>
          <div><span>Sent / resolved</span><p>${fmtDate(h.sent_at || h.resolved_at)}</p></div>
          <div><span>Delay</span><p>${fmtDelay(h.scheduled_for, h.sent_at)}</p></div>
        </div>
        ${h.error ? `<div class="history-error">${escapeHtml(h.error)}</div>` : ""}
        ${Array.isArray(h.attempts) && h.attempts.length ? `
          <details class="attempt-details">
            <summary>Attempt details</summary>
            <div class="attempt-list">
              ${h.attempts.map((a) => `<div>Round ${escapeHtml(a.round)} · ${escapeHtml(a.status)}${a.confirmation ? ` · ${escapeHtml(a.confirmation)}` : ""}${a.error ? ` · ${escapeHtml(a.error)}` : ""}</div>`).join("")}
            </div>
          </details>` : ""}
        ${["failed","uncertain"].includes(h.status) ? `<button class="ghost retry-history" data-history-id="${h.id}">Retry this recipient</button>` : ""}
      </div>`).join("");

    return `
      <article class="history-run ${statusClass}">
        <div class="history-run-head">
          <div>
            <div class="history-run-title">${escapeHtml(title)}</div>
            <div class="history-run-meta">${escapeHtml(runSummaryText(group, counts))} · ${fmtDate(group.scheduledFor)} · ${escapeHtml(group.triggerType)}</div>
            <div class="history-run-meta">${personalized ? "Personalized message per recipient" : escapeHtml(firstMessage).slice(0, 220)}</div>
          </div>
          <div class="history-run-badges">
            <span class="history-status-pill ${statusClass}">${escapeHtml(statusClass)}</span>
            <span class="badge">up to ${Math.max(maxAttempts, 1)}/3 attempts</span>
          </div>
        </div>
        <details class="history-run-details" ${group.rows.length === 1 ? "open" : ""}>
          <summary>Show ${group.rows.length} recipient${group.rows.length === 1 ? "" : "s"}</summary>
          <div class="history-recipient-list">${details}</div>
        </details>
      </article>`;
  }).join("");
}

function birthdayLabel(value) {
  if (!value) return "No birthday";
  const parts = String(value).split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return value;
  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "long", year: "numeric" }).format(date);
}

function resetContactForm() {
  state.editingContactId = null;
  $("contactId").value = "";
  $("contactForm").reset();
  $("saveContact").textContent = "Save contact";
  $("cancelContactEdit").classList.add("hidden");
  $("contactMessage").textContent = "";
}

function editContact(id) {
  const contact = state.contacts.find((item) => item.id === id);
  if (!contact) return;
  state.editingContactId = id;
  $("contactId").value = String(id);
  $("contactName").value = contact.name || "";
  $("contactPhone").value = contact.phone || "";
  $("contactBirthday").value = contact.birthday || "";
  $("saveContact").textContent = "Save changes";
  $("cancelContactEdit").classList.remove("hidden");
  $("contactMessage").textContent = "Editing contact.";
  $("contactName").focus();
}

function useContact(contact) {
  if (!contact) return;
  if (state.recipientMode === "multiple") {
    addRecipientRow(contact.name || "", contact.phone || "");
  } else {
    $("recipientName").value = contact.name || "";
    $("phone").value = contact.phone || "";
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function loadContacts() {
  state.contacts = await api(`/api/contacts?_=${Date.now()}`);
  const box = $("contacts");
  if (!state.contacts.length) {
    box.innerHTML = '<div class="empty">No contacts yet.</div>';
    return;
  }
  box.innerHTML = state.contacts.map((contact) => `
    <div class="contact-item">
      <div>
        <div class="contact-name">${escapeHtml(contact.name)}</div>
        <div class="contact-meta">${escapeHtml(contact.phone)}</div>
        <div class="contact-meta">Birthday: ${escapeHtml(birthdayLabel(contact.birthday))}</div>
      </div>
      <div class="contact-actions">
        <button class="ghost" data-contact-action="use" data-contact-id="${contact.id}">Use</button>
        <button class="ghost" data-contact-action="edit" data-contact-id="${contact.id}">Edit</button>
        <button class="danger" data-contact-action="delete" data-contact-id="${contact.id}">Delete</button>
      </div>
    </div>`).join("");
}

function missedPreview(schedule) {
  if (schedule.content_type === "gemini") return `Gemini prompt: ${schedule.automation?.prompt || ""}`;
  return schedule.message || "";
}

async function loadMissed() {
  state.missed = await api(`/api/missed?_=${Date.now()}`);
  const modal = $("missedModal");
  if (!state.missed.length) {
    modal.classList.add("hidden");
    return;
  }
  $("missedList").innerHTML = state.missed.map((m) => `
    <label class="missed-item">
      <input type="checkbox" name="missed" value="${m.missed_id}" checked />
      <div>
        <strong>${escapeHtml(m.schedule.label || m.schedule.recipient_name || m.schedule.phone)}</strong>
        <div class="schedule-meta">Due ${fmtDate(m.due_at)} · ${m.schedule.recipient_count || 1} recipient(s)</div>
        <div class="missed-message">${escapeHtml(missedPreview(m.schedule))}</div>
      </div>
    </label>`).join("");
  modal.classList.remove("hidden");
}

async function refreshAll({ showErrors = false } = {}) {
  const button = $("refreshAll");
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "Refreshing…";

  const results = await Promise.allSettled([loadStatus(), loadSchedules(), loadContacts(), loadHistory(), loadMissed()]);
  const errors = results.filter((r) => r.status === "rejected").map((r) => r.reason?.message || String(r.reason));
  $("lastRefreshed").textContent = `Refreshed ${timeFmt.format(new Date())}`;
  button.disabled = false;
  button.textContent = original;

  if (showErrors && errors.length) alert(`Refresh completed with errors:\n${errors.join("\n")}`);
  return errors;
}

function renderClientTemplate(text, recipient) {
  return String(text || "")
    .replace(/\{\{\s*name\s*\}\}/gi, recipient?.name || "")
    .replace(/\{\{\s*phone\s*\}\}/gi, recipient?.phone || "");
}

$("scheduleForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const msg = $("formMessage");
  msg.className = "form-message";
  msg.textContent = "Saving…";
  try {
    const payload = formData();
    if (state.editingId) await api(`/api/schedules/${state.editingId}`, { method:"PUT", body:JSON.stringify(payload) });
    else await api("/api/schedules", { method:"POST", body:JSON.stringify(payload) });
    msg.classList.add("ok");
    msg.textContent = state.editingId ? "Changes saved." : "Schedule saved.";
    resetForm();
    await refreshAll();
  } catch (error) {
    msg.classList.add("error");
    msg.textContent = error.message;
  }
});

$("testGeminiPrompt").addEventListener("click", async () => {
  const button = $("testGeminiPrompt");
  const message = $("geminiTestMessage");
  const recipients = collectRecipients();
  const prompt = renderClientTemplate($("geminiPrompt").value.trim(), recipients[0] || {});
  if (!prompt) {
    message.className = "form-message error";
    message.textContent = "Enter a Gemini prompt first.";
    return;
  }
  button.disabled = true;
  button.textContent = "Asking Gemini…";
  message.className = "form-message";
  message.textContent = "Gemini is working in Chromium. Nothing will be sent to WhatsApp.";
  $("geminiPreview").value = "";
  try {
    const result = await api("/api/gemini/ask", { method: "POST", body: JSON.stringify({ prompt, newChat: true }) });
    $("geminiPreview").value = result.answer || "";
    message.className = "form-message ok";
    message.textContent = "Gemini response received. This was only a test.";
    await loadStatus();
  } catch (error) {
    message.className = "form-message error";
    message.textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = "Test prompt in Gemini";
  }
});

function requireSecondClick(button, confirmText = "Click again to confirm", timeoutMs = 4500) {
  const now = Date.now();
  const until = Number(button.dataset.confirmUntil || 0);
  if (until > now) {
    button.dataset.confirmUntil = "";
    if (button.dataset.originalText) button.textContent = button.dataset.originalText;
    return true;
  }

  button.dataset.originalText = button.textContent;
  button.dataset.confirmUntil = String(now + timeoutMs);
  button.textContent = confirmText;
  setTimeout(() => {
    if (Number(button.dataset.confirmUntil || 0) <= Date.now()) {
      button.dataset.confirmUntil = "";
      if (button.dataset.originalText) button.textContent = button.dataset.originalText;
    }
  }, timeoutMs + 100);
  return false;
}

$("history").addEventListener("click", async (event) => {
  const button = event.target.closest("button.retry-history");
  if (!button) return;
  if (!requireSecondClick(button, "Click again to retry")) return;
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "Retrying…";
  try {
    await api(`/api/history/${Number(button.dataset.historyId)}/retry`, { method:"POST", body:"{}" });
    await refreshAll();
  } catch (error) {
    alert(error.message);
    await refreshAll();
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
});

$("schedules").addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const id = Number(button.dataset.id);
  const action = button.dataset.action;
  if (action === "edit") return editSchedule(id);
  try {
    if (action === "delete") {
      button.disabled = true;
      button.textContent = "Deleting…";
      await api(`/api/schedules/${id}`, { method:"DELETE" });
    }
    if (action === "toggle") {
      const s = state.schedules.find((x) => x.id === id);
      await api(`/api/schedules/${id}/toggle`, { method:"POST", body:JSON.stringify({ active: !s.active }) });
    }
    if (action === "send") {
      button.textContent = "Sending…";
      await api(`/api/schedules/${id}/send-now`, { method:"POST", body:"{}" });
    }
    await refreshAll();
  } catch (error) { alert(error.message); await refreshAll(); }
});

async function resolveMissed(mode, all = false) {
  const selected = all ? state.missed.map((m) => m.missed_id) : [...document.querySelectorAll('input[name="missed"]:checked')].map((el) => Number(el.value));
  if (!selected.length) return;
  $("missedMessage").textContent = mode === "send" ? "Sending selected messages…" : "Skipping selected messages…";
  try {
    await api("/api/missed/resolve", { method:"POST", body:JSON.stringify({ actions:selected.map((id) => ({ id, action:mode })) }) });
    $("missedMessage").textContent = "Done.";
    await refreshAll();
  } catch (error) { $("missedMessage").textContent = error.message; }
}

function insertAtCursor(textarea, text) {
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  textarea.value = textarea.value.slice(0, start) + text + textarea.value.slice(end);
  textarea.focus();
  textarea.selectionStart = textarea.selectionEnd = start + text.length;
}

$("sendSelected").addEventListener("click", () => resolveMissed("send", false));
$("skipSelected").addEventListener("click", () => resolveMissed("skip", false));
$("sendAll").addEventListener("click", () => resolveMissed("send", true));
$("skipAll").addEventListener("click", () => resolveMissed("skip", true));
$("recurrenceType").addEventListener("change", updateDynamicFields);
$("cancelEdit").addEventListener("click", resetForm);
$("refreshAll").addEventListener("click", () => refreshAll({ showErrors: true }));
$("focusChromium").addEventListener("click", () => api("/api/chromium/focus", { method:"POST", body:"{}" }).catch((e) => alert(e.message)));
$("focusGemini").addEventListener("click", () => api("/api/gemini/focus", { method:"POST", body:"{}" }).catch((e) => alert(e.message)));

$("addRecipient").addEventListener("click", () => addRecipientRow());
$("applyBulkRecipients").addEventListener("click", () => {
  const lines = $("bulkRecipients").value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return;
  for (const line of lines) {
    const parts = line.split(/[;,\t]/).map((x) => x.trim());
    if (parts.length >= 2) addRecipientRow(parts[0], parts.slice(1).join("").trim());
    else addRecipientRow("", parts[0]);
  }
  $("bulkRecipients").value = "";
});

document.querySelectorAll(".mode-tab").forEach((button) => {
  button.addEventListener("click", () => setRecipientMode(button.dataset.mode));
});

document.querySelectorAll(".source-tab").forEach((button) => {
  button.addEventListener("click", () => setContentSource(button.dataset.source));
});

document.querySelectorAll(".insert-template").forEach((button) => {
  button.addEventListener("click", () => insertAtCursor($(button.dataset.target || "message"), button.dataset.template));
});

$("contactForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = $("contactMessage");
  message.className = "form-message";
  message.textContent = "Saving…";
  const payload = {
    name: $("contactName").value.trim(),
    phone: $("contactPhone").value.trim(),
    birthday: $("contactBirthday").value || null
  };
  try {
    if (state.editingContactId) {
      await api(`/api/contacts/${state.editingContactId}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await api("/api/contacts", { method: "POST", body: JSON.stringify(payload) });
    }
    message.className = "form-message ok";
    message.textContent = state.editingContactId ? "Contact updated." : "Contact saved.";
    resetContactForm();
    await loadContacts();
  } catch (error) {
    message.className = "form-message error";
    message.textContent = error.message;
  }
});

$("cancelContactEdit").addEventListener("click", resetContactForm);

$("contacts").addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-contact-action]");
  if (!button) return;
  const id = Number(button.dataset.contactId);
  const contact = state.contacts.find((item) => item.id === id);
  if (!contact) return;
  const action = button.dataset.contactAction;
  if (action === "use") return useContact(contact);
  if (action === "edit") return editContact(id);
  if (action === "delete") {
    const original = button.textContent;
    if (!requireSecondClick(button, "Click again to delete")) return;
    button.disabled = true;
    button.textContent = "Deleting…";
    try {
      await api(`/api/contacts/${id}`, { method: "DELETE" });
      if (state.editingContactId === id) resetContactForm();
      await loadContacts();
    } catch (error) {
      alert(error.message);
      button.disabled = false;
      button.textContent = original;
    }
  }
});

$("clearHistory").addEventListener("click", async () => {
  const button = $("clearHistory");
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "Clearing…";
  try {
    await api("/api/history", { method: "DELETE" });
    await refreshAll();
  } catch (error) {
    alert(error.message);
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
});

fillDateSelectors();
addRecipientRow();
resetForm();
resetContactForm();
refreshAll();
setInterval(loadStatus, 3000);
setInterval(loadMissed, 5000);
setInterval(loadSchedules, 15000);
