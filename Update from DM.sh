#!/bin/bash
# Pulls whatever the DM has pushed to main into this vault.
# Double-click "Update from DM.desktop", or run this from the vault folder.
cd "$(dirname "$0")" || exit 1

echo "Updating Skypunkthulu from the DM..."
echo
git pull --rebase --autostash origin main
status=$?
echo
if [ $status -eq 0 ]; then
    echo "Done. Reopen the note in Obsidian if it looks stale."
else
    echo "Something went wrong. Take a photo of this window and send it to the DM."
fi
echo
read -rp "Press Enter to close this window."
