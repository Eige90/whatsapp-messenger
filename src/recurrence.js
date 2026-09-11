const DAY_MS = 24 * 60 * 60 * 1000;

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function parseTime(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(value || "");
  if (!match) throw new Error("Time must use HH:MM format.");
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new Error("Invalid time.");
  return { hour, minute };
}

export function atLocalTime(date, time) {
  const { hour, minute } = parseTime(time);
  const result = new Date(date);
  result.setHours(hour, minute, 0, 0);
  return result;
}

function validLocalDate(year, month, day, time) {
  const { hour, minute } = parseTime(time);
  const d = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}

export function computeNextRun(schedule, afterMs = Date.now()) {
  const after = new Date(afterMs);
  const type = schedule.recurrence_type;
  const time = schedule.time_of_day;

  if (type === "once") {
    if (!schedule.once_date) return null;
    const [year, month, day] = schedule.once_date.split("-").map(Number);
    const d = validLocalDate(year, month, day, time);
    return d && d.getTime() > afterMs ? d.getTime() : null;
  }

  if (type === "daily") {
    let candidate = atLocalTime(after, time);
    if (candidate.getTime() <= afterMs) {
      candidate = new Date(candidate.getTime());
      candidate.setDate(candidate.getDate() + 1);
    }
    return candidate.getTime();
  }

  if (type === "weekly") {
    const target = Number(schedule.weekly_day);
    if (!Number.isInteger(target) || target < 0 || target > 6) return null;
    for (let offset = 0; offset <= 7; offset += 1) {
      const d = new Date(after);
      d.setDate(d.getDate() + offset);
      const candidate = atLocalTime(d, time);
      if (candidate.getDay() === target && candidate.getTime() > afterMs) return candidate.getTime();
    }
    return null;
  }

  if (type === "weekdays") {
    const days = Array.isArray(schedule.weekdays) ? schedule.weekdays.map(Number) : [];
    const allowed = new Set(days);
    for (let offset = 0; offset <= 7; offset += 1) {
      const d = new Date(after);
      d.setDate(d.getDate() + offset);
      const candidate = atLocalTime(d, time);
      if (allowed.has(candidate.getDay()) && candidate.getTime() > afterMs) return candidate.getTime();
    }
    return null;
  }

  if (type === "yearly") {
    const month = Number(schedule.yearly_month);
    const day = Number(schedule.yearly_day);
    for (let year = after.getFullYear(); year <= after.getFullYear() + 8; year += 1) {
      const candidate = validLocalDate(year, month, day, time);
      if (candidate && candidate.getTime() > afterMs) return candidate.getTime();
    }
    return null;
  }

  throw new Error(`Unknown recurrence type: ${type}`);
}

export function occurrenceAfter(schedule, dueMs) {
  if (schedule.recurrence_type === "once") return null;
  return computeNextRun(schedule, dueMs + 1000);
}

export function recurrenceLabel(schedule) {
  const time = schedule.time_of_day;
  if (schedule.recurrence_type === "once") return `Once · ${schedule.once_date} ${time}`;
  if (schedule.recurrence_type === "daily") return `Daily · ${time}`;
  if (schedule.recurrence_type === "weekly") return `Weekly · ${WEEKDAYS[Number(schedule.weekly_day)]} ${time}`;
  if (schedule.recurrence_type === "weekdays") {
    const names = (schedule.weekdays || []).map((d) => WEEKDAYS[Number(d)].slice(0, 3)).join(", ");
    return `${names} · ${time}`;
  }
  if (schedule.recurrence_type === "yearly") {
    return `Yearly · ${String(schedule.yearly_day).padStart(2, "0")}.${String(schedule.yearly_month).padStart(2, "0")} · ${time}`;
  }
  return schedule.recurrence_type;
}

export function toLocalInputValue(ms) {
  if (!ms) return "";
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export { DAY_MS };
