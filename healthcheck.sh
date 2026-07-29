#!/bin/bash
# Is the app actually serving? Nothing watched it before, so a failed boot on
# 2026-06-07 went unnoticed until someone happened to open the site in late July.
#
# Tries to self-heal first, then reports. Only alerts on a state CHANGE, so a
# prolonged outage sends one message rather than one every five minutes.
set -uo pipefail
cd /opt/algo-engine
STATE=/var/run/algo-engine-health.state
URL=http://localhost:3000/login

check() { curl -s -o /dev/null -m 20 -w "%{http_code}" "$URL"; }

notify() {
  TOKEN=$(grep '^TELEGRAM_BOT_TOKEN=' .env | cut -d= -f2- | tr -d '"')
  CHAT=$(grep '^ALERT_CHAT_ID=' .env | cut -d= -f2- | tr -d '"')
  [ -n "$TOKEN" ] && [ -n "$CHAT" ] || return 0
  curl -s -o /dev/null -m 20 -X POST \
    "https://api.telegram.org/bot$TOKEN/sendMessage" \
    -d "chat_id=$CHAT" -d "parse_mode=HTML" --data-urlencode "text=$1"
}

CODE=$(check)
PREV=$(cat "$STATE" 2>/dev/null || echo up)

if [ "$CODE" = "200" ]; then
  [ "$PREV" = "down" ] && notify "✅ <b>Portfolio app recovered</b>%0Aserving again on 172.16.245.84:3000"
  echo up > "$STATE"
  exit 0
fi

# Down. Attempt recovery before shouting.
systemctl start pm2-root >/dev/null 2>&1 || /usr/lib/node_modules/pm2/bin/pm2 resurrect >/dev/null 2>&1
sleep 20
CODE2=$(check)
if [ "$CODE2" = "200" ]; then
  [ "$PREV" = "down" ] && notify "✅ <b>Portfolio app recovered</b>"
  echo up > "$STATE"
  exit 0
fi

if [ "$PREV" != "down" ]; then
  notify "🔴 <b>Portfolio app is DOWN</b>%0Ahttp://172.16.245.84:3000 returned <code>$CODE2</code>%0AAuto-restart did not bring it back."
fi
echo down > "$STATE"
exit 1
