import Observer from "../../classes/Observer.js";
import TokenStore from "../../classes/TokenStore.js";
import Dialog from "../../classes/Dialog.js";
import { lookupOneCached } from "../../utils/elements.js";
import { buildPools } from "../../utils/whale-pool.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";

/**
 * 대왕고래 양동이 전용 진행 기능.
 *
 * 이 시트에는 "whalebucket" 이라는 고유 캐릭터가 항상 들어 있다. 그것을
 * 표식으로 삼아, 해당 시트를 불러왔을 때만 진행 버튼을 드러낸다.
 *
 * 진행 상황은 브라우저 저장소에 남겨 두어, 실수로 새로고침해도 같은
 * 게임 방으로 돌아올 수 있게 한다.
 */

const MARKER_ID = "whalebucket";
const STORAGE_KEY = "pg_whale_session";
const POLL_INTERVAL = 2000;

const gameObserver = Observer.create("game");

let current = {
    name: "",
    characters: []
};

let session = null;
let pollTimer = null;

/**
 * Supabase 창구에 보낼 공통 머리말.
 *
 * @return {Object}
 *         요청 머리말.
 */
function headers() {

    return {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + SUPABASE_ANON_KEY
    };

}

/**
 * Supabase 창구 함수를 부른다.
 *
 * @param  {String} name
 *         창구 이름.
 * @param  {Object} body
 *         보낼 내용.
 * @return {Promise}
 *         결과를 담은 약속.
 */
function callRpc(name, body) {

    return fetch(SUPABASE_URL + "/rest/v1/rpc/" + name, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(body)
    }).then((response) => {

        if (!response.ok) {

            return response.text().then((text) => {
                throw new Error(text || ("요청 실패 " + response.status));
            });

        }

        return response.json();

    });

}

/**
 * 아무도 맞출 수 없는 긴 무작위 문자열을 만든다. 이야기꾼 열쇠로 쓴다.
 *
 * @return {String}
 *         무작위 문자열.
 */
function makeToken() {

    const bytes = new Uint8Array(16);

    window.crypto.getRandomValues(bytes);

    return Array.from(bytes).map((byte) => {
        return byte.toString(16).padStart(2, "0");
    }).join("");

}

/**
 * 진행 중인 게임 방 정보를 저장소에서 읽는다.
 *
 * @return {Object|null}
 *         저장된 정보. 없으면 null.
 */
function loadSession() {

    try {

        const raw = window.localStorage.getItem(STORAGE_KEY);

        return raw ? JSON.parse(raw) : null;

    } catch (ignore) {
        return null;
    }

}

/**
 * 진행 중인 게임 방 정보를 저장소에 남긴다.
 */
function saveSession() {

    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch (ignore) {
        // 저장소를 못 쓰면 그냥 넘어간다.
    }

}

/**
 * 참가자용 링크를 만든다. 정적 배포본과 개발 서버의 경로가 달라 나눠 본다.
 *
 * @param  {String} gameId
 *         게임 방 번호.
 * @return {String}
 *         전체 주소.
 */
function buildLink(gameId) {

    const pathname = window.location.pathname;
    const base = /\/[a-z]{2}_[A-Z]{2}(\/|$)/.test(pathname)
        ? "/"
        : pathname.replace(/[^/]*$/, "");

    return window.location.origin + base + "whale.html?game=" + gameId;

}

/**
 * 참가자 명단을 화면에 그린다.
 *
 * @param {Array} players
 *        참가자 목록.
 */
function assignCharacter(playerId, entry) {

    return callRpc("wb_assign", {
        p_game_id: session.gameId,
        p_host_token: session.hostToken,
        p_player_id: playerId,
        p_char: entry
    }).then(pollOnce).catch((error) => {
        window.alert("확정하지 못했습니다:\n" + error.message);
    });

}

/**
 * 후보 목록 전체에서 아이디로 캐릭터 하나를 찾는다.
 *
 * @param  {String} id
 *         캐릭터 아이디.
 * @return {Object|null}
 *         찾은 캐릭터. 없으면 null.
 */
function findEntry(id) {

    const pools = (session && session.pools) || {};
    const teams = Object.keys(pools);

    for (let i = 0; i < teams.length; i += 1) {

        const found = pools[teams[i]].find((entry) => entry.id === id);

        if (found) {
            return found;
        }

    }

    return null;

}

