# MWI Dungeon Floor Timer

A Tampermonkey userscript for [Milky Way Idle](https://www.milkywayidle.com/) that tracks dungeon run times per floor group with speedrun-style comparison and extra boss spawn tracking.

Works on both **English** (milkywayidle.com) and **Chinese** (milkywayidlecn.com) versions — UI language auto-detects.

## Features

### ⏱ Floor Group Timing
Times each 5-floor group within a dungeon run (e.g., 1-5, 6-10, ..., 61-64). The **final boss wave** is always shown as its own row.

| Dungeon | Floors | Boss Wave |
|---------|--------|-----------|
| Chimerical Den | 1-49 (groups of 5) | 50 (Griffin) |
| Sinister Circus | 1-59 (groups of 5) | 60 (Deranged Jester) |
| Enchanted Fortress | 1-64 (groups of 5) | 65 (Queen + King) |
| Pirate Cove | 1-64 (groups of 5) | 65 (The Kraken) |

### 📊 Speedrun Comparison
After your first complete run, every subsequent run shows a **Diff** column:
- 🟢 **-Xm Xs** (green) — faster than your average
- 🔴 **+Xm Xs** (red) — slower than your average
- **-** (grey) — within 1 second, essentially the same

### 👹 Extra Boss Spawns
Tracks boss spawns on **non-fixed waves** (waves that aren't multiples of 5). These are random mini-boss appearances that can slow you down.

The **Extra** column shows per-group counts for the current run, and **Avg** shows the historical average across all complete runs.

**Tracked bosses per dungeon:**

| Dungeon | Tracked | Excluded |
|---------|---------|----------|
| Chimerical Den | Butterjerry, Jackalope, Dodocamel, Manticore | Griffin (wave 50 only) |
| Sinister Circus | Rabid Rabbit, Zombie Bear, Acrobat, Juggler, Magician | Deranged Jester (wave 60 only) |
| Enchanted Fortress | Enchanted Pawn, Knight, Bishop, Rook | Queen + King (wave 65 only) |
| Pirate Cove | Anchor Shark, Brine Marksman, Tidal Conjuror | Kraken (65), Captain Fishhook (60), Squawker (too weak) |

### 🛡 Smart Data Handling
- **Mid-dungeon join**: If you load the page mid-run (e.g., at wave 43), it waits for the next clean 5-floor boundary (wave 46) before recording. Partial runs are marked and excluded from history/averages.
- **Complete runs only**: Only runs starting from wave 1 are saved to history and used for averages.
- **History**: Keeps the last 50 complete runs. Recent 5 shown in the panel footer.

## Reading the Panel

```
⏱ Dungeon Timer                    [Reset] [Hide]
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
| **Diff** | Difference vs average (green = faster, red = slower) |
| **Extra** | Number of boss spawns on non-fixed waves in this group |
| **Avg** (Extra) | Average extra boss spawns per run for this group |

**Row colors:**
- 🟠 Orange — currently active group
- ⚪ White — completed group
- 🔘 Grey — future (not yet reached)

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) browser extension
2. Create a new userscript
3. Paste the contents of [`dungeon-floor-timer.user.js`](dungeon-floor-timer.user.js)
4. Save and refresh the game page

> ⚠️ The script must run at `document-start` to intercept WebSocket messages. Make sure `@run-at document-start` is in the header.

## How It Works

The script wraps the game's WebSocket connection to intercept messages:

- **`new_battle`** — Contains `wave` number and `monsters` array. Used to track floor progression and detect boss spawns.
- **`init_character_data`** — Detects which dungeon you're running.
- **`chat_message_received`** — Detects dungeon end via party system messages.

No data is sent externally. Everything stays in your browser's memory (resets on page refresh).

## License

MIT
