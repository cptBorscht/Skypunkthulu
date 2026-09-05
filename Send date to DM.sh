#!/bin/bash
# Sends the Campaign Date note (and only that) up to main so the DM gets it.
# Run after a session in which the date moved on this machine.
cd "$(dirname "$0")" || exit 1

echo "Sending the campaign date to the DM..."
echo
git add "Campaign Date.md"
if git diff --cached --quiet; then
    echo "The date has not changed since the last send. Nothing to do."
else
    git commit -q -m "Campaign date from the player workstation" && \
    git pull --rebase --autostash origin main && \
    git push origin HEAD:main
    if [ $? -eq 0 ]; then
        echo; echo "Sent."
    else
        echo; echo "Something went wrong. Take a photo of this window and send it to the DM."
    fi
fi
echo
read -rp "Press Enter to close this window."
