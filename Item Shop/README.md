# The Item Shop

A simple item-shop browser for Obsidian, built from four sourcebooks:

| Key | Source | What's in it |
|-----|--------|--------------|
| SC | Steampunk Compendium (9-page excerpt, pp. 58–66) | firearms, unique weapons, grenades, modern armor, gun mods |
| AC | Airship Campaigns (Skies of Skyaia) | magic items, potions, zap guns, bionics, ship upgrades, eldritch crystals |
| CM | Sandy Petersen's Cthulhu Mythos for 5e | Mythos gear, alien tech, magic items, forbidden texts |
| SW | Southlands Worldbook (Kobold Press) | Appendix C magic items, tosculi living items and gear, regional goods |
| ESS | Eldritch Society Smiths (homebrew) | firearms-as-spell-foci mods, caster gun gear |
| MGL | Merchant's Guild Livery (homebrew) | non-martial martial gear: armor, bolas, instruments, hats |

## Setup (once)

1. Copy this whole **`Item Shop`** folder anywhere into your vault
   (the script finds `item-shop-items.json` by filename, so location doesn't matter —
   but keep the folder name `Item Shop` or update the `dv.view(...)` path in the notes).
2. Install the community plugin **Dataview** (Settings → Community plugins).
3. In Dataview's settings, turn on **Enable JavaScript queries**.
4. Open any note in `Shops/` or `Goa Zo Shops/`. Done — works the same on
   SteamOS/Linux, Windows, and mobile.

`Shops/` holds the Skyaia/Mythos storefronts; `Goa Zo Shops/` holds the five
Southlands (SW) storefronts, which between them carry every SW item exactly once.

> SteamOS note: Linux is case-sensitive about file paths. If you rename anything,
> keep the capitalization matching the `dv.view("Item Shop/itemshop")` calls.

## Making your own shop note

Any note becomes a shop with a frontmatter block plus one code block:

````markdown
---
shop: Larissa's Oddments        # display name
sources: [AC, CM]               # empty or omitted = all sources
categories: [Magic Item, Potion] # empty = all categories
rarities: [common, uncommon]    # empty = all; use "none" for mundane items
maxPrice: 500                   # hide anything estimated above this many gl
stock: 10                       # >0 = only N items, rotating daily; 0 = everything
seed: larissa                   # change to reshuffle a stocked shop
calendar: Skyaian               # Calendarium calendar driving stock rotation
markup: 1.2                     # price multiplier (1.2 = 20% markup)
search: true                    # show the filter box
---

```dataviewjs
await dv.view("Item Shop/itemshop")
```
````

Every frontmatter field except `shop` is optional.

## Stock rotation and the campaign calendar

Shops with `stock: N` rotate on the **in-world** date, read from the
[Calendarium](https://plugins.javalent.com/calendarium) plugin — by default the
calendar named `Skyaian`. Stock turns over when you advance the campaign date,
not when the real-world day changes, and the shop header shows the in-world date.

- Point a note at a different calendar with `calendar: Some Other Calendar`.
- If Calendarium isn't installed, or that calendar doesn't exist, rotation falls
  back to the system date — the header shows a `YYYY-MM-DD` date instead of an
  in-world one, which is the tell.
- Dataview renders once, so after advancing the date, reopen the note (or
  Ctrl+P → "Dataview: Force refresh all views") to see the new stock.

**Categories:** Weapon, Ammunition, Armor, Gun Mod, Explosive, Magic Item, Potion,
Zap Gun, Bionic, Ship Upgrade, Material, Gear, Mythos Text.

## Mechanics tags

AC/CM items that lean on a book-specific subsystem carry `mechanics` tags
(shown as ⚙ badges, searchable in the filter box). Full glossary lives in
`item-shop-items.json` → `mechanicsGlossary`:

crystal-exhaustion, spelldriving, ship-attunement, eldritch-constructs,
grimhulk-transformation, carcassite, altitude-rules, bionics-attunement,
arcane-firearms, yog-sothothery, alien-tech, insanity, mythos-texts,
mythos-spells, mythos-monsters, dreamlands, tosculi-living-items,
siltstorm, ravening-disease

**Banned by default in every shop** (`defaultExcludedMechanics` in the JSON):
crystal-exhaustion, carcassite, mythos-texts, mythos-spells, mythos-monsters.

Per-note frontmatter overrides:

- `excludeMechanics: []` — clear the bans (see *Full Catalog*)
- `excludeMechanics: [spelldriving, insanity]` — replace the ban list entirely
- `onlyMechanics: [mythos-monsters]` — show only items with a listed tag
  (see *The Travelling Butcher*, the sole home of monster-summoning items)

Note: the setting's "shard" flavor (shard constructs, Shardjammer, shard blimps)
is renamed to **eldritch** throughout this data.

## How prices work

Prices display in **gl** (goldleaf) — the setting's gold piece; values are 1:1 with book gp.

- A plain price (e.g. `250 gl`) is straight from the book.
- `~3,000 gl` (with a tilde) is an **estimate by rarity** — the Airship and Cthulhu books
  don't price most magic items. Defaults (editable in `item-shop-items.json` →
  `rarityEstimates`): common 75, uncommon 300, rare 3,000, very rare 30,000, legendary 150,000.
- `hull cost x2` etc. are the book's formula prices for ship upgrades.
- `markup` in a note's frontmatter multiplies all numeric prices for that shop.

Weight is shown where the books list one; `—` means no listed weight.

## Running the tests

From the repo folder (not needed inside the vault):

```
node tests/validate.js
node tests/smoke.js
```

`validate.js` checks the data for garbage (empty names, broken characters, bad
prices/weights/rarities, duplicates). `smoke.js` renders a shop against a fake DOM and
fails if anything like `undefined`, `NaN`, or `[object Object]` reaches the output.
