// 마도서 가운데 인원 현황 (타투처럼 박히는 표시, 조작 없음)
// 윗줄: 전체 인원 / 생존 인원 / 남은 유령표
// 아랫줄: 인원별 고정 구성 (주민 / 외지인 / 하수인 / 악마)
//
// 기준 인원은 "캐릭터 뽑기"·"모두 추가"·"캐릭터 나눠주기" 시점의 플레이어 수를
// 저장해 쓴다. 마도서 지우기 또는 캐시 삭제(토큰 지우기)로 사라진다.
import Observer from "../../classes/Observer.js";
import Store from "../../classes/Store.js";
import {
    lookupOne,
    lookupOneCached
} from "../../utils/elements.js";
import {
    clamp
} from "../../utils/numbers.js";

const gameObserver = Observer.create("game");
const tokenObserver = Observer.create("token");
const store = Store.create("pocket-grimoire");
const pad = lookupOneCached(".js--pad").pad;
const tally = lookupOne("#grimoire-tally");

// 전설·로릭은 플레이어가 아니므로 셈에서 뺀다.
const NON_PLAYER_TEAMS = ["fabled", "loric"];
const TEAMS = ["townsfolk", "outsider", "minion", "demon"];

let breakdowns = [];

function render() {

    const total = store.getTally();

    if (!tally || !total) {

        if (tally) {
            tally.hidden = true;
        }

        return;

    }

    let dead = 0;
    let ghostVotes = 0;

    pad.characters.forEach(({ character }) => {

        if (NON_PLAYER_TEAMS.includes(character.getTeam())) {
            return;
        }

        if (character.getIsDead()) {

            dead += 1;

            if (character.getHasGhostVote()) {
                ghostVotes += 1;
            }

        }

    });

    tally.querySelector("[data-tally=\"total\"]").textContent = total;
    tally.querySelector("[data-tally=\"alive\"]").textContent = Math.max(0, total - dead);
    tally.querySelector("[data-tally=\"ghost\"]").textContent = ghostVotes;

    // 인원별 구성표는 5~15인. 15인을 넘는 만큼은 여행자라 15인 구성을 쓴다
    // (캐릭터 선택 화면의 getBreakdown()과 같은 계산).
    const breakdown = breakdowns.length
        ? breakdowns[clamp(0, total - 5, breakdowns.length - 1)]
        : null;
    const teamsRow = tally.querySelector(".js--tally--teams");

    teamsRow.hidden = !breakdown;

    if (breakdown) {

        TEAMS.forEach((team) => {
            tally.querySelector(`[data-tally="${team}"]`).textContent = (
                breakdown[team] || 0
            );
        });

    }

    tally.hidden = false;

}

function setTotal(count) {

    store.setTally(Math.max(0, Number(count) || 0));
    render();

}

function setFromPlayerCount() {
    setTotal(lookupOneCached("#player-count").value);
}

gameObserver.on("team-breakdown-loaded", ({ detail }) => {

    breakdowns = Array.isArray(detail.breakdown) ? detail.breakdown : [];
    render();

});

// 캐릭터 뽑기 / 모두 추가
gameObserver.on("character-draw", setFromPlayerCount);

// 캐릭터 나눠주기 (배포 성공 시 distribute.js가 알린다)
gameObserver.on("character-distribute", setFromPlayerCount);

// 마도서 지우기 (전설 제거 / 전설 유지 두 경로 모두)
gameObserver.on("clear", () => setTotal(0));
gameObserver.on("tally-reset", () => setTotal(0));

// 캐시 삭제 뒤 저장값을 다시 읽는다 (토큰 지우기에 함께 지워짐).
gameObserver.on("cache-cleared", render);

// 생존·유령표는 토큰 상태가 바뀔 때마다 다시 센다.
[
    "character-add",
    "character-remove",
    "shroud-toggle",
    "ghost-vote-toggle"
].forEach((eventName) => tokenObserver.on(eventName, render));

render();