/**
 * 참가자 명단을 화면에 그린다. 이번 단계에서 지망을 제출한 사람에게는
 * 1~3지망이 버튼으로 붙고, 누르면 그 캐릭터로 확정된다.
 *
 * @param {Array} players
 *        참가자 목록.
 */
function renderRoster(players) {

    const roster = document.querySelector("#whale-bucket-roster");
    const count = document.querySelector("#whale-bucket-count");

    if (!roster || !count) {
        return;
    }

    count.textContent = players.length;
    roster.textContent = "";

    players.forEach((player) => {

        const item = document.createElement("li");
        const head = document.createElement("div");

        head.className = "whale-bucket__player";
        head.textContent = player.name || "(이름 없음)";

        if (player.char_name) {
            head.textContent += " → " + player.char_name + " ✅";
        } else if (player.team) {
            head.textContent += " (" + STAGE_NAMES[player.team] + ")";
        }

        item.append(head);

        if (player.is_real && player.submitted && !player.char_name) {

            const picks = document.createElement("ul");

            picks.className = "button-list";

            (player.picks || []).forEach((id, index) => {

                const entry = findEntry(id);

                if (!entry) {
                    return;
                }

                const cell = document.createElement("li");
                const button = document.createElement("button");

                button.type = "button";
                button.className = "button";
                button.textContent = (index + 1) + ". " + entry.name;
                button.addEventListener("click", () => {

                    const ask = player.name + " → " + entry.name + " 으로 확정할까요?";

                    if (window.confirm(ask)) {
                        assignCharacter(player.player_id, entry);
                    }

                });

                cell.append(button);
                picks.append(cell);

            });

            item.append(picks);

        } else if (player.is_real && !player.submitted) {

            const waiting = document.createElement("small");

            waiting.textContent = "고르는 중...";
            item.append(waiting);

        }

        roster.append(item);

    });

}

/**
 * 서버에 현재 상황을 물어본다.
 */
function pollOnce() {

    if (!session) {
        return;
    }

    callRpc("wb_host_state", {
        p_game_id: session.gameId,
        p_host_token: session.hostToken
    }).then((state) => {

        renderRoster(state.players || []);
        latestState = state;
        renderStage();

    }).catch(() => {
        // 잠깐 실패해도 다음 차례에 다시 물어본다.
    });

}

/**
 * 2초마다 서버에 물어보기 시작한다.
 */
function startPolling() {

    if (pollTimer) {
        window.clearInterval(pollTimer);
    }

    pollOnce();
    pollTimer = window.setInterval(pollOnce, POLL_INTERVAL);

}

/**
 * 게임 방이 준비된 상태로 화면을 바꾼다.
 */
function showReady() {

    const status = document.querySelector("#whale-bucket-status");
    const create = document.querySelector("#whale-bucket-create");
    const copy = document.querySelector("#whale-bucket-copy");
    const wrap = document.querySelector("#whale-bucket-link-wrap");
    const link = document.querySelector("#whale-bucket-link");

    if (status) {
        status.textContent = "게임 방이 열렸습니다. 아래 링크를 참가자에게 나눠주세요.";
    }

    if (create) {
        create.hidden = true;
    }

    if (copy) {
        copy.hidden = false;
    }

    const restart = document.querySelector("#whale-bucket-restart");

    if (restart) {
        restart.hidden = false;
    }

    if (wrap) {
        wrap.hidden = false;
    }

    if (link) {
        link.value = buildLink(session.gameId);
    }

}

/**
 * 지금 불러온 시트가 대왕고래 양동이인지 확인한다.
 *
 * @param  {Array} characters
 *         현재 시트의 캐릭터 목록.
 * @return {Boolean}
 *         대왕고래 양동이면 true.
 */
function isWhaleBucket(characters) {

    return characters.some((character) => character.id === MARKER_ID);

}

