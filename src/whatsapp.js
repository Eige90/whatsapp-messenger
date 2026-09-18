import { getWhatsAppPage, chromiumState, focusDashboard } from "./chromium.js";
import { config } from "./config.js";

const WA_URL = "https://web.whatsapp.com/";
let status = {
  phase: "starting",
  detail: "Waiting for Chromium…",
  updatedAt: Date.now()
};
let monitorTimer = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function setStatus(phase, detail = "") {
  status = { phase, detail, updatedAt: Date.now() };
}

export function whatsappStatus() {
  return { ...status, chromium: chromiumState() };
}

async function inspect(page) {
  try {
    const result = await page.evaluate(() => {
      const text = (document.body?.innerText || "").toLowerCase();
      const hasSidebar = Boolean(document.querySelector("#pane-side"));
      const hasQr = Boolean(document.querySelector('canvas[aria-label*="QR" i], canvas'))
        && (text.includes("qr") || text.includes("scan") || text.includes("scannen"));
      return { hasSidebar, hasQr };
    });
    if (result.hasSidebar) return { phase: "connected", detail: "WhatsApp Web is connected." };
    if (result.hasQr) return { phase: "qr", detail: "Scan the QR code in the Chromium window." };
    return { phase: "waiting", detail: "Waiting for WhatsApp Web to become ready…" };
  } catch (error) {
    return { phase: "waiting", detail: error.message };
  }
}

export async function ensureWhatsAppOpen() {
  const page = await getWhatsAppPage();
  const url = page.url();
  if (!url.startsWith("https://web.whatsapp.com")) {
    setStatus("loading", "Opening WhatsApp Web…");
    await page.goto(WA_URL, { waitUntil: "domcontentloaded", timeout: config.navigationTimeoutMs });
  }
  const s = await inspect(page);
  setStatus(s.phase, s.detail);
  if (!monitorTimer) {
    monitorTimer = setInterval(async () => {
      try {
        const p = await getWhatsAppPage();
        if (!p.url().startsWith("https://web.whatsapp.com")) return;
        const next = await inspect(p);
        setStatus(next.phase, next.detail);
      } catch (error) {
        setStatus("error", error.message);
      }
    }, 3000);
    monitorTimer.unref?.();
  }
  return page;
}

async function waitForConnected(page, timeoutMs = 120000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const s = await inspect(page);
    setStatus(s.phase, s.detail);
    if (s.phase === "connected") return true;
    await sleep(1000);
  }
  throw new Error("WhatsApp Web is not connected. Open Chromium and scan the QR code first.");
}

function normalizePhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) throw new Error("Invalid phone number.");
  return digits;
}


async function dismissInvalidRecipientModal(page) {
  const result = await page.evaluate(() => {
    const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const bodyText = normalize(document.body?.innerText || "").toLowerCase();
    const invalidPatterns = [
      "phone number shared via url is invalid",
      "phone number isn't on whatsapp",
      "not registered on whatsapp",
      "telefonnummer, die über die url geteilt wurde, ist ungültig",
      "nicht auf whatsapp registriert",
      "ist nicht bei whatsapp",
      "ist nicht auf whatsapp"
    ];

    const matched = invalidPatterns.find((pattern) => bodyText.includes(pattern));
    if (!matched) return { found: false, dismissed: false, text: "" };

    const visible = (el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };

    const dialogs = [...document.querySelectorAll('[role="dialog"], [aria-modal="true"]')].filter(visible);
    const scope = dialogs.find((el) => invalidPatterns.some((pattern) => normalize(el.innerText || "").toLowerCase().includes(pattern))) || document.body;
    const buttons = [...scope.querySelectorAll('button, [role="button"]')].filter(visible);
    const ok = buttons.find((el) => /^(ok|okay|verstanden|schließen|close)$/i.test(normalize(el.innerText || el.textContent || el.getAttribute("aria-label") || "")));

    if (ok) {
      ok.click();
      return { found: true, dismissed: true, text: matched };
    }

    return { found: true, dismissed: false, text: matched };
  }).catch(() => ({ found: false, dismissed: false, text: "" }));

  if (result.dismissed) await sleep(250);
  return result;
}

async function invalidRecipientMessage(page) {
  return page.evaluate(() => {
    const text = document.body?.innerText || "";
    const patterns = [
      "phone number shared via url is invalid",
      "telefonnummer, die über die url geteilt wurde, ist ungültig",
      "phone number isn't on whatsapp",
      "telefonnummer ist nicht bei whatsapp"
    ];
    const lower = text.toLowerCase();
    return patterns.find((p) => lower.includes(p)) || "";
  });
}

async function findComposer(page) {
  return page.$('footer div[contenteditable="true"][role="textbox"]');
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .trim();
}

async function composerText(composer) {
  try {
    return normalizeText(await composer.evaluate((el) => el.innerText || el.textContent || ""));
  } catch {
    return "";
  }
}

