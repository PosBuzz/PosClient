#!/bin/bash

set -e  # stop on error

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 22.22.1 or newer in the Node 22 series is required. Run nvm install 22 first."
  exit 1
fi
node -e 'const [major, minor, patch] = process.versions.node.split(".").map(Number); if (major !== 22 || minor < 22 || (minor === 22 && patch < 1)) { console.error("Use Node.js >=22.22.1 <23 (nvm install 22 && nvm use 22)."); process.exit(1); }'

echo "Installing root dependencies..."
npm install
echo "Root dependencies installed."

cd backend || exit

echo "Switched to backend directory."

cp .env.example .env
echo ".env file created from .env.example."

read -p "Enter DB Host: " DB_HOST
read -p "Enter DB Name: " DB_NAME
read -p "Enter DB Username: " DB_USERNAME
read -s -p "Enter DB Password: " DB_PASSWORD
echo
read -p "Enter DB Port (default 5432): " DB_PORT
DB_PORT=${DB_PORT:-5432}

DATABASE_URL="postgresql://${DB_USERNAME}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public"

echo ".env file updated with provided database credentials."

# ---- SAFE ENV UPDATE (macOS + Linux compatible) ----
update_env () {
  local key=$1
  local value=$2

  if grep -q "^${key}=" .env; then
    # macOS + Linux compatible sed
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' "s|^${key}=.*|${key}=${value}|" .env
    else
      sed -i "s|^${key}=.*|${key}=${value}|" .env
    fi
  else
    echo "${key}=${value}" >> .env
  fi
}

update_env "DB_HOST" "$DB_HOST"
update_env "DB_NAME" "$DB_NAME"
update_env "DB_USERNAME" "$DB_USERNAME"
update_env "DB_PASSWORD" "$DB_PASSWORD"
update_env "DB_PORT" "$DB_PORT"
update_env "DATABASE_URL" "\"$DATABASE_URL\""

export $(grep -v '^#' .env | xargs)

npm install
echo "Backend dependencies installed."

npx prisma migrate deploy || true
npx prisma generate
npx prisma db seed || true

cd ..

# ---------------- ADMIN ----------------
cd admin || exit
cp .env.example .env
npm install
echo "Admin dependencies installed."
cd ..

# ---------------- CONSUMER ----------------
cd consumer || exit
cp .env.example .env
npm install
echo "Consumer dependencies installed."
cd ..

# ---------------- AI SERVICE ----------------
cd ai-service || exit
cp .env.example .env

echo "Setting up Python environment..."

if ! command -v python3 &> /dev/null; then
  echo "Python3 not installed"
  exit 1
fi

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi

echo "Activating virtual environment..."
source .venv/bin/activate

python -m pip install --upgrade pip

pip install -r requirements.txt

mkdir -p data/chroma_db
mkdir -p data/feedback

echo "Setup completed successfully."