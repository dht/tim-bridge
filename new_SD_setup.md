give SSH key:
1. give access through SSH:
on the rasp:
sudo nano /etc/ssh/sshd_config
edit from no ~> yes
PasswordAuthentication yes
PubkeyAuthentication yes
restart SSH:
sudo systemctl restart ssh

2. on mac copy SSH and access, give password:
ssh-copy-id -i ~/.ssh/id_ed25519.pub admin@10.0.0.9 (or the IP the rasp got)

3. next clone git into project dir:
mkdir projects
cd projects/
git clone https://github.com/dht/tim-bridge.git

4. set perma IP using:
wifi.sh
bash script in this repo, bridge.

5. get all needed dependencies using
install0.sh or install4.sh
