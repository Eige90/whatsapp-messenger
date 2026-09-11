import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { config, PROFILE_DIR, findChromiumExecutable } from "./config.js";

let browser = null;
let whatsappPage = null;
let dashboardPage = null;
let executablePath = null;
let closingByApp = false;
let browserClosedHandler = null;
let state = {
  phase: "stopped",
  detail: "Chromium has not started yet.",
  executablePath: null,
  updatedAt: Date.now()
};

function setState(phase, detail = "") {
  state = { phase, detail, executablePath, updatedAt: Date.now() };
}

function configurePage(page) {
  page.setDefaultTimeout(config.actionTimeoutMs);
  page.setDefaultNavigationTimeout(config.navigationTimeoutMs);
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

export async function startChromium() {
  if (browser?.connected) return { browser };

  executablePath = findChromiumExecutable();
  if (!executablePath) {
    setState("error", "Chromium/Chrome/Edge was not found. Set chromiumPath in config.local.json or CHROMIUM_PATH.");
    throw new Error(state.detail);
  }

  fs.mkdirSync(PROFILE_DIR, { recursive: true });
  setState("starting", "Starting Chromium with the persistent local profile…");

  closingByApp = false;

  browser = await puppeteer.launch({
    executablePath,
    headless: false,
    userDataDir: PROFILE_DIR,
    devtools: Boolean(config.openDevTools),
    defaultViewport: null,
    protocolTimeout: config.protocolTimeoutMs,
    args: [
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-features=Translate,OptimizationHints",
      "--start-maximized"
    ]
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
    whatsappPage = null;
    dashboardPage = null;
    setState("stopped", "Chromium was closed.");

    if (!closingByApp && browserClosedHandler) {
      queueMicrotask(() => browserClosedHandler());
    }
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
    const blank = pages.find((p) => p.url() === "about:blank" && p !== dashboardPage);
    whatsappPage = blank || await ctx.browser.newPage();
  }

  return configurePage(whatsappPage);
}

export async function ensureDashboardOpen(url) {
  if (!config.openDashboard) return null;
  const ctx = await startChromium();

  if (isUsable(dashboardPage)) {
    configurePage(dashboardPage);
    if (dashboardPage.url() !== url) {
      await dashboardPage.goto(url, { waitUntil: "domcontentloaded", timeout: config.navigationTimeoutMs });
    }
    return dashboardPage;
  }

  const pages = await ctx.browser.pages();
  dashboardPage = pages.find((p) => p.url().startsWith(url)) || null;

  if (!dashboardPage) {
    dashboardPage = configurePage(await ctx.browser.newPage());
    await dashboardPage.goto(url, { waitUntil: "domcontentloaded", timeout: config.navigationTimeoutMs });
  }

  return configurePage(dashboardPage);
}

export async function focusChromium() {
  const p = await getWhatsAppPage();
  await p.bringToFront();
  return true;
}

export async function restartChromium() {
  closingByApp = true;
  try { await browser?.close(); } catch {}
  browser = null;
  whatsappPage = null;
  dashboardPage = null;
  closingByApp = false;
  return startChromium();
}

export async function stopChromium() {
  closingByApp = true;
  try { await browser?.close(); } catch {}
  browser = null;
  whatsappPage = null;
  dashboardPage = null;
  setState("stopped", "Chromium stopped.");
}
