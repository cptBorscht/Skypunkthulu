// Cubeventory inventory view for the Obsidian Dataview plugin (dataviewjs).
//
// Install: copy this file to <vault home>/views/cubeventory/view-cubventory.js
//          (on SteamOS: /Home/deck/cthulu/calendar/Skypunkthulu/views/cubeventory/view-cubventory.js)
//
// Use from a character note in <vault home>/characters/:
//   await dv.view("views/cubeventory/view-cubventory", { character: "Quinn" })
// If no character is given, the note's file name is used.
//
// Saves are read straight from where Cubeventory writes them: using "Save As"
// while the app runs from its local server stores the file in SAVES_DIR below.
// If that folder isn't reachable, the view asks the running Cubeventory server,
// and as a last resort reads a copy placed in <vault home>/views/cubeventory/.
//
// Output: three simplified lists - equipped items first (anything not
// snapped into the grid when the save was made - Cubeventory stamps each
// item with an "equipped" attr on save), then magic items, then ordinary
// items. Saves made before the equipped stamp existed just show an empty
// equipped list until re-saved.

const SAVES_DIR = "/Home/dnd/cthulu/inventories/Cubeventory-main/saves";
const SERVER_URL = "http://127.0.0.1:8737";

const character = (input && input.character) ? input.character : dv.current().file.name;

// the server collapses whitespace in the name when saving, so mirror that
// here; case differences are covered by the fuzzy lookups below (the deck's
// filesystem is case-sensitive, so "The unpronounceable" would otherwise miss)
const fileName = character.replace(/\s+/g, " ").trim() + " cubeventory.json";

function matchesFileName(candidate) {
    return candidate.replace(/\s+/g, " ").trim().toLowerCase() === fileName.toLowerCase();
}

async function loadSave() {
    //1) straight from the app's saves folder
    try {
        const fs = require("fs");
        const filePath = SAVES_DIR + "/" + fileName;
        if (fs.existsSync(filePath))
            return fs.readFileSync(filePath, "utf8");
        //no exact match - take a case/spacing-insensitive one
        const match = fs.readdirSync(SAVES_DIR).find(matchesFileName);
        if (match !== undefined)
            return fs.readFileSync(SAVES_DIR + "/" + match, "utf8");
    } catch (e) { /* no filesystem access (mobile or sandboxed) */ }

    //2) from the running Cubeventory server
    try {
        const response = await fetch(SERVER_URL + "/saves/" + encodeURIComponent(fileName));
        if (response.ok)
            return await response.text();
        //no exact match - scan the server's directory listing for a
        //case/spacing-insensitive one
        const listing = await fetch(SERVER_URL + "/saves/");
        if (listing.ok) {
            const names = [...(await listing.text()).matchAll(/href="([^"]+)"/g)]
                .map(m => decodeURIComponent(m[1]));
            const match = names.find(matchesFileName);
            if (match !== undefined) {
                const retry = await fetch(SERVER_URL + "/saves/" + encodeURIComponent(match));
                if (retry.ok)
                    return await retry.text();
            }
        }
    } catch (e) { /* server not running */ }

    //3) a copy placed in the vault
    return await dv.io.load("views/cubeventory/" + fileName);
}

const raw = await loadSave();

if (!raw) {
    dv.paragraph("⚠️ No Cubeventory save found for **" + character + "**.");
    dv.paragraph("Run Cubeventory from its server and use *Save As* - the file lands in `" + SAVES_DIR + "` automatically. (A copy of `" + fileName + "` in `views/cubeventory/` works too.)");
} else {
    const save = JSON.parse(raw);

    // save.items is Konva's serialized item layer: children are the item
    // groups, each carrying the item info in attrs
    const itemLayer = JSON.parse(save.items);
    const items = (itemLayer.children || []).filter(child => child.attrs && child.attrs.itemName !== undefined);

    // equipped = not snapped into the grid when saved; the rest split by magic
    const equipped = items.filter(item => item.attrs.equipped === true);
    const stored = items.filter(item => item.attrs.equipped !== true);
    const magic = stored.filter(item => item.attrs.magicItem === true);
    const ordinary = stored.filter(item => item.attrs.magicItem !== true);

    // collapse duplicates into "Name ×N", sorted alphabetically;
    // markMagic tags magic items with ✨ (used in the mixed equipped list)
    function simplifiedList(list, markMagic) {
        const counts = new Map();
        for (const item of list) {
            let name = (item.attrs.altName !== undefined && item.attrs.altName !== "")
                ? item.attrs.altName
                : item.attrs.itemName;
            if (markMagic && item.attrs.magicItem === true)
                name += " ✨";
            counts.set(name, (counts.get(name) || 0) + 1);
        }
        return [...counts.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([name, count]) => (count > 1 ? name + " ×" + count : name));
    }

    dv.header(2, "🛡️ Equipped Items");
    const equippedList = simplifiedList(equipped, true);
    if (equippedList.length > 0)
        dv.list(equippedList);
    else
        dv.paragraph("*none*");

    dv.header(2, "✨ Magic Items");
    const magicList = simplifiedList(magic);
    if (magicList.length > 0)
        dv.list(magicList);
    else
        dv.paragraph("*none*");

    dv.header(2, "Ordinary Items");
    const ordinaryList = simplifiedList(ordinary);
    if (ordinaryList.length > 0)
        dv.list(ordinaryList);
    else
        dv.paragraph("*none*");
}
