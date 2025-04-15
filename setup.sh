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
echo ".env file created in backend."

# Install npm dependencies
npm install
echo "Backend dependencies installed."

# Navigate back to the root directory
cd ..

# Navigate to the admin directory
cd admin || exit
echo "Switched to admin directory."

# Copy .env.example to .env
cp .env.example .env
echo ".env file created in admin."

# Install npm dependencies
npm install -f
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
npm install -f
echo "Consumer dependencies installed."

echo "Setup completed successfully."