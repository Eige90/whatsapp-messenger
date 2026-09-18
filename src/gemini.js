import { config } from "./config.js";
import { ensureGeminiOpen, getGeminiPage, focusDashboard } from "./chromium.js";

const GEMINI_URL = "https://gemini.google.com/app";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let monitorTimer = null;
let status = {
  phase: "starting",
  detail: "Waiting for Gemini…",
  updatedAt: Date.now()
};

const SELECTORS = {
  prompt: [
    "div.ql-editor",
    'rich-textarea [contenteditable="true"]',
    '[aria-label="Enter a prompt here"]',
    '[contenteditable="true"][role="textbox"]'
  ],
  send: [
    'button[aria-label="Send message"]',
    'button[aria-label*="Send" i]',
    ".send-button",
    "button.send-button"
  ],
  response: [
    "model-response",
    "message-content",
    ".model-response-text",
    ".response-content",
    '[data-test-id="model-response"]',
    '[data-message-author-role="model"]',
    '[class*="model-response"]'
  ],
  streaming: [
    'button[aria-label*="Stop" i]',
    '[aria-label*="Stop response" i]',
    ".loading-indicator",
    ".response-loading"
  ]
};

function setStatus(phase, detail = "") {
  status = { phase, detail, updatedAt: Date.now() };
}

export function geminiStatus() {
  return { ...status };
}

function combined(list) {
  return list.join(", ");
}

async function inspect(page) {
  if (!page || page.isClosed()) return { phase: "closed", detail: "Gemini tab is closed." };
  if (!page.url().startsWith("https://gemini.google.com")) return { phase: "waiting", detail: "Gemini is not open yet." };

  try {
    const result = await page.evaluate((promptSelector) => {
      const prompt = document.querySelector(promptSelector);
      const bodyText = (document.body?.innerText || "").toLowerCase();
      const signIn = Boolean(
        document.querySelector('a[href*="accounts.google.com"]') ||
        [...document.querySelectorAll("button,a")].some((el) => /sign in|anmelden/i.test(el.textContent || ""))
      );
      return {
        hasPrompt: Boolean(prompt),
        signIn,
        bodyText: bodyText.slice(0, 3000)
      };
    }, combined(SELECTORS.prompt));

    if (result.hasPrompt) return { phase: "ready", detail: "Gemini Web is ready." };
    if (result.signIn) return { phase: "login", detail: "Google sign-in is required. Stop the app and run: npm.cmd run gemini-login" };
    if (result.bodyText.includes("gemini") && result.bodyText.includes("sign in")) return { phase: "login", detail: "Google sign-in is required. Stop the app and run: npm.cmd run gemini-login" };
    return { phase: "waiting", detail: "Waiting for Gemini Web to become ready…" };
  } catch (error) {
    return { phase: "waiting", detail: error.message };
  }
}

async function ensureMonitor() {
  if (monitorTimer) return;
  monitorTimer = setInterval(async () => {
    try {
      const page = await getGeminiPage();
      if (!page.url().startsWith("https://gemini.google.com")) return;
      const next = await inspect(page);
      setStatus(next.phase, next.detail);
    } catch (error) {
      setStatus("error", error.message);
    }
  }, 4000);
  monitorTimer.unref?.();
}

export async function ensureGeminiReady({ bringToFront = false } = {}) {
  const page = await ensureGeminiOpen(GEMINI_URL);
  if (!page) throw new Error("Gemini tab is disabled in config.local.json.");
  await ensureMonitor();
  if (bringToFront) await page.bringToFront();

  const started = Date.now();
  let loginSince = null;
  const loginGraceMs = Number(config.geminiLoginGraceMs || 30000);
  while (Date.now() - started < Number(config.actionTimeoutMs || 90000)) {
    const current = await inspect(page);
    setStatus(current.phase, current.detail);
    if (current.phase === "ready") return page;
    if (current.phase === "login") {
      // Chrome can briefly render a signed-out shell while restoring the persisted
      // Google session. Do not fail scheduled messages immediately. Only treat this
      // as a real logout when the login state remains stable for the grace period.
      if (loginSince == null) loginSince = Date.now();
      if (Date.now() - loginSince >= loginGraceMs) {
        throw new Error("Gemini is not signed in. Stop the app, run `npm.cmd run gemini-login`, sign in manually, close the browser, then start the app again.");
      }
    } else {
      loginSince = null;
    }
    await sleep(700);
  }
  throw new Error("Gemini Web did not become ready in time.");
}

async function responseCount(page) {
  return page.evaluate((selector) => document.querySelectorAll(selector).length, combined(SELECTORS.response));
}

async function responseSnapshot(page) {
  return page.evaluate((selector) => {
    const nodes = [...document.querySelectorAll(selector)];
    if (!nodes.length) return { count: 0, text: "" };
    const node = nodes[nodes.length - 1];
    const preferred = node.querySelector(
      ".markdown, .model-response-text, .response-content, [class*='response-content'], message-content"
    );
    const text = String((preferred || node).innerText || (preferred || node).textContent || "").trim();
    return { count: nodes.length, text };
  }, combined(SELECTORS.response));
}

async function isStreaming(page) {
  return page.evaluate((selector) => {
    const nodes = [...document.querySelectorAll(selector)];
    return nodes.some((el) => {
      const style = getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden" && !el.disabled;
    });
  }, combined(SELECTORS.streaming)).catch(() => false);
}

