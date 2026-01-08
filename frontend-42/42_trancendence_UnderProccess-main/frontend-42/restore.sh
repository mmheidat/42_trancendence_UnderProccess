#!/bin/bash

if [ -z "$1" ]; then
    echo "Usage: ./restore.sh <backup_file>"
    echo "Available backups:"
    ls -lh backups/
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Error: Backup file '$BACKUP_FILE' not found."
    exit 1
fi

echo "⚠️  WARNING: This will overwrite the current database."
read -p "Are you sure? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

echo "🛑 Stopping services..."
docker compose stop

echo "♻️  Restoring database..."
cp "$BACKUP_FILE" data/pong.db

echo "🚀 Starting services..."
docker compose start

echo "✅ Restore complete!"