async function countMatchingOutgoing(page, expected) {
  const target = normalizeText(expected);
  return page.evaluate((wanted) => {
    const norm = (value) => String(value || "")
      .replace(/\r\n/g, "\n")
      .replace(/\u00a0/g, " ")
      .trim();

    const candidates = new Set();
    document.querySelectorAll("div.message-out").forEach((el) => candidates.add(el));
    document.querySelectorAll('[data-id^="true_"]').forEach((el) => candidates.add(el));

    let count = 0;
    for (const row of candidates) {
      const textNodes = row.querySelectorAll("span.selectable-text, div.copyable-text span, [dir='ltr']");
      const texts = textNodes.length
        ? [...textNodes].map((el) => norm(el.innerText || el.textContent || "")).filter(Boolean)
        : [norm(row.innerText || row.textContent || "")];

      if (texts.some((text) => text === wanted || text.split("\n").some((line) => norm(line) === wanted))) {
        count += 1;
      }
    }
    return count;
  }, target);
}

async function getSendEvidence(page, composer, message, baseline) {
  if (composer) {
    try {
      const current = await composerText(composer);
      if (!current) return { confirmed: true, method: "composer-cleared", confirmedAt: Date.now() };
    } catch {}
  }

  if (Number.isFinite(baseline)) {
    try {
      const count = await countMatchingOutgoing(page, message);
      if (count > baseline) return { confirmed: true, method: "outgoing-message", confirmedAt: Date.now(), count };
    } catch {}
  }

  return { confirmed: false, method: null, confirmedAt: null };
}

async function waitForSendEvidence(page, composer, message, baseline, timeoutMs) {
  const started = Date.now();
  let last = { confirmed: false, method: null };
  while (Date.now() - started < timeoutMs) {
    last = await getSendEvidence(page, composer, message, baseline);
    if (last.confirmed) return last;
    await sleep(350);
  }
  return last;
}

function withSendMeta(error, meta) {
  if (error && typeof error === "object") error.sendMeta = { ...(error.sendMeta || {}), ...meta };
  return error;
}

function uncertainError(message, cause = null, sendMeta = null) {
  const error = new Error(message);
  error.code = "SEND_UNCONFIRMED";
  if (cause) error.cause = cause;
  if (sendMeta) error.sendMeta = sendMeta;
  return error;
}

export function isUncertainSendError(error) {
  return error?.code === "SEND_UNCONFIRMED";
}

