/* Fleet — Dataview view script.
 *
 * Ship note:     await dv.view("Fleet/fleet")
 * Fleet table:   await dv.view("Fleet/fleet", { view: "fleet" })
 *
 * Static stat blocks, crew feats, and assignments live in fleet-ships.json
 * (found by filename, anywhere in the vault). A ship note holds only what
 * changes, as flat properties:
 *
 *   ship_id: unpronounceable      which block in the JSON
 *   captain: "[[Quinn]]"          text or a link (fleet table only)
 *   assignment: goa-zo-run        an assignment id from the JSON, or free text
 *   hull_hp: 700                  current hull points
 *   condition: 4                  1 to 5, 5 best (Crippled .. Pristine)
 *   crew_quality: 3               1 to 5, 5 best (Green .. Elite); drives Gunnery
 *   crew_feats:                   list of crew feat names from the JSON
 *     - Cannon Experts
 *
 * Requires Dataview with "Enable JavaScript queries" on.
 */

var Fleet = (function () {

  function num(v, fallback) {
    return typeof v === "number" && !Number.isNaN(v) ? v : fallback;
  }
  function signed(n) { return n >= 0 ? "+" + n : String(n); }
  function list(v) { return Array.isArray(v) ? v : (v === undefined || v === null || v === "" ? [] : [v]); }
  function noteLink(path) {
    var name = String(path).replace(/\.md$/, "");
    var base = name.split("/").pop();
    return "[[" + name + "|" + base + "]]";
  }

  // ---- Data ---------------------------------------------------------------

  async function loadData() {
    var file = app.vault.getFiles().find(function (f) { return f.name === "fleet-ships.json"; });
    if (!file) throw new Error("fleet-ships.json not found anywhere in the vault.");
    return JSON.parse(await app.vault.cachedRead(file));
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

  // ---- State --------------------------------------------------------------

  // crew_quality 1..5 -> label + Gunnery modifier, from rules.crewQuality.
  function crewQuality(data, fm) {
    var table = data.rules.crewQuality || {};
    var keys = Object.keys(table).map(Number).sort(function (a, b) { return a - b; });
    var max = keys[keys.length - 1] || 5;
    var raw = fm.crew_quality;
    var q = null;
    if (typeof raw === "number") q = raw;
    else if (typeof raw === "string" && raw.trim() !== "") {
      var n = Number(raw.trim());
      if (!Number.isNaN(n)) q = n;
      else {
        var hit = keys.find(function (k) { return table[String(k)].label.toLowerCase() === raw.trim().toLowerCase(); });
        if (hit !== undefined) q = hit;
      }
    }
    if (q === null) return { value: null, label: "Unset", mod: 0, max: max };
    q = Math.max(keys[0], Math.min(max, Math.round(q)));
    var e = table[String(q)] || { label: "Crew", mod: 0 };
    return { value: q, label: e.label, mod: num(e.mod, 0), max: max };
  }

  // condition 1..5 (or a name) -> entry from rules.conditions.
  function condition(data, fm) {
    var conds = data.rules.conditions || [];
    var max = conds.reduce(function (m, c) { return Math.max(m, num(c.value, 0)); }, 0) || 5;
    var raw = fm.condition;
    var entry = null;
    if (typeof raw === "number") entry = conds.find(function (c) { return c.value === Math.round(raw); });
    else if (typeof raw === "string" && raw.trim() !== "") {
      var n = Number(raw.trim());
      entry = !Number.isNaN(n)
        ? conds.find(function (c) { return c.value === Math.round(n); })
        : conds.find(function (c) { return c.name.toLowerCase() === raw.trim().toLowerCase(); });
    }
    if (!entry) return { value: null, name: "Unset", note: "Set condition 1 to 5 in the note's properties.", max: max };
    return { value: entry.value, name: entry.name, note: entry.note || "", max: max };
  }

  function featSlots(data) {
    var lvl = num(data.rules.partyLevel, 1);
    var slots = 0;
    (data.rules.crewFeatSlots || []).forEach(function (row) { if (lvl >= row.minLevel) slots = row.feats; });
    return { level: lvl, slots: slots };
  }

  function crewFeats(data, fm) {
    var known = data.rules.crewFeats || [];
    var chosen = list(fm.crew_feats).map(function (n) {
      var name = String(n).trim();
      var found = known.find(function (f) { return f.name.toLowerCase() === name.toLowerCase(); });
      return found || { name: name, summary: "", unknown: true };
    });
    return { chosen: chosen, slots: featSlots(data) };
  }

  function assignment(data, fm) {
    var raw = fm.assignment ? String(fm.assignment).trim() : "";
    if (!raw) return { label: "Idle", note: "", unlocks: [], id: null };
    var entry = (data.assignments || []).find(function (a) {
      return a.id.toLowerCase() === raw.toLowerCase() || a.label.toLowerCase() === raw.toLowerCase();
    });
    if (entry) return { id: entry.id, label: entry.label, note: entry.note || "", unlocks: entry.unlocks || [] };
    return { id: null, label: raw, note: "", unlocks: [] };
  }

  function unlockText(unlocks) {
    return unlocks.map(function (u) {
      return noteLink(u.shop) + (u.mode === "full" ? " (full inventory)" : "");
    }).join(", ");
  }

  // ---- Rendering helpers --------------------------------------------------

  function card(grid, label, value, hint) {
    var el = grid.createEl("div");
    el.style.cssText = "min-width:5.5rem;padding:.4rem .6rem;border-radius:6px;" +
      "background:var(--background-secondary);border:1px solid var(--background-modifier-border);";
    var l = el.createEl("div", { text: label });
    l.style.cssText = "font-size:.72em;text-transform:uppercase;letter-spacing:.04em;opacity:.7;";
    var v = el.createEl("div", { text: String(value) });
    v.style.cssText = "font-size:1.4em;font-weight:600;line-height:1.15;font-variant-numeric:tabular-nums;";
    if (hint) {
      var h = el.createEl("div", { text: hint });
      h.style.cssText = "font-size:.75em;opacity:.65;";
    }
    return el;
  }

  function section(container, title) {
    var el = container.createEl("div", { text: title });
    el.style.cssText = "font-size:.72em;text-transform:uppercase;letter-spacing:.06em;opacity:.7;" +
      "margin:1rem 0 .25rem;padding-bottom:.15rem;border-bottom:1px solid var(--background-modifier-border);";
    return el;
  }

  function cardGrid(container) {
    var grid = container.createEl("div");
    grid.style.cssText = "display:flex;flex-wrap:wrap;gap:.5rem;margin:.5rem 0;";
    return grid;
  }

  function kitRows(ship, gun) {
    return (ship.kit || []).map(function (k) {
      var count = num(k.count, 1);
      var attack = typeof k.attack === "number"
        ? signed(k.attack + gun.mod) + (gun.mod !== 0 ? " (" + signed(k.attack) + " base)" : "")
        : "—";
      var crewMin = k.crewMin === undefined || k.crewMin === null || k.crewMin === 0 ? "—" : String(k.crewMin);
      return [(count > 1 ? count + " × " : "") + k.name, k.where || "—", attack, k.damage || "—", k.range || "—", crewMin];
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

    var gun = crewQuality(data, fm);
    var cond = condition(data, fm);
    var feats = crewFeats(data, fm);
    var asg = assignment(data, fm);
    var hp = num(fm.hull_hp, ship.hullMax);

    // Identity line
    var head = [];
    if (ship.fullName) head.push("*" + ship.fullName + "*");
    head.push(ship.hull + (ship.role ? ", " + ship.role.toLowerCase() : "") + " · Engine Class " + ship.engineClass);
    dv.paragraph(head.join("  \n"));

    // Cards: the numbers you reach for at the table
    var grid = cardGrid(dv.container);
    card(grid, "Hull HP", hp + " / " + ship.hullMax);
    card(grid, "Condition", cond.name, cond.value === null ? cond.note : cond.value + " / " + cond.max + " · " + cond.note);
    card(grid, "Crew", gun.label, gun.value === null ? "set crew_quality 1 to 5" : gun.value + " / " + gun.max);
    card(grid, "Gunnery", signed(gun.mod), "from crew, added to attacks");
    card(grid, "AC", ship.ac);
    card(grid, "STR", ship.str);
    card(grid, "DEX", ship.dex);
    card(grid, "CON", ship.con);

    // Assignment and what it opens
    section(dv.container, "Assignment");
    var asgLine = "**" + asg.label + "**" + (asg.note ? " — " + asg.note : "");
    if (asg.unlocks.length > 0) asgLine += "  \nOpens: " + unlockText(asg.unlocks);
    dv.paragraph(asgLine);

    // Crew feats (only for crews the party trains)
    if (ship.trackFeats !== false) {
    section(dv.container, "Crew feats · " + feats.chosen.length + " of " + feats.slots.slots + " at party level " + feats.slots.level);
    var featLine;
    if (feats.chosen.length === 0) {
      featLine = "*none trained yet*";
    } else {
      featLine = feats.chosen.map(function (f) {
        return "**" + f.name + "**" + (f.unknown ? " ⚠ not in the feat list" : "") + (f.summary ? " — " + f.summary : "");
      }).join("  \n");
    }
    if (feats.chosen.length > feats.slots.slots) featLine += "  \n⚠ Over the feat limit for this party level.";
    dv.paragraph(featLine);
    }

    // Kit
    section(dv.container, "Kit");
    dv.table(["Component", "Where", "Attack", "Damage", "Range", "Crew min"], kitRows(ship, gun));
    var extra = [];
    if (gun.mod !== 0) extra.push("Attacks include Gunnery " + signed(gun.mod) + ".");
    if (Array.isArray(ship.emptyMounts) && ship.emptyMounts.length > 0) extra.push("Empty mounts: " + ship.emptyMounts.join(", ") + ".");
    if (extra.length) dv.paragraph("*" + extra.join(" ") + "*");

    // Layout
    section(dv.container, "Layout");
    dv.paragraph((ship.decks || []).map(function (d) {
      return "**Level " + d.level + "** " + (d.rooms || []).join(", ");
    }).join("  \n"));

    // Reference
    var details = dv.container.createEl("details");
    details.createEl("summary", { text: "Rules reference" });
    var ul = details.createEl("ul");
    [data.rules.crewQualityNote, data.rules.conditionNote, data.rules.speedNote, data.rules.crewFeatNote]
      .concat(data.rules.reference || [])
      .filter(Boolean)
      .forEach(function (line) { ul.createEl("li", { text: line }); });
    var condUl = details.createEl("ul");
    (data.rules.conditions || []).forEach(function (c) { condUl.createEl("li", { text: "Condition " + c.value + " " + c.name + ": " + (c.note || "") }); });
    var cqUl = details.createEl("ul");
    Object.keys(data.rules.crewQuality || {}).sort().forEach(function (k) {
      var e = data.rules.crewQuality[k];
      cqUl.createEl("li", { text: "Crew " + k + " " + e.label + ": Gunnery " + signed(num(e.mod, 0)) });
    });
    var featUl = details.createEl("ul");
    (data.rules.crewFeats || []).forEach(function (f) { featUl.createEl("li", { text: f.name + ": " + f.summary }); });
    var asgUl = details.createEl("ul");
    (data.assignments || []).forEach(function (a) {
      asgUl.createEl("li", { text: a.id + " — " + a.label + (a.unlocks && a.unlocks.length ? " (opens " + a.unlocks.length + " shop" + (a.unlocks.length === 1 ? "" : "s") + ")" : "") });
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
      if (!ship) return [p.file.link, "⚠ unknown ship_id `" + fm.ship_id + "`", "", "", "", "", "", ""];
      var gun = crewQuality(data, fm);
      var cond = condition(data, fm);
      var feats = crewFeats(data, fm);
      var asg = assignment(data, fm);
      return [
        p.file.link,
        fm.captain ? String(fm.captain) : "*unassigned*",
        asg.label,
        num(fm.hull_hp, ship.hullMax) + " / " + ship.hullMax,
        cond.name,
        gun.label + " (" + signed(gun.mod) + ")",
        ship.trackFeats === false ? "*not tracked*" : (feats.chosen.length ? feats.chosen.map(function (f) { return f.name; }).join(", ") : "—"),
        asg.unlocks.length ? unlockText(asg.unlocks) : "—"
      ];
    }).sort(function (a, b) { return String(a[0]).localeCompare(String(b[0])); });

    dv.table(["Ship", "Captain", "Assignment", "Hull HP", "Condition", "Crew (Gunnery)", "Crew feats", "Opens"], rows);

    var allUnlocks = [];
    pages.forEach(function (p) {
      assignment(data, rawFrontmatter(p.file.path)).unlocks.forEach(function (u) { allUnlocks.push(u); });
    });
    if (allUnlocks.length > 0) {
      dv.paragraph("**Shops reachable through the fleet right now:** " + unlockText(allUnlocks));
    }
  }

  // Used by the item shop: which unlock (if any) covers a shop note right now.
  function activeUnlockFor(data, shipFrontmatters, shopPath) {
    var target = String(shopPath).replace(/\.md$/, "").toLowerCase();
    var hit = null;
    shipFrontmatters.forEach(function (fm) {
      assignment(data, fm).unlocks.forEach(function (u) {
        if (String(u.shop).replace(/\.md$/, "").toLowerCase() === target) {
          if (!hit || u.mode === "full") hit = u;
        }
      });
    });
    return hit;
  }

  return { renderShip: renderShip, renderFleet: renderFleet, loadData: loadData,
           rawFrontmatter: rawFrontmatter, assignment: assignment, activeUnlockFor: activeUnlockFor };
})();

if (typeof dv !== "undefined") {
  if (input && input.view === "fleet") {
    await Fleet.renderFleet(dv, input);
  } else {
    await Fleet.renderShip(dv);
  }
}
