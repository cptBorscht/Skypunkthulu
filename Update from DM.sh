#!/bin/bash
# Pulls whatever the DM has pushed to main into this vault.
# Double-click "Update from DM.desktop", or run this from the vault folder.
cd "$(dirname "$0")" || exit 1

# Calendarium keeps its own file on each machine (the DM's has secret
# events). Keep this machine's copy safe across the pull.
CAL=".obsidian/plugins/calendarium/data.json"
[ -f "$CAL" ] && cp "$CAL" "$CAL.local-backup"

echo "Updating Skypunkthulu from the DM..."
echo
git pull --rebase --autostash origin main
status=$?

if [ -f "$CAL.local-backup" ] && [ ! -f "$CAL" ]; then
    cp "$CAL.local-backup" "$CAL"
    echo "(restored this machine's calendar file)"
fi

echo
if [ $status -eq 0 ]; then
    echo "Done. Reopen the note in Obsidian if it looks stale."
else
    echo "Something went wrong. Take a photo of this window and send it to the DM."
fi
echo
read -rp "Press Enter to close this window."