async function openChat(page, target, text = null) {
  const params = new URLSearchParams({ phone: target });
  if (text != null) params.set("text", text);
  const url = `https://web.whatsapp.com/send?${params.toString()}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: config.navigationTimeoutMs });

  const started = Date.now();
  while (Date.now() - started < config.actionTimeoutMs) {
    // WhatsApp can show an in-page OK dialog for numbers that are not registered.
    // Dismiss it automatically so retry rounds do not stall waiting for a human click.
    const modal = await dismissInvalidRecipientModal(page);
    if (modal.found) {
      throw new Error("The recipient is not available on WhatsApp or the phone number is invalid.");
    }

    const browserDialog = page.__lastInvalidRecipientDialog;
    if (browserDialog && Date.now() - Number(browserDialog.at || 0) < 10000) {
      page.__lastInvalidRecipientDialog = null;
      throw new Error("The recipient is not available on WhatsApp or the phone number is invalid.");
    }

    const invalid = await invalidRecipientMessage(page).catch(() => "");
    if (invalid) {
      await dismissInvalidRecipientModal(page).catch(() => {});
      throw new Error("The recipient is not available on WhatsApp or the phone number is invalid.");
    }
    const composer = await findComposer(page);
    if (composer) return composer;
    await sleep(400);
  }
  throw new Error("WhatsApp message composer did not become ready.");
}

export async function verifyWhatsAppSendEvidence(phone, message, baseline = null) {
  const target = normalizePhone(phone);
  const text = String(message || "");
  if (!text.trim()) return { confirmed: false, method: null };

  const page = await ensureWhatsAppOpen();
  await page.bringToFront();
  await sleep(120);
  await waitForConnected(page);
  setStatus("sending", `Verifying previous send to ${target}…`);

  const composer = await openChat(page, target, null);
  await sleep(600);
  const evidence = await getSendEvidence(page, composer, text, Number.isFinite(baseline) ? baseline : null);
  if (evidence.confirmed) setStatus("connected", `Previous send verified (${evidence.method}).`);
  else setStatus("connected", "Previous send could not be verified; retry may be required.");
  return evidence;
}

async function clickVisibleSendButton(page) {
  return page.evaluate(() => {
    const visible = (el) => {
      if (!el) return false;
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== "none"
        && style.visibility !== "hidden"
        && Number(style.opacity || 1) > 0
        && rect.width > 0
        && rect.height > 0;
    };

    const labelOf = (el) => String(
      el?.getAttribute?.("aria-label")
      || el?.getAttribute?.("title")
      || el?.innerText
      || el?.textContent
      || ""
    ).replace(/\s+/g, " ").trim();

    const candidates = [
      ...document.querySelectorAll('[data-icon="send"]'),
      ...document.querySelectorAll('button, [role="button"]')
    ];

    const seen = new Set();
    for (const candidate of candidates) {
      const target = candidate.closest?.('button, [role="button"]') || candidate;
      if (!target || seen.has(target) || !visible(target)) continue;
      seen.add(target);

      const label = labelOf(target);
      const hasSendIcon = Boolean(
        target.matches?.('[data-icon="send"]')
        || target.querySelector?.('[data-icon="send"]')
      );
      const looksLikeSend = /^(send|senden)$/i.test(label)
        || /\b(send|senden)\b/i.test(label);

      if (!hasSendIcon && !looksLikeSend) continue;
      target.click();
      return true;
    }

    return false;
  });
}

export async function sendWhatsAppMessage(phone, message) {
  const target = normalizePhone(phone);
  const text = String(message || "");
  if (!text.trim()) throw new Error("Message is empty.");

  const page = await ensureWhatsAppOpen();
  // WhatsApp Web can be throttled by Chromium when the tab is backgrounded.
  // Bring it to the foreground automatically for the short send operation.
  await page.bringToFront();
  await sleep(120);
  await waitForConnected(page);

  let sendAttempted = false;
  let baseline = null;
  let composer = null;
  let attemptedAt = null;
  let sendTrigger = null;

  try {
    setStatus("sending", `Preparing chat with ${target}…`);
    composer = await openChat(page, target, text);

    const loadedText = await composerText(composer);
    if (!loadedText) throw new Error("WhatsApp opened the chat, but the message text was not loaded into the composer.");

    baseline = await countMatchingOutgoing(page, text).catch(() => null);
    await composer.click();
    await sleep(150);

    setStatus("sending", `Sending to ${target}…`);
    sendAttempted = true;
    attemptedAt = Date.now();

    // Clicking WhatsApp's real send button is more reliable than relying on
    // keyboard focus after switching back from Gemini. Enter remains a fallback
    // for layouts where the send button cannot be identified.
    sendTrigger = "send-button";
    const clickedSend = await clickVisibleSendButton(page).catch(() => false);
    if (!clickedSend) {
      sendTrigger = "enter-fallback";
      await composer.click();
      await sleep(100);
      await page.keyboard.press("Enter");
    }

    const evidence = await waitForSendEvidence(
      page,
      composer,
      text,
      baseline,
      Number(config.sendConfirmationTimeoutMs || 30000)
    );

    if (!evidence.confirmed) {
      throw uncertainError(
        "The send action was triggered, but WhatsApp Web did not confirm the outgoing message in time.",
        null,
        { phone: target, baseline, sendAttempted: true, attemptedAt, sendTrigger }
      );
    }

    const confirmedAt = evidence.confirmedAt || Date.now();
    setStatus("connected", `Message sent (${evidence.method}).`);
    return {
      ok: true,
      phone: target,
      attemptedAt,
      confirmedAt,
      confirmation: evidence.method,
      sendMeta: { phone: target, baseline, sendAttempted: true, attemptedAt, sendTrigger }
    };
  } catch (error) {
    const sendMeta = { phone: target, baseline, sendAttempted, attemptedAt, sendTrigger };

    if (sendAttempted) {
      // Chromium can report a protocol timeout even though WhatsApp already handled the send action.
      // Give the live page a grace period and then verify independently before a retry round.
      await sleep(1500).catch(() => {});
      try {
        const freshComposer = await findComposer(page).catch(() => null);
        const evidence = await waitForSendEvidence(
          page,
          freshComposer,
          text,
          baseline,
          Number(config.postTimeoutVerificationMs || 15000)
        );
        if (evidence.confirmed) {
          const confirmedAt = evidence.confirmedAt || Date.now();
          setStatus("connected", `Message sent after delayed browser response (${evidence.method}).`);
          return {
            ok: true,
            phone: target,
            attemptedAt: attemptedAt || confirmedAt,
            confirmedAt,
            confirmation: evidence.method,
            recoveredFrom: error.message,
            sendMeta
          };
        }
      } catch {}

      if (!isUncertainSendError(error)) {
        throw uncertainError(
          `The send action may have reached WhatsApp, but confirmation failed: ${error.message}`,
          error,
          sendMeta
        );
      }
      throw withSendMeta(error, sendMeta);
    }

    throw withSendMeta(error, sendMeta);
  } finally {
    // Return the UI to localhost after the WhatsApp action. The user does not
    // need to click the WhatsApp tab manually for scheduled sends anymore.
    await focusDashboard().catch(() => {});
  }
}
