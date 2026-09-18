import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import puppeteer from "puppeteer-core";
import { config, PROFILE_DIR, findChromiumExecutable } from "./config.js";

let browser = null;
let chromeProcess = null;
let whatsappPage = null;
let dashboardPage = null;
let geminiPage = null;
let executablePath = null;
let closingByApp = false;
let browserClosedHandler = null;
const configuredPages = new WeakSet();
let state = {
  phase: "stopped",
  detail: "Chromium has not started yet.",
  executablePath: null,
  updatedAt: Date.now()
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function setState(phase, detail = "") {
  state = { phase, detail, executablePath, updatedAt: Date.now() };
}

function knownInvalidRecipientDialog(message) {
  const text = String(message || "").toLowerCase();
  return (
    text.includes("not on whatsapp") ||
    text.includes("isn't on whatsapp") ||
    text.includes("not registered on whatsapp") ||
    text.includes("nicht auf whatsapp") ||
    text.includes("nicht bei whatsapp") ||
    text.includes("nicht auf whatsapp registriert") ||
    text.includes("phone number shared via url is invalid") ||
    text.includes("telefonnummer, die über die url geteilt wurde, ist ungültig")
  );
}

function configurePage(page) {
  page.setDefaultTimeout(config.actionTimeoutMs);
  page.setDefaultNavigationTimeout(config.navigationTimeoutMs);

  if (!configuredPages.has(page)) {
    configuredPages.add(page);
    page.on("dialog", async (dialog) => {
      // Only WhatsApp dialogs are handled automatically. Dashboard confirmations and
      // Google/Gemini dialogs must remain under the user's control.
      if (!page.url().startsWith("https://web.whatsapp.com")) return;

      const message = dialog.message();
      try {
        if (knownInvalidRecipientDialog(message)) {
          page.__lastInvalidRecipientDialog = { message, at: Date.now() };
          await dialog.accept();
          return;
        }
        // Unknown WhatsApp JS dialogs can block the sender forever, so dismiss them.
        await dialog.dismiss();
      } catch {}
    });
  }

  return page;
}

export function chromiumState() {
  return { ...state };
}

export function onChromiumClosed(handler) {
  browserClosedHandler = typeof handler === "function" ? handler : null;
}

function isUsable(page) {
  return Boolean(page && !page.isClosed());
}

function devToolsPortFile() {
  return path.join(PROFILE_DIR, "DevToolsActivePort");
}

async function waitForDevToolsEndpoint(processHandle) {
  const file = devToolsPortFile();
  const timeoutMs = Number(config.remoteDebuggingStartupTimeoutMs || 20000);
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    if (processHandle?.exitCode != null) {
      throw new Error(`Chromium exited before remote debugging became available (exit code ${processHandle.exitCode}).`);
    }

    if (fs.existsSync(file)) {
      try {
        const [portLine, browserPath] = fs.readFileSync(file, "utf8").trim().split(/\r?\n/);
        const port = Number(portLine);
        if (Number.isFinite(port) && browserPath) {
          return `ws://127.0.0.1:${port}${browserPath}`;
        }
      } catch {}
    }

    await sleep(150);
  }

  throw new Error("Chromium started, but the DevTools endpoint did not become available in time.");
}

function resetPageReferences() {
  whatsappPage = null;
  dashboardPage = null;
  geminiPage = null;
}

