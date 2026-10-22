// 이야기꾼 이름 — [캐릭터 나눠주기] 때 적는다.
// 뽑기 화면 첫 화면에 "OO 님의 게임입니다"로 보여 주어, 여러 지역에서 동시에 열린 게임의
// 링크를 잘못 눌러 다른 게임의 캐릭터를 뽑는 일을 막는다.
// 한 번 적은 이름은 이 기기에 기억해 다음 게임 때 미리 채운다. [캐시 삭제]를 하면 지운다.
const KEY = "pg_storyteller_name";

export const STORYTELLER_NAME_MAX = 20;

/**
 * 앞뒤 공백을 지우고 최대 길이로 자른다.
 *
 * @param  {String} value
 * @return {String}
 */
export function cleanStorytellerName(value) {
    return String(value || "").trim().slice(0, STORYTELLER_NAME_MAX);
}

/**
 * 기억해 둔 이름. 없으면 "".
 *
 * @return {String}
 */
export function getStorytellerName() {

    try {
        return cleanStorytellerName(window.localStorage.getItem(KEY));
    } catch (ignore) {
        return "";
    }

}

/**
 * 이름을 기억한다.
 *
 * @param {String} name
 */
export function setStorytellerName(name) {

    try {
        window.localStorage.setItem(KEY, cleanStorytellerName(name));
    } catch (ignore) {
        // 저장소를 못 쓰면 다음에 다시 적으면 된다.
    }

}

/**
 * 기억해 둔 이름을 지운다 ([캐시 삭제]).
 */
export function clearStorytellerName() {

    try {
        window.localStorage.removeItem(KEY);
    } catch (ignore) {
        // 저장소를 못 쓰면 지울 것도 없다.
    }

}
