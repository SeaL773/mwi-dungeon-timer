// ==UserScript==
// @name         Dungeon Floor Timer
// @name:zh-CN   地牢计时器
// @name:zh-TW   地牢計時器
// @namespace    http://tampermonkey.net/
// @version      1.16
// @description  Track dungeon floor group times with speedrun-style comparison & extra boss spawn counter for Milky Way Idle
// @description:zh-CN  银河奶牛放置 - 地牢每5层分组计时，支持多轮均时对比（Speedrun风格）+ 额外Boss刷新统计
// @description:zh-TW  銀河奶牛放置 - 地牢每5層分組計時，支持多輪均時對比（Speedrun風格）+ 額外Boss刷新統計
// @license      MIT
// @author       SeaL773
// @match        https://www.milkywayidle.com/*
// @match        https://www.milkywayidlecn.com/*
// @icon         https://www.milkywayidle.com/favicon.svg
// @grant        unsafeWindow
// @run-at       document-start
// @supportURL   https://github.com/SeaL773/mwi-dungeon-timer/issues
// @homepageURL  https://github.com/SeaL773/mwi-dungeon-timer
// @compatible   chrome
// @compatible   firefox
// @compatible   edge
// ==/UserScript==

(function () {
    "use strict";

    // ── i18n ──
    const LANG_CACHE_KEY = "dft_lang";

    function detectZH() {
        // 1. CN domain is always Chinese
        if (location.hostname.includes("milkywayidlecn")) return true;
        // 2. Check game's language dropdown (most reliable when settings page is open)
        const allInputs = document.querySelectorAll('input.MuiSelect-nativeInput');
        for (const inp of allInputs) {
            if (inp.value === "zh") { localStorage.setItem(LANG_CACHE_KEY, "zh"); return true; }
            if (inp.value === "en") { localStorage.setItem(LANG_CACHE_KEY, "en"); return false; }
        }
        // 3. Check page title (updates in real-time when language changes)
        const title = document.title || "";
        if (title.includes("银河") || title.includes("奶牛") || title.includes("战斗") || title.includes("技能")) {
            localStorage.setItem(LANG_CACHE_KEY, "zh");
            return true;
        }
        if (title.includes("Milky Way") || title.includes("Combat") || title.includes("Skills")) {
            localStorage.setItem(LANG_CACHE_KEY, "en");
            return false;
        }
        // 4. Fallback: cached detection
        const cached = localStorage.getItem(LANG_CACHE_KEY);
        if (cached === "zh") return true;
        if (cached === "en") return false;
        return false;
    }

    let isZH = false;
    // Re-detect language periodically (handles language switch without page reload)
    function updateLang() {
        const newZH = detectZH();
        if (newZH !== isZH) {
            isZH = newZH;
            L = isZH ? zhStrings : enStrings;
            // Rebuild panel header with new language
            if (panelEl) {
                panelEl.querySelector("#dft_hdr span").textContent = L.title;
                panelEl.querySelector("#dft_rst").textContent = L.reset;
                panelEl.querySelector("#dft_rst").title = L.resetTitle;
                panelEl.querySelector("#dft_wipe").textContent = L.resetAll;
                panelEl.querySelector("#dft_wipe").title = L.resetAllTitle;
                panelEl.querySelector("#dft_tog").textContent = panelExpanded ? L.collapse : L.expand;
            }
            render();
        }
    }

    const zhStrings = {
        title: "⏱ 地牢计时器",
        reset: "重置",
        resetAll: "清空",
        resetTitle: "清除当前地牢当前难度的记录",
        resetAllTitle: "清除所有地牢所有难度的记录",
        confirmReset: "确定要清除 {target} 的记录吗？",
        confirmResetAll: "确定要清除所有地牢所有难度的记录吗？",
        collapse: "收起",
        expand: "展开",
        wave: "波次",
        elapsed: "已用",
        waitAlign: "等待下一组开始计时...",
        waitNext: "等待下一轮...",
        partial: "(不完整轮)",
        colFloor: "层数",
        colTime: "用时",
        colAvg: "均时",
        colDiff: "对比",
        colExtra: "额外",
        colExtraAvg: "平均",
        total: "总计",
        history: "历史",
        runs: "轮",
        avgTime: "平均",
    };
    const enStrings = {
        title: "⏱ Dungeon Timer",
        reset: "Reset",
        resetAll: "Wipe",
        resetTitle: "Clear records for the current dungeon and tier",
        resetAllTitle: "Clear records for every dungeon and tier",
        confirmReset: "Clear the records for {target}?",
        confirmResetAll: "Clear the records for every dungeon and tier?",
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
        avgTime: "Avg",
    };
    let L = enStrings;  // default, updated by updateLang()

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

    // Dungeons have three difficulty tiers, shown in game as T0/T1/T2.
    // endCharacterAction.difficultyTier carries that index directly.
    function tierLabel(tier) {
        return `T${tier ?? 0}`;
    }

    function runLabel(hrid, tier) {
        return hrid ? `${dungeonName(hrid)} ${tierLabel(tier)}` : (isZH ? "地牢" : "Dungeon");
    }

    // Boss definitions per dungeon
    // trackable = bosses that can spawn on non-fixed waves (we count these)
    // finalOnly = bosses that ONLY appear on the final wave(s) (excluded)
    const DUNGEON_BOSSES = {
        // Only bosses that appear in randomSpawnInfoMap (can spawn on non-fixed waves)
        "/actions/combat/chimerical_den": {
            trackable: {
                // Butterjerry in random pool but too weak — excluded
                "/monsters/jackalope":    { zh: "鹿角兔",   en: "Jackalope" },       // random 30+
            },
            finalOnly: ["/monsters/griffin"],
        },
        "/actions/combat/sinister_circus": {
            trackable: {
                // Rabid Rabbit in random pool but too weak — excluded
                "/monsters/zombie_bear":  { zh: "僵尸熊",  en: "Zombie Bear" },       // random 40+
            },
            finalOnly: ["/monsters/deranged_jester"],
        },
        "/actions/combat/enchanted_fortress": {
            trackable: {
                // Enchanted Pawn in random pool but too weak — excluded
                // Knight, Bishop, Rook never in random pool — fixed waves only
            },
            finalOnly: ["/monsters/enchanted_queen", "/monsters/enchanted_king"],
        },
        "/actions/combat/pirate_cove": {
            trackable: {
                // Squawker in random pool but too weak — excluded
                "/monsters/anchor_shark":    { zh: "持锚鲨",    en: "Anchor Shark" },  // random 40+
                "/monsters/brine_marksman":  { zh: "海盐射手",   en: "Brine Marksman" },// random 40+
                "/monsters/tidal_conjuror":  { zh: "潮汐召唤师", en: "Tidal Conjuror" },// random 40+
            },
            finalOnly: ["/monsters/the_kraken"],
            fixedWaveBoss: { 60: "/monsters/captain_fishhook" },
        },
    };

    const GROUP = 5;

    // ── State ──
    let currentDungeon = null;
    let currentTier = 0;
    let currentWave = -1;
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
    let runCompleted = false;

    // Wave timing runs on the server clock (action_completed.endCharacterAction
    // .updatedAt), never on Date.now(). A frozen tab, a throttled background
    // tab or a websocket reconnect delivers messages late and in bursts, which
    // would inflate one wave and crush the next ones if we timed them locally.
    let runStartTime = null;       // server ms, start of wave 1
    let lastBoundaryWave = null;   // wave that ended at lastBoundaryTime (0 = run finished)
    let lastBoundaryTime = null;   // server ms
    let lastBoundaryClient = null; // Date.now() when that boundary was received
    let inLabyrinth = false;

    // Latest action state mirrored from the websocket. The game never writes
    // "init_character_data" to localStorage, so the only reliable sources are
    // the init_character_data snapshot and every action_completed delta.
    let cachedCharacterActions = null;
    let cachedPartyActionMap = null;

    // ── Persistence (per dungeon + difficulty tier) ──
    // v3 splits every dungeon by difficulty tier; v2 lumped them together and
    // its averages are not comparable, so it is not migrated.
    const STORAGE_KEY = "dft_history_v3";

    function storageKeyFor(dungeonHrid, tier) {
        return `${dungeonHrid || "_unknown"}#${tierLabel(tier)}`;
    }

    function readAll() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (_) { return {}; }
    }

    function writeAll(allData) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(allData)); } catch (_) {}
    }

    function saveHistory() {
        const allData = readAll();
        allData[storageKeyFor(currentDungeon, currentTier)] = {
            runHistory,
            totalBossCounts,
            totalBossPerGroup,
            totalRuns,
        };
        writeAll(allData);
    }

    function loadHistory() {
        loadHistoryFor(currentDungeon, currentTier);
    }

    function loadHistoryFor(dungeonHrid, tier) {
        runHistory = [];
        totalBossCounts = {};
        totalBossPerGroup = {};
        totalRuns = 0;
        const data = readAll()[storageKeyFor(dungeonHrid, tier)];
        if (!data) return;
        if (data.runHistory) runHistory = data.runHistory;
        if (data.totalBossCounts) totalBossCounts = data.totalBossCounts;
        if (data.totalBossPerGroup) totalBossPerGroup = data.totalBossPerGroup;
        if (data.totalRuns) totalRuns = data.totalRuns;
    }

    function dropHistoryFor(dungeonHrid, tier) {
        const allData = readAll();
        delete allData[storageKeyFor(dungeonHrid, tier)];
        writeAll(allData);
    }

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
    let panelEventsController = null;

    function ensurePanel() {
        // React can replace the document body during route transitions. Do not
        // keep using a panel node that is no longer attached to the document.
        if (panelEl?.isConnected && panelEl.ownerDocument === document) return;
        panelEventsController?.abort();
        panelEventsController = new AbortController();
        panelEl = null;
        if (!document.body) return;

        panelEl = document.createElement("div");
        panelEl.style.cssText = `
            position:fixed; top:50px; right:50px; z-index:2147483647;
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
                    <button id="dft_rst" title="${L.resetTitle}" style="background:#e53935;color:white;border:none;padding:2px 7px;margin-left:5px;border-radius:8px;cursor:pointer;font-size:0.7rem;">${L.reset}</button>
                    <button id="dft_wipe" title="${L.resetAllTitle}" style="background:#6d4c41;color:white;border:none;padding:2px 7px;margin-left:5px;border-radius:8px;cursor:pointer;font-size:0.7rem;">${L.resetAll}</button>
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
        function clearLiveRun() {
            runHistory = [];
            currentRunGroups = {};
            currentRunBossCounts = {};
            currentRunBossPerGroup = {};
            totalBossCounts = {};
            totalBossPerGroup = {};
            totalRuns = 0;
            isDungeonActive = false;
            isPartialRun = false;
            runCompleted = false;
            resetTiming();
        }
        panelEl.querySelector("#dft_rst").onclick = () => {
            const target = runLabel(currentDungeon, currentTier);
            if (!confirm(L.confirmReset.replace("{target}", target))) return;
            clearLiveRun();
            dropHistoryFor(currentDungeon, currentTier);
            render();
        };
        panelEl.querySelector("#dft_wipe").onclick = () => {
            if (!confirm(L.confirmResetAll)) return;
            clearLiveRun();
            localStorage.removeItem(STORAGE_KEY);
            render();
        };

        // drag
        let dx, dy, dragging = false;
        const hdr = panelEl.querySelector("#dft_hdr");
        hdr.onmousedown = e => { dragging = true; dx = e.clientX - panelEl.getBoundingClientRect().left; dy = e.clientY - panelEl.getBoundingClientRect().top; e.preventDefault(); };
        const eventOptions = { signal: panelEventsController.signal };
        document.addEventListener("mousemove", e => { if (!dragging) return; panelEl.style.left = (e.clientX - dx) + "px"; panelEl.style.top = (e.clientY - dy) + "px"; panelEl.style.right = "auto"; }, eventOptions);
        document.addEventListener("mouseup", () => { dragging = false; }, eventOptions);
    }

    function shouldShow() {
        // The game no longer consistently exposes characterId in the URL.
        // The panel is harmless while idle and must remain discoverable after
        // client-side route changes, so visibility is driven by timer state.
        return Boolean(currentDungeon) || isDungeonActive || Object.keys(currentRunGroups).length > 0 || runHistory.length > 0;
    }

    function render() {
        ensurePanel();
        if (!panelEl) return;

        if (!shouldShow()) { panelEl.style.display = "none"; return; }
        panelEl.style.display = "";

        const maxWaves = currentDungeon && DUNGEONS[currentDungeon] ? DUNGEONS[currentDungeon].maxWaves : 65;
        const dName = runLabel(currentDungeon, currentTier);
        const labels = allLabels(maxWaves);
        const histAvg = getHistoryAvg();
        const hasHistory = runHistory.length > 0;

        // ── Status ──
        const statusEl = panelEl.querySelector("#dft_status");
        if (isDungeonActive && currentDungeon) {
            // measured part comes from the server clock, only the in-flight
            // wave ticks locally
            const elapsed = (runStartTime !== null && lastBoundaryTime !== null)
                ? (lastBoundaryTime - runStartTime) + Math.max(0, Date.now() - lastBoundaryClient)
                : 0;
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
            const scope = currentDungeon ? `<span style="color:#4fc3f7;">${dName}</span> ` : "";
            statusEl.innerHTML = `${scope}<span style="color:#aaa;">${L.waitNext}</span>`;
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
                const isFuture = !g && !isActive;

                let groupTime = g ? g.total : 0;
                if (isActive && lastBoundaryClient !== null) groupTime += Math.max(0, Date.now() - lastBoundaryClient);

                const rowStyle = isActive ? "color:#ffb74d;" : isFuture ? "color:#555;" : "color:white;";

                html += `<tr style="${rowStyle}">`;
                html += `<td style="padding:2px 4px;">${label}</td>`;
                html += `<td style="padding:2px 4px;">${isFuture ? "-" : fmt(groupTime)}</td>`;

                if (hasHistory) {
                    const ha = histAvg[label];
                    html += `<td style="padding:2px 4px;color:#aaa;">${ha ? fmt(ha.avg) : "-"}</td>`;
                    if (!isFuture && ha && g) {
                        if (!isActive || lastBoundaryClient === null) {
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
            const allTotals = runHistory.map(r => Object.values(r.groups).reduce((s, g) => s + g.total, 0));
            const avgTotal = allTotals.reduce((s, t) => s + t, 0) / allTotals.length;
            h += `<span style="color:#4fc3f7;">${L.history} (${runHistory.length} ${L.runs})</span> <span style="color:#81c784;">${L.avgTime}: ${fmt(avgTotal)}</span><br>`;
            for (const run of recent) {
                const total = Object.values(run.groups).reduce((s, g) => s + g.total, 0);
                const t = new Date(run.endTime);
                const ts = `${t.getHours().toString().padStart(2, '0')}:${t.getMinutes().toString().padStart(2, '0')}`;
                const rName = run.dungeonHrid ? runLabel(run.dungeonHrid, run.difficultyTier) : run.dungeonName;
                h += `[${ts}] ${rName} <span style="color:white;">${fmt(total)}</span><br>`;
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
            if (a?.actionHrid && DUNGEONS[a.actionHrid]) return a;
        }
        return null;
    }

    function detectPartyDungeon(partyActionMap) {
        if (!partyActionMap) return null;
        return detectDungeon(Object.values(partyActionMap));
    }

    function clearDungeon() {
        if (!currentDungeon) return;
        if (isDungeonActive) finishRun();
        currentDungeon = null;
        isDungeonActive = false;
        resetTiming();
        render();
    }

    function tryDetectDungeon() {
        if (inLabyrinth) { clearDungeon(); return; }
        const action = detectDungeon(cachedCharacterActions) || detectPartyDungeon(cachedPartyActionMap);
        if (action) switchDungeon(action.actionHrid, action.difficultyTier);
        // No dungeon in the cache means "unknown", not "left the dungeon".
        // Clearing is driven by explicit events (init snapshot, action_completed,
        // labyrinth messages, party battle ended).
    }

    function onNewBattle(msg) {
        const wave = msg.wave;
        if (wave === undefined || wave === null) return;

        // Skip labyrinth battles
        if (inLabyrinth) return;

        tryDetectDungeon();
        if (!currentDungeon || !DUNGEONS[currentDungeon]) return;

        const maxWaves = DUNGEONS[currentDungeon].maxWaves;

        if (wave === 1) {
            if (isDungeonActive) finishRun();
            currentRunGroups = {};
            currentRunBossCounts = {};
            currentRunBossPerGroup = {};
            isDungeonActive = true;
            waitingForCleanGroup = false;
            isPartialRun = false;
            runCompleted = false;
            // A looping dungeon gives us an exact server boundary for the start
            // of wave 1 (the action_completed with wave 0). A freshly started
            // action has none, so fall back to the arrival of this message.
            if (lastBoundaryWave !== 0 || lastBoundaryTime === null) {
                lastBoundaryWave = 0;
                lastBoundaryTime = Date.now();
                lastBoundaryClient = lastBoundaryTime;
            }
            runStartTime = lastBoundaryTime;
        } else if (!isDungeonActive) {
            // Joined mid-run (page reload, late script start): never savable.
            isDungeonActive = true;
            currentRunGroups = {};
            currentRunBossCounts = {};
            currentRunBossPerGroup = {};
            isPartialRun = true;
            runCompleted = false;
            runStartTime = null;
            waitingForCleanGroup = !isGroupStart(wave);
            if (!waitingForCleanGroup) runStartTime = lastBoundaryTime;
        }

        detectBosses(msg);

        if (waitingForCleanGroup && isGroupStart(wave)) {
            waitingForCleanGroup = false;
            runStartTime = lastBoundaryTime;
        }

        currentWave = wave;
        render();
    }

    // Authoritative wave boundary: endCharacterAction.updatedAt is the server
    // timestamp at which `wave` finished (wave 0 means the whole run finished).
    function onWaveBoundary(action) {
        if (!currentDungeon || !DUNGEONS[currentDungeon]) return;
        const boundary = Date.parse(action.updatedAt);
        if (!Number.isFinite(boundary)) return;

        const maxWaves = DUNGEONS[currentDungeon].maxWaves;
        const raw = action.wave;
        const endedWave = raw === 0 ? maxWaves : raw;
        const continuous = lastBoundaryWave !== null && lastBoundaryWave === endedWave - 1;

        if (isDungeonActive && !waitingForCleanGroup) {
            if (continuous && lastBoundaryTime !== null) {
                const label = groupLabel(endedWave, maxWaves);
                if (!currentRunGroups[label]) currentRunGroups[label] = { total: 0, count: 0 };
                currentRunGroups[label].total += boundary - lastBoundaryTime;
                currentRunGroups[label].count += 1;
            } else if (lastBoundaryWave !== null) {
                // Waves went missing (reconnect, stalled tab, dropped message).
                // The measured groups no longer cover the run, so do not let it
                // reach the history.
                isPartialRun = true;
            }
        }

        lastBoundaryWave = raw;
        lastBoundaryTime = boundary;
        lastBoundaryClient = Date.now();

        if (raw === 0) {
            if (isDungeonActive) {
                runCompleted = continuous;
                finishRun();
            }
            // the next run starts at this very boundary
            lastBoundaryWave = 0;
        }
        render();
    }

    function finishRun() {
        if (runCompleted && !isPartialRun && Object.keys(currentRunGroups).length > 0) {
            runHistory.push({
                dungeonHrid: currentDungeon,
                difficultyTier: currentTier,
                dungeonName: runLabel(currentDungeon, currentTier),
                maxWaves: DUNGEONS[currentDungeon]?.maxWaves || 65,
                groups: JSON.parse(JSON.stringify(currentRunGroups)),
                endTime: Date.now(),
            });

            for (const [hrid, count] of Object.entries(currentRunBossCounts)) {
                if (!totalBossCounts[hrid]) totalBossCounts[hrid] = 0;
                totalBossCounts[hrid] += count;
            }
            for (const [label, count] of Object.entries(currentRunBossPerGroup)) {
                if (!totalBossPerGroup[label]) totalBossPerGroup[label] = 0;
                totalBossPerGroup[label] += count;
            }
            totalRuns++;
            saveHistory();
        }

        currentRunGroups = {};
        currentRunBossCounts = {};
        currentRunBossPerGroup = {};
        isDungeonActive = false;
        isPartialRun = false;
        runCompleted = false;
        runStartTime = null;
        currentWave = -1;
        render();
    }

    function resetTiming() {
        runStartTime = null;
        lastBoundaryWave = null;
        lastBoundaryTime = null;
        lastBoundaryClient = null;
    }

    function switchDungeon(newDungeon, newTier) {
        const tier = newTier ?? 0;
        if (newDungeon === currentDungeon && tier === currentTier) return;
        // Save the previous dungeon/tier bucket before switching
        if (currentDungeon) saveHistory();
        // new_battle wave 1 arrives before the server names the new action, so a
        // fresh run is briefly attributed to the previous dungeon/tier. Only the
        // "1-5" group can exist that early and its label does not depend on
        // maxWaves, so carry the run over instead of throwing it away.
        const keepRun = isDungeonActive && !isPartialRun && currentWave >= 1 && currentWave <= GROUP;
        if (!keepRun) {
            currentRunGroups = {};
            currentRunBossCounts = {};
            currentRunBossPerGroup = {};
            isDungeonActive = false;
            isPartialRun = false;
            runCompleted = false;
            waitingForCleanGroup = false;
            currentWave = -1;
            resetTiming();
        }
        currentDungeon = newDungeon;
        currentTier = tier;
        // Load the bucket for the new dungeon + tier
        loadHistoryFor(newDungeon, tier);
    }

    function handle(message) {
        if (message.type === "init_character_data") {
            cachedCharacterActions = message.characterActions || null;
            cachedPartyActionMap = message.partyInfo?.partyActionMap || null;

            // Track labyrinth state
            if (message.labyrinth?.isActive) {
                inLabyrinth = true;
                cachedCharacterActions = null;
                cachedPartyActionMap = null;
                clearDungeon();
                render();
                return;
            }
            inLabyrinth = false;

            const d = detectDungeon(cachedCharacterActions) || detectPartyDungeon(cachedPartyActionMap);
            if (d) switchDungeon(d.actionHrid, d.difficultyTier);
            else clearDungeon();
            render();
        }

        // The action the character is running right now. This is the only
        // detection path that works when the page was loaded outside a dungeon,
        // and it arrives roughly once per wave.
        if (message.type === "action_completed") {
            const action = message.endCharacterAction;
            if (action?.actionHrid) {
                cachedCharacterActions = [action];
                if (DUNGEONS[action.actionHrid]) {
                    inLabyrinth = false;
                    switchDungeon(action.actionHrid, action.difficultyTier);
                    onWaveBoundary(action);
                } else {
                    // Switched to a non-dungeon action — the run is over.
                    cachedPartyActionMap = null;
                    resetTiming();
                    clearDungeon();
                }
            }
        }

        // Track labyrinth enter/exit from dedicated messages
        if (message.type === "labyrinth_update" || message.type === "labyrinth_enter") {
            inLabyrinth = true;
            cachedCharacterActions = null;
            cachedPartyActionMap = null;
            clearDungeon();
        }
        if (message.type === "labyrinth_exit") {
            inLabyrinth = false;
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
    // `class ... extends` keeps the prototype chain and the static readyState
    // constants intact, so `ws instanceof WebSocket` still holds for game code.
    const OrigWS = unsafeWindow.WebSocket;
    class WrapWS extends OrigWS {
        constructor(...args) {
            super(...args);
            this.addEventListener("message", e => {
                try { handle(JSON.parse(e.data)); } catch (_) {}
            });
        }
    }
    unsafeWindow.WebSocket = WrapWS;

    setInterval(() => {
        tryDetectDungeon();
        ensurePanel();
        updateLang();
        render();
    }, 2000);
    (function wait() {
        if (document.body) {
            loadHistory();
            updateLang();
            ensurePanel();
            render();
        } else {
            setTimeout(wait, 500);
        }
    })();
})();
