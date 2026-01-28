# TIM Bridge

**TIM Bridge** is an edge orchestration service that runs on Raspberry Pi devices and connects physical installations to the TIM ecosystem.
It is responsible for executing _timelines_ that control hardware, synchronizing state through Firestore, and reacting autonomously to system status changes.

Each TIM Bridge instance represents a **single machine installation** (physical or virtual) and acts as the runtime that translates high-level timelines into real-world sensory output.

---

## Table of Contents

- [High-Level Overview](#high-level-overview)
- [Machine Instances](#machine-instances)
- [Architecture](#architecture)
- [Orders & Playback](#orders--playback)
- [Timelines & Keyframes](#timelines--keyframes)
- [Hardware & Sensors](#hardware--sensors)
- [Statuses & State Model](#statuses--state-model)
- [Playback Timeline Modes](#playback-timeline-modes)
- [Firestore as Source of Truth](#firestore-as-source-of-truth)
- [Phone Interaction (QR Flow)](#phone-interaction-qr-flow)
- [Stopping a Session](#stopping-a-session)
- [Networking & Connectivity](#networking--connectivity)
- [Autonomy & Design Principles](#autonomy--design-principles)
- [Security Notes](#security-notes)
- [Development & Simulation](#development--simulation)

---

## High-Level Overview

TIM Bridge is an **npm-based Node.js service** running on Raspberry Pi devices.

Its responsibilities include:

- Listening for **orders** via Firestore
- Fetching and executing **timeline JSONs**
- Driving **hardware peripherals** (audio, lighting, printers, pixel boards, servos, etc.)
- Synchronizing machine state to Firestore
- Autonomously managing idle, generating, and playback behavior
- Acting as the execution engine for both **preset** and **generated** sessions

---

## Machine Instances

Each installation is identified by a unique **instance code**, for example:

```
A-001-DEV
```

A machine instance represents:

- One physical installation **or**
- One virtual/simulated installation (digital twin)

Each instance has **exactly one active guest at a time**.

---

## Architecture

The TIM ecosystem consists of four main actors:

1. **TIM Bridge (Edge / Raspberry Pi)**
2. **TIM-OS Server**
3. **Guest Phone (QR-based web experience)**
4. **Developer Dashboard / Simulator (Digital Twin UI)**

All actors communicate indirectly through **Firestore**, which acts as the **single source of truth**.

```
┌──────────┐
│  Phone   │
└────┬─────┘
     │
┌────▼──────────┐
│  Firestore    │  ← Source of Truth
└────┬──────────┘
     │
┌────▼─────┐      ┌────────────┐
│ TIM      │      │ TIM-OS     │
│ Bridge   │      │ Server     │
└──────────┘      └────────────┘
```

---

## Orders & Playback

TIM Bridge listens for **orders** stored in Firestore.

Currently supported orders:

1. **Play Preset**
   - Plays a predefined timeline with pre-existing assets

2. **Play New Session**
   - References a newly generated session
   - Identified by a **GUID (4 characters)**

3. **Stop**
   - Stops the active playback and returns the machine to idle

Orders are processed sequentially and deterministically.

---

## Timelines & Keyframes

Playback is driven by a **`timeline.json`** file.

A timeline consists of an **array of keyframes**, each defining actions to perform at a specific time.

### Keyframes can control:

- Audio playback (voices, MP3s)
- Lighting states
- Printer output
- Pixel board visuals (e.g. mouth shapes, facial expressions)
- Servo positions
- Phone transcript updates

Each keyframe is interpreted by the bridge and translated into hardware-specific commands.

---

## Hardware & Sensors

Each machine supports a different subset of peripherals.

Possible components include:

- 🔊 Speaker (voices, MP3s)
- 💡 Lighting installations (e.g. dual house lights)
- 🖨️ Label printers
- 🟥 RGB pixel boards (e.g. 64×64)
- 🤖 Servo motors (robotic arms, kinetic elements)
- 🚦 RGB status light (present on all machines)

The bridge abstracts these differences and executes timelines accordingly.

---

## Statuses & State Model

### Bridge Status

Represents the internal state of the edge device:

- `offline`
- `idle`
- `caching`
- `playback`
- `resetting`

---

### Server Status

Represents the TIM-OS server state:

- `offline`
- `idle`
- `generating`

---

### Phone (Guest UI) Status

Represents the current screen of the active guest:

- `none`
- `intro`
- `backstory`
- `params`
- `generating`
- `playback`
- `feedback`

Only one guest can be active per machine at any given time.

---

## Playback Timeline Modes

Each machine has a **playback timeline status**, independent of bridge status.

This determines _which_ timeline is currently running.

### Timeline Modes

1. **`none`**
   - No timeline is active

2. **`idle`**
   - Attract mode between sessions
   - Lights, ambient sounds, movement, etc.

3. **`generating`**
   - Tangible progress indicator during session generation
   - Example: a 45–60 second animated sequence

4. **`main`**
   - The actual session timeline
   - Preset or newly generated

---

### Autonomous Switching

Timeline switching is **handled internally by the bridge**.

Example:

- If the server status changes to `generating`
- The bridge automatically:
  - Stops the idle timeline
  - Starts the generating timeline

No explicit order is required.

---

## Firestore as Source of Truth

Firestore holds a **machine document per instance**.

This document is the **authoritative state** of the machine.

### Who can read/write?

Currently:

- TIM Bridge
- TIM-OS Server
- Guest Phone
- Developer Dashboard

All can update machine fields freely.

> Authentication and permissions may be added in the future.

---

## Phone Interaction (QR Flow)

1. Guest scans QR code
2. Phone UI loads machine context
3. Guest chooses:
   - A preset session **or**
   - A new topic for debate

4. For new sessions:
   - TIM-OS generates assets and a timeline
   - Timeline is hosted (e.g. Firebase Hosting)
   - Bridge receives a `play new session` order

5. Playback begins

Phone transcript updates are driven by timeline keyframes.

---

## Stopping a Session

A playback can be stopped from:

1. **Guest Phone**
   - Stop button visible during playback

2. **Developer Dashboard**
   - Machine card includes a stop action

Both mechanisms send a **stop order** via Firestore.

Result:

- Active timeline stops
- Machine returns to `idle`

---

## Networking & Connectivity

- TIM Bridge runs on Raspberry Pi
- On boot:
  - Connects to Wi-Fi
  - Transitions to `idle`
  - Publishes its **local IP address** to Firestore

The server IP and online status are also tracked.

---

## Autonomy & Design Principles

Key principles of TIM Bridge:

- **Edge autonomy**
  - Minimal external orchestration

- **Declarative control**
  - Behavior defined via timelines, not imperative commands

- **Single source of truth**
  - Firestore reflects reality

- **Hardware abstraction**
  - Same timeline model across diverse machines

- **Digital twin compatibility**
  - Physical and virtual machines behave identically

---

## Security Notes

- No authentication or authorization is currently enforced
- This is intentional for early-stage development
- Future iterations may include:
  - Device authentication
  - Role-based access control
  - Write restrictions per actor

---

## Development & Simulation

The ecosystem includes a **simulator / digital twin UI**:

- Mirrors real machine state from Firestore
- Visualizes lights, playback, and statuses
- Enables:
  - Development without physical hardware
  - Interaction design
  - Debugging production machines remotely

---

## Summary

TIM Bridge is the **execution backbone** of The Incredible Machine:

- It turns timelines into tangible experiences
- It bridges cloud intelligence with physical reality
- It enables both production installations and virtual experimentation