export async function startChromium() {
  if (browser?.connected) return { browser };

  executablePath = findChromiumExecutable();
  if (!executablePath) {
    setState("error", "Chromium/Chrome/Edge was not found. Set chromiumPath in config.local.json or CHROMIUM_PATH.");
    throw new Error(state.detail);
  }

  fs.mkdirSync(PROFILE_DIR, { recursive: true });
  try { fs.rmSync(devToolsPortFile(), { force: true }); } catch {}

  setState("starting", "Starting Chromium with the persistent local profile…");
  closingByApp = false;

  const args = [
    "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=0",
    `--user-data-dir=${PROFILE_DIR}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-features=Translate,OptimizationHints,CalculateNativeWinOcclusion",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    "--start-maximized",
    "about:blank"
  ];

  // Chrome is deliberately started as a normal browser process and Puppeteer attaches
  // afterwards through DevTools. This avoids Puppeteer's automation launch switches and
  // improves compatibility with normal Google sign-in flows while keeping the profile local.
  chromeProcess = spawn(executablePath, args, {
    detached: false,
    stdio: "ignore",
    windowsHide: false
  });

  chromeProcess.once("exit", (code, signal) => {
    const unexpected = !closingByApp;
    chromeProcess = null;
    browser = null;
    resetPageReferences();
    setState("stopped", `Chromium was closed${code != null ? ` (exit ${code})` : signal ? ` (${signal})` : ""}.`);

    if (unexpected && browserClosedHandler) {
      queueMicrotask(() => browserClosedHandler());
    }
  });

  const browserWSEndpoint = await waitForDevToolsEndpoint(chromeProcess);
  browser = await puppeteer.connect({
    browserWSEndpoint,
    defaultViewport: null,
    protocolTimeout: config.protocolTimeoutMs
  });

  for (const page of await browser.pages()) configurePage(page);
  browser.on("targetcreated", async (target) => {
    try {
      const page = await target.page();
      if (page) configurePage(page);
    } catch {}
  });

  browser.on("disconnected", () => {
    browser = null;
    resetPageReferences();
    // The real Chrome child process owns lifecycle notification. A temporary DevTools
    // disconnect alone must not cause the app to relaunch the browser.
  });

  setState("running", `Chromium running: ${path.basename(executablePath)}`);
  return { browser };
}

export async function getWhatsAppPage() {
  const ctx = await startChromium();
  if (isUsable(whatsappPage)) return configurePage(whatsappPage);

  const pages = await ctx.browser.pages();
  whatsappPage = pages.find((p) => p.url().startsWith("https://web.whatsapp.com")) || null;

  if (!whatsappPage) {
    const blank = pages.find((p) => p.url() === "about:blank" && p !== dashboardPage && p !== geminiPage);
    whatsappPage = blank || await ctx.browser.newPage();
  }

  return configurePage(whatsappPage);
}

export async function getGeminiPage() {
  const ctx = await startChromium();
  if (isUsable(geminiPage)) return configurePage(geminiPage);

  const pages = await ctx.browser.pages();
  geminiPage = pages.find((p) => p.url().startsWith("https://gemini.google.com")) || null;

  if (!geminiPage) {
    geminiPage = configurePage(await ctx.browser.newPage());
  }

  return configurePage(geminiPage);
}

export async function ensureGeminiOpen(url = "https://gemini.google.com/app") {
  if (!config.openGemini) return null;
  const page = await getGeminiPage();
  if (!page.url().startsWith("https://gemini.google.com")) {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: config.navigationTimeoutMs });
  }
  return configurePage(page);
}

export async function ensureDashboardOpen(url) {
  if (!config.openDashboard) return null;
  const ctx = await startChromium();

  if (isUsable(dashboardPage)) {
    configurePage(dashboardPage);
    if (dashboardPage.url() !== url) {
      await dashboardPage.goto(url, { waitUntil: "domcontentloaded", timeout: config.navigationTimeoutMs });
    }
    await dashboardPage.bringToFront();
    return dashboardPage;
  }

  const pages = await ctx.browser.pages();
  dashboardPage = pages.find((p) => p.url().startsWith(url)) || null;

  if (!dashboardPage) {
    dashboardPage = configurePage(await ctx.browser.newPage());
    await dashboardPage.goto(url, { waitUntil: "domcontentloaded", timeout: config.navigationTimeoutMs });
  }

  configurePage(dashboardPage);
  await dashboardPage.bringToFront();
  return dashboardPage;
}

export async function focusDashboard() {
  if (!isUsable(dashboardPage)) return false;
  await dashboardPage.bringToFront();
  return true;
}

export async function focusChromium() {
  const p = await getWhatsAppPage();
  await p.bringToFront();
  return true;
}

export async function focusGemini() {
  const p = await ensureGeminiOpen();
  if (!p) throw new Error("Gemini tab is disabled in config.local.json.");
  await p.bringToFront();
  return true;
}

export async function stopChromium() {
  closingByApp = true;
  try { await browser?.close(); } catch {}
  if (chromeProcess && chromeProcess.exitCode == null) {
    try { chromeProcess.kill(); } catch {}
  }
  browser = null;
  chromeProcess = null;
  resetPageReferences();
  setState("stopped", "Chromium stopped.");
}
