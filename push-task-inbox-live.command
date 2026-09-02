#!/bin/bash
cd "$(dirname "$0")"
./push-task-inbox-live.sh
echo
read -r -p "Press Enter to close this window..."
