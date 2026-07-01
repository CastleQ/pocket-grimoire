// 캐릭터 배포 기능 (A: 배포+링크) + (B: 그리모어 실시간 자동 채우기)
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";
import TokenStore from "../../classes/TokenStore.js";

const WATCH_GAME_KEY = "pg_watch_game";
let watchTimer = null;
let watchGameId = null;
let placedSlotIds = null;
let notifiedComplete = false;

function sbHeaders() {
    return {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + SUPABASE_ANON_KEY,
        "Content-Type": "application/json"
    };
}

function getSelectedCharacters() {
    const form = document.querySelector("#player-select");
    if (!form) {
        return [];
    }
    const result = [];
    form.querySelectorAll('input[name="character"]:checked').forEach(function (input) {
        const id = input.value;
        const countInput = form.querySelector('input[name="count-' + id + '"]');
        const count = countInput ? Math.max(1, Number(countInput.value) || 1) : 1;
        result.push({ id: id, count: count });
    });
    return result;
}

function supabaseInsert(table, rows) {
    return fetch(SUPABASE_URL + "/rest/v1/" + table, {
        method: "POST",
        headers: Object.assign(sbHeaders(), { "Prefer": "return=representation" }),
        body: JSON.stringify(rows)
    }).then(function (response) {
        if (!response.ok) {
            return response.text().then(function (text) {
                throw new Error(table + " 저장 실패 (" + response.status + "): " + text);
            });
        }
        return response.json();
    });
}

// ---- B단계: 그리모어 자동 채우기 ----

function placedKey(gameId) { return "pg_placed_" + gameId; }

function loadPlaced(gameId) {
    try {
        return new Set(JSON.parse(localStorage.getItem(placedKey(gameId))) || []);
    } catch (e) {
        return new Set();
    }
}

function savePlaced(gameId) {
    try {
        localStorage.setItem(placedKey(gameId), JSON.stringify(Array.from(placedSlotIds)));
    } catch (e) {}
}

function placeToken(characterId, playerName) {
    TokenStore.ready(function (tokenStore) {
        const padEl = document.querySelector(".js--pad");
        if (!padEl || !padEl.pad) { return; }
        const pad = padEl.pad;
        const clone = tokenStore.getCharacterClone(characterId);
        if (!clone) { return; }
        const info = pad.addCharacter(clone);
        if (info && info.token && playerName) {
            pad.setPlayerNameForToken(info.token, playerName);
        }
    });
}

function pollOnce() {
    if (!watchGameId) { return; }
    const url = SUPABASE_URL + "/rest/v1/slots?game_id=eq." + watchGameId
        + "&select=id,character_id,player_name,submitted";
    fetch(url, { headers: sbHeaders() })
        .then(function (res) { if (!res.ok) { throw new Error("poll " + res.status); } return res.json(); })
        .then(function (slots) {
            if (!slots || !slots.length) { return; }
            let changed = false;
            slots.forEach(function (s) {
                if (s.submitted && !placedSlotIds.has(s.id)) {
                    placedSlotIds.add(s.id);
                    changed = true;
                    placeToken(s.character_id, s.player_name);
                }
            });
            if (changed) { savePlaced(watchGameId); }
            const submittedCount = slots.filter(function (s) { return s.submitted; }).length;
            if (submittedCount === slots.length && !notifiedComplete) {
                notifiedComplete = true;
                stopWatching();
                localStorage.removeItem(WATCH_GAME_KEY);
                window.alert("모든 참가자가 캐릭터를 확인했습니다!\n준비가 되면 게임을 시작하세요.");
            }
        })
        .catch(function () {});
}

function stopWatching() {
    if (watchTimer) {
        window.clearInterval(watchTimer);
        watchTimer = null;
    }
}

function startWatching(gameId) {
    stopWatching();
    watchGameId = gameId;
    placedSlotIds = loadPlaced(gameId);
    notifiedComplete = false;
    localStorage.setItem(WATCH_GAME_KEY, gameId);
    pollOnce();
    watchTimer = window.setInterval(pollOnce, 2000);
}

function resumeWatchingIfNeeded() {
    const saved = localStorage.getItem(WATCH_GAME_KEY);
    if (saved) { startWatching(saved); }
}

// ---- A단계: 배포 버튼 ----

function handleDistributeClick() {
    if (SUPABASE_URL.indexOf("여기에") !== -1 || SUPABASE_ANON_KEY.indexOf("여기에") !== -1) {
        window.alert("supabase-config.js 파일에 Supabase 주소와 키를 먼저 넣어주세요.");
        return;
    }
    const characters = getSelectedCharacters();
    if (characters.length === 0) {
        window.alert("아직 선택된 캐릭터가 없습니다.\n먼저 배포할 캐릭터를 체크해 주세요.");
        return;
    }
    const slotCharacters = [];
    characters.forEach(function (c) {
        for (let i = 0; i < c.count; i += 1) {
            slotCharacters.push(c.id);
        }
    });
    const button = document.querySelector("#player-select-distribute");
    if (button) {
        button.disabled = true;
        button.textContent = "배포 중...";
    }

    let createdGame = null;
    supabaseInsert("games", [{ script_name: "" }])
        .then(function (games) {
            createdGame = games[0];
            const slotRows = slotCharacters.map(function (characterId) {
                return { game_id: createdGame.id, character_id: characterId };
            });
            return supabaseInsert("slots", slotRows);
        })
        .then(function () {
            startWatching(createdGame.id);
            const link = window.location.origin + "/claim.html?game=" + createdGame.id;
            return navigator.clipboard.writeText(link).then(function () {
                window.alert(
                    "✅ 배포 준비 완료! 공유 링크가 클립보드에 복사되었습니다.\n\n"
                    + link + "\n\n"
                    + "가방 캐릭터 수: " + slotCharacters.length + "개\n\n"
                    + "이제 플레이어가 제출하면, 이 그리모어에 자동으로 토큰이 채워집니다."
                );
            }).catch(function () {
                window.prompt("자동 복사 실패. 아래 링크를 직접 복사하세요:", link);
            });
        })
        .catch(function (err) {
            window.alert("문제가 발생했습니다:\n" + err.message);
        })
        .then(function () {
            if (button) {
                button.disabled = false;
                button.textContent = "캐릭터 배포";
            }
        });
}

document.addEventListener("click", function (event) {
    const target = event.target;
    if (target && target.closest && target.closest("#player-select-distribute")) {
        handleDistributeClick();
    }
});

resumeWatchingIfNeeded();