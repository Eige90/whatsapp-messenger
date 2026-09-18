import fs from "node:fs";
import { spawn } from "node:child_process";
import { PROFILE_DIR, findChromiumExecutable } from "./config.js";

const executablePath = findChromiumExecutable();
if (!executablePath) {
  console.error("Chromium/Chrome/Edge was not found. Set chromiumPath in config.local.json first.");
  process.exit(1);
}

fs.mkdirSync(PROFILE_DIR, { recursive: true });

console.log("\nGemini manual login mode");
console.log("------------------------");
console.log("1. A normal browser window will open WITHOUT Puppeteer/remote debugging.");
console.log("2. Sign in to Google/Gemini manually.");
console.log("3. Confirm that https://gemini.google.com/app opens normally.");
console.log("4. Close the browser window completely.");
console.log("5. Then run: npm.cmd start\n");
console.log(`Profile: ${PROFILE_DIR}\n`);

const args = [
  `--user-data-dir=${PROFILE_DIR}`,
  "--no-first-run",
  "--no-default-browser-check",
  "--start-maximized",
  "https://gemini.google.com/app"
];

const child = spawn(executablePath, args, {
  detached: false,
  stdio: "ignore",
  windowsHide: false
});

child.once("exit", (code) => {
  console.log(`\nBrowser closed${code != null ? ` (exit ${code})` : ""}.`);
  console.log("Gemini login mode finished. Start the app with: npm.cmd start\n");
  process.exit(0);
});

child.once("error", (error) => {
  console.error(`Could not start browser: ${error.message}`);
  process.exit(1);
});
