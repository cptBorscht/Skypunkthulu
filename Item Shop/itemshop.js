/* The Item Shop — Dataview view script.
 * Used from a note via:  await dv.view("Item Shop/itemshop")
 * Per-note settings come from the note's frontmatter (see README.md).
 * Requires the Dataview plugin with "Enable JavaScript queries" turned on.
 */

var ItemShop = (function () {
  var RARITY_ORDER = { common: 0, uncommon: 1, rare: 2, "very rare": 3, legendary: 4 };

  function hashSeed(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function estimatePrice(item, rarityEstimates) {
    if (typeof item.price === "number") return { gp: item.price, estimated: false };
    if (item.priceNote) return { note: item.priceNote };
    if (item.rarity && rarityEstimates && typeof rarityEstimates[item.rarity] === "number") {
      return { gp: rarityEstimates[item.rarity], estimated: true };
    }
    return { note: "ask" };
  }

  function fmtGp(gp) {
    if (gp >= 1) {
      var rounded = gp >= 100 ? Math.round(gp) : Math.round(gp * 10) / 10;
      return rounded.toLocaleString("en-US") + " gl";
    }
    var sp = Math.round(gp * 10);
    if (sp >= 1) return sp + " sp";
    return Math.max(1, Math.round(gp * 100)) + " cp";
  }

  function fmtPrice(item, rarityEstimates, markup) {
    var p = estimatePrice(item, rarityEstimates);
    if (p.note) return p.note;
    var gp = p.gp * (markup || 1);
    return (p.estimated ? "~" : "") + fmtGp(gp);
  }

  function fmtWeight(w) {
    if (w === null || w === undefined || w === "") return "—";
    if (typeof w === "number") return w + " lb.";
    return String(w);
  }

  function filterItems(items, cfg) {
    var lower = function (arr) { return (arr || []).map(function (x) { return String(x).toLowerCase(); }); };
    var sources = lower(cfg.sources);
    var categories = lower(cfg.categories);
    var rarities = lower(cfg.rarities);
    var excludeMech = lower(cfg.excludeMechanics);
    var onlyMech = lower(cfg.onlyMechanics);
    return items.filter(function (it) {
      if (sources.length && sources.indexOf(String(it.source).toLowerCase()) < 0) return false;
      if (categories.length && categories.indexOf(String(it.category).toLowerCase()) < 0) return false;
      var mech = lower(it.mechanics);
      if (excludeMech.length && mech.some(function (m) { return excludeMech.indexOf(m) >= 0; })) return false;
      if (onlyMech.length && !mech.some(function (m) { return onlyMech.indexOf(m) >= 0; })) return false;
      if (rarities.length) {
        var r = it.rarity ? String(it.rarity).toLowerCase() : "none";
        if (rarities.indexOf(r) < 0) return false;
      }
      if (typeof cfg.maxPrice === "number") {
        var p = estimatePrice(it, cfg.rarityEstimates);
        if (typeof p.gp === "number" && p.gp > cfg.maxPrice) return false;
      }
      return true;
    });
  }

  function pickStock(items, count, seedString) {
    if (!count || count <= 0 || count >= items.length) return items.slice();
    var rand = mulberry32(hashSeed(seedString));
    var pool = items.slice();
    var picked = [];
    for (var i = 0; i < count; i++) {
      var idx = Math.floor(rand() * pool.length);
      picked.push(pool.splice(idx, 1)[0]);
    }
    return picked;
  }

  function sortItems(items) {
    return items.slice().sort(function (a, b) {
      if (a.category !== b.category) return a.category < b.category ? -1 : 1;
      var ra = a.rarity ? RARITY_ORDER[a.rarity] : -1;
      var rb = b.rarity ? RARITY_ORDER[b.rarity] : -1;
      if (ra !== rb) return ra - rb;
      var pa = typeof a.price === "number" ? a.price : Infinity;
      var pb = typeof b.price === "number" ? b.price : Infinity;
      if (pa !== pb) return pa - pb;
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    });
  }

  function groupItems(items) {
    var groups = [];
    var byCat = {};
    items.forEach(function (it) {
      if (!byCat[it.category]) {
        byCat[it.category] = { category: it.category, items: [] };
        groups.push(byCat[it.category]);
      }
      byCat[it.category].items.push(it);
    });
    return groups;
  }

  /* Pure assembly of everything the renderer needs — this is what the tests exercise. */
  function buildShop(data, cfg, todayIso) {
    var excludeMechanics = cfg.excludeMechanics !== undefined && cfg.excludeMechanics !== null
      ? cfg.excludeMechanics
      : (data.defaultExcludedMechanics || []);
    var filtered = filterItems(data.items, {
      sources: cfg.sources, categories: cfg.categories, rarities: cfg.rarities,
      excludeMechanics: excludeMechanics, onlyMechanics: cfg.onlyMechanics,
      maxPrice: cfg.maxPrice, rarityEstimates: data.rarityEstimates
    });
    var stocked = pickStock(filtered, cfg.stock, (cfg.shop || "") + "|" + (cfg.seed || "") + "|" + todayIso);
    var groups = groupItems(sortItems(stocked)).map(function (g) {
      return {
        category: g.category,
        rows: g.items.map(function (it) {
          var srcName = (data.sources[it.source] && data.sources[it.source].name) || it.source;
          var details = [it.type || it.category];
          if (it.rarity) details.push(it.rarity);
          if (it.attunement) {
            details.push(it.attunement === true ? "attunement" : "attunement: " + it.attunement);
          }
          (it.mechanics || []).forEach(function (m) { details.push("⚙ " + m); });
          return {
            name: it.name,
            details: details.join(" · "),
            blurb: it.blurb || "",
            sourceRef: srcName + (it.page ? ", p. " + it.page : ""),
            price: fmtPrice(it, data.rarityEstimates, cfg.markup),
            weight: fmtWeight(it.weight),
            searchText: (it.name + " " + (it.type || "") + " " + (it.rarity || "") + " " + (it.blurb || "") + " " + it.category + " " + (it.mechanics || []).join(" ")).toLowerCase()
          };
        })
      };
    });
    return { groups: groups, total: stocked.length, stocked: cfg.stock > 0 && cfg.stock < filtered.length, available: filtered.length };
  }

  return { hashSeed: hashSeed, mulberry32: mulberry32, estimatePrice: estimatePrice, fmtGp: fmtGp,
           fmtPrice: fmtPrice, fmtWeight: fmtWeight, filterItems: filterItems, pickStock: pickStock,
           sortItems: sortItems, groupItems: groupItems, buildShop: buildShop };
})();

/* Rotation date. Reads the current in-world date from the Calendarium calendar
 * named by `calendar:` (default "Skyaian"), so stock turns over when the campaign
 * date advances, not when the real-world day does. Falls back to the system date
 * if Calendarium isn't installed or that calendar doesn't exist. */
function worldDate(name, dvRef) {
  /* Shared date first: a note with `campaign_date: true` (see Campaign Date.md)
   * travels with git, so both machines rotate stock from the same day even
   * though each keeps its own Calendarium file. */
  try {
    var notes = dvRef ? dvRef.pages().where(function (p) { return p.campaign_date === true; }).array() : [];
    if (notes.length > 0) {
      var n = notes[0];
      var y = Number(n.cal_year), m = Number(n.cal_month), dd = Number(n.cal_day);
      if ([y, m, dd].every(function (v) { return Number.isFinite(v); })) {
        var key = y + "-" + (m - 1) + "-" + dd;
        var lbl = null;
        try {
          var capi = app.plugins.getPlugin("calendarium").api.getAPI(name);
          lbl = capi.toDisplayDate({ year: y, month: m - 1, day: dd });
        } catch (e) { lbl = null; }
        return { key: key, label: lbl || (n.cal_label ? String(n.cal_label) : dd + "/" + m + "/" + y) };
      }
    }
  } catch (e) { /* fall through to Calendarium */ }
  try {
    var api = (typeof window !== "undefined" && window.Calendarium) || app.plugins.getPlugin("calendarium").api;
    var cal = api.getAPI(name);
    var d = cal.getCurrentDate();
    var key = d.year + "-" + d.month + "-" + d.day;
    var label;
    try { label = cal.toDisplayDate(d); } catch (e) { label = key; }
    return { key: key, label: label };
  } catch (e) {
    var iso = new Date().toISOString().slice(0, 10);
    return { key: iso, label: iso };
  }
}

async function itemShopMain(dv, input) {
  var root = dv.container;
  var fail = function (msg) { root.createEl("p", { text: "Item Shop: " + msg }); };

  var dataFile = app.vault.getFiles().find(function (f) { return f.name === "item-shop-items.json"; });
  if (!dataFile) return fail("could not find item-shop-items.json anywhere in this vault.");

  var data;
  try { data = JSON.parse(await app.vault.cachedRead(dataFile)); }
  catch (e) { return fail("item-shop-items.json is not valid JSON (" + e.message + ")."); }

  var page = dv.current() || {};
  var fm = Object.assign({}, page, (page.file && page.file.frontmatter) || {});
  input = input || {};
  var cfg = {
    shop: input.shop || fm.shop || dv.current().file.name,
    sources: input.sources || fm.sources || [],
    categories: input.categories || fm.categories || [],
    rarities: input.rarities || fm.rarities || [],
    excludeMechanics: input.excludeMechanics !== undefined ? input.excludeMechanics
      : (fm.excludeMechanics !== undefined ? fm.excludeMechanics : undefined),
    onlyMechanics: input.onlyMechanics || fm.onlyMechanics || [],
    maxPrice: typeof input.maxPrice === "number" ? input.maxPrice : (typeof fm.maxPrice === "number" ? fm.maxPrice : null),
    stock: typeof input.stock === "number" ? input.stock : (typeof fm.stock === "number" ? fm.stock : 0),
    markup: typeof input.markup === "number" ? input.markup : (typeof fm.markup === "number" ? fm.markup : 1),
    seed: input.seed || fm.seed || "",
    calendar: input.calendar || fm.calendar || "Skyaian",
    search: input.search !== undefined ? input.search : (fm.search !== undefined ? fm.search : true)
  };

  /* Fleet hook. A shop note with `fleetUnlock: <assignment id>` is only open
   * while some ship note's `assignment` matches that id (see fleet-ships.json).
   * An unlock with mode "full" also lifts the stock limit for the visit. */
  var unlockNote = null;
  var fleetUnlock = input.fleetUnlock !== undefined ? input.fleetUnlock : fm.fleetUnlock;
  if (fleetUnlock) {
    try {
      var fleetFile = app.vault.getFiles().find(function (f) { return f.name === "fleet-ships.json"; });
      var fleet = fleetFile ? JSON.parse(await app.vault.cachedRead(fleetFile)) : { assignments: [] };
      var wanted = String(fleetUnlock).toLowerCase();
      var shopPath = (dv.current().file.path || "").replace(/\.md$/, "").toLowerCase();
      var active = null;
      dv.pages().where(function (p) { return p.ship_id !== undefined && p.ship_id !== null; }).forEach(function (p) {
        var sfm = ((app.metadataCache.getFileCache(app.vault.getAbstractFileByPath(p.file.path)) || {}).frontmatter) || {};
        var raw = sfm.assignment ? String(sfm.assignment).trim().toLowerCase() : "";
        var a = (fleet.assignments || []).find(function (x) { return x.id.toLowerCase() === raw || x.label.toLowerCase() === raw; });
        if (!a || a.id.toLowerCase() !== wanted) return;
        var u = (a.unlocks || []).find(function (x) { return String(x.shop).replace(/\.md$/, "").toLowerCase() === shopPath; });
        if (!u) u = { shop: shopPath };
        if (!active || u.mode === "full") active = { unlock: u, ship: p.file.name, label: a.label };
      });
      if (!active) {
        return fail("this shop is out of reach. It opens while a ship is on the \"" + fleetUnlock + "\" assignment (see the Fleet note).");
      }
      if (active.unlock.mode === "full") cfg.stock = 0;
      unlockNote = "Open via " + active.ship + " (" + active.label + ")" + (active.unlock.mode === "full" ? ", full inventory" : "");
    } catch (e) {
      return fail("fleet check failed (" + e.message + ").");
    }
  }

  var today = worldDate(cfg.calendar, dv);
  var shop = ItemShop.buildShop(data, cfg, today.key);

  var head = root.createEl("div");
  head.style.margin = "0.3em 0 0.6em 0";
  var sub = shop.stocked
    ? "In stock today (" + today.label + "): " + shop.total + " of " + shop.available + " items"
    : shop.total + " items";
  head.createEl("strong", { text: cfg.shop });
  head.createEl("span", { text: "  —  " + sub + (unlockNote ? "  ·  " + unlockNote : "") }).style.opacity = "0.7";

  var visibleRows = [];
  if (cfg.search) {
    var searchBox = root.createEl("input");
    searchBox.setAttribute("type", "text");
    searchBox.setAttribute("placeholder", "Filter items…");
    searchBox.style.width = "100%";
    searchBox.style.margin = "0 0 0.6em 0";
    searchBox.addEventListener("input", function () {
      var q = searchBox.value.toLowerCase().trim();
      visibleRows.forEach(function (entry) {
        entry.tr.style.display = !q || entry.searchText.indexOf(q) >= 0 ? "" : "none";
      });
      visibleRows.forEach(function (entry) {
        if (!entry.isHeader) return;
        var any = entry.children.some(function (c) { return c.tr.style.display !== "none"; });
        entry.tr.style.display = any ? "" : "none";
      });
    });
  }

  var table = root.createEl("table");
  table.style.width = "100%";
  shop.groups.forEach(function (group) {
    var hr = table.createEl("tr");
    var hc = hr.createEl("th", { text: group.category });
    hc.setAttribute("colspan", "3");
    hc.style.textAlign = "left";
    hc.style.paddingTop = "0.8em";
    var headerEntry = { tr: hr, isHeader: true, searchText: "", children: [] };
    visibleRows.push(headerEntry);

    group.rows.forEach(function (row) {
      var tr = table.createEl("tr");
      var nameCell = tr.createEl("td");
      nameCell.createEl("strong", { text: row.name });
      var meta = nameCell.createEl("div", { text: row.details + "  ·  " + row.sourceRef });
      meta.style.fontSize = "0.8em";
      meta.style.opacity = "0.7";
      if (row.blurb) {
        var b = nameCell.createEl("div", { text: row.blurb });
        b.style.fontSize = "0.85em";
      }
      var priceCell = tr.createEl("td", { text: row.price });
      priceCell.style.whiteSpace = "nowrap";
      priceCell.style.verticalAlign = "top";
      var wtCell = tr.createEl("td", { text: row.weight });
      wtCell.style.whiteSpace = "nowrap";
      wtCell.style.verticalAlign = "top";
      var entry = { tr: tr, isHeader: false, searchText: row.searchText };
      visibleRows.push(entry);
      headerEntry.children.push(entry);
    });
  });

  if (shop.total === 0) fail("no items match this note's filters — check its frontmatter.");
}

if (typeof dv !== "undefined") {
  itemShopMain(dv, typeof input === "undefined" ? {} : input);
} else if (typeof module !== "undefined" && module.exports) {
  module.exports = { ItemShop: ItemShop, itemShopMain: itemShopMain };
}
