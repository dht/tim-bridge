#!/usr/bin/env bash

echo "=============================="
echo "Raspberry Pi SD Diagnostics"
echo "=============================="
echo

echo "---- System ----"
uname -a
echo

echo "---- Pi Model ----"
cat /proc/device-tree/model 2>/dev/null || echo "Not a Raspberry Pi?"
echo

echo "---- Bootloader (Pi 4/5) ----"
vcgencmd bootloader_version 2>/dev/null || echo "vcgencmd not available"
echo

echo "---- Kernel cmdline ----"
cat /boot/cmdline.txt 2>/dev/null || cat /boot/firmware/cmdline.txt 2>/dev/null
echo
echo

echo "---- /etc/fstab ----"
cat /etc/fstab
echo

echo "---- Root device ----"
findmnt -n -o SOURCE /
echo

ROOTDEV=$(findmnt -n -o SOURCE /)
DISK=$(lsblk -no pkname "$ROOTDEV" 2>/dev/null)

echo "---- Block devices ----"
lsblk -o NAME,SIZE,FSTYPE,UUID,PARTUUID,MOUNTPOINT
echo

echo "---- blkid ----"
blkid
echo

echo "---- Partition table ----"
sudo fdisk -l /dev/$DISK 2>/dev/null
echo

echo "---- SD Card CID ----"
cat /sys/block/mmcblk0/device/cid 2>/dev/null || echo "Not mmcblk0"
echo

echo "---- SD speed mode ----"
cat /sys/kernel/debug/mmc0/ios 2>/dev/null || echo "debugfs not mounted or unavailable"
echo

echo "---- ext4 filesystem state ----"
sudo tune2fs -l "$ROOTDEV" 2>/dev/null | grep -E "Filesystem state|Errors behavior|Filesystem features"
echo

echo "---- Mount status ----"
mount | grep "$ROOTDEV"
echo

echo "---- Machine ID ----"
cat /etc/machine-id
echo

echo "---- MAC addresses ----"
ip link | grep ether
echo

echo "---- dmesg SD / mmc errors ----"
dmesg | grep -i -E "mmc|error|timeout|fail" | tail -n 50
echo

echo "---- Disk usage ----"
df -h
echo

echo "=============================="
echo "End of Report"
echo "=============================="
