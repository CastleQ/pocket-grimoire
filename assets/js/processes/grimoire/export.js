// 마도서 [게임 내보내기] — 참가자용 마도서 링크를 만든다.
//
// 링크 = 지금 주소 + ?play=<시트 번호>&g=<자리 정보>
// - 시트는 [시트 공유]와 같은 장부(save_shared_sheet)에 올리고 번호만 담는다.
// - 자리 정보는 참가자 이름과 접시 위치(판 크기 대비 비율)뿐이다.
//   캐릭터·알림 토큰은 담지 않는다 → 링크가 새도 정보가 새지 않는다.
// 받는 쪽은 utils/play-mode.js + processes/play-mode.js.
import {
    buildSheetPayload
} from "../setup/character-sheet.js";
import {
    saveSharedSheet,
    copyLink,
    showResult
} from "../setup/sheet-share.js";
import {
    lookupOne,
    lookupOneCached
} from "../../utils/elements.js";
import Observer from "../../classes/Observer.js";

const gameObserver = Observer.create("game");

// 참가자가 아닌 토큰(전설·로릭)은 자리로 치지 않는다.
const NON_PLAYER_TEAMS = ["fabled", "loric"];

function round(value) {
    return Math.round(value * 1000) / 1000;
}

/**
 * 마도서 위 참가자 접시들의 이름과 위치(0~1 비율).
 *
 * @return {{r: Number, p: Array.<Array>}}
 */
function readSeats() {

    const pad = lookupOneCached(".js--pad").pad;
    const { width, height } = pad.getPadDimensions();
    const token = pad.getTokenDimensions();
    const roomX = Math.max(1, width - token.width);
    const roomY = Math.max(1, height - token.height);

    return {
        r: round(height / Math.max(1, width)),
        p: pad.characters
            .filter(({ character }) => !NON_PLAYER_TEAMS.includes(character.getTeam()))
            .map(({ character, token: element }) => {

                const { x, y } = pad.getTokenPosition(element);

                return [
                    pad.getPlayerName(character) || "",
                    round(x / roomX),
                    round(y / roomY)
                ];

            })
    };

}

const button = lookupOne("#export-make");
const result = lookupOne("#export-result");

// 마도서 가운데 [게임 시작하기]: 링크를 한 번 만들면 숨기고, 새 게임(시트 바꾸기·마도서 지우기)에서 다시 보인다.
// 메뉴의 [게임 내보내기]와 같은 창을 연다(data-dialog). 새로고침해도 숨긴 상태를 기억한다.
const START_KEY = "pg_game_link_made";
const startButton = lookupOne("#start-game");

function setLinkMade(made) {

    startButton.hidden = made;

    try {
        if (made) {
            window.localStorage.setItem(START_KEY, "1");
        } else {
            window.localStorage.removeItem(START_KEY);
        }
    } catch (ignore) {
        // 저장 공간을 못 쓰면 새로고침 때 버튼이 다시 보일 뿐이다.
    }

}

try {
    startButton.hidden = window.localStorage.getItem(START_KEY) === "1";
} catch (ignore) {
    startButton.hidden = false;
}

["sheet-change", "clear"].forEach((eventName) => {
    gameObserver.on(eventName, () => setLinkMade(false));
});

button.addEventListener("click", () => {

    const payload = buildSheetPayload();

    if (!payload.characters || !payload.characters.length) {
        showResult(result, "먼저 [준비]에서 시트를 골라 주세요.", "");
        return;
    }

    const seats = readSeats();

    if (!seats.p.length) {
        showResult(result, "마도서에 참가자 접시가 없습니다. 캐릭터 토큰을 먼저 놓아 주세요.", "");
        return;
    }

    button.disabled = true;
    showResult(result, "링크 만드는 중…", "");

    saveSharedSheet(payload).then((token) => {

        const url = new URL(window.location.href);

        url.search = "";
        url.hash = "";
        url.searchParams.set("play", token);
        url.searchParams.set("g", JSON.stringify(seats));

        const link = url.toString();

        setLinkMade(true);

        return copyLink(link).then((copied) => showResult(
            result,
            copied
                ? "✅ 링크가 복사되었습니다. 단톡방에 붙여 넣어 주세요."
                : "아래 주소를 길게 눌러 복사해 주세요.",
            link
        ));

    }).catch((error) => {
        showResult(result, "링크를 만들지 못했습니다: " + error.message, "");
    }).then(() => {
        button.disabled = false;
    });

});