gameObserver.on("characters-selected", ({ detail }) => {

    current = {
        name: detail.name || "",
        characters: detail.characters.map((character) => character.getAllData())
    };

    const isWhale = isWhaleBucket(current.characters);

    // 대왕고래에서는 '무작위 강조' 자리를 '양동이 진행'이 대신 쓴다.
    // 캐릭터 목록이 길어 아래쪽 버튼은 스크롤 부담이 크기 때문이다.
    const whaleWrap = document.querySelector("#whale-bucket-top-wrap");
    const randomWrap = document.querySelector("#player-select-random-wrap");

    if (whaleWrap) {
        whaleWrap.hidden = !isWhale;
    }

    if (randomWrap) {
        randomWrap.hidden = isWhale;
    }

    // 대왕고래에서는 양동이 진행이 배포를 대신하므로 기존 버튼을 감춘다.
    const distribute = document.querySelector("#player-select-distribute");
    const distributeItem = distribute ? distribute.closest("li") : null;

    if (distributeItem) {
        distributeItem.hidden = isWhale;
    }

});

const startButton = document.querySelector("#whale-bucket-start-top");

if (startButton) {

    startButton.addEventListener("click", () => {

        Dialog.create(lookupOneCached("#whale-bucket-dialog")).show();

        session = loadSession();

        if (session && session.gameId) {

            showReady();
            startPolling();

        }

    });

}

const createButton = document.querySelector("#whale-bucket-create");

if (createButton) {

    createButton.addEventListener("click", () => {

        const pools = buildPools(current.characters);

        createButton.disabled = true;
        createButton.textContent = "만드는 중...";

        const hostToken = makeToken();

        callRpc("wb_create", {
            p_host_token: hostToken,
            p_script_name: current.name || "대왕고래 양동이",
            p_pools: pools
        }).then((gameId) => {

            session = { gameId, hostToken, pools };
            saveSession();
            showReady();
            startPolling();

            const link = buildLink(gameId);

            return navigator.clipboard.writeText(link).then(() => {
                window.alert("🐳 고래시트 캐릭터 배정을 위한 링크가 복사되었습니다.\n게임을 플레이 할 참가자들에게 링크를 나눠주세요.\n\n" + link);
            }).catch(() => {
                window.prompt("아래 링크를 직접 복사하세요:", link);
            });

        }).catch((error) => {

            window.alert("게임 방을 만들지 못했습니다:\n" + error.message);
            createButton.disabled = false;
            createButton.textContent = "게임 방 만들기";

        });

    });

}

/* ────────────────────────────────────────────────────────────
 * 단계 진행 (3-3)
 * ──────────────────────────────────────────────────────────── */

/** 진행 순서. 이 차례대로 유형을 배정한다. */
const STAGE_ORDER = ["demon", "minion", "outsider", "townsfolk"];

/** 화면에 보여줄 유형 이름. */
const STAGE_NAMES = {
    demon: "악마",
    minion: "하수인",
    outsider: "외지인",
    townsfolk: "마을 주민"
};

/** 숫자를 고를 때 덧붙이는 조절 안내. */
const STAGE_ADJUST = {
    demon: "현재 인원수에 맞는 기본값이 셋팅되어 있습니다.",
    minion: "현재 인원수에 맞는 기본값이 셋팅되어 있습니다. 악마의 능력에 따라 조절하세요.",
    outsider: "현재 인원수에 맞는 기본값이 셋팅되어 있습니다. 악한 진영의 능력에 따라 조절하세요.",
    townsfolk: "남은 참가자 수에 맞춰 조절하세요."
};

/** 단계별 안내 문구. 1단계는 처음 쓰는 사람을 위해 더 자세히 적는다. */
const STAGE_HINTS = {
    demon: "플레이 할 모든 참가자가 방에 입장하면, 악마부터 배정합니다. 악마가 될 참가자 수를 정한 뒤 [악마 배정 시작] 버튼을 누르세요.(일반적으로 1명입니다.)",
    minion: "이제 하수인을 배정합니다. 확정된 악마의 능력을 확인한 뒤, 하수인이 될 참가자 수를 정하고 [하수인 배정 시작]을 누르세요.",
    outsider: "이제 외지인을 배정합니다. 확정된 하수인의 능력에 따라 인원이 늘거나 줄 수 있으니 아래 목록을 확인하세요. 0명도 가능합니다.",
    townsfolk: "마지막으로 남은 참가자에게 마을 주민을 배정합니다."
};

/** 유형 이름 뒤에 붙일 목적격 조사. */
const STAGE_JOSA = {
    demon: "를",
    minion: "을",
    outsider: "을",
    townsfolk: "을"
};

