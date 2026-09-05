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
 *   captain: "[[Quinn]]"          text or a link
 *   assignment: goa-zo-run        an assignment id from the JSON, or free text
 *   hull_hp: 700                  current hull points
 *   condition: Worn               set by hand, one of the JSON conditions
 *   crew: 18                      heads aboard
 *   crew_quality: 2               -2 Poor .. +3 Elite; shown as Gunnery
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

  function gunnery(data, fm) {
    var q = num(fm.crew_quality, 0);
    var label = (data.rules.gunnery || {})[String(q)] || "Crew";
    return { mod: q, label: label, text: signed(q) + " " + label };
  }

  function condition(data, fm) {
    var raw = fm.condition ? String(fm.condition).trim() : "";
    if (!raw) return { name: "Unset", note: "Set `condition` in the note's properties." };
    var entry = (data.rules.conditions || []).find(function (c) { return c.name.toLowerCase() === raw.toLowerCase(); });
    return entry || { name: raw, note: "" };
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

    var gun = gunnery(data, fm);
    var cond = condition(data, fm);
    var feats = crewFeats(data, fm);
    var asg = assignment(data, fm);
    var hp = num(fm.hull_hp, ship.hullMax);
    var crew = num(fm.crew, null);

    // Identity line
    var head = [];
    if (ship.fullName) head.push("*" + ship.fullName + "*");
    var bits = [ship.hull + (ship.role ? ", " + ship.role.toLowerCase() : ""), "Engine Class " + ship.engineClass];
    if (ship.inventory) bits.push(ship.inventory);
    head.push(bits.join(" · "));
    head.push("**Captain:** " + (fm.captain ? String(fm.captain) : "*unassigned*"));
    dv.paragraph(head.join("  \n"));

    // Cards: the numbers you reach for at the table
    var grid = cardGrid(dv.container);
    card(grid, "Hull HP", hp + " / " + ship.hullMax);
    card(grid, "Condition", cond.name, cond.note);
    card(grid, "Gunnery", signed(gun.mod), gun.label + " crew");
    card(grid, "Speed", (ship.speed !== undefined ? ship.speed : "?") + " / " + num(ship.speedMax, 5));
    card(grid, "AC", ship.ac);
    card(grid, "Crew", crew === null ? "?" : crew, ship.capacity ? "of " + ship.capacity : "");
    card(grid, "STR", ship.str);
    card(grid, "DEX", ship.dex);
    card(grid, "CON", ship.con);

    // Assignment and what it opens
    var asgLine = "**Assignment:** " + asg.label + (asg.note ? " — " + asg.note : "");
    if (asg.unlocks.length > 0) asgLine += "  \n**Opens:** " + unlockText(asg.unlocks);
    dv.paragraph(asgLine);

    // Crew feats
    var featLine = "**Crew feats** (" + feats.chosen.length + " of " + feats.slots.slots +
      " at party level " + feats.slots.level + "): ";
    if (feats.chosen.length === 0) {
      featLine += "*none trained yet*";
    } else {
      featLine += feats.chosen.map(function (f) {
        return "**" + f.name + "**" + (f.unknown ? " ⚠ not in the feat list" : "") + (f.summary ? " — " + f.summary : "");
      }).join("  \n");
    }
    if (feats.chosen.length > feats.slots.slots) featLine += "  \n⚠ Over the feat limit for this party level.";
    dv.paragraph(featLine);

    // Kit
    dv.header(4, "Kit");
    dv.table(["Component", "Where", "Attack", "Damage", "Range", "Crew min"], kitRows(ship, gun));
    var extra = [];
    if (gun.mod !== 0) extra.push("Attacks include Gunnery " + signed(gun.mod) + ".");
    if (Array.isArray(ship.emptyMounts) && ship.emptyMounts.length > 0) extra.push("Empty mounts: " + ship.emptyMounts.join(", ") + ".");
    if (extra.length) dv.paragraph("*" + extra.join(" ") + "*");

    // Layout
    dv.paragraph("**Layout**  \n" + (ship.decks || []).map(function (d) {
      return "Level " + d.level + ": " + (d.rooms || []).join(", ");
    }).join("  \n"));

    // Reference
    var details = dv.container.createEl("details");
    details.createEl("summary", { text: "Rules reference" });
    var ul = details.createEl("ul");
    [data.rules.gunneryNote, data.rules.conditionNote, data.rules.speedNote, data.rules.crewFeatNote]
      .concat(data.rules.reference || [])
      .filter(Boolean)
      .forEach(function (line) { ul.createEl("li", { text: line }); });
    var condUl = details.createEl("ul");
    (data.rules.conditions || []).forEach(function (c) { condUl.createEl("li", { text: c.name + ": " + (c.note || "") }); });
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
      if (!ship) return [p.file.link, "⚠ unknown ship_id `" + fm.ship_id + "`", "", "", "", "", "", "", ""];
      var gun = gunnery(data, fm);
      var cond = condition(data, fm);
      var feats = crewFeats(data, fm);
      var asg = assignment(data, fm);
      var crew = num(fm.crew, null);
      return [
        p.file.link,
        fm.captain ? String(fm.captain) : "*unassigned*",
        asg.label,
        num(fm.hull_hp, ship.hullMax) + " / " + ship.hullMax,
        cond.name,
        gun.text,
        (ship.speed !== undefined ? ship.speed : "?") + " / " + num(ship.speedMax, 5),
        crew === null ? "?" : crew + (ship.capacity ? " / " + ship.capacity : ""),
        feats.chosen.length ? feats.chosen.map(function (f) { return f.name; }).join(", ") : "—",
        asg.unlocks.length ? unlockText(asg.unlocks) : "—"
      ];
    }).sort(function (a, b) { return String(a[0]).localeCompare(String(b[0])); });

    dv.table(["Ship", "Captain", "Assignment", "Hull HP", "Condition", "Gunnery", "Speed", "Crew", "Crew feats", "Opens"], rows);

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
