// 커스텀 스크립트 아카이브 (N-1)
// 직접 입력(URL/파일/붙여넣기)된 시트를 "불러오는 즉시" Supabase에 저장한다.
//
// 설계:
//   - 내장 19종 시트는 수집하지 않는다 (이미 리포에 있음).
//   - 온라인 배포를 쓰지 않고 오프라인으로만 진행하는 경우도 수집되도록
//     배포 시점이 아니라 로드 시점에 저장한다.
//   - 같은 내용은 서버 함수가 중복 없이 play_count 만 올린다.
//   - 같은 시트를 한 세션에서 여러 번 다시 불러도 한 번만 전송한다.
//   - 아카이브 실패는 절대 시트 로드를 방해하지 않는다.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";

// 이 페이지에서 이미 전송한 해시. 같은 시트를 반복 로드해도 중복 전송하지 않는다.
const sentHashes = new Set();

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
 * 직접 입력된 커스텀 시트를 Supabase에 저장한다.
 * 시트를 불러오는 즉시 호출하며, 실패해도 예외를 던지지 않는다.
 *
 * @param  {Array.<Object>} json 사용자가 입력한 원본 시트 JSON.
 * @return {Promise} 항상 resolve 되는 Promise.
 */
export function archiveCustomScript(json) {

    if (!Array.isArray(json) || !json.length) {
        return Promise.resolve();
    }

    let text = "";
    let hash = "";
    let meta = { name: "", author: "" };
    let characterCount = 0;

    try {

        text = JSON.stringify(json);
        hash = hashText(text);
        meta = readMeta(json);
        characterCount = json.filter((item) => (
            item
            && typeof item === "object"
            && item.id !== "_meta"
        )).length;

    } catch (ignore) {
        return Promise.resolve();
    }

    // 서버가 1MB 초과를 거부하므로 미리 걸러 불필요한 요청을 줄인다.
    if (!hash || text.length > 1000000) {
        return Promise.resolve();
    }

    // 같은 페이지에서 같은 시트를 다시 불러온 경우는 전송하지 않는다.
    if (sentHashes.has(hash)) {
        return Promise.resolve();
    }

    sentHashes.add(hash);

    return fetch(SUPABASE_URL + "/rest/v1/rpc/save_custom_script", {
        method: "POST",
        headers: {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": "Bearer " + SUPABASE_ANON_KEY,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            p_hash: hash,
            p_name: meta.name,
            p_author: meta.author,
            p_char_count: characterCount,
            p_json: json
        })
    }).catch(() => {
        // 아카이브 실패는 시트 로드에 영향을 주지 않는다.
    });

}