#!/bin/bash

sudo python3 - << 'EOF'
from adafruit_servokit import ServoKit
kit = ServoKit(channels=16)
kit.servo[0].set_pulse_width_range(500, 2500)
kit.servo[0].angle = 90
print("Moved servo to middle (90°)")
EOF

