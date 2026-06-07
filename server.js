const http = require("node:http");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const path = require("node:path");

const root = __dirname;

function loadEnv() {
  const envPath = path.join(root, ".env");
  if (!fsSync.existsSync(envPath)) return;

  const lines = fsSync.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnv();

const port = Number(process.env.PORT || 4173);
const dataDir = path.resolve(root, process.env.DATA_DIR || "data");
const directBookingsPath = path.join(dataDir, "bookings.json");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ics": "text/calendar; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp"
};

const feedConfig = [
  { source: "sutochno", url: process.env.SUTOCHNO_ICAL_URL },
  { source: "avito", url: process.env.AVITO_ICAL_URL }
].filter((feed) => feed.url);

function json(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(body));
}

function dateOnly(value) {
  return value.toISOString().slice(0, 10);
}

function parseDateValue(value) {
  if (/^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }

  const match = value.match(/^(\d{4})(\d{2})(\d{2})T/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;

  return null;
}

function unfoldIcs(content) {
  return content.replace(/\r?\n[ \t]/g, "");
}

function parseIcs(content, source) {
  const events = [];
  const blocks = unfoldIcs(content).split("BEGIN:VEVENT").slice(1);

  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    const event = {};

    for (const line of lines) {
      const separator = line.indexOf(":");
      if (separator === -1) continue;

      const key = line.slice(0, separator).split(";")[0];
      const value = line.slice(separator + 1).trim();

      if (key === "DTSTART") event.start = parseDateValue(value);
      if (key === "DTEND") event.end = parseDateValue(value);
      if (key === "SUMMARY") event.summary = value;
      if (key === "UID") event.uid = value;
    }

    if (event.start && event.end && event.start < event.end) {
      events.push({
        source,
        uid: event.uid || `${source}-${event.start}-${event.end}`,
        start: event.start,
        end: event.end,
        summary: event.summary || "Booked"
      });
    }
  }

  return events;
}

function addDays(date, days) {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return dateOnly(next);
}

function clampRange(range, from, to) {
  const start = range.start < from ? from : range.start;
  const end = range.end > to ? to : range.end;
  if (start >= end) return null;
  return { ...range, start, end };
}

function mergeRanges(ranges) {
  const sorted = [...ranges].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
  const merged = [];

  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (!last || range.start > last.end) {
      merged.push({ start: range.start, end: range.end, sources: [range.source] });
      continue;
    }

    if (range.end > last.end) last.end = range.end;
    if (!last.sources.includes(range.source)) last.sources.push(range.source);
  }

  return merged;
}

async function fetchFeed(feed) {
  const response = await fetch(feed.url, {
    headers: { "user-agent": "domik-calendar-sync/1.0" }
  });

  if (!response.ok) {
    throw new Error(`${feed.source} returned ${response.status}`);
  }

  return parseIcs(await response.text(), feed.source);
}

async function readDirectBookings() {
  try {
    const raw = await fs.readFile(directBookingsPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function getBusyRanges(from, to) {
  const externalResults = await Promise.allSettled(feedConfig.map(fetchFeed));
  const external = externalResults.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
  const direct = (await readDirectBookings()).map((booking) => ({
    source: "direct",
    uid: booking.id || `direct-${booking.start}-${booking.end}`,
    start: booking.start,
    end: booking.end,
    summary: "Direct booking"
  }));

  const events = [...external, ...direct]
    .map((range) => clampRange(range, from, to))
    .filter(Boolean);

  return {
    feeds: feedConfig.map((feed) => feed.source),
    feedErrors: externalResults
      .map((result, index) => (result.status === "rejected" ? { source: feedConfig[index].source, message: result.reason.message } : null))
      .filter(Boolean),
    events,
    merged: mergeRanges(events)
  };
}

async function availability(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const from = url.searchParams.get("from") || dateOnly(new Date());
  const to = url.searchParams.get("to") || addDays(from, 62);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from >= to) {
    json(res, 400, { error: "Use from/to as YYYY-MM-DD and keep from before to." });
    return;
  }

  const busy = await getBusyRanges(from, to);
  json(res, 200, {
    from,
    to,
    updatedAt: new Date().toISOString(),
    feeds: busy.feeds,
    feedErrors: busy.feedErrors,
    events: busy.events,
    busy: busy.merged
  });
}

function escapeIcs(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
    .replace(/\n/g, "\\n");
}

async function directCalendar(res) {
  const bookings = await readDirectBookings();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Domik//Direct bookings//RU",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH"
  ];

  for (const booking of bookings) {
    const uid = booking.id || `direct-${booking.start}-${booking.end}@domik`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeIcs(uid)}`,
      `DTSTART;VALUE=DATE:${booking.start.replaceAll("-", "")}`,
      `DTEND;VALUE=DATE:${booking.end.replaceAll("-", "")}`,
      "SUMMARY:Direct booking",
      "TRANSP:OPAQUE",
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  res.writeHead(200, {
    "content-type": "text/calendar; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(lines.join("\r\n"));
}

async function staticFile(req, res) {
  const rawPath = decodeURIComponent((req.url || "/").split("?")[0]);
  const safePath = rawPath === "/" ? "/index.html" : rawPath;
  const filePath = path.resolve(root, `.${safePath}`);

  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    res.writeHead(200, {
      "content-type": mimeTypes[path.extname(filePath)] || "application/octet-stream"
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith("/api/availability")) {
      await availability(req, res);
      return;
    }

    if (req.url.startsWith("/calendar.ics")) {
      await directCalendar(res);
      return;
    }

    await staticFile(req, res);
  } catch (error) {
    json(res, 500, { error: error.message });
  }
});

server.listen(port, () => {
  console.log(`Domik site listening on http://127.0.0.1:${port}`);
});
