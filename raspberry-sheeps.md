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

| Number | Works | OS Version    | notes                            |
| ------ | ----- | ------------- | -------------------------------- |
| 1      | X     | 32 Bit Buster | no longer works                  |
| 2      | V     | 64 bit        | Main - messed up with lunch defs |
| 3      | X     | 64 Bit        | 2SD copied                       |
| 4      | V     | 32 Bit        | for Pi0                          |
| 5      | V     | 64 Bit        | 2SD copied                       |
| 6      | ?     | 64 Bit        | 2SD copied                       |

IP to SD

| SD  | IP        | Installation | Hostname |
| --- | --------- | ------------ | -------- |
| 2   | 10.0.0.50 | Claygon      | SD2Pi4   |
| 5   | 10.0.0.51 | Houses       | SD4pi4   |
| 6   | 10.0.0.52 | Robotic Arm  | SD6Pi5   |
| 3   | 10.0.0.53 | Test         | TESTSD3  |

Raspberry Pi4 works is compatible and better with 64 bit,
Raspberry Pi Zero isn't compatible with 64 bit

# Remote SSH control over a raspberry Pi on the SAME WIFI:

# Look for the raspberry name, the first line in the Pi terminal

# Something like: admin@SD5 and add .local

# than: ssh admin@SD5.local ... are you sure? ~> yes.

# type exit to exit.
