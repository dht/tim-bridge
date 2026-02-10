ssh admin@10.0.0.50 '
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

cd ~/projects/tim-bridge &&
pm2 start npm --name houses -- start
'