async function livePromptSelector(page) {
  return page.evaluate((selectors) => {
    const visible = (el) => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (visible(el)) return selector;
    }
    return null;
  }, SELECTORS.prompt);
}

async function fillPrompt(page, prompt) {
  const started = Date.now();
  let selector = null;
  while (Date.now() - started < Number(config.actionTimeoutMs || 90000)) {
    selector = await livePromptSelector(page).catch(() => null);
    if (selector) break;
    await sleep(300);
  }
  if (!selector) throw new Error("Gemini prompt field was not found. The Gemini web interface may have changed.");

  // Puppeteer's Locator.fill() is designed for reactive inputs and supports
  // contenteditable elements. This avoids stale ElementHandles and does not
  // depend on Keyboard.insertText(), which is not available in every
  // Puppeteer/Chrome combination.
  let filled = false;
  let firstError = null;
  try {
    const locator = page.locator(selector).setTimeout(Number(config.actionTimeoutMs || 90000));
    await locator.fill("");
    await locator.fill(prompt);
    filled = true;
  } catch (error) {
    firstError = error;
  }

  // Fallback: focus the current live editor and type through the standard
  // Puppeteer Keyboard.type() API. No DOM handle is kept across updates.
  if (!filled) {
    const focused = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el || !el.isConnected) return false;
      el.scrollIntoView({ block: "center", inline: "nearest" });
      el.focus();
      el.click();
      return true;
    }, selector).catch(() => false);
    if (!focused) {
      throw new Error(`Gemini prompt field could not be focused.${firstError ? ` ${firstError.message}` : ""}`);
    }

    await page.keyboard.down(process.platform === "darwin" ? "Meta" : "Control");
    await page.keyboard.press("A");
    await page.keyboard.up(process.platform === "darwin" ? "Meta" : "Control");
    await page.keyboard.press("Backspace");
    await page.keyboard.type(prompt, { delay: 2 });
  }

  const typed = await page.evaluate((selectors) => {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const text = String(el.innerText || el.textContent || el.value || "").trim();
      if (text) return text;
    }
    return "";
  }, SELECTORS.prompt).catch(() => "");

  if (!typed) throw new Error("Gemini did not accept the prompt text.");
}

async function submitPrompt(page) {
  const clicked = await page.evaluate((selectors) => {
    const visible = (el) => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    for (const selector of selectors) {
      const button = document.querySelector(selector);
      if (!visible(button)) continue;
      const disabled = Boolean(button.disabled) || button.getAttribute("aria-disabled") === "true";
      if (!disabled) {
        button.click();
        return true;
      }
    }
    return false;
  }, SELECTORS.send).catch(() => false);
  if (clicked) return "button";

  // Gemini also accepts Enter from its prompt editor. Re-focus a current node
  // instead of using a stale ElementHandle.
  const selector = await livePromptSelector(page).catch(() => null);
  if (selector) {
    await page.evaluate((sel) => document.querySelector(sel)?.focus(), selector).catch(() => {});
  }
  await page.keyboard.press("Enter");
  return "enter";
}

async function waitForNewResponse(page, baseline) {
  const timeout = Number(config.geminiResponseTimeoutMs || 120000);
  const stableRequired = Number(config.geminiStableMs || 1800);
  const started = Date.now();
  let lastText = "";
  let stableSince = 0;

  while (Date.now() - started < timeout) {
    const snapshot = await responseSnapshot(page).catch(() => ({ count: 0, text: "" }));
    const streaming = await isStreaming(page);
    if (snapshot.count > baseline && snapshot.text) {
      if (snapshot.text !== lastText) {
        lastText = snapshot.text;
        stableSince = Date.now();
      } else if (!streaming && stableSince && Date.now() - stableSince >= stableRequired) {
        return snapshot.text;
      }
    }
    await sleep(350);
  }

  if (lastText) return lastText;
  throw new Error("Gemini did not return a readable response before the timeout.");
}

export async function askGemini(prompt, { newChat = true } = {}) {
  const text = String(prompt || "").trim();
  if (!text) throw new Error("Gemini prompt is empty.");

  let page = null;
  try {
    page = await ensureGeminiReady({ bringToFront: true });
    setStatus("working", "Sending prompt to Gemini…");

    if (newChat) {
      await page.goto(GEMINI_URL, { waitUntil: "domcontentloaded", timeout: config.navigationTimeoutMs });
      page = await ensureGeminiReady({ bringToFront: true });
    }

    const baseline = await responseCount(page).catch(() => 0);
    await fillPrompt(page, text);
    await sleep(350);
    await submitPrompt(page);

    const answer = await waitForNewResponse(page, baseline);
    setStatus("ready", "Gemini response received.");
    return {
      ok: true,
      prompt: text,
      answer,
      receivedAt: Date.now()
    };
  } catch (error) {
    setStatus("error", error.message || String(error));
    throw error;
  } finally {
    // The dashboard is the primary UI. Gemini is foregrounded only while the
    // automation is actively asking/reading a response.
    await focusDashboard().catch(() => {});
  }
}

export async function initializeGemini() {
  try {
    const page = await ensureGeminiOpen(GEMINI_URL);
    if (!page) {
      setStatus("disabled", "Gemini tab is disabled in config.local.json.");
      return null;
    }
    await ensureMonitor();
    const current = await inspect(page);
    setStatus(current.phase, current.detail);
    return page;
  } catch (error) {
    setStatus("error", error.message);
    throw error;
  }
}
