#!/usr/bin/env bash
set -o errexit

echo "📦 Installing dependencies..."
npm install

echo "📍 List of installed dependencies:"
npm ls

echo "🔐 Generating development certificate..."
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost"

echo "✅️ Dependencies installed, ready to start!"