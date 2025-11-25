# Create a systemd service:

sudo nano /etc/systemd/system/tim-bridge.service

# Paste this

[Unit]
Description=Tim Bridge Main Service
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/usr/bin/node /home/admin/projects/tim-bridge/src/index.js
WorkingDirectory=/home/admin/projects/tim-bridge
Restart=always
RestartSec=3
User=admin
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target

# Enable & start:

sudo systemctl daemon-reload
sudo systemctl enable tim-bridge.service
sudo systemctl start tim-bridge.service
