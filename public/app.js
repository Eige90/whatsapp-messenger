const $ = (id) => document.getElementById(id);
const state = { schedules: [], missed: [], editingId: null, recipientMode: "single" };

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
    message: $("message").value,
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
  setDefaultDateTime();
  updateDynamicFields();
  $("formMessage").textContent = "";
}

function editSchedule(id) {
  const s = state.schedules.find((x) => x.id === id);
  if (!s) return;
  state.editingId = id;
  $("label").value = s.label || "";
  $("message").value = s.message;
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
      <div class="message-preview">${escapeHtml(s.message)}</div>
      <div class="schedule-actions">
        <button class="ghost" data-action="edit" data-id="${s.id}">Edit</button>
        ${s.active ? `<button class="ghost" data-action="toggle" data-id="${s.id}">Pause</button>` : (s.recurrence_type !== "once" ? `<button class="ghost" data-action="toggle" data-id="${s.id}">Activate</button>` : "")}
        <button class="ghost" data-action="send" data-id="${s.id}">Send now</button>
        <button class="danger" data-action="delete" data-id="${s.id}">Delete</button>
      </div>
    </div>`;
  }).join("");
}

async function loadHistory() {
  const rows = await api(`/api/history?limit=100&_=${Date.now()}`);
  $("history").innerHTML = rows.length ? rows.map((h) => `
    <tr>
      <td class="status-${escapeHtml(h.status)}">
        <strong>${escapeHtml(h.status)}</strong>
        ${h.error ? `<div class="history-error">${escapeHtml(h.error)}</div>` : ""}
      </td>
      <td>${escapeHtml(h.recipient_name || h.phone)}<br><small>${escapeHtml(h.phone)}</small></td>
      <td>${escapeHtml(h.message).slice(0,180)}</td>
      <td>${fmtDate(h.scheduled_for)}</td>
      <td>${fmtDate(h.sent_at || h.resolved_at)}</td>
      <td>${fmtDelay(h.scheduled_for, h.sent_at)}</td>
      <td>${escapeHtml(h.trigger_type)}</td>
      <td>${["failed","uncertain"].includes(h.status) ? `<button class="ghost retry-history" data-history-id="${h.id}">Retry</button>` : ""}</td>
    </tr>`).join("") : '<tr><td colspan="8" class="muted">No activity yet.</td></tr>';
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
        <div class="missed-message">${escapeHtml(m.schedule.message)}</div>
      </div>
    </label>`).join("");
  modal.classList.remove("hidden");
}

async function refreshAll({ showErrors = false } = {}) {
  const button = $("refreshAll");
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "Refreshing…";

  const results = await Promise.allSettled([loadStatus(), loadSchedules(), loadHistory(), loadMissed()]);
  const errors = results.filter((r) => r.status === "rejected").map((r) => r.reason?.message || String(r.reason));
  $("lastRefreshed").textContent = `Refreshed ${timeFmt.format(new Date())}`;
  button.disabled = false;
  button.textContent = original;

  if (showErrors && errors.length) alert(`Refresh completed with errors:\n${errors.join("\n")}`);
  return errors;
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

$("history").addEventListener("click", async (event) => {
  const button = event.target.closest("button.retry-history");
  if (!button) return;
  if (!confirm("Retry this message now? If WhatsApp actually sent the previous uncertain attempt, this can create a duplicate.")) return;
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
      if (!confirm("Delete this schedule permanently?")) return;
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
$("restartChromium").addEventListener("click", () => api("/api/chromium/restart", { method:"POST", body:"{}" }).then(() => refreshAll()).catch((e) => alert(e.message)));

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

document.querySelectorAll(".insert-template").forEach((button) => {
  button.addEventListener("click", () => insertAtCursor($("message"), button.dataset.template));
});


$("clearHistory").addEventListener("click", async () => {
  if (!confirm("Clear the complete local send history? Scheduled messages are not deleted.")) return;
  try {
    await api("/api/history", { method: "DELETE" });
    await refreshAll();
  } catch (error) {
    alert(error.message);
  }
});

fillDateSelectors();
addRecipientRow();
resetForm();
refreshAll();
setInterval(loadStatus, 3000);
setInterval(loadMissed, 5000);
setInterval(loadSchedules, 15000);