let latestState = null;
let counterOpen = false;
let pickedNumber = 0;

/**
 * 다음에 진행할 단계 번호를 알아낸다.
 *
 * @return {Number}
 *         1~4. 모두 끝났으면 5.
 */
function stageFinished() {

    if (!latestState || latestState.stage_no < 1) {
        return true;
    }

    // 이번 단계에서 진짜로 고른 사람 중 아직 캐릭터가 없는 사람이 있으면
    // 이 단계는 끝나지 않은 것이다.
    return !(latestState.players || []).some((player) => {
        return player.is_real && !player.char_name;
    });

}

function nextStageNo() {

    if (!latestState) {
        return 1;
    }

    if (!stageFinished()) {
        return latestState.stage_no;
    }

    return Math.min(latestState.stage_no + 1, 5);

}

/**
 * 숫자 고르는 칸을 새로 그린다.
 */
function renderNumber() {

    const output = document.querySelector("#whale-bucket-number");

    if (output) {
        output.textContent = pickedNumber;
    }

}

/**
 * 이미 확정된 캐릭터를 화면 아래에 보여준다. 외지인 수를 정할 때
 * 남작이 있는지 등을 눈으로 확인하기 위한 것이다.
 */
function renderDecided() {

    const wrap = document.querySelector("#whale-bucket-decided");

    if (!wrap || !latestState) {
        return;
    }

    const decided = (latestState.players || []).filter((player) => {
        return player.char_name;
    });

    wrap.textContent = "";

    if (!decided.length) {
        return;
    }

    const title = document.createElement("h4");

    title.textContent = "지금까지 정해진 캐릭터";
    wrap.append(title);

    const list = document.createElement("ul");

    decided.forEach((player) => {

        const item = document.createElement("li");

        item.textContent = player.name + " — " + player.char_name;
        list.append(item);

    });

    wrap.append(list);

}

/**
 * 단계 진행 칸 전체를 다시 그린다.
 */
/**
 * 이번 단계의 제출 현황을 보여준다. 미끼를 받은 사람도 함께 센다.
 * 외지인 0명처럼 전원이 미끼인 단계에서 진행 신호가 되어 준다.
 */
/**
 * 이번 단계에서 아직 제출하지 않은 참가자 수를 센다. 미끼를 받은
 * 사람도 함께 센다.
 *
 * @return {Number}
 *         아직 내지 않은 사람 수.
 */
/**
 * 서버가 진행 중이라고 말하는 단계의 이름표. 화면에 보이는 단계는
 * 앱이 미리 계산한 '다음' 단계일 수 있어, 숫자가 어느 단계 것인지
 * 밝히지 않으면 이야기꾼이 혼동한다.
 *
 * @return {String}
 *         예: "1단계(악마)". 아직 시작 전이면 빈 글자.
 */
function serverStageLabel() {

    if (!latestState || latestState.stage_no < 1) {
        return "";
    }

    const team = STAGE_ORDER[latestState.stage_no - 1];

    return latestState.stage_no + "단계(" + STAGE_NAMES[team] + ")";

}

function pendingSubmitters() {

    if (!latestState || latestState.stage_no < 1) {
        return 0;
    }

    return (latestState.players || []).filter((player) => {
        return !player.submitted;
    }).length;

}

function renderProgress() {

    const box = document.querySelector("#whale-bucket-progress");

    if (!box || !latestState) {
        return;
    }

    const players = latestState.players || [];

    // 아직 아무 단계도 시작하지 않았으면 보여줄 것이 없다.
    if (latestState.stage_no < 1 || !players.length) {
        box.hidden = true;
        return;
    }

    const done = players.filter((player) => player.submitted).length;
    const total = players.length;
    const complete = done === total;

    box.hidden = false;
    box.classList.toggle("is-complete", complete);
    box.textContent = "📥 " + serverStageLabel() + " 제출 " + done + " / " + total
        + (complete ? " — ✅ 모두 제출했습니다" : "");

}

