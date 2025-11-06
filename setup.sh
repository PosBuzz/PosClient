#!/bin/bash

# Run npm install in the root directory
echo "Installing root dependencies..."
npm install
echo "Root dependencies installed."

# Navigate to the backend directory
cd backend || exit
echo "Switched to backend directory."

# Copy .env.example to .env
cp .env.example .env
echo ".env file created from .env.example."

# Ask user for DB credentials
read -p "Enter DB Host: " DB_HOST
read -p "Enter DB Name: " DB_NAME
read -p "Enter DB Username: " DB_USERNAME
read -s -p "Enter DB Password: " DB_PASSWORD
echo
read -p "Enter DB Port (default 5432): " DB_PORT
DB_PORT=${DB_PORT:-5432} # Use 5432 if user leaves it blank

# Generate DATABASE_URL
DATABASE_URL="postgresql://${DB_USERNAME}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public"

# Overwrite values in .env
sed -i "s|^DB_HOST=.*|DB_HOST=${DB_HOST}|" .env
sed -i "s|^DB_NAME=.*|DB_NAME=${DB_NAME}|" .env
sed -i "s|^DB_USERNAME=.*|DB_USERNAME=${DB_USERNAME}|" .env
sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=${DB_PASSWORD}|" .env
sed -i "s|^DB_PORT=.*|DB_PORT=${DB_PORT}|" .env
sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"${DATABASE_URL}\"|" .env

echo ".env file updated with provided database credentials."

# Export the variables into the environment for this session
export $(grep -v '^#' .env | xargs)

# Install backend dependencies
npm install
echo "Backend dependencies installed."

# Run Prisma commands
npx prisma migrate deploy
npx prisma generate
npx prisma db seed

# Navigate back to the root directory
cd ..

# Navigate to the admin directory
cd admin || exit
echo "Switched to admin directory."

# Copy .env.example to .env
cp .env.example .env
echo ".env file created in admin."

# Install npm dependencies
npm install
echo "Admin dependencies installed."

# Navigate back to the root directory
cd ..

# Navigate to the consumer directory
cd consumer || exit
echo "Switched to consumer directory."

# Copy .env.example to .env
cp .env.example .env
echo ".env file created in consumer."

# Install npm dependencies
npm install
echo "Consumer dependencies installed."

# Navigate back to the root directory
cd ..

# Navigate to the ai-service directory
cd ai-service || exit
echo "Switched to ai-service directory."

# Copy .env.example to .env
cp .env.example .env
echo ".env file created in ai-service."

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "Python3 is not installed. Please install Python 3.8+ and try again."
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d ".venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv .venv
    echo "Virtual environment created."
fi

# Activate virtual environment
echo "Activating virtual environment..."
source .venv/Scripts/activate || source .venv/bin/activate 

# Upgrade pip
python -m pip install --upgrade pip

# Install Python dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt
echo "AI service dependencies installed."

# Create data directories if they don't exist
mkdir -p data/chroma_db
mkdir -p data/feedback
echo "Data directories created."

echo "Setup completed successfully."