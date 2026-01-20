sudo nmcli connection modify preconfigured \
  ipv4.method manual \
  ipv4.addresses 10.0.0.55/24 \
  ipv4.gateway 10.0.0.1 \
  ipv4.dns "10.0.0.1 8.8.8.8"

sudo nmcli connection down preconfigured
sudo nmcli connection up preconfigured
