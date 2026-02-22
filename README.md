# Dungeon Floor Timer / 地牢计时器

A [Tampermonkey](https://www.tampermonkey.net/) userscript for [Milky Way Idle](https://www.milkywayidle.com/) that tracks dungeon run times per 5-floor group with **speedrun-style comparison** and **extra boss spawn tracking**.

Supports both **English** and **Chinese** — auto-detects game language and switches dynamically.

[![Install on Greasy Fork](https://img.shields.io/badge/Install-Greasy%20Fork-red?logo=tampermonkey)](https://greasyfork.org/scripts/XXXXX)

---

## Features

### ⏱ Floor Group Timing
Times each 5-floor group (1-5, 6-10, ...). The **final boss wave** is shown as its own row.

### 📊 Speedrun Comparison
After your first complete run, every subsequent run shows a **Diff** column:
- 🟢 **-Xm Xs** (green) — faster than average
- 🔴 **+Xm Xs** (red) — slower than average
- Grey — within 1 second, essentially the same

### 👹 Extra Boss Spawns
Counts boss appearances on **non-fixed waves** (not multiples of 5). These random mini-boss spawns affect your run time.

### 🛡 Smart Data Handling
- **Mid-dungeon join**: If you load the page mid-run (e.g., at wave 43), it waits for the next clean 5-floor boundary before recording. Partial runs are excluded from averages.
- **Complete runs only**: Only runs starting from wave 1 are saved to history.
- **Persistent storage**: Complete run data saved to `localStorage` — survives page refresh.
- **Draggable panel**: Move it anywhere. Collapse/expand with a button.

---

## Screenshots

<!-- TODO: Add screenshots -->
**First run (no history):**

`[screenshot: first_run.png]`

**Mid-dungeon join (waiting for alignment):**

`[screenshot: partial_run.png]`

**Multiple runs with comparison:**

`[screenshot: multi_run.png]`

---

## Reading the Panel

```
⏱ Dungeon Timer                       [Reset] [Hide]
Pirate Cove  Wave 32/65  Elapsed 5m 23s

Floors  Time    Avg     Diff    Extra  Avg
1-5     22s     24s     -2s     0      0.2
6-10    31s     28s     +3s     1      0.5
11-15   29s     30s     -1s     0      0.3
16-20   35s     33s     +2s     0      0.1
21-25   40s     38s     +2s     1      0.4
26-30   42s     ...     ...     0      0.2
...
Total   3m 19s  3m 45s  -26s    2      1.8

History (12 runs)
[16:25] Pirate Cove 21m 52s
[16:04] Pirate Cove 22m 3s
```

| Column | Meaning |
|--------|---------|
| **Floors** | 5-floor group range (final boss wave is separate) |
| **Time** | Time spent on this group in the current run |
| **Avg** | Average time across all completed runs |
| **Diff** | Difference vs average (🟢 faster / 🔴 slower) |
| **Extra** | Boss spawns on non-fixed waves in this group |
| **Avg** (Extra) | Average extra boss spawns per run |

**Row colors:**
- 🟠 Orange — currently active group
- ⚪ White — completed group
- 🔘 Grey — future (not yet reached)

---

## Supported Dungeons

| Dungeon | Floors | Final Boss | Tracked Bosses |
|---------|--------|------------|----------------|
| Chimerical Den / 奇幻洞穴 | 50 | Griffin | Butterjerry, Jackalope, Dodocamel, Manticore |
| Sinister Circus / 阴森马戏团 | 60 | Deranged Jester | Rabid Rabbit, Zombie Bear, Acrobat, Juggler, Magician |
| Enchanted Fortress / 秘法要塞 | 65 | Queen + King | Pawn, Knight, Bishop, Rook |
| Pirate Cove / 海盗基地 | 65 | The Kraken | Anchor Shark, Brine Marksman, Tidal Conjuror |

> **Note:** Squawker (Pirate Cove) and Captain Fishhook (wave 60 fixed) are excluded from extra boss tracking.

---

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/)
2. Install from [Greasy Fork](https://greasyfork.org/scripts/XXXXX) or create a new script and paste [`dungeon-floor-timer.user.js`](dungeon-floor-timer.user.js)
3. Refresh the game page

> ⚠️ The script must run at `document-start` to intercept WebSocket messages.

---

## How It Works

The script wraps the game's WebSocket to intercept:

| Message | Purpose |
|---------|---------|
| `new_battle` | Wave number + monster list (timing & boss detection) |
| `init_character_data` | Detect which dungeon is active |
| `chat_message_received` | Detect dungeon end via party system messages |

No data is sent externally. Everything stays in your browser.

---

## License

MIT
