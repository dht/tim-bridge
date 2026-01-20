sudo nmcli connection modify "NETGEAR67" ipv4.addresses 10.0.0.55/24
sudo nmcli connection modify "NETGEAR67" ipv4.gateway 10.0.0.1
sudo nmcli connection modify "NETGEAR67" ipv4.dns "10.0.0.1 8.8.8.8"
sudo nmcli connection modify "NETGEAR67" ipv4.method manual

sudo nmcli connection down "NETGEAR67"
sudo nmcli connection up "NETGEAR67"
