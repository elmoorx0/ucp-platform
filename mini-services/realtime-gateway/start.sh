#!/bin/bash
# Start gateway and keep it alive
cd /home/z/my-project/mini-services/realtime-gateway

while true; do
  echo "[$(date)] Starting gateway..."
  bun index.ts >> process.log 2>&1
  EXIT_CODE=$?
  echo "[$(date)] Gateway exited with code $EXIT_CODE, restarting in 2s..."
  sleep 2
done
