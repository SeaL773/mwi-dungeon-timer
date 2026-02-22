# Dungeon Floor Timer / 地牢计时器

A [Tampermonkey](https://www.tampermonkey.net/) userscript for [Milky Way Idle](https://www.milkywayidle.com/) that tracks dungeon run times per 5-floor group with **speedrun-style comparison** and **extra boss spawn tracking**.

Supports both **English** and **Chinese** — auto-detects game language and switches dynamically.

[![Install on Greasy Fork](https://img.shields.io/badge/Install-Greasy%20Fork-red?logo=tampermonkey)](https://greasyfork.org/scripts/XXXXX)

---

## Features

### ⏱ Floor Group Timing
Times each 5-floor group (1-5, 6-10, ...). The **final boss wave** is shown as its own row.

### 📊 Speedrun Comparison (Diff Column)
After your first complete run, every subsequent run shows:
- 🟢 **-Xm Xs** (green) — faster than average
- 🔴 **+Xm Xs** (red) — slower than average
- Grey — within 1 second

### 👹 Extra Boss Spawns
Counts boss appearances on **non-fixed waves** (not multiples of 5). These random mini-boss spawns can slow your run.

### 🛡 Smart Data Handling
- **Mid-dungeon join**: Waits for next clean 5-floor boundary before recording. Partial runs excluded from averages.
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

---

# 中文说明

银河奶牛放置（Milky Way Idle）地牢计时器插件，追踪每5层的通关时间，支持 **Speedrun风格对比** 和 **额外Boss刷新统计**。

自动检测游戏语言，支持**中英文动态切换**。

---

## 功能

### ⏱ 每5层分组计时
自动按5层分组计时（1-5, 6-10, ...），最后一层Boss单独一行显示。

### 📊 Speedrun对比
从第二轮开始，每组时间会和历史平均对比：
- 🟢 绿色 `-Xm Xs` = 比平均快
- 🔴 红色 `+Xm Xs` = 比平均慢
- 灰色 = 差距不到1秒

### 👹 额外Boss统计
统计在非5的倍数层出现的Boss次数（随机小Boss刷新），帮助了解运气对通关时间的影响。

### 🛡 智能数据处理
- **中途进入**：等待下一个完整5层组才开始计时，不完整轮不计入历史
- **仅保存完整轮**：只有从第1波开始的完整轮才存入历史
- **持久化存储**：完整轮数据保存到 localStorage，刷新页面不丢失
- **可拖动面板**：随意拖动位置，支持收起/展开

---

## 截图

<!-- TODO: 添加截图 -->
**首次运行（无对比数据）：**

`[截图占位: first_run.png]`

**中途进入（等待对齐）：**

`[截图占位: partial_run.png]`

**多轮运行（带对比）：**

`[截图占位: multi_run.png]`

---

## 面板说明

```
⏱ 地牢计时器                          [重置] [收起]
海盗基地  层 32/65  已用 5m 23s

层数    用时    均时    对比    额外  均
1-5     22s     24s     -2s     0     0.2
6-10    31s     28s     +3s     1     0.5
11-15   29s     30s     -1s     0     0.3
...
总计    3m 19s  3m 45s  -26s    2     1.8

历史 (12轮)
[16:25] 海盗基地 21m 52s
[16:04] 海盗基地 22m 3s
```

| 列名 | 含义 |
|------|------|
| **层数** | 5层分组（最终Boss单独一行） |
| **用时** | 当前轮该组耗时 |
| **均时** | 所有完整轮的平均耗时 |
| **对比** | 与平均的差值（🟢快了 / 🔴慢了） |
| **额外** | 非固定层Boss出现次数 |
| **均** | 历史平均额外Boss次数 |

**行颜色：** 🟠 橙色 = 当前组 · ⚪ 白色 = 已完成 · 🔘 灰色 = 未到达

---

## 支持的地牢

| 地牢 | 层数 | 最终Boss | 追踪的Boss |
|------|------|----------|-----------|
| 奇幻洞穴 | 50 | 狮鹫 | 蝴蝶杰瑞、鹿角兔、渡渡骆驼、蝎狮 |
| 阴森马戏团 | 60 | 小丑皇 | 疯兔、僵尸熊、杂技师、杂耍师、魔术师 |
| 秘法要塞 | 65 | 秘法王后+国王 | 秘法兵、秘法骑士、秘法主教、秘法城堡 |
| 海盗基地 | 65 | 克拉肯 | 持锚鲨、海盐射手、潮汐召唤师 |

> **注意：** 鹦鹉（太弱）和鱼钩船长（60层固定）不计入额外Boss统计。

---

## 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展
2. 从 [Greasy Fork](https://greasyfork.org/scripts/XXXXX) 安装，或新建脚本粘贴 [`dungeon-floor-timer.user.js`](dungeon-floor-timer.user.js)
3. 刷新游戏页面

> ⚠️ 脚本必须在 `document-start` 运行以拦截 WebSocket 消息。

---

## 工作原理

通过包装游戏的 WebSocket 连接拦截消息：

| 消息类型 | 用途 |
|---------|------|
| `new_battle` | 获取波次号和怪物列表（计时 + Boss检测） |
| `init_character_data` | 检测当前地牢 |
| `chat_message_received` | 检测地牢结束（队伍系统消息） |

所有数据仅保存在浏览器本地，不会发送到外部。
