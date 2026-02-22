# Dungeon Floor Timer / 地牢计时器

A floating panel that tracks dungeon run times per 5-floor group with **speedrun-style comparison** and **extra boss spawn tracking** for [Milky Way Idle](https://www.milkywayidle.com/).

Supports both **English** and **Chinese** — auto-detects game language and switches dynamically.

---

## Features

### ⏱ Floor Group Timing
Times each 5-floor group (1-5, 6-10, ...). The **final boss wave** is shown as its own row.

### 📊 Speedrun Comparison (Diff Column)
After your first complete run, every subsequent run shows:
- 🟢 **-Xm Xs** (green) = faster than average
- 🔴 **+Xm Xs** (red) = slower than average
- Grey = within 1 second

### 👹 Extra Boss Spawns
Counts boss appearances on **non-fixed waves** (not multiples of 5). These random mini-boss spawns can slow your run.

### 🛡 Smart Data
- **Mid-dungeon join**: Waits for next clean 5-floor boundary before recording. Partial runs excluded from averages.
- **Persistent history**: Complete runs saved to localStorage — survives page refresh.
- **Draggable panel**: Move it anywhere, collapse/expand.

---

## Supported Dungeons

| Dungeon | Floors | Final Boss |
|---------|--------|------------|
| Chimerical Den / 奇幻洞穴 | 50 | Griffin / 狮鹫 |
| Sinister Circus / 阴森马戏团 | 60 | Deranged Jester / 小丑皇 |
| Enchanted Fortress / 秘法要塞 | 65 | Queen + King / 秘法王后+国王 |
| Pirate Cove / 海盗基地 | 65 | The Kraken / 克拉肯 |

---

## How to Read the Panel

<!-- SCREENSHOT: First run (no history) -->
**First run — no comparison data yet:**

`[Screenshot placeholder: first_run.png]`

<!-- SCREENSHOT: Partial/incomplete run -->
**Mid-dungeon join — waiting for clean group:**

`[Screenshot placeholder: partial_run.png]`

<!-- SCREENSHOT: Complete run with comparison -->
**After multiple runs — with Diff comparison:**

`[Screenshot placeholder: multi_run.png]`

| Column | Meaning |
|--------|---------|
| **Floors** | 5-floor group (final boss wave separate) |
| **Time** | Current run time for this group |
| **Avg** | Average across all complete runs |
| **Diff** | Difference vs average |
| **Extra** | Boss spawns on non-fixed waves |
| **Avg** (Extra) | Historical average extra spawns |

**Row colors:** 🟠 Orange = active group · ⚪ White = completed · 🔘 Grey = future

---

## Source Code

[GitHub Repository](https://github.com/SeaL773/mwi-dungeon-timer)

---

# 中文说明

浮动面板插件，追踪银河奶牛放置地牢每5层的通关时间，支持 **Speedrun风格对比** 和 **额外Boss刷新统计**。

## 功能

### ⏱ 每5层分组计时
自动按5层分组计时（1-5, 6-10, ...），最后一层Boss单独一行显示。

### 📊 Speedrun对比
从第二轮开始，每组时间会和历史平均对比：
- 🟢 绿色 `-Xm Xs` = 比平均快
- 🔴 红色 `+Xm Xs` = 比平均慢
- 灰色 = 差距不到1秒

### 👹 额外Boss统计
统计在非5的倍数层出现的Boss次数（随机小Boss刷新）。

### 🛡 智能数据处理
- **中途进入**：等待下一个完整5层组才开始计时，不完整轮不计入历史
- **持久化存储**：完整轮数据保存到 localStorage，刷新页面不丢失
- **可拖动面板**：随意拖动位置，支持收起/展开

---

## 面板截图

<!-- 截图：第一次运行 -->
**首次运行（无对比数据）：**

`[截图占位: first_run.png]`

<!-- 截图：不完整轮 -->
**中途进入（等待对齐）：**

`[截图占位: partial_run.png]`

<!-- 截图：多轮对比 -->
**多轮运行（带对比）：**

`[截图占位: multi_run.png]`

| 列名 | 含义 |
|------|------|
| **层数** | 5层分组（最终Boss单独一行） |
| **用时** | 当前轮该组耗时 |
| **均时** | 所有完整轮的平均耗时 |
| **对比** | 与平均的差值 |
| **额外** | 非固定层Boss出现次数 |
| **均** | 历史平均额外Boss次数 |

**行颜色：** 🟠 橙色 = 当前组 · ⚪ 白色 = 已完成 · 🔘 灰色 = 未到达
