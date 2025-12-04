Raspberry Pi

| Number | Works | Notes           |
| ------ | ----- | --------------- |
| 1      | yes   | RB Pi 4 Model B |
| 3      | yes   | RB Pi 4 Model B |
| 4      | no    | RB Pi 4 Model B |
| 5      | no    | RB Pi 4 Model B |
| 2      | no    | Raspberry Pi 2  |
| 6      | yes   | Raspberry Pi 5  |
| 01     | no    | Raspberry Pi 0  |
| 02     | no    | Raspberry Pi 0  |
| 03     | no    | Raspberry Pi 0  |
| 04     | no    | Raspberry Pi 0  |

SD cards:

| Number | Works | OS Version           | notes                            |
| ------ | ----- | -------------------- | -------------------------------- |
| 1      | X     | 32 Bit Buster        | no longer works                  |
| 2      | V     | 64 bit               | Main - messed up with lunch defs |
| 3      | X     | 32 Bit normal trixie | Not working anymore              |
| 4      | V     | 32 Bit               | for Pi0                          |
| 5      | ?     | 64 Bit               | works                            |

Raspberry Pi4 works is compatible and better with 64 bit,
Raspberry Pi Zero isn't compatible with 64 bit

# Remote SSH control over a raspberry Pi on the SAME WIFI:
# Look for the raspberry name, the first line in the Pi terminal
# Something like: admin@SD5 and add .local
# than: ssh admin@SD5.local ... are you sure? ~> yes.
# type exit to exit.
