// ==UserScript==
// @name         Dungeon Floor Timer
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Track dungeon floor group times + extra boss spawn counter (speedrun style)
// @license      MIT
// @author       SeaL773
// @match        https://www.milkywayidle.com/*
// @match        https://www.milkywayidlecn.com/*
// @icon         https://www.milkywayidle.com/favicon.svg
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==

(function () {
    "use strict";

    // ── i18n ──
    const isZH = location.hostname.includes("milkywayidlecn") ||
                 (navigator.language || "").startsWith("zh") ||
                 document.documentElement.lang === "zh";

    const L = isZH ? {
        title: "⏱ 地牢计时",
        reset: "重置",
        collapse: "收起",
        expand: "展开",
        wave: "层",
        elapsed: "已用",
        waitAlign: "等待下一组开始计时...",
        waitNext: "等待下一轮...",
        partial: "(不完整轮)",
        colFloor: "层数",
        colTime: "用时",
        colAvg: "均时",
        colDiff: "对比",
        colExtra: "额外",
        colExtraAvg: "均",
        total: "总计",
        history: "历史",
        runs: "轮",
    } : {
        title: "⏱ Dungeon Timer",
        reset: "Reset",
        collapse: "Hide",
        expand: "Show",
        wave: "Wave",
        elapsed: "Elapsed",
        waitAlign: "Waiting for next group...",
        waitNext: "Waiting for next run...",
        partial: "(partial)",
        colFloor: "Floors",
        colTime: "Time",
        colAvg: "Avg",
        colDiff: "Diff",
        colExtra: "Extra",
        colExtraAvg: "Avg",
        total: "Total",
        history: "History",
        runs: "runs",
    };

    // ── Dungeon config ──
    const DUNGEONS = {
        "/actions/combat/chimerical_den":     { zhName: "奇幻洞穴", enName: "Chimerical Den", maxWaves: 50 },
        "/actions/combat/sinister_circus":    { zhName: "阴森马戏团", enName: "Sinister Circus", maxWaves: 60 },
        "/actions/combat/enchanted_fortress": { zhName: "秘法要塞", enName: "Enchanted Fortress", maxWaves: 65 },
        "/actions/combat/pirate_cove":        { zhName: "海盗基地", enName: "Pirate Cove", maxWaves: 65 },
    };

    function dungeonName(hrid) {
        const d = DUNGEONS[hrid];
        if (!d) return hrid;
        return isZH ? d.zhName : d.enName;
    }

    // Boss definitions per dungeon
    // trackable = bosses that can spawn on non-fixed waves (we count these)
    // finalOnly = bosses that ONLY appear on the final wave(s) (excluded)
    const DUNGEON_BOSSES = {
        "/actions/combat/chimerical_den": {
            trackable: {
                "/monsters/butterjerry":  { zh: "蝴蝶杰瑞", en: "Butterjerry" },
                "/monsters/jackalope":    { zh: "鹿角兔",   en: "Jackalope" },
                "/monsters/dodocamel":    { zh: "渡渡骆驼", en: "Dodocamel" },
                "/monsters/manticore":    { zh: "蝎狮",    en: "Manticore" },
            },
            finalOnly: ["/monsters/griffin"],
        },
        "/actions/combat/sinister_circus": {
            trackable: {
                "/monsters/rabid_rabbit": { zh: "疯兔",   en: "Rabid Rabbit" },
                "/monsters/zombie_bear":  { zh: "僵尸熊",  en: "Zombie Bear" },
                "/monsters/acrobat":      { zh: "杂技师",  en: "Acrobat" },
                "/monsters/juggler":      { zh: "杂耍师",  en: "Juggler" },
                "/monsters/magician":     { zh: "魔术师",  en: "Magician" },
            },
            finalOnly: ["/monsters/deranged_jester"],
        },
        "/actions/combat/enchanted_fortress": {
            trackable: {
                "/monsters/enchanted_pawn":   { zh: "秘法兵",  en: "Enchanted Pawn" },
                "/monsters/enchanted_knight": { zh: "秘法骑士", en: "Enchanted Knight" },
                "/monsters/enchanted_bishop": { zh: "秘法主教", en: "Enchanted Bishop" },
                "/monsters/enchanted_rook":   { zh: "秘法城堡", en: "Enchanted Rook" },
            },
            finalOnly: ["/monsters/enchanted_queen", "/monsters/enchanted_king"],
        },
        "/actions/combat/pirate_cove": {
            trackable: {
                // Squawker excluded — too weak
                "/monsters/anchor_shark":    { zh: "持锚鲨",    en: "Anchor Shark" },
                "/monsters/brine_marksman":  { zh: "海盐射手",   en: "Brine Marksman" },
                "/monsters/tidal_conjuror":  { zh: "潮汐召唤师", en: "Tidal Conjuror" },
            },
            finalOnly: ["/monsters/the_kraken"],
            fixedWaveBoss: { 60: "/monsters/captain_fishhook" },
        },
    };

    const GROUP = 5;

    // ── State ──
    let currentDungeon = null;
    let currentWave = -1;
    let waveStartTime = null;
    let dungeonStartTime = null;
    let isDungeonActive = false;
    let waitingForCleanGroup = false;
    let isPartialRun = false;
    let currentRunGroups = {};
    let currentRunBossCounts = {};
    let currentRunBossPerGroup = {};
    let totalBossCounts = {};
    let totalBossPerGroup = {};
    let totalRuns = 0;
    let runHistory = [];
    let panelExpanded = true;

    // ── Helpers ──
    function fmt(ms) {
        if (!ms || ms <= 0) return "0s";
        const s = Math.floor(ms / 1000);
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
    }

    function fmtDiff(ms) {
        const abs = Math.abs(ms);
        const s = Math.floor(abs / 1000);
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
    }

    function groupLabel(wave, maxWaves) {
        if (wave === maxWaves) return `${maxWaves}`;
        const start = Math.floor((wave - 1) / GROUP) * GROUP + 1;
        let end = start + GROUP - 1;
        if (end >= maxWaves) end = maxWaves - 1;
        return `${start}-${end}`;
    }

    function allLabels(maxWaves) {
        const labels = [];
        for (let i = 1; i <= maxWaves; i += GROUP) {
            const end = Math.min(i + GROUP - 1, maxWaves);
            if (end === maxWaves && i < maxWaves) {
                labels.push(`${i}-${maxWaves - 1}`);
                labels.push(`${maxWaves}`);
            } else if (i === maxWaves) {
                labels.push(`${maxWaves}`);
            } else {
                labels.push(`${i}-${end}`);
            }
        }
        return labels;
    }

    function isGroupStart(wave) {
        return (wave - 1) % GROUP === 0;
    }

    function getHistoryAvg() {
        const avg = {};
        if (runHistory.length === 0) return avg;
        for (const run of runHistory) {
            for (const [label, data] of Object.entries(run.groups)) {
                if (!avg[label]) avg[label] = { total: 0, runs: 0 };
                avg[label].total += data.total;
                avg[label].runs++;
            }
        }
        for (const label of Object.keys(avg)) {
            avg[label].avg = avg[label].total / avg[label].runs;
        }
        return avg;
    }

    // ── Boss detection ──
    function detectBosses(msg) {
        if (!currentDungeon || !msg.monsters) return;
        const bossConfig = DUNGEON_BOSSES[currentDungeon];
        if (!bossConfig) return;

        const wave = msg.wave;
        const maxWaves = DUNGEONS[currentDungeon]?.maxWaves || 65;

        if (wave === maxWaves) return;
        if (wave % GROUP === 0) return;

        const label = groupLabel(wave, maxWaves);
        let foundBoss = false;

        for (const monster of msg.monsters) {
            const hrid = monster.hrid;
            if (!hrid) continue;
            if (bossConfig.trackable[hrid]) {
                if (!currentRunBossCounts[hrid]) currentRunBossCounts[hrid] = 0;
                currentRunBossCounts[hrid]++;
                foundBoss = true;
            }
        }

        if (foundBoss) {
            if (!currentRunBossPerGroup[label]) currentRunBossPerGroup[label] = 0;
            currentRunBossPerGroup[label]++;
        }
    }

    // ── Panel ──
    let panelEl = null;

    function ensurePanel() {
        if (panelEl) return;
        if (!document.body) return;

        panelEl = document.createElement("div");
        panelEl.style.cssText = `
            position:fixed; top:50px; right:50px; z-index:9999;
            font-size:0.8rem; padding:8px 10px; border-radius:16px;
            box-shadow:rgba(0,0,0,0.3) 0 4px 12px;
            overflow:auto; max-height:80vh;
            backdrop-filter:blur(8px);
            background:rgba(0,0,0,0.5);
            border:1px solid rgba(255,255,255,0.2);
            color:white; font-family:monospace;
            display:none;
        `;
        panelEl.innerHTML = `
            <div id="dft_hdr" style="display:flex;justify-content:space-between;align-items:center;cursor:move;margin-bottom:4px;">
                <span style="font-weight:bold;font-size:0.95rem;color:#4fc3f7;">${L.title}</span>
                <div>
                    <button id="dft_rst" style="background:#e53935;color:white;border:none;padding:2px 7px;margin-left:5px;border-radius:8px;cursor:pointer;font-size:0.7rem;">${L.reset}</button>
                    <button id="dft_tog" style="background:#4fc3f7;color:white;border:none;padding:2px 7px;margin-left:5px;border-radius:8px;cursor:pointer;font-size:0.7rem;">${L.collapse}</button>
                </div>
            </div>
            <div id="dft_body">
                <div id="dft_status" style="margin-bottom:4px;font-size:0.75rem;"></div>
                <div id="dft_table"></div>
                <div id="dft_hist" style="margin-top:6px;"></div>
            </div>`;
        document.body.appendChild(panelEl);

        panelEl.querySelector("#dft_tog").onclick = () => {
            panelExpanded = !panelExpanded;
            panelEl.querySelector("#dft_body").style.display = panelExpanded ? "" : "none";
            panelEl.querySelector("#dft_tog").textContent = panelExpanded ? L.collapse : L.expand;
        };
        panelEl.querySelector("#dft_rst").onclick = () => {
            runHistory = [];
            currentRunGroups = {};
            currentRunBossCounts = {};
            currentRunBossPerGroup = {};
            totalBossCounts = {};
            totalBossPerGroup = {};
            totalRuns = 0;
            isDungeonActive = false;
            render();
        };

        // drag
        let dx, dy, dragging = false;
        const hdr = panelEl.querySelector("#dft_hdr");
        hdr.onmousedown = e => { dragging = true; dx = e.clientX - panelEl.getBoundingClientRect().left; dy = e.clientY - panelEl.getBoundingClientRect().top; e.preventDefault(); };
        document.addEventListener("mousemove", e => { if (!dragging) return; panelEl.style.left = (e.clientX - dx) + "px"; panelEl.style.top = (e.clientY - dy) + "px"; panelEl.style.right = "auto"; });
        document.addEventListener("mouseup", () => { dragging = false; });
    }

    function shouldShow() {
        return isDungeonActive || Object.keys(currentRunGroups).length > 0 || runHistory.length > 0;
    }

    function render() {
        ensurePanel();
        if (!panelEl) return;

        if (!shouldShow()) { panelEl.style.display = "none"; return; }
        panelEl.style.display = "";

        const maxWaves = currentDungeon && DUNGEONS[currentDungeon] ? DUNGEONS[currentDungeon].maxWaves : 65;
        const dName = currentDungeon ? dungeonName(currentDungeon) : (isZH ? "地牢" : "Dungeon");
        const labels = allLabels(maxWaves);
        const histAvg = getHistoryAvg();
        const hasHistory = runHistory.length > 0;

        // ── Status ──
        const statusEl = panelEl.querySelector("#dft_status");
        if (isDungeonActive && currentDungeon) {
            const elapsed = dungeonStartTime ? Date.now() - dungeonStartTime : 0;
            if (waitingForCleanGroup) {
                statusEl.innerHTML = `<span style="color:#4fc3f7;">${dName}</span>` +
                    ` <span style="color:#81c784;">${L.wave} ${currentWave}/${maxWaves}</span>` +
                    ` <span style="color:#ff9800;">${L.waitAlign}</span>`;
            } else {
                const partialTag = isPartialRun ? ` <span style="color:#888;font-size:0.65rem;">${L.partial}</span>` : "";
                statusEl.innerHTML = `<span style="color:#4fc3f7;">${dName}</span>` +
                    ` <span style="color:#81c784;">${L.wave} ${currentWave}/${maxWaves}</span>` +
                    ` <span style="color:#ffb74d;">${L.elapsed} ${fmt(elapsed)}</span>${partialTag}`;
            }
        } else {
            statusEl.innerHTML = `<span style="color:#aaa;">${L.waitNext}</span>`;
        }

        // ── Timer table ──
        const tableEl = panelEl.querySelector("#dft_table");
        const hasCurrentData = Object.keys(currentRunGroups).length > 0;

        if (hasCurrentData || isDungeonActive) {
            const hasBossConfig = currentDungeon && DUNGEON_BOSSES[currentDungeon];

            let html = `<table style="width:100%;border-collapse:collapse;font-size:0.75rem;">
                <thead><tr style="text-align:left;color:#4fc3f7;border-bottom:1px solid rgba(255,255,255,0.2);">
                    <th style="padding:2px 4px;">${L.colFloor}</th>
                    <th style="padding:2px 4px;">${L.colTime}</th>`;
            if (hasHistory) {
                html += `<th style="padding:2px 4px;">${L.colAvg}</th>`;
                html += `<th style="padding:2px 4px;">${L.colDiff}</th>`;
            }
            if (hasBossConfig) {
                html += `<th style="padding:2px 4px;color:#ff9800;">${L.colExtra}</th>`;
                if (totalRuns > 0) html += `<th style="padding:2px 4px;color:#ff9800;">${L.colExtraAvg}</th>`;
            }
            html += `</tr></thead><tbody>`;

            let totalTime = 0, totalAvgTime = 0;

            for (const label of labels) {
                const g = currentRunGroups[label];
                if (!g && !isDungeonActive) continue;

                const isActive = isDungeonActive && currentWave >= 0 && groupLabel(currentWave, maxWaves) === label;
                const isFuture = !g;

                let groupTime = g ? g.total : 0;
                if (isActive && waveStartTime) groupTime += Date.now() - waveStartTime;

                const rowStyle = isActive ? "color:#ffb74d;" : isFuture ? "color:#555;" : "color:white;";

                html += `<tr style="${rowStyle}">`;
                html += `<td style="padding:2px 4px;">${label}</td>`;
                html += `<td style="padding:2px 4px;">${isFuture ? "-" : fmt(groupTime)}</td>`;

                if (hasHistory) {
                    const ha = histAvg[label];
                    html += `<td style="padding:2px 4px;color:#aaa;">${ha ? fmt(ha.avg) : "-"}</td>`;
                    if (!isFuture && ha && g) {
                        if (!isActive || !waveStartTime) {
                            const diff = groupTime - ha.avg;
                            if (Math.abs(diff) < 1000) html += `<td style="padding:2px 4px;color:#888;">-</td>`;
                            else if (diff > 0) html += `<td style="padding:2px 4px;color:#ef5350;">+${fmtDiff(diff)}</td>`;
                            else html += `<td style="padding:2px 4px;color:#66bb6a;">-${fmtDiff(diff)}</td>`;
                        } else {
                            html += `<td style="padding:2px 4px;color:#888;">...</td>`;
                        }
                    } else {
                        html += `<td style="padding:2px 4px;">-</td>`;
                    }
                }
                if (hasBossConfig) {
                    const bc = currentRunBossPerGroup[label] || 0;
                    const bColor = bc > 0 ? "#ff9800" : "#555";
                    html += `<td style="padding:2px 4px;color:${bColor};">${bc}</td>`;
                    if (totalRuns > 0) {
                        const tb = totalBossPerGroup[label] || 0;
                        html += `<td style="padding:2px 4px;color:#aaa;">${(tb / totalRuns).toFixed(1)}</td>`;
                    }
                }
                html += `</tr>`;
                if (!isFuture) totalTime += groupTime;
                if (hasHistory && histAvg[label]) totalAvgTime += histAvg[label].avg;
            }

            // Total
            html += `<tr style="border-top:1px solid rgba(255,255,255,0.3);color:#4fc3f7;font-weight:bold;">`;
            html += `<td style="padding:2px 4px;">${L.total}</td><td style="padding:2px 4px;">${fmt(totalTime)}</td>`;
            if (hasHistory) {
                html += `<td style="padding:2px 4px;">${fmt(totalAvgTime)}</td>`;
                if (totalTime > 0 && totalAvgTime > 0) {
                    const diff = totalTime - totalAvgTime;
                    if (Math.abs(diff) < 1000) html += `<td style="padding:2px 4px;color:#888;">-</td>`;
                    else if (diff > 0) html += `<td style="padding:2px 4px;color:#ef5350;">+${fmtDiff(diff)}</td>`;
                    else html += `<td style="padding:2px 4px;color:#66bb6a;">-${fmtDiff(diff)}</td>`;
                } else html += `<td style="padding:2px 4px;">-</td>`;
            }
            if (hasBossConfig) {
                const totalBoss = Object.values(currentRunBossPerGroup).reduce((s, c) => s + c, 0);
                html += `<td style="padding:2px 4px;color:#ff9800;">${totalBoss}</td>`;
                if (totalRuns > 0) {
                    const totalHistBoss = Object.values(totalBossPerGroup).reduce((s, c) => s + c, 0);
                    html += `<td style="padding:2px 4px;color:#aaa;">${(totalHistBoss / totalRuns).toFixed(1)}</td>`;
                }
            }
            html += `</tr></tbody></table>`;
            tableEl.innerHTML = html;
        } else {
            tableEl.innerHTML = "";
        }

        // ── History ──
        const histEl = panelEl.querySelector("#dft_hist");
        if (runHistory.length > 0) {
            const recent = runHistory.slice(-5).reverse();
            let h = `<div style="font-size:0.7rem;color:#aaa;border-top:1px solid rgba(255,255,255,0.15);padding-top:4px;">`;
            h += `<span style="color:#4fc3f7;">${L.history} (${runHistory.length} ${L.runs})</span><br>`;
            for (const run of recent) {
                const total = Object.values(run.groups).reduce((s, g) => s + g.total, 0);
                const t = new Date(run.endTime);
                const ts = `${t.getHours().toString().padStart(2, '0')}:${t.getMinutes().toString().padStart(2, '0')}`;
                h += `[${ts}] ${run.dungeonName} <span style="color:white;">${fmt(total)}</span><br>`;
            }
            h += `</div>`;
            histEl.innerHTML = h;
        } else {
            histEl.innerHTML = "";
        }
    }

    // ── Game events ──
    function detectDungeon(characterActions) {
        if (!characterActions) return null;
        for (const a of characterActions) {
            if (a?.actionHrid && DUNGEONS[a.actionHrid]) return a.actionHrid;
        }
        return null;
    }

    function tryDetectDungeon() {
        if (currentDungeon) return;
        try {
            const d = JSON.parse(localStorage.getItem("init_character_data") || "{}");
            const hrid = detectDungeon(d.characterActions);
            if (hrid) currentDungeon = hrid;
            if (!currentDungeon && d.partyInfo?.partyActionMap) {
                for (const a of Object.values(d.partyInfo.partyActionMap)) {
                    if (a?.actionHrid && DUNGEONS[a.actionHrid]) { currentDungeon = a.actionHrid; break; }
                }
            }
        } catch (e) {}
    }

    function onNewBattle(msg) {
        const wave = msg.wave;
        if (wave === undefined || wave === null) return;

        tryDetectDungeon();
        if (!currentDungeon || !DUNGEONS[currentDungeon]) return;

        const maxWaves = DUNGEONS[currentDungeon].maxWaves;
        const now = Date.now();

        if (wave === 1) {
            if (isDungeonActive && Object.keys(currentRunGroups).length > 0) finishRun();
            currentRunGroups = {};
            currentRunBossCounts = {};
            currentRunBossPerGroup = {};
            dungeonStartTime = now;
            currentWave = -1;
            waveStartTime = null;
            isDungeonActive = true;
            waitingForCleanGroup = false;
            isPartialRun = false;
        } else if (!isDungeonActive) {
            isDungeonActive = true;
            dungeonStartTime = null;
            currentRunGroups = {};
            currentRunBossCounts = {};
            currentRunBossPerGroup = {};
            currentWave = -1;
            waveStartTime = null;
            isPartialRun = true;
            waitingForCleanGroup = !isGroupStart(wave);
            if (!waitingForCleanGroup) dungeonStartTime = now;
        }

        detectBosses(msg);

        if (waitingForCleanGroup && isGroupStart(wave)) {
            waitingForCleanGroup = false;
            dungeonStartTime = now;
            currentWave = wave;
            waveStartTime = now;
            render();
            return;
        }

        if (!waitingForCleanGroup && waveStartTime !== null && currentWave >= 0) {
            const elapsed = now - waveStartTime;
            const label = groupLabel(currentWave, maxWaves);
            if (!currentRunGroups[label]) currentRunGroups[label] = { total: 0, count: 0 };
            currentRunGroups[label].total += elapsed;
            currentRunGroups[label].count += 1;
        }

        currentWave = wave;
        waveStartTime = now;
        render();
    }

    function finishRun() {
        if (waveStartTime !== null && currentWave >= 0 && currentDungeon && DUNGEONS[currentDungeon]) {
            const elapsed = Date.now() - waveStartTime;
            const maxWaves = DUNGEONS[currentDungeon].maxWaves;
            const label = groupLabel(currentWave, maxWaves);
            if (!currentRunGroups[label]) currentRunGroups[label] = { total: 0, count: 0 };
            currentRunGroups[label].total += elapsed;
            currentRunGroups[label].count += 1;
        }

        if (Object.keys(currentRunGroups).length > 0 && !isPartialRun) {
            runHistory.push({
                dungeonHrid: currentDungeon,
                dungeonName: dungeonName(currentDungeon),
                maxWaves: DUNGEONS[currentDungeon]?.maxWaves || 65,
                groups: JSON.parse(JSON.stringify(currentRunGroups)),
                endTime: Date.now(),
            });
            if (runHistory.length > 50) runHistory.shift();

            for (const [hrid, count] of Object.entries(currentRunBossCounts)) {
                if (!totalBossCounts[hrid]) totalBossCounts[hrid] = 0;
                totalBossCounts[hrid] += count;
            }
            for (const [label, count] of Object.entries(currentRunBossPerGroup)) {
                if (!totalBossPerGroup[label]) totalBossPerGroup[label] = 0;
                totalBossPerGroup[label] += count;
            }
            totalRuns++;
        }

        currentRunGroups = {};
        currentRunBossCounts = {};
        currentRunBossPerGroup = {};
        isDungeonActive = false;
        waveStartTime = null;
        currentWave = -1;
        render();
    }

    function handle(message) {
        if (message.type === "init_character_data") {
            const d = detectDungeon(message.characterActions);
            if (d) currentDungeon = d;
            if (message.partyInfo?.partyActionMap) {
                for (const a of Object.values(message.partyInfo.partyActionMap)) {
                    if (a?.actionHrid && DUNGEONS[a.actionHrid]) { currentDungeon = a.actionHrid; break; }
                }
            }
            render();
        }

        if (message.type === "new_battle") onNewBattle(message);

        if (message.type === "chat_message_received" &&
            message.message?.chan === "/chat_channel_types/party" &&
            message.message?.isSystemMessage) {
            const m = message.message.m;
            if (m === "systemChatMessage.partyBattleEnded" ||
                m === "systemChatMessage.partyBattleStopped") {
                if (isDungeonActive) finishRun();
            }
            if (m === "systemChatMessage.partyBattleStarted") tryDetectDungeon();
        }
    }

    // ── WebSocket wrap ──
    const OrigWS = unsafeWindow.WebSocket;
    const WrapWS = function (...args) {
        const ws = new OrigWS(...args);
        ws.addEventListener("message", e => {
            try { handle(JSON.parse(e.data)); } catch (_) {}
        });
        return ws;
    };
    WrapWS.CONNECTING = OrigWS.CONNECTING;
    WrapWS.OPEN = OrigWS.OPEN;
    WrapWS.CLOSED = OrigWS.CLOSED;
    unsafeWindow.WebSocket = WrapWS;

    setInterval(() => { if (isDungeonActive && panelEl) render(); }, 2000);
    (function wait() { document.body ? (ensurePanel(), render()) : setTimeout(wait, 500); })();
})();
