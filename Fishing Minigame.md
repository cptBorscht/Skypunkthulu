---
title: Fishing Minigame
type: rules
source: D&D Fishing Minigame, by Saffy Penrose
tags: [rules/downtime, rules/fishing]
---

# Fishing

One pass down this list is one day of fishing. Untick it when you're done.

- [ ] Roll **5d6**
- [ ] Reroll any dice, up to **7** times. Count down on a d10.
- [ ] Add the dice up
- [ ] Pattern? Multiply. No pattern? Skip.
- [ ] Add gear bonus: **+0**
- [ ] Find the score in the table below
- [ ] Score 60 or more? Ask the DM if it's magical
- [ ] Tick the fish in the log, and add 1 to days fished

|                  |        |
| ---------------- | ------ |
| Full house       | **x2** |
| Four of a kind   | **x3** |
| Straight (5 in a row) | **x4** |
| Five of a kind   | **x5** |

Multiply first, then add gear. Never the other way round.

**Days fished:** 0 &nbsp; (Angler at 30, Master Angler at 100)

## Catch log

Tick a fish the first time you land it. All 52 gets you the Lucky Hat.

```dataviewjs
const raw = dv.current().file.tasks;
const tasks = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.values) ? raw.values : []);
const heading = (t) => String((t.header && t.header.subpath) || (t.section && t.section.subpath) || "");
const rows = [];
let done = 0, total = 0;
for (const pool of ["Freshwater", "Aethersea"]) {
  const t = tasks.filter((x) => heading(x).includes(pool));
  const d = t.filter((x) => x.completed).length;
  rows.push([pool, d + " / " + t.length]);
  done += d; total += t.length;
}
rows.push(["**Total**", "**" + done + " / " + total + "**"]);
dv.table(["Pool", "Caught"], rows);
if (total > 0 && done === total) dv.paragraph("**Catch 'Em All complete.** Find the sea nymph.");
```

### Freshwater

- [ ] Minnows - 20
- [ ] Bluegill - 21
- [ ] Crappies - 22
- [ ] Sunfish - 23
- [ ] Smallmouth bass - 24
- [ ] Carp - 25
- [ ] Perch - 26
- [ ] Quipper - 27
- [ ] Walleye - 28
- [ ] Bullhead catfish - 29
- [ ] Largemouth bass - 30-31
- [ ] Pike - 32-33
- [ ] Salmon - 34-35
- [ ] Lungfish - 36-37
- [ ] Tiger trout - 38-39
- [ ] Sturgeon - 40-44
- [ ] Giant salamander - 45-49
- [ ] Giant stingray - 50-54
- [ ] Giant catfish - 55-59
- [ ] Stonefish - 60-64
- [ ] Goliath tigerfish - 65-69
- [ ] Scorpion carp - 70-79
- [ ] Void salmon - 80-89
- [ ] Ghostfish - 100-124
- [ ] Silverfin flier - 125-149
- [ ] Legend - 150+

### Aethersea

- [ ] Anchovies - 20
- [ ] Sardines - 21
- [ ] Herrings - 22
- [ ] Red Snapper - 23
- [ ] Shad - 24
- [ ] Tilapia - 25
- [ ] Halibut - 26
- [ ] Red Mullet - 27
- [ ] Albacore - 28
- [ ] Tuna - 29
- [ ] Sea cucumber - 30-31
- [ ] Giant trevally - 32-33
- [ ] Barracuda - 34-35
- [ ] Blue Marlin - 36-37
- [ ] Sailfish - 38-39
- [ ] Pufferfish - 40-44
- [ ] Dorado - 45-49
- [ ] Giant octopus - 50-54
- [ ] Giant swordfish - 55-59
- [ ] Lightning eel - 60-64
- [ ] Darkclaw lobster - 65-69
- [ ] Mightfish - 70-79
- [ ] Sagefish - 80-89
- [ ] Benthic Man O'War - 100-124
- [ ] Kingfish - 125-149
- [ ] Imperial Manta Ray - 150+

## Fishing table

| Score | Freshwater | Aethersea |
|-------|------------|-----------|
| 5-19 | Junk | Junk |
| 20 | 2d6 Minnows | 2d6 Anchovies |
| 21 | 2d6 Bluegill | 2d6 Sardines |
| 22 | 2d6 Crappies | 2d6 Herrings |
| 23 | 2d6 Sunfish | 2d6 Red Snapper |
| 24 | 2d6 Smallmouth bass | 2d6 Shad |
| 25 | 2d6 Carp | 2d6 Tilapia |
| 26 | 2d6 Perch | 2d6 Halibut |
| 27 | 2d6 Quipper | 2d6 Red Mullet |
| 28 | 1d6 Walleye | 1d6 Albacore |
| 29 | 1d6 Bullhead catfish | 1d6 Tuna |
| 30-31 | 2d4 Largemouth bass | 1d4 Sea cucumber |
| 32-33 | 2d4 Pike | 1d4 Giant trevally |
| 34-35 | 2d4 Salmon | 1d4 Barracuda |
| 36-37 | 1d4 Lungfish | 1d4 Blue Marlin |
| 38-39 | 1d4 Tiger trout | 1d4 Sailfish |
| 40-44 | 1d4 Sturgeon | 1d4 Pufferfish |
| 45-49 | Giant salamander | Dorado |
| 50-54 | Giant stingray | Giant octopus |
| 55-59 | Giant catfish | Giant swordfish |
| 60-64 | Stonefish | Lightning eel |
| 65-69 | Goliath tigerfish | Darkclaw lobster |
| 70-79 | Scorpion carp | Mightfish |
| 80-89 | Void salmon | Sagefish |
| 90-99 | Treasure | Treasure |
| 100-124 | Ghostfish | Benthic Man O'War |
| 125-149 | Silverfin flier | Kingfish |
| 150+ | Legend | Imperial Manta Ray |

> [!note]- Junk (d8)
> 1 Nothing · 2 Crawling claw · 3 Sticks · 4 Seaweed · 5 Old boot · 6 Broken crab trap · 7 Message in a bottle · 8 A working net

> [!note]- Treasure (d10)
> 1 Trident of fish command · 2 Ring of water walking · 3 Mariner's armor · 4 Stone of good luck · 5 Tentacle rod · 6 Cloak of the manta ray · 7 Pearl of power · 8 Bowl of commanding water elementals · 9 Decanter of endless water · 10 Folding boat

## Getting better

> [!note]- Gear (flat bonus, added after multiplying)
> | Item | Cost | Bonus |
> |---|---|---|
> | Improved Pole | 12 gp | +3 |
> | Improved Line | 5 gp | +1 |
> | Improved Lures | 8 gp | +1 |
>
> All three together is +5. Update the gear line in the checklist when you buy one.

> [!note]- Angler and Master Angler
> **Angler**, 30 days fished: roll 6d6, and +10 after multiplying.
> **Master Angler**, 100 days fished: roll 7d6, and another +10. Both stack.
> Patterns still only need the five dice named. Spare dice just add to the sum.

> [!note]- Lucky Hat
> Artifact hat, attune as a Master Angler. Shape it into any hat you like.
> Immune to blinded, charmed, deafened, frightened, petrified, stunned, disease, and aging.
> Catch twice as many fish. You'll want a pipe or a piece of straw.
