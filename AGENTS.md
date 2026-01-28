# AGENTS.md

**TIM Ecosystem – Agent Guidelines**

This document defines how **agents (human or AI)** should reason about, modify, and extend the TIM ecosystem codebases, including but not limited to:

- TIM Bridge (edge / Raspberry Pi)
- TIM-OS Server
- Phone experience
- Simulator / Digital Twin
- Shared types and schemas

It is intended for use by **Codex-style AI agents** and developers alike.

---

## 1. Mental Model (Required)

Before making any change, agents **must internalize** the following principles:

### 1.1 Firestore Is the Source of Truth

- Firestore machine documents represent **reality**
- UI, bridge, phone, and server **do not own state**
- All actors:
  - Read from Firestore
  - Write to Firestore

- Local state exists only as a **cache or execution detail**

> If Firestore disagrees with local memory, Firestore wins.

---

### 1.2 TIM Bridge Is Autonomous

The bridge:

- Reacts to **state**, not commands
- Owns **timeline transitions**
- Does _not_ require explicit orders for:
  - Idle → generating
  - Generating → playback
  - Playback → idle (on stop or completion)

Agents **must not** introduce orchestration logic outside the bridge that breaks this autonomy.

---

### 1.3 Timelines Are Declarative

- Timelines describe **what should happen**, not how
- Keyframes must be:
  - Deterministic
  - Idempotent where possible

- Hardware-specific logic belongs in **drivers**, not timelines

Do **not** embed device-specific assumptions into shared timeline schemas.

---

## 2. Agent Responsibilities

### 2.1 What Agents MAY Do

Agents are encouraged to:

- Refactor for clarity and correctness
- Improve type safety
- Add missing invariants
- Improve observability and logging
- Add simulation support
- Reduce coupling between components
- Make implicit assumptions explicit (docs or types)

---

### 2.2 What Agents MUST NOT Do

Agents must **not**:

- Add hidden state that is not reflected in Firestore
- Introduce tight coupling between:
  - Bridge ↔ Server
  - Bridge ↔ Phone

- Move business logic into the UI
- Hardcode machine-specific behavior outside configuration
- Break digital twin compatibility
- Add authentication assumptions unless explicitly requested

---

## 3. Statuses Are Contracts

Statuses are **contracts**, not UI hints.

### 3.1 Bridge Status

Bridge status reflects **execution capability**, not intent.

Agents must ensure:

- Transitions are valid
- No impossible states are introduced
- Status changes are observable and logged

---

### 3.2 Playback Timeline Status

Playback timeline status defines **what experience is running**.

Valid modes:

- `none`
- `idle`
- `generating`
- `main`

Agents must not:

- Add new modes casually
- Overload meanings
- Mix playback status with bridge lifecycle status

---

### 3.3 Phone Screen Status

Phone status reflects **guest journey**, not machine state.

Agents must not:

- Drive machine behavior directly from phone screen state
- Assume phone state is always present or correct

---

## 4. Orders Are Intent, Not Control

Orders represent **intent**:

- Play preset
- Play new session
- Stop

Agents must ensure:

- Orders are safe to retry
- Orders are processed exactly once _in effect_
- Stop orders always win over play orders

Do not add orders that micro-manage playback.

---

## 5. Digital Twin Compatibility (Non-Negotiable)

Every change must satisfy:

> _Could this run identically on a simulated machine?_

If the answer is “no”, the design is wrong.

Agents should:

- Prefer abstractions
- Avoid GPIO-only logic leaking into core execution
- Keep simulation parity with physical machines

---

## 6. Type System First

Types are the **shared language** of the ecosystem.

Agents must:

- Prefer expressive types over comments
- Encode invariants in types where possible
- Avoid `any`, weak maps, or untyped blobs
- Treat timeline schemas as **public APIs**

Breaking type compatibility requires explicit justification.

---

## 7. Failure Is a First-Class Case

Agents must assume:

- Network failures
- Partial writes
- Reboots mid-playback
- Duplicate events
- Out-of-order updates

Code must be:

- Restart-safe
- Eventually consistent
- Able to recover from Firestore alone

---

## 8. Security Posture (Current)

Current system assumptions:

- No authentication
- Full read/write access per actor

Agents:

- Must not add security layers implicitly
- May prepare code for future auth (interfaces, boundaries)
- Must document any security-relevant assumptions

---

## 9. Logging & Observability

Agents should:

- Log **state transitions**, not noise
- Include instance code in logs
- Make timeline execution traceable
- Avoid logging sensitive content (future-proofing)

---

## 10. Documentation Is Part of the Change

Any agent that:

- Adds a status
- Adds an order
- Changes timeline behavior
- Introduces a new lifecycle

**Must update documentation** accordingly.

Undocumented behavior is considered incomplete.

---

## 11. Guiding Question (Final Check)

Before submitting a change, agents should ask:

> “Does this make the machine more predictable, more autonomous, and easier to simulate?”

If not, reconsider the approach.
