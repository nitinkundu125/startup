#!/bin/bash

# Configuration
SERVER="root@172.16.245.84"
DEST_DIR="/opt/algo-engine"

echo "==========================================="
echo "🚀 Deploying Algo Engine to $SERVER"
echo "==========================================="

# Ensure the destination directory exists
echo "[1/4] Creating remote directory..."
ssh $SERVER "mkdir -p $DEST_DIR"

# Rsync the application files over to the server
echo "[2/4] Syncing files via rsync..."
# --delete: without it, a file deleted locally lives on forever on the server and
# still gets compiled. A build failed on prod for exactly this reason — a route
# deleted here kept importing a constant that no longer existed.
# Excluded paths are protected from deletion by rsync, so the live database,
# node_modules and .next survive. *.bak-* keeps hand-made database backups.
rsync -avz --delete \
  --exclude 'node_modules' --exclude '.next' --exclude '.git' \
  --exclude 'dev.db' --exclude '*.bak-*' \
  -e ssh ./ $SERVER:$DEST_DIR/

# Execute remote setup commands
echo "[3/4] Installing dependencies and building on remote server..."
ssh $SERVER << 'EOF'
  cd /opt/algo-engine

  # Check if Node.js is installed
  if ! command -v node &> /dev/null; then
    echo "Node.js not found. Installing Node 20 on Rocky Linux..."
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    dnf install -y nodejs
  fi

  # Install global PM2
  if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
  fi

  # Install dependencies
  echo "Installing project dependencies..."
  npm install

  # Generate Prisma client and apply migrations
  echo "Generating Prisma Client and applying migrations..."
  npx prisma generate

  # `migrate deploy` applies committed migrations and refuses to destroy data.
  # `db push` was previously used here: it has no migration history and will
  # silently drop columns on some schema changes — against the live database.
  if [ -d prisma/migrations ]; then
    npx prisma migrate deploy
  else
    echo "!! prisma/migrations is missing. Refusing to fall back to 'db push' on"
    echo "!! a live database. Create an initial migration locally with:"
    echo "!!   npx prisma migrate dev --name init"
    echo "!! then commit prisma/migrations/ and redeploy."
    exit 1
  fi


  echo "Building Next.js application..."
  npm run build || { echo "!! Build failed. Leaving the running app untouched."; exit 1; }

  # Start or Restart with PM2
  echo "Starting application with PM2..."
  # `pm2 stop` leaves the process registered, so every deploy used to append
  # ANOTHER entry named algo-engine (five had accumulated, all stopped).
  # `delete` removes the registration so exactly one entry survives.
  pm2 delete algo-engine 2>/dev/null || true
  pm2 start npm --name "algo-engine" -- run start

  # Ensure PM2 starts on boot.
  pm2 save

  # NOT `pm2 startup`. That regenerates the unit file, and the unit it generates
  # is broken on this host: it declares PIDFile=/root/.pm2/pm2.pid, which systemd
  # cannot read under SELinux, so the service fails on boot and the app never
  # comes back. That is what kept it down for seven weeks from 2026-06-07.
  # ops/pm2-root.service is the working version; install it only when it differs,
  # so a deploy does not restart the unit for no reason.
  if ! cmp -s ops/pm2-root.service /etc/systemd/system/pm2-root.service; then
    echo "Installing pm2 systemd unit..."
    cp ops/pm2-root.service /etc/systemd/system/pm2-root.service
    systemctl daemon-reload
    systemctl enable pm2-root >/dev/null 2>&1 || true
  fi

  # Report actual state rather than assuming success.
  sleep 3
  pm2 describe algo-engine | grep -E "status|restarts" || true
  if ! pm2 describe algo-engine | grep -q "status.*online"; then
    echo "!! algo-engine is NOT online. Recent logs:"
    pm2 logs algo-engine --lines 30 --nostream || true
    exit 1
  fi
  echo "algo-engine is online."
EOF

# The remote block's exit code. Without this the script announced success even
# when the remote build had just failed and said so on the line above.
REMOTE_STATUS=$?

echo "==========================================="
if [ $REMOTE_STATUS -ne 0 ]; then
  echo "❌ Deployment FAILED (remote exit $REMOTE_STATUS). The previous version is still running."
  echo "Logs: ssh $SERVER 'pm2 logs algo-engine'"
  exit $REMOTE_STATUS
fi
echo "✅ Deployment Complete! The Algo Engine is now running on 172.16.245.84."
echo "You can view the logs on the server using: ssh $SERVER 'pm2 logs algo-engine'"
echo "==========================================="
