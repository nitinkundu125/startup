#!/bin/bash
# Host-level setup that lives outside /opt/algo-engine: cron schedules and log
# rotation. Run once on a new server, or after changing ops/cron.algo-engine.example.
# Idempotent.
set -euo pipefail
cd "$(dirname "$0")/.."

SECRET=$(grep '^CRON_SECRET=' .env | cut -d= -f2- | tr -d '"')
[ -n "$SECRET" ] || { echo "CRON_SECRET missing from .env"; exit 1; }

sed "s|\$CRON_SECRET|$SECRET|g; /^# Reference copy/d; /^# real CRON_SECRET/d" \
  ops/cron.algo-engine.example > /etc/cron.d/algo-engine
chmod 600 /etc/cron.d/algo-engine

cat > /etc/logrotate.d/algo-engine <<'LR'
/var/log/algo-engine-cron.log /var/log/algo-engine-health.log {
    weekly
    rotate 8
    compress
    missingok
    notifempty
    copytruncate
}
LR

pm2 install pm2-logrotate >/dev/null 2>&1 || true
pm2 set pm2-logrotate:max_size 10M >/dev/null 2>&1 || true
pm2 set pm2-logrotate:retain 7 >/dev/null 2>&1 || true

echo "cron + logrotate installed"
