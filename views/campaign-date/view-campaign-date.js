// Campaign Date view for the Obsidian Dataview plugin (dataviewjs).
//
// Use from the Campaign Date note:
//   await dv.view("views/campaign-date/view-campaign-date")
//
// The note's properties (cal_year, cal_month 1-based, cal_day) are the shared
// campaign date. Calendarium's own data.json stays local to each machine, so
// this view keeps the two in step by hand: it shows both, and the buttons
// write to both. Nothing is changed silently.

const CALENDAR = (input && input.calendar) || "Skyaian";
const root = dv.container;
const page = dv.current();
const file = app.vault.getAbstractFileByPath(page.file.path);

function frontmatter() {
  const c = app.metadataCache.getFileCache(file);
  return (c && c.frontmatter) || {};
}

// ---- Calendarium access (all optional; the note works without it) ----------

function plugin() { return app.plugins.getPlugin("calendarium"); }
function api() {
  try { return plugin().api.getAPI(CALENDAR); } catch (e) { return null; }
}
function calendarData() {
  try { return plugin().data.calendars.find((c) => c.name === CALENDAR) || null; } catch (e) { return null; }
}
function calCurrent() {
  const a = api();
  if (!a) return null;
  try { const d = a.getCurrentDate(); return { year: d.year, month: d.month + 1, day: d.day }; } catch (e) { return null; }
}
function label(d) {
  const a = api();
  if (a && d) {
    try { return a.toDisplayDate({ year: d.year, month: d.month - 1, day: d.day }); } catch (e) { /* fall through */ }
  }
  return d ? d.day + " / " + d.month + " / " + d.year : "unset";
}
function setCalendarium(d) {
  const target = { year: d.year, month: d.month - 1, day: d.day };
  const a = api();
  try { if (a && typeof a.getStore === "function") { a.getStore().setCurrentDate(target); return true; } } catch (e) { /* try next */ }
  try {
    const cal = calendarData();
    const store = cal && plugin().getStore(cal.id);
    if (store) { store.setCurrentDate(target); return true; }
  } catch (e) { /* give up */ }
  return false;
}

// ---- Note date -------------------------------------------------------------

function noteDate() {
  const fm = frontmatter();
  const y = Number(fm.cal_year), m = Number(fm.cal_month), d = Number(fm.cal_day);
  if ([y, m, d].some((n) => !Number.isFinite(n))) return null;
  return { year: y, month: m, day: d };
}
async function writeNote(d) {
  await app.fileManager.processFrontMatter(file, (fm) => {
    fm.cal_year = d.year; fm.cal_month = d.month; fm.cal_day = d.day; fm.cal_label = label(d);
  });
}
function same(a, b) { return a && b && a.year === b.year && a.month === b.month && a.day === b.day; }

// Month lengths from Calendarium's static data; falls back to 30-day months.
function monthLengths() {
  const cal = calendarData();
  const months = cal && cal.static && Array.isArray(cal.static.months) ? cal.static.months : null;
  return months ? months.map((m) => Number(m.length) || 30) : null;
}
function shift(d, delta) {
  const lens = monthLengths();
  const count = lens ? lens.length : 12;
  const len = (m) => (lens ? lens[m - 1] : 30);
  let { year, month, day } = d;
  day += delta;
  while (day > len(month)) { day -= len(month); month += 1; if (month > count) { month = 1; year += 1; } }
  while (day < 1) { month -= 1; if (month < 1) { month = count; year -= 1; } day += len(month); }
  return { year, month, day };
}

// ---- Render ----------------------------------------------------------------

const note = noteDate();
const cal = calCurrent();

const big = root.createEl("div", { text: label(note) });
big.style.cssText = "font-size:1.6em;font-weight:600;margin:.2em 0;";
root.createEl("div", { text: note ? "Campaign date, from this note." : "Set cal_year, cal_month, cal_day in the properties." })
  .style.cssText = "opacity:.65;font-size:.85em;";

function button(parent, text, onClick) {
  const b = parent.createEl("button", { text });
  b.style.margin = "0 .4em .4em 0";
  b.onclick = async () => {
    try { await onClick(); } catch (e) { status.setText("Failed: " + e.message); }
  };
  return b;
}
const row = root.createEl("div");
row.style.margin = ".6em 0 .2em";
const status = root.createEl("div");
status.style.cssText = "opacity:.7;font-size:.85em;";

async function moveTo(d, why) {
  await writeNote(d);
  const ok = setCalendarium(d);
  status.setText(why + " " + label(d) + (ok ? ". Calendarium updated too." : ". Calendarium not reachable, note only."));
}

if (note) {
  button(row, "+1 day", () => moveTo(shift(note, 1), "Advanced to"));
  button(row, "+7 days", () => moveTo(shift(note, 7), "Advanced to"));
  button(row, "-1 day", () => moveTo(shift(note, -1), "Back to"));
}

if (cal && !same(note, cal)) {
  const warn = root.createEl("div");
  warn.style.cssText = "margin:.6em 0;padding:.5em .7em;border-left:3px solid var(--color-orange);background:var(--background-secondary);";
  warn.createEl("div", { text: "Calendarium on this machine says " + label(cal) + ". This note says " + label(note) + "." });
  const fix = warn.createEl("div");
  fix.style.marginTop = ".4em";
  button(fix, "Use Calendarium's date here", async () => {
    await writeNote(cal);
    status.setText("Note set to " + label(cal) + ". Commit and push so the other machine gets it.");
  });
  if (note) button(fix, "Push this note's date into Calendarium", () => {
    const ok = setCalendarium(note);
    status.setText(ok ? "Calendarium set to " + label(note) + "." : "Could not reach Calendarium.");
  });
} else if (cal) {
  status.setText("Calendarium agrees.");
} else {
  status.setText("Calendarium not found on this machine; the note still works on its own.");
}
