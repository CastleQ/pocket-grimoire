// 시트 제작자가 만든 위키 (public/scripts/sheet-wikis.json)
//   [{ "sheet": "파일", "name": "시트 이름(_meta.name)", "url": "위키 주소", "ids": ["캐릭터 id", ...] }]
//
// - 그 시트를 불러온 상태에서는 보라색 Wiki 버튼이 모두 이 위키로 간다(공식 위키로 가지 않음).
//   목록의 캐릭터는 위키의 캐릭터 위치(#id), 그 밖(전설·설화 등 공식 캐릭터, 메뉴 버튼)은 위키 첫 화면.
// - 뽑기 화면(public/claim.html)도 같은 파일을 읽는다(캐릭터 id 기준).
import Observer from "../classes/Observer.js";
import TokenStore from "../classes/TokenStore.js";

const scriptsBase = (typeof URLS !== "undefined" && URLS.scriptsBase) || "/scripts/";

let entries = [];
let currentUrl = "";
let currentName = "";

function findByName(name) {
    return entries.find((entry) => entry.name === name) || null;
}

export const sheetWikiReady = fetch(scriptsBase + "sheet-wikis.json", { cache: "no-cache" })
    .then((response) => (response.ok ? response.json() : []))
    .catch(() => [])
    .then((list) => {

        entries = (Array.isArray(list) ? list : []).filter((entry) => (
            entry
            && typeof entry.url === "string"
            && entry.url.startsWith("https://")
            && Array.isArray(entry.ids)
        )).map((entry) => ({
            name: typeof entry.name === "string" ? entry.name : "",
            url: entry.url,
            ids: entry.ids.map((id) => TokenStore.normaliseId(String(id))),
            rawIds: entry.ids.map(String)
        }));

        // 목록이 시트 선택보다 늦게 도착했을 때를 위해 다시 맞춘다.
        const entry = findByName(currentName);
        currentUrl = entry ? entry.url : "";

    });

Observer.create("game").on("characters-selected", ({ detail }) => {

    const meta = detail && detail.meta;

    currentName = (meta && typeof meta.name === "string" && meta.name)
        || (detail && detail.name)
        || "";

    const entry = findByName(currentName);
    currentUrl = entry ? entry.url : "";

});

/**
 * 지금 불러온 시트에 제작자 위키가 있으면 그 주소, 없으면 "".
 *
 * @return {String}
 */
export function getCurrentSheetWiki() {
    return currentUrl;
}

/**
 * 캐릭터 id 가 제작자 위키 목록에 있으면 그 캐릭터 위치 주소(#id), 없으면 "".
 *
 * @param  {String} id
 * @return {String}
 */
export function getSheetWikiForCharacter(id) {

    const key = TokenStore.normaliseId(String(id || ""));
    let url = "";

    entries.some((entry) => {

        const index = entry.ids.indexOf(key);

        if (index !== -1) {
            url = entry.url + "#" + encodeURIComponent(entry.rawIds[index]);
        }

        return Boolean(url);

    });

    return url;

}
