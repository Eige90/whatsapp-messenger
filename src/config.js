import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(__dirname, "..");
export const DATA_DIR = path.join(ROOT_DIR, "data");
export const PROFILE_DIR = path.join(DATA_DIR, "chromium-profile");
export const DB_PATH = path.join(DATA_DIR, "whatsapp.db");

const defaults = {
  port: 3001,
  chromiumPath: "",
  openDashboard: true,
  openDevTools: false,
  schedulerIntervalMs: 1000,
  suspendDetectionMs: 30000,
  protocolTimeoutMs: 120000,
  navigationTimeoutMs: 90000,
  actionTimeoutMs: 90000,
  sendConfirmationTimeoutMs: 30000,
  postTimeoutVerificationMs: 15000,
  batchDelayMs: 2000,
  sendRetryRounds: 3,
  retryRoundDelayMs: 4000,
  openGemini: true,
  geminiResponseTimeoutMs: 120000,
  geminiStableMs: 1800,
  geminiLoginGraceMs: 30000,
  geminiGenerationRetries: 3,
  geminiGenerationRetryDelayMs: 3000,
  remoteDebuggingStartupTimeoutMs: 20000
};

function readLocalConfig() {
  const file = path.join(ROOT_DIR, "config.local.json");
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`Invalid config.local.json: ${error.message}`);
  }
}

const localConfig = readLocalConfig();

export const config = {
  ...defaults,
  ...localConfig,
  port: Number(process.env.PORT || localConfig.port || defaults.port),
  chromiumPath: process.env.CHROMIUM_PATH || localConfig.chromiumPath || defaults.chromiumPath,
  schedulerIntervalMs: Number(localConfig.schedulerIntervalMs ?? defaults.schedulerIntervalMs),
  suspendDetectionMs: Number(localConfig.suspendDetectionMs ?? defaults.suspendDetectionMs),
  protocolTimeoutMs: Number(localConfig.protocolTimeoutMs ?? defaults.protocolTimeoutMs),
  navigationTimeoutMs: Number(localConfig.navigationTimeoutMs ?? defaults.navigationTimeoutMs),
  actionTimeoutMs: Number(localConfig.actionTimeoutMs ?? defaults.actionTimeoutMs),
  sendConfirmationTimeoutMs: Number(localConfig.sendConfirmationTimeoutMs ?? defaults.sendConfirmationTimeoutMs),
  postTimeoutVerificationMs: Number(localConfig.postTimeoutVerificationMs ?? defaults.postTimeoutVerificationMs),
  batchDelayMs: Number(localConfig.batchDelayMs ?? defaults.batchDelayMs),
  sendRetryRounds: Number(localConfig.sendRetryRounds ?? defaults.sendRetryRounds),
  retryRoundDelayMs: Number(localConfig.retryRoundDelayMs ?? defaults.retryRoundDelayMs),
  openGemini: localConfig.openGemini ?? defaults.openGemini,
  geminiResponseTimeoutMs: Number(localConfig.geminiResponseTimeoutMs ?? defaults.geminiResponseTimeoutMs),
  geminiStableMs: Number(localConfig.geminiStableMs ?? defaults.geminiStableMs),
  geminiLoginGraceMs: Number(localConfig.geminiLoginGraceMs ?? defaults.geminiLoginGraceMs),
  geminiGenerationRetries: Number(localConfig.geminiGenerationRetries ?? defaults.geminiGenerationRetries),
  geminiGenerationRetryDelayMs: Number(localConfig.geminiGenerationRetryDelayMs ?? defaults.geminiGenerationRetryDelayMs),
  remoteDebuggingStartupTimeoutMs: Number(localConfig.remoteDebuggingStartupTimeoutMs ?? defaults.remoteDebuggingStartupTimeoutMs)
};

function existing(paths) {
  return paths.filter(Boolean).find((candidate) => fs.existsSync(candidate));
}

function windowsBrowserCandidates(home) {
  const local = process.env.LOCALAPPDATA;
  const programFiles = process.env.PROGRAMFILES;
  const programFilesX86 = process.env["PROGRAMFILES(X86)"];

  const candidates = [
    // Chromium
    local && path.join(local, "Chromium", "Application", "chrome.exe"),
    programFiles && path.join(programFiles, "Chromium", "Application", "chrome.exe"),
    programFilesX86 && path.join(programFilesX86, "Chromium", "Application", "chrome.exe"),

    // Google Chrome (Chromium based)
    local && path.join(local, "Google", "Chrome", "Application", "chrome.exe"),
    programFiles && path.join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
    programFilesX86 && path.join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),

    // Microsoft Edge (Chromium based)
    local && path.join(local, "Microsoft", "Edge", "Application", "msedge.exe"),
    programFiles && path.join(programFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
    programFilesX86 && path.join(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe"),

    // Portable/user installations
    path.join(home, "Tools", "chromium", "chrome.exe"),
    path.join(home, "Tools", "chrome", "chrome.exe")
  ];

  const tools = path.join(home, "Tools");
  if (fs.existsSync(tools)) {
    for (const entry of fs.readdirSync(tools, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const name = entry.name.toLowerCase();
      if (!name.includes("chromium") && !name.includes("chrome") && !name.includes("edge")) continue;
      candidates.push(
        path.join(tools, entry.name, "chrome.exe"),
        path.join(tools, entry.name, "msedge.exe"),
        path.join(tools, entry.name, "Application", "chrome.exe"),
        path.join(tools, entry.name, "Application", "msedge.exe")
      );
    }
  }

  return candidates;
}

export function findChromiumExecutable() {
  if (config.chromiumPath) {
    const explicit = path.isAbsolute(config.chromiumPath)
      ? config.chromiumPath
      : path.resolve(ROOT_DIR, config.chromiumPath);
    if (fs.existsSync(explicit)) return explicit;
    throw new Error(`Configured Chromium executable does not exist: ${explicit}`);
  }

  const home = os.homedir();
  const candidates = [];

  if (process.platform === "win32") {
    candidates.push(...windowsBrowserCandidates(home));
  } else if (process.platform === "darwin") {
    candidates.push(
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
    );
  } else {
    candidates.push(
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/snap/bin/chromium",
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/microsoft-edge",
      "/usr/bin/microsoft-edge-stable"
    );
  }

  return existing(candidates);
}
