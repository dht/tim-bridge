ssh admin@10.0.0.51 "cd ~/projects/tim-bridge && pm2 stop houses || true && pm2 delete houses || true && pm2 start npm --name houses -- start"