function renderStage() {

    const box = document.querySelector("#whale-bucket-stage");

    if (!box || !latestState) {
        return;
    }

    box.hidden = false;

    const stageNo = nextStageNo();
    const title = document.querySelector("#whale-bucket-stage-title");
    const hint = document.querySelector("#whale-bucket-stage-hint");
    const go = document.querySelector("#whale-bucket-stage-go");

    if (stageNo > 4) {

        counterOpen = false;
        title.textContent = "모든 유형 배정 완료";
        hint.textContent = "";
        go.hidden = true;
        renderDecided();
    renderProgress();

        return;

    }

    const team = STAGE_ORDER[stageNo - 1];

    title.textContent = stageNo + "단계: " + STAGE_NAMES[team] + " 배정";
    // 숫자를 고르는 중이면 문구를 건드리지 않는다.
    if (!counterOpen) {
        hint.textContent = STAGE_HINTS[team];
    }
    go.hidden = counterOpen;
    go.textContent = STAGE_NAMES[team] + " 배정 시작";

    renderDecided();
    renderProgress();

}

const goButton = document.querySelector("#whale-bucket-stage-go");

if (goButton) {

    goButton.addEventListener("click", () => {

        const stageNo = nextStageNo();
        const team = STAGE_ORDER[stageNo - 1];
        const total = (latestState.players || []).length;
        const pending = pendingSubmitters();

        if (pending > 0) {

            const ask = serverStageLabel() + "에서 아직 제출하지 않은 참가자가 "
                + pending + "명 있습니다."
                + " (제출 " + (total - pending) + " / " + total + ")\n\n"
                + "그래도 다음 단계로 넘어갈까요?\n"
                + "넘어가면 참가자들의 화면도 강제로 다음 단계로 넘어갑니다.";

            if (!window.confirm(ask)) {
                return;
            }

        }

        import("../../utils/whale-counts.js").then(({ defaultCounts }) => {

            pickedNumber = defaultCounts(total)[team];

            renderNumber();

            counterOpen = true;
            document.querySelector("#whale-bucket-counter").hidden = false;
            goButton.hidden = true;

            document.querySelector("#whale-bucket-stage-hint").innerHTML =
                STAGE_NAMES[team] + STAGE_JOSA[team] + " 몇 명 배정할까요?<br>"
                + STAGE_ADJUST[team];

        });

    });

}

const minusButton = document.querySelector("#whale-bucket-minus");

if (minusButton) {

    minusButton.addEventListener("click", () => {

        pickedNumber = Math.max(pickedNumber - 1, 0);
        renderNumber();

    });

}

const plusButton = document.querySelector("#whale-bucket-plus");

if (plusButton) {

    plusButton.addEventListener("click", () => {

        pickedNumber += 1;
        renderNumber();

    });

}

const cancelButton = document.querySelector("#whale-bucket-cancel");

if (cancelButton) {

    cancelButton.addEventListener("click", () => {

        counterOpen = false;
        document.querySelector("#whale-bucket-counter").hidden = true;
        renderStage();

    });

}

const confirmButton = document.querySelector("#whale-bucket-confirm");

if (confirmButton) {

    confirmButton.addEventListener("click", () => {

        const stageNo = nextStageNo();
        const team = STAGE_ORDER[stageNo - 1];
        const message = STAGE_NAMES[team] + STAGE_JOSA[team] + " " + pickedNumber
            + "명 배정할까요?\n\n한 번 배정하면 되돌릴 수 없습니다.";

        if (!window.confirm(message)) {
            return;
        }

        confirmButton.disabled = true;

        callRpc("wb_start_stage", {
            p_game_id: session.gameId,
            p_host_token: session.hostToken,
            p_stage_no: stageNo,
            p_team: team,
            p_count: pickedNumber
        }).then(() => {

            counterOpen = false;
            document.querySelector("#whale-bucket-counter").hidden = true;
            pollOnce();

        }).catch((error) => {

            window.alert("배정하지 못했습니다:\n" + error.message);

        }).then(() => {

            confirmButton.disabled = false;

        });

    });

}

const revealButton = document.querySelector("#whale-bucket-reveal");

if (revealButton) {

    revealButton.addEventListener("click", () => {

        const message = "모든 참가자에게 캐릭터를 동시에 공개합니다.\n\n"
            + "각자 자기 캐릭터만 보게 됩니다. 되돌릴 수 없습니다.\n계속할까요?";

        if (!window.confirm(message)) {
            return;
        }

        revealButton.disabled = true;

        callRpc("wb_reveal", {
            p_game_id: session.gameId,
            p_host_token: session.hostToken
        }).then(() => {

            placeAllTokens((latestState && latestState.players) || []);
            window.alert("🎭 공개되었습니다.\n그리모어에 토큰을 배치했습니다.");
            pollOnce();

        }).catch((error) => {

            window.alert("공개하지 못했습니다:\n" + error.message);

        }).then(() => {

            revealButton.disabled = false;

        });

    });

}

