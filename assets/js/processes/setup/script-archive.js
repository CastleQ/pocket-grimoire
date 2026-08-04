// 커스텀 스크립트 아카이브 (N-1)
// 직접 입력(URL/파일/붙여넣기)된 시트를 "실제 배포 시점"에 Supabase에 저장한다.
//
// 설계:
//   - 내장 19종 시트는 수집하지 않는다 (이미 리포에 있음).
//   - 시트를 고를 때는 "예약"만 하고, 배포 버튼을 눌렀을 때 비로소 전송한다.
//     (구경만 하고 안 논 시트를 수집하지 않기 위함)
//   - 같은 내용은 서버 함수가 중복 없이 play_count만 올린다.
//   - 아카이브 실패는 절대 배포를 방해하지 않는다.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";

const PENDING_KEY = "pg_pending_archive";

/**
 * 문자열의 지문(해시)을 만든다. 같은 내용이면 같은 값, 한 글자만 달라도 다른 값.
 * FNV-1a 계열 32비트 해시를 서로 다른 방식으로 두 번 돌리고 길이를 덧붙여
 * 서로 다른 시트가 같은 지문을 갖는 일을 실질적으로 방지한다.
 *
 * @param  {String} text 해시할 문자열.
 * @return {String} 지문 문자열.
 */
function hashText(text) {

    let hash1 = 0x811c9dc5;
    let hash2 = 0x01000193;

    for (let index = 0; index < text.length; index += 1) {

        const code = text.charCodeAt(index);

        hash1 ^= code;
        hash1 = Math.imul(hash1, 0x01000193) >>> 0;

        hash2 ^= code + index;
        hash2 = Math.imul(hash2, 0x85ebca6b) >>> 0;

    }

    const part1 = ("00000000" + hash1.toString(16)).slice(-8);
    const part2 = ("00000000" + hash2.toString(16)).slice(-8);

    return part1 + part2 + "-" + text.length;

}

/**
 * _meta 항목에서 이름과 작성자를 읽는다. 원본 배열은 수정하지 않는다.
 *
 * @param  {Array.<Object>} json 시트 JSON.
 * @return {Object} name 과 author 를 가진 객체.
 */
function readMeta(json) {

    const meta = json.find((item) => (
        item
        && typeof item === "object"
        && item.id === "_meta"
    ));

    return {
        name: (meta && typeof meta.name === "string")
            ? meta.name
            : "",
        author: (meta && typeof meta.author === "string")
            ? meta.author
            : ""
    };

}

/**
 * 배포 시 저장할 시트를 예약해 둔다. 이 시점에는 전송하지 않는다.
 * 직접 입력된 시트에 대해서만 호출해야 한다.
 *
 * @param {Array.<Object>} json 사용자가 입력한 원본 시트 JSON.
 */
export function rememberCustomScript(json) {

    if (!Array.isArray(json) || !json.length) {

        forgetCustomScript();
        return;

    }

    try {

        const text = JSON.stringify(json);
        const meta = readMeta(json);
        const characterCount = json.filter((item) => (
            item
            && typeof item === "object"
            && item.id !== "_meta"
        )).length;

        window.localStorage.setItem(PENDING_KEY, JSON.stringify({
            hash: hashText(text),
            name: meta.name,
            author: meta.author,
            characterCount,
            json
        }));

    } catch (ignore) {
        // localStorage 사용 불가 또는 직렬화 실패 시 아카이브를 포기한다.
    }

}

/**
 * 예약을 지운다. 내장 시트를 고른 경우처럼 수집 대상이 아닐 때 호출한다.
 */
export function forgetCustomScript() {

    try {
        window.localStorage.removeItem(PENDING_KEY);
    } catch (ignore) {
        // 무시한다.
    }

}

/**
 * 예약된 시트를 Supabase에 저장한다. 배포 시점에 호출한다.
 * 실패해도 예외를 던지지 않는다.
 *
 * @return {Promise} 항상 resolve 되는 Promise.
 */
export function archivePendingScript() {

    let pending = null;

    try {

        const raw = window.localStorage.getItem(PENDING_KEY);

        if (!raw) {
            return Promise.resolve();
        }

        pending = JSON.parse(raw);

    } catch (ignore) {
        return Promise.resolve();
    }

    if (!pending || !pending.hash || !pending.json) {
        return Promise.resolve();
    }

    return fetch(SUPABASE_URL + "/rest/v1/rpc/save_custom_script", {
        method: "POST",
        headers: {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": "Bearer " + SUPABASE_ANON_KEY,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            p_hash: pending.hash,
            p_name: pending.name || "",
            p_author: pending.author || "",
            p_char_count: pending.characterCount || 0,
            p_json: pending.json
        })
    }).catch(() => {
        // 아카이브 실패는 배포에 영향을 주지 않는다.
    });

}