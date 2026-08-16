// 캐릭터 배포 기능 (A: 배포+링크) + (B: 그리모어 실시간 자동 채우기)
// v4: 배포 시 캐릭터 이름/능력/이미지를 슬롯에 함께 저장 (공식+커스텀 스크립트 모두 지원)
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
    const button = document.querySelector("#player-select-distribute");
    if (button) {
        button.disabled = true;
        button.textContent = "배포 중...";
    }

    function restoreButton() {
        if (button) {
            button.disabled = false;
            button.textContent = "캐릭터 나눠주기";
        }
    }

    TokenStore.ready(function (tokenStore) {

        // bag-disabled: 가방에 넣을 수 없는 캐릭터(예: 드렁크/마리오네트)는 배포에서
        // 제외하고 이야기꾼에게 안내한다. (배포 대상이 아니라 직접 배치하는 캐릭터)
        const bagDisabledNames = [];
        const distributable = characters.filter(function (c) {
            const ch = tokenStore.getCharacter(c.id);
            if (ch && ch.hasSpecialData("selection", "bag-disabled")) {
                bagDisabledNames.push(ch.getName());
                return false;
            }
            return true;
        });
        if (bagDisabledNames.length) {
            window.alert(
                "다음 캐릭터는 가방에 넣을 수 없어 배포에서 제외됩니다.\n"
                + "이야기꾼이 직접 배치하세요:\n\n- "
                + bagDisabledNames.join("\n- ")
            );
        }
        if (distributable.length === 0) {
            window.alert("배포할 수 있는 캐릭터가 없습니다.");
            restoreButton();
            return;
        }

        // 카운트만큼 슬롯으로 펼치기 (bag-duplicate 대응)
        const slotCharacters = [];
        distributable.forEach(function (c) {
            for (let i = 0; i < c.count; i += 1) {
                slotCharacters.push(c.id);
            }
        });

        // 각 캐릭터의 이름/능력/이미지를 지금(배포 시점) 확보 — 공식+커스텀 모두 동작
        const slotData = slotCharacters.map(function (id) {
            const ch = tokenStore.getCharacter(id);
            return {
                character_id: id,
                character_name: ch ? ch.getName() : id,
                character_ability: ch ? ch.getAbility() : "",
                character_image: ch ? ch.getImage() : ""
            };
        });

        // 현재 로드된 시트 이름 (select-edition.js가 로드 시 저장). games.script_name + 플레이 빈도에 사용.
        let scriptName = "";
        try {
            scriptName = window.localStorage.getItem("pg_current_script") || "";
        } catch (ignore) {
            scriptName = "";
        }

        let createdGame = null;
        supabaseInsert("games", [{ script_name: scriptName }])
            .then(function (games) {
                createdGame = games[0];
                const slotRows = slotData.map(function (d) {
                    return {
                        game_id: createdGame.id,
                        character_id: d.character_id,
                        character_name: d.character_name,
                        character_ability: d.character_ability,
                        character_image: d.character_image
                    };
                });
                return supabaseInsert("slots", slotRows);
            })
            .then(function () {
                startWatching(createdGame.id);

                // 플레이 빈도 +1 (공식/내장/직접입력 모두 포함). 실패해도 배포에 영향 없음.
                if (scriptName) {
                    fetch(SUPABASE_URL + "/rest/v1/rpc/increment_sheet_play", {
                        method: "POST",
                        headers: sbHeaders(),
                        body: JSON.stringify({ p_sheet_key: scriptName, p_name: scriptName })
                    }).catch(function () {});
                }
                // claim.html 링크 생성:
                // - 정적 배포(예: /pocket-grimoire/): 그리모어와 같은 폴더의 claim.html
                // - 개발 환경(/ko_KR/ 등 로케일 경로): public 루트의 /claim.html
                var pathname = window.location.pathname;
                var claimBase = /\/[a-z]{2}_[A-Z]{2}(\/|$)/.test(pathname)
                    ? "/"
                    : pathname.replace(/[^/]*$/, "");
                const link = window.location.origin + claimBase + "claim.html?game=" + createdGame.id;
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
            .then(restoreButton);
    });
}

document.addEventListener("click", function (event) {
    const target = event.target;
    if (target && target.closest && target.closest("#player-select-distribute")) {
        handleDistributeClick();
    }
});

resumeWatchingIfNeeded();