export function renderMessageTemplate(template, recipient = {}) {
  const name = String(recipient.name || recipient.recipient_name || "").trim();
  const phone = String(recipient.phone || "").trim();
  return String(template || "")
    .replace(/\{\{\s*name\s*\}\}/gi, name)
    .replace(/\{\{\s*phone\s*\}\}/gi, phone);
}
