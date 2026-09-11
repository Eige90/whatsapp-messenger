import { getWhatsAppPage, chromiumState } from "./chromium.js";
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
  try {
    const current = await composerText(composer);
    if (!current) return { confirmed: true, method: "composer-cleared" };
  } catch {}

  try {
    const count = await countMatchingOutgoing(page, message);
    if (count > baseline) return { confirmed: true, method: "outgoing-message" };
  } catch {}

  return { confirmed: false, method: null };
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

function uncertainError(message, cause = null) {
  const error = new Error(message);
  error.code = "SEND_UNCONFIRMED";
  if (cause) error.cause = cause;
  return error;
}

export function isUncertainSendError(error) {
  return error?.code === "SEND_UNCONFIRMED";
}

export async function sendWhatsAppMessage(phone, message) {
  const target = normalizePhone(phone);
  const text = String(message || "");
  if (!text.trim()) throw new Error("Message is empty.");

  const page = await ensureWhatsAppOpen();
  await waitForConnected(page);

  let sendAttempted = false;
  let baseline = 0;
  let composer = null;
  let attemptedAt = null;

  try {
    setStatus("sending", `Preparing chat with ${target}…`);
    const url = `https://web.whatsapp.com/send?phone=${encodeURIComponent(target)}&text=${encodeURIComponent(text)}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: config.navigationTimeoutMs });

    const started = Date.now();
    while (Date.now() - started < config.actionTimeoutMs) {
      const invalid = await invalidRecipientMessage(page).catch(() => "");
      if (invalid) throw new Error("The recipient is not available on WhatsApp or the phone number is invalid.");
      composer = await findComposer(page);
      if (composer) {
        const current = await composerText(composer);
        if (current) break;
      }
      await sleep(400);
    }
    if (!composer) throw new Error("WhatsApp message composer did not become ready.");

    const loadedText = await composerText(composer);
    if (!loadedText) throw new Error("WhatsApp opened the chat, but the message text was not loaded into the composer.");

    baseline = await countMatchingOutgoing(page, text).catch(() => 0);
    await composer.click();
    await sleep(120);

    setStatus("sending", `Sending to ${target}…`);
    sendAttempted = true;
    attemptedAt = Date.now();
    await page.keyboard.press("Enter");

    const evidence = await waitForSendEvidence(
      page,
      composer,
      text,
      baseline,
      Number(config.sendConfirmationTimeoutMs || 15000)
    );

    if (!evidence.confirmed) {
      throw uncertainError("The send action was triggered, but WhatsApp Web did not confirm the outgoing message in time.");
    }

    const confirmedAt = Date.now();
    setStatus("connected", `Message sent (${evidence.method}).`);
    return { ok: true, phone: target, attemptedAt, confirmedAt, confirmation: evidence.method };
  } catch (error) {
    if (sendAttempted && composer) {
      // WhatsApp may complete the Enter action even if Puppeteer's protocol call timed out.
      // Give the real page a short grace period and look for independent send evidence.
      await sleep(1200).catch(() => {});
      try {
        const evidence = await waitForSendEvidence(page, composer, text, baseline, 12000);
        if (evidence.confirmed) {
          const confirmedAt = Date.now();
          setStatus("connected", `Message sent after delayed browser response (${evidence.method}).`);
          return {
            ok: true,
            phone: target,
            attemptedAt: attemptedAt || confirmedAt,
            confirmedAt,
            confirmation: evidence.method,
            recoveredFrom: error.message
          };
        }
      } catch {}

      if (!isUncertainSendError(error)) {
        throw uncertainError(
          `The send action may have reached WhatsApp, but confirmation failed: ${error.message}`,
          error
        );
      }
    }
    throw error;
  }
}
