/* Fleet — Dataview view script.
 *
 * Ship note:     await dv.view("Fleet/fleet")
 * Fleet table:   await dv.view("Fleet/fleet", { view: "fleet" })
 *
 * Static stat blocks live in fleet-ships.json (found by filename, anywhere in
 * the vault). A ship note holds only the things that change, as flat
 * properties:
 *
 *   ship_id: unpronounceable     which block in the JSON
 *   captain: "[[Quinn]]"          plain text or a link
 *   assignment: Escorting ...     free text, what the ship is doing
 *   hull_hp: 700                  current hull points
 *   crew: 18                      heads aboard
 *   crew_quality: 1               -2 Poor .. +3 Elite, added to attacks
 *   condition: Worn               optional, overrides the HP-derived label
 *   stations:                     optional list, "Station: who"
 *     - "Helm: [[Kovo]]"
 *     - "Heavy Cannon 1: [[Hugh]], 2 deckhands"
 *
 * Requires Dataview with "Enable JavaScript queries" on.
 */

var Fleet = (function () {

  function num(v, fallback) {
    return typeof v === "number" && !Number.isNaN(v) ? v : fallback;
  }

  function signed(n) {
    return n >= 0 ? "+" + n : String(n);
  }

  // ---- Data ---------------------------------------------------------------

  async function loadData() {
    var file = app.vault.getFiles().find(function (f) { return f.name === "fleet-ships.json"; });
    if (!file) throw new Error("fleet-ships.json not found anywhere in the vault.");
    return JSON.parse(await app.vault.read(file));
  }

  function rawFrontmatter(path) {
    var file = app.vault.getAbstractFileByPath(path);
    var cache = file ? app.metadataCache.getFileCache(file) : null;
    return (cache && cache.frontmatter) ? cache.frontmatter : {};
  }

  function findShip(data, fm, basename) {
    var id = fm.ship_id ? String(fm.ship_id).trim().toLowerCase() : null;
    return data.ships.find(function (s) {
      if (id) return s.id === id;
      return s.name.toLowerCase() === String(basename).toLowerCase();
    }) || null;
  }

  // ---- Stations -----------------------------------------------------------

  // "Heavy Cannon" x2 becomes "Heavy Cannon 1", "Heavy Cannon 2".
  function stations(ship) {
    var out = [];
    (ship.components || []).forEach(function (c) {
      var n = num(c.count, 1);
      for (var i = 1; i <= n; i++) {
        var loc = Array.isArray(c.locations) ? (c.locations[i - 1] || c.location) : c.location;
        out.push(Object.assign({}, c, { name: n > 1 ? c.name + " " + i : c.name, location: loc }));
      }
    });
    return out;
  }

  // Count heads in "Hugh, 2 deckhands, [[Kovo]]" -> 4.
  function headcount(text) {
    return String(text).split(",").reduce(function (sum, part) {
      var p = part.trim();
      if (p === "") return sum;
      var m = p.match(/^(\d+)\b/);
      return sum + (m ? Number(m[1]) : 1);
    }, 0);
  }

  // Frontmatter `stations` list -> { stationName -> who }. Unknown names go
  // under `extra` so a typo is visible instead of silently dropped.
  function assignments(fm, stationList) {
    var map = {}, extra = [];
    var raw = Array.isArray(fm.stations) ? fm.stations : (fm.stations ? [fm.stations] : []);
    raw.forEach(function (entry) {
      var text = String(entry);
      var idx = text.indexOf(":");
      if (idx < 0) { extra.push(text); return; }
      var key = text.slice(0, idx).trim().toLowerCase();
      var who = text.slice(idx + 1).trim();
      var st = stationList.find(function (s) { return s.name.toLowerCase() === key; });
      if (st) map[st.name] = who; else extra.push(text);
    });
    return { map: map, extra: extra };
  }

  // ---- State --------------------------------------------------------------

  function condition(data, ship, fm) {
    var hp = num(fm.hull_hp, ship.hullMax);
    var pct = ship.hullMax > 0 ? Math.round((hp / ship.hullMax) * 100) : 0;
    var override = fm.condition ? String(fm.condition).trim() : "";
    var entry = null;
    if (override) {
      entry = data.rules.conditions.find(function (c) { return c.name.toLowerCase() === override.toLowerCase(); });
      if (!entry) entry = { name: override, note: "Custom condition." };
    } else {
      entry = data.rules.conditions.find(function (c) { return pct >= c.minPct; }) ||
              data.rules.conditions[data.rules.conditions.length - 1];
    }
    return { hp: hp, pct: pct, entry: entry, overridden: !!override };
  }

  function speed(ship, cond) {
    var base = num(ship.speed, null);
    if (base === null) return { text: "?" };
    var s = base;
    var why = [];
    if (num(cond.entry.speedPenalty, 0) > 0) { s -= cond.entry.speedPenalty; why.push(cond.entry.name + " -" + cond.entry.speedPenalty); }
    if (cond.entry.speedCap !== undefined && s > cond.entry.speedCap) { s = cond.entry.speedCap; why.push(cond.entry.name + " cap " + cond.entry.speedCap); }
    s = Math.max(1, s);
    var max = num(ship.speedMax, 5);
    return { value: s, text: s + " / " + max + (why.length ? " (" + why.join(", ") + ")" : "") };
  }

  function crewQuality(data, fm) {
    var q = num(fm.crew_quality, 0);
    var label = data.rules.crewQuality[String(q)] || ("Crew " + signed(q));
    return { mod: q, label: label, text: label + " (" + signed(q) + ")" };
  }

  function crewLine(ship, fm, assign) {
    var aboard = num(fm.crew, null);
    var atStations = Object.keys(assign.map).reduce(function (sum, k) { return sum + headcount(assign.map[k]); }, 0);
    var cap = num(ship.capacity, null);
    var parts = [];
    parts.push(aboard === null ? "? aboard" : aboard + " aboard" + (cap !== null ? " of " + cap : ""));
    if (atStations > 0) parts.push(atStations + " at stations");
    if (aboard !== null && atStations > 0) parts.push(Math.max(0, aboard - atStations) + " free");
    return { aboard: aboard, atStations: atStations, text: parts.join(", ") };
  }

  // Stations below their crew minimum.
  function shortStations(stationList, assign) {
    return stationList.filter(function (s) {
      var min = num(s.crewMin, 0);
      if (min === 0) return false;
      var who = assign.map[s.name];
      return !who || headcount(who) < min;
    });
  }

  // ---- Ship sheet ---------------------------------------------------------

  async function renderShip(dv) {
    var data = await loadData();
    var page = dv.current();
    var fm = rawFrontmatter(page.file.path);
    var ship = findShip(data, fm, page.file.name);
    if (!ship) {
      dv.paragraph("**Fleet:** no ship in fleet-ships.json matches `ship_id: " + (fm.ship_id || "(unset)") +
        "`. Known ids: " + data.ships.map(function (s) { return "`" + s.id + "`"; }).join(", ") + ".");
      return;
    }

    var stationList = stations(ship);
    var assign = assignments(fm, stationList);
    var cond = condition(data, ship, fm);
    var spd = speed(ship, cond);
    var quality = crewQuality(data, fm);
    var crew = crewLine(ship, fm, assign);
    var short = shortStations(stationList, assign);

    // Header line
    var head = [];
    if (ship.fullName) head.push("*" + ship.fullName + "*");
    var bits = [ship.hull + (ship.role ? ", " + ship.role.toLowerCase() : ""), "Engine Class " + ship.engineClass];
    if (ship.inventory) bits.push(ship.inventory);
    head.push(bits.join(" · "));
    head.push("**Captain:** " + (fm.captain ? String(fm.captain) : "*unassigned*") +
      " · **Assignment:** " + (fm.assignment ? String(fm.assignment) : "*idle*"));
    dv.paragraph(head.join("  \n"));

    // State strip
    dv.table(
      ["Hull HP", "Condition", "Speed", "Crew", "Crew Quality", "AC", "STR", "DEX", "CON"],
      [[
        cond.hp + " / " + ship.hullMax + " (" + cond.pct + "%)",
        cond.entry.name + (cond.overridden ? " (set by hand)" : ""),
        spd.text,
        crew.text,
        quality.text,
        ship.ac, ship.str, ship.dex, ship.con
      ]]
    );
    if (cond.entry.note) dv.paragraph("*" + cond.entry.name + ": " + cond.entry.note + "*");

    if (short.length > 0) {
      dv.paragraph("⚠ **Below crew minimum:** " + short.map(function (s) { return s.name; }).join(", "));
    }
    if (assign.extra.length > 0) {
      dv.paragraph("⚠ **Unrecognised station entries:** " + assign.extra.map(function (t) { return "`" + t + "`"; }).join(", ") +
        ". Station names are: " + stationList.map(function (s) { return s.name; }).join(", ") + ".");
    }

    // Stations
    dv.header(4, "Stations");
    dv.table(
      ["Station", "Where", "Crew", "Assigned", "Attack", "Damage", "Range"],
      stationList.map(function (s) {
        var min = num(s.crewMin, 0);
        var who = assign.map[s.name] || "";
        var have = who ? headcount(who) : 0;
        var crewCell = min === 0 ? "—" : have + " / " + min + (s.crewNote ? " (" + s.crewNote + ")" : "");
        if (min > 0 && have < min) crewCell = "⚠ " + crewCell;
        var attack = typeof s.attack === "number"
          ? signed(s.attack + quality.mod) + (quality.mod !== 0 ? " (" + signed(s.attack) + " " + signed(quality.mod) + " crew)" : "")
          : "—";
        var damage = s.damage ? s.damage + (s.damageType ? " " + s.damageType : "") : "—";
        return [s.name, s.location || "—", crewCell, who || "*—*", attack, damage, s.range || "—"];
      })
    );
    if (Array.isArray(ship.emptyMounts) && ship.emptyMounts.length > 0) {
      dv.paragraph("**Empty mounts:** " + ship.emptyMounts.join(", "));
    }

    // Decks
    dv.header(4, "Decks");
    dv.table(["Level", "Rooms"], (ship.decks || []).map(function (d) {
      return ["Level " + d.level, (d.rooms || []).join(", ")];
    }));

    // Reference
    var details = dv.container.createEl("details");
    details.createEl("summary", { text: "Rules reference" });
    var ul = details.createEl("ul");
    [data.rules.crewQualityNote, data.rules.conditionNote, data.rules.speedNote]
      .concat(data.rules.reference || [])
      .filter(Boolean)
      .forEach(function (line) { ul.createEl("li", { text: line }); });
    var condUl = details.createEl("ul");
    data.rules.conditions.forEach(function (c) {
      condUl.createEl("li", { text: c.name + " (" + c.minPct + "%+): " + (c.note || "") });
    });
  }

  // ---- Fleet table --------------------------------------------------------

  async function renderFleet(dv, input) {
    var data = await loadData();
    var folder = (input && input.folder) || null;
    var pages = dv.pages(folder ? '"' + folder + '"' : undefined)
      .where(function (p) { return p.ship_id !== undefined && p.ship_id !== null; })
      .array();

    if (pages.length === 0) {
      dv.paragraph("*No ship notes found. A ship note needs a `ship_id` property.*");
      return;
    }

    var rows = pages.map(function (p) {
      var fm = rawFrontmatter(p.file.path);
      var ship = findShip(data, fm, p.file.name);
      if (!ship) return [p.file.link, "⚠ unknown ship_id `" + fm.ship_id + "`", "", "", "", "", "", "", ""];
      var stationList = stations(ship);
      var assign = assignments(fm, stationList);
      var cond = condition(data, ship, fm);
      var spd = speed(ship, cond);
      var quality = crewQuality(data, fm);
      var crew = crewLine(ship, fm, assign);
      var short = shortStations(stationList, assign);
      return [
        p.file.link,
        ship.hull,
        fm.captain ? String(fm.captain) : "*unassigned*",
        fm.assignment ? String(fm.assignment) : "*idle*",
        cond.hp + " / " + ship.hullMax,
        cond.entry.name,
        spd.text,
        crew.aboard === null ? "?" : crew.aboard + (ship.capacity ? " / " + ship.capacity : ""),
        quality.label,
        short.length === 0 ? "all manned" : "⚠ " + short.length + " short"
      ];
    }).sort(function (a, b) { return String(a[0]).localeCompare(String(b[0])); });

    dv.table(["Ship", "Hull", "Captain", "Assignment", "Hull HP", "Condition", "Speed", "Crew", "Quality", "Stations"], rows);
  }

  return { renderShip: renderShip, renderFleet: renderFleet };
})();

if (input && input.view === "fleet") {
  await Fleet.renderFleet(dv, input);
} else {
  await Fleet.renderShip(dv);
}
