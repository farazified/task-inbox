#!/bin/bash
cd "$(dirname "$0")"
lsof -ti:5173 | xargs kill -9 2>/dev/null
npm run serve &
sleep 2
open -a "Google Chrome" http://127.0.0.1:5173/
wait