/**
 * 확정된 캐릭터를 그리모어 판에 토큰으로 꽂는다. 기존 '캐릭터 나눠주기'
 * 기능과 같은 부품을 쓰므로, 손으로 꽂은 토큰과 똑같이 동작한다.
 *
 * @param {Array} players
 *        확정된 참가자 목록.
 */
function placeAllTokens(players) {

    TokenStore.ready((tokenStore) => {

        const padElement = document.querySelector(".js--pad");

        if (!padElement || !padElement.pad) {
            return;
        }

        const pad = padElement.pad;
        const layoutSelect = document.querySelector("#token-layout");

        // 배치기에게 인원수와 배치 모양을 먼저 알려준다. 이걸 건너뛰면
        // 토큰이 한 자리에 겹쳐 쌓인다.
        pad.updatePositioner({
            container: true,
            tokens: true,
            total: players.length,
            layout: layoutSelect ? layoutSelect.value : "oval"
        });

        players.forEach((player) => {

            if (!player.char_id) {
                return;
            }

            const clone = tokenStore.getCharacterClone(player.char_id);

            if (!clone) {
                return;
            }

            const info = pad.addCharacter(clone);

            if (info && info.token && player.name) {
                pad.setPlayerNameForToken(info.token, player.name);
            }

        });

    });

}

/**
 * 링크를 클립보드에 복사한다. 복사가 막힌 환경에서는 주소를 직접
 * 고를 수 있도록 입력칸을 선택해 준다.
 */
function copyLink() {

    const field = document.querySelector("#whale-bucket-link");

    if (!field || !field.value) {
        return;
    }

    const copy = document.querySelector("#whale-bucket-copy");

    navigator.clipboard.writeText(field.value).then(() => {

        if (copy) {

            copy.textContent = "✅ 복사했습니다";

            window.setTimeout(() => {
                copy.textContent = "🔗 링크 복사";
            }, 2000);

        }

    }).catch(() => {

        field.select();
        window.alert("자동 복사가 막혀 있습니다.\n주소가 선택되었으니 Ctrl+C 를 눌러주세요.");

    });

}

const copyButton = document.querySelector("#whale-bucket-copy");

if (copyButton) {
    copyButton.addEventListener("click", copyLink);
}

const restartButton = document.querySelector("#whale-bucket-restart");

if (restartButton) {

    restartButton.addEventListener("click", () => {

        const ask = "새로운 게임이 열렸군요! 캐릭터 배정을 다시 시작할까요?\n\n"
            + "[확인]을 누르면 지난 링크는 더 이상 쓸 수 없습니다.";

        if (!window.confirm(ask)) {
            return;
        }

        if (pollTimer) {
            window.clearInterval(pollTimer);
            pollTimer = null;
        }

        session = null;
        latestState = null;
        counterOpen = false;

        try {
            window.localStorage.removeItem(STORAGE_KEY);
        } catch (ignore) {
            // 저장소를 못 쓰면 그냥 넘어간다.
        }

        // 화면을 처음 상태로 되돌린다.
        const status = document.querySelector("#whale-bucket-status");
        const create = document.querySelector("#whale-bucket-create");
        const wrap = document.querySelector("#whale-bucket-link-wrap");
        const stage = document.querySelector("#whale-bucket-stage");
        const roster = document.querySelector("#whale-bucket-roster");
        const count = document.querySelector("#whale-bucket-count");

        if (status) {
            status.textContent = "아직 게임 방을 만들지 않았습니다.";
        }

        if (create) {
            create.hidden = false;
            create.disabled = false;
            create.textContent = "게임 방 만들기";
        }

        if (copyButton) {
            copyButton.hidden = true;
        }

        restartButton.hidden = true;

        if (wrap) {
            wrap.hidden = true;
        }

        if (stage) {
            stage.hidden = true;
        }

        if (roster) {
            roster.textContent = "";
        }

        if (count) {
            count.textContent = "0";
        }

    });

}
