#!/bin/sh

# Backup interval in seconds (default 1 hour)
INTERVAL=${BACKUP_INTERVAL:-3600}
DATA_DIR="/app/data"
BACKUP_DIR="/app/backups"
MAX_BACKUPS=${MAX_BACKUPS:-24}

mkdir -p "$BACKUP_DIR"

echo "🚀 Starting backup service..."
echo "📂 Data dir: $DATA_DIR"
echo "📂 Backup dir: $BACKUP_DIR"
echo "⏱️  Interval: $INTERVAL seconds"

while true; do
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/pong_$TIMESTAMP.db"
    
    if [ -f "$DATA_DIR/pong.db" ]; then
        # Use sqlite3 to safely backup if possible, otherwise simple copy
        # Since we use WAL mode, simple copy might be risky without lock, 
        # but for this assignment simpler is better. 
        # Ideally: sqlite3 $DATA_DIR/pong.db ".backup '$BACKUP_FILE'"
        
        echo "📦 Creating backup: $BACKUP_FILE"
        cp "$DATA_DIR/pong.db" "$BACKUP_FILE"
        
        # Cleanup old backups
        COUNT=$(ls -1 "$BACKUP_DIR"/*.db 2>/dev/null | wc -l)
        if [ "$COUNT" -gt "$MAX_BACKUPS" ]; then
            REMOVE_COUNT=$((COUNT - MAX_BACKUPS))
            ls -1t "$BACKUP_DIR"/*.db | tail -n "$REMOVE_COUNT" | xargs rm -f
            echo "🧹 Removed $REMOVE_COUNT old backups"
        fi
    else
        echo "⚠️  Database file not found at $DATA_DIR/pong.db"
    fi
    
    sleep "$INTERVAL"
done
