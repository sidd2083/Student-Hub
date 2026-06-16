# SOS Matchmaking Algorithm — Simple Explanation

This document explains how the **Get Help (SOS)** system finds a helper for a student who is stuck.
Everything happens on the server in memory — no database is used.

---

## The Basic Idea

When a student clicks **"Get Help"**, the server tries to find the best available helper from their grade.
It does this in **5 rounds**, each one broader than the last.
If nobody is found after all 5 rounds, the student waits in a queue for up to 5 minutes.

---

## Round-by-Round Breakdown

### Round 1 — Best Students, Same Grade
- Only looks at students **in the same grade**
- Only picks students who are **high performers**:
  - Studied at least 10 minutes today, OR
  - Have a streak of 3+ days
- Sorts them by a score: study time (40%) + streak (30%) + subject knowledge (30%)
- Picks the **top 3** scorers and shows them the popup
- If nobody qualifies as a high performer → skip to Round 2 immediately

### Round 2 — Any Available, Same Grade
- Still only same grade
- No performance requirement — anyone who is free and has notifications on
- Picks 3 randomly
- Skips anyone who is busy or on cooldown

### Round 3 — Last Resort, Same Grade
- Still only same grade
- Now ignores cooldowns and notification preferences
- Only skips people who are actively in another SOS session or currently seeing a different popup
- Picks 3 randomly
- This is the "wake up everyone" round

### Round 4 — Available, Adjacent Grades
- Same grade pool is exhausted — now tries **neighbouring grades**
- Uses curriculum-based neighbours:
  - Grade 9 → tries Grade 10
  - Grade 10 → tries Grade 9 and 11
  - Grade 11 → tries Grade 10 and 12
  - Grade 12 → tries Grade 11 and CEE/13
  - CEE → tries Grade 12 and IOE/14
  - IOE → tries Grade 12, 13, and 14
  - Grade 15 / Bachelor → tries Grade 14 and IOE
- Respects notification preferences and cooldowns (same as Round 2)
- Picks 3 randomly

### Round 5 — Broadest Possible, Adjacent Grades
- Same adjacent grade pool as Round 4
- Now ignores cooldowns and notification preferences (same as Round 3)
- Picks 3 randomly
- Last attempt before the waiting queue

---

## Each Round Has a 25-Second Timer

When helpers are shown the popup, they have **25 seconds** to accept.

If nobody accepts in 25 seconds:
- Those helpers get a **short cooldown** (60 seconds) — they were probably just distracted
- The system moves to the next round automatically
- (If a helper clicked **Pass**, they get a longer cooldown: 3 minutes — that was deliberate)

---

## Waiting Queue (After All 5 Rounds Fail)

If all 5 rounds yield no acceptances, the student enters a **waiting queue** for up to **5 minutes**.

While waiting, the student sees a message: *"You'll get a popup the moment someone comes online!"*

The queue is checked automatically in 3 situations:
1. A new student opens the Get Help page (they just came online)
2. An existing student reconnects
3. A helper finishes a session and is free again

When the queue is checked, **all** waiting students are served — not just the first one.
A Grade 12 student coming online can help a waiting Grade 11 student too (not just Grade 12).

---

## Strict Rules (Never Broken)

| Rule | What it means |
|---|---|
| **Never notify twice** | Once a user has seen a popup for a request, they will never see that same request again |
| **Opt-out is respected** | If a user turned off notifications → Rounds 1, 2, 4 skip them. Only Rounds 3 and 5 override this as a last resort |
| **Never notify yourself** | The person asking for help is always excluded |
| **Busy = skip** | Anyone already in a session or currently seeing another popup is never targeted |

---

## Online Count Shown to the Student

When a student opens the Get Help page, they see one of these:

- 🟢 **"3 in your grade available"** — good chance of getting help quickly
- 🟡 **"2 in your grade (all busy)"** — people are online but in other sessions; try shortly
- **"5 online (other grades)"** — nobody in your grade yet, but adjacent grades may still help
- **"No helpers online now"** — very quiet right now; request anyway, you'll be queued

---

## Summary Flow Chart

```
Student clicks Get Help
        │
        ▼
Round 1 — Same grade, top performers (25s timer)
        │ nobody accepted
        ▼
Round 2 — Same grade, any available (25s timer)
        │ nobody accepted
        ▼
Round 3 — Same grade, broadest (25s timer)
        │ nobody accepted
        ▼
Round 4 — Adjacent grades, available (25s timer)
        │ nobody accepted
        ▼
Round 5 — Adjacent grades, broadest (25s timer)
        │ nobody accepted
        ▼
Waiting Queue (5 minutes)
        │
        ├── Someone comes online? → restart from Round 1
        ├── Helper finishes session? → restart from Round 1
        └── 5 min expires? → "No helpers found, please try again"
```

---

## Key Numbers

| Setting | Value |
|---|---|
| Popup timeout per round | 25 seconds |
| Ignored popup cooldown | 60 seconds |
| Explicit reject (Pass) cooldown | 3 minutes |
| Helper grace period after helping | 7 minutes (won't get another popup) |
| Waiting queue max wait time | 5 minutes |
| Max helpers shown per round | 3 |
| Total rounds before queue | 5 |

---

## Files

| File | What it does |
|---|---|
| `artifacts/api-server/src/lib/sos.ts` | Complete backend engine — all matchmaking logic lives here |
| `artifacts/student-hub/src/context/SosContext.tsx` | Frontend socket connection and state management |
| `artifacts/student-hub/src/pages/SosNetwork.tsx` | The Get Help page the student sees |
| `artifacts/student-hub/src/components/sos/` | Popup, chat, canvas, and workspace components |
