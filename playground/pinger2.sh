#!/bin/bash

BASE_IP="10.0.0"

echo "Scanning 10.0.0.5 to 10.0.0.60 (Quiet Mode)..."

for i in {5..60}
do
    (
        IP="$BASE_IP.$i"
        if ping -c 1 -t 1 "$IP" > /dev/null 2>&1; then
            echo "Host $IP is UP"
        fi
    ) &
done

wait
