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
rsync -avz --exclude 'node_modules' --exclude '.next' --exclude '.git' --exclude 'dev.db' -e ssh ./ $SERVER:$DEST_DIR/

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

  # Ensure PM2 starts on boot
  pm2 save
  pm2 startup >/dev/null 2>&1 || true

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

echo "==========================================="
echo "✅ Deployment Complete! The Algo Engine is now running on 172.16.245.84."
echo "You can view the logs on the server using: ssh $SERVER 'pm2 logs algo-engine'"
echo "==========================================="
