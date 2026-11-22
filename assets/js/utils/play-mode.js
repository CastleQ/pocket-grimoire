// 참가자용 마도서 (주소 ?play=<시트 번호>&g=<자리 정보>)
//
// 이야기꾼이 [게임 내보내기]로 만든 링크를 참가자가 열면 같은 앱이 "참가자 모드"로 뜬다.
// - 저장 칸을 따로 쓴다(STORE_KEY). 그 폰에 있던 이야기꾼 마도서를 덮어쓰지 않기 위해서다.
// - 처음 여는 링크면 참가자 저장 칸을 비우고 processes/play-mode.js 가 새로 깐다.
//   같은 링크를 다시 열면(새로고침 등) 적어 둔 메모를 그대로 복원한다.
//
// ⚠️ 이 파일은 Store.create 를 부르는 모든 파일보다 먼저 평가돼야 한다.
//    그 파일들이 STORE_KEY 를 이 파일에서 가져오므로 import 순서상 자동으로 지켜진다.

const NAME_MAX = 20;
const SEAT_MAX = 30;
const PLAY_ID_KEY = "pg_play_id";

const params = new URLSearchParams(window.location.search);

export const PLAY_TOKEN = params.get("play") || "";
export const IS_PLAY_MODE = Boolean(PLAY_TOKEN);
export const STORE_KEY = IS_PLAY_MODE ? "pocket-grimoire-play" : "pocket-grimoire";

function clampFraction(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : 0;
}

/**
 * 링크의 자리 정보를 읽는다. 남이 만든 링크라 모양을 하나하나 검사한다.
 * 형식: { r: 판 세로/가로 비율, p: [[이름, 가로 위치(0~1), 세로 위치(0~1)], …] }
 *
 * @param  {String} raw
 * @return {{ratio: Number, seats: Array.<Array>}}
 */
export function parseSeats(raw) {

    let data = null;

    try {
        data = JSON.parse(raw || "null");
    } catch (ignore) {
        data = null;
    }

    const ratio = Number(data && data.r);
    const list = (data && Array.isArray(data.p)) ? data.p.slice(0, SEAT_MAX) : [];

    return {
        ratio: (Number.isFinite(ratio) && ratio > 0.2 && ratio < 5) ? ratio : 0,
        seats: list
            .filter(Array.isArray)
            .map(([name, x, y]) => [
                String(name || "").trim().slice(0, NAME_MAX),
                clampFraction(x),
                clampFraction(y)
            ])
    };

}

export const PLAY_SEATS = IS_PLAY_MODE ? parseSeats(params.get("g")) : parseSeats("");

// 처음 여는 링크인지. 깔기에 성공했을 때만 markPlaySetupDone()으로 기록하므로,
// 도중에 실패하면 다음에 열 때 다시 깐다.
export let PLAY_IS_NEW = false;

if (IS_PLAY_MODE) {

    document.documentElement.classList.add("is-play-mode");

    try {

        if (window.localStorage.getItem(PLAY_ID_KEY) !== window.location.search) {
            window.localStorage.removeItem(STORE_KEY);
            PLAY_IS_NEW = true;
        }

    } catch (ignore) {
        PLAY_IS_NEW = true;
    }

}

export function markPlaySetupDone() {

    try {
        window.localStorage.setItem(PLAY_ID_KEY, window.location.search);
    } catch (ignore) {
        // 저장 공간을 못 쓰면 다음에 열 때 다시 깔 뿐이다.
    }

}
