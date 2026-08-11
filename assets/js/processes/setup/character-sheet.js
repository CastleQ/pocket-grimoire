import Observer from "../../classes/Observer.js";
import { lookupOneCached } from "../../utils/elements.js";
import { initSheetShare } from "./sheet-share.js";

/**
 * 캐릭터 시트 열기.
 *
 * 예전에는 캐릭터 목록을 주소에 실어 QR로 넘겼지만, 정적 배포본에는 시트를
 * 그려줄 서버가 없어 404가 났다. 이제는 현재 시트 데이터를 브라우저 저장소에
 * 넣고 새 탭에서 sheet.html 이 그것을 읽어 직접 그린다.
 *
 * 공유 버튼은 같은 내용을 Supabase 장부에 올리고 짧은 링크를 받아온다.
 */

const gameObserver = Observer.create("game");

export const SHEET_STORAGE_KEY = "pg-sheet-data";

let current = {
    name: "",
    meta: null,
    characters: []
};

/**
 * 지금 화면 설정대로 시트 내용을 만든다.
 *
 * 저장 시각(savedAt)은 넣지 않는다. 넣으면 내용이 같은 시트도 매번 다른
 * 것으로 취급되어 장부에 중복으로 쌓이기 때문이다.
 */
export function buildSheetPayload() {

    return {
        name: current.name,
        meta: current.meta,
        characters: current.characters,
        includeTravellers: lookupOneCached("#include-travellers").checked,
        includeFabled: lookupOneCached("#include-fabled").checked
    };

}

gameObserver.on("characters-selected", ({ detail }) => {

    current = {
        name: detail.name || "",
        meta: detail.meta || null,
        characters: detail.characters.map((character) => character.getAllData())
    };

    lookupOneCached("#qr-code-button").disabled = false;
    lookupOneCached("#open-sheet").disabled = false;

    const shareButton = document.querySelector("#share-sheet");

    if (shareButton) {
        shareButton.disabled = false;
    }

});

lookupOneCached("#open-sheet").addEventListener("click", () => {

    const payload = buildSheetPayload();

    payload.savedAt = Date.now();

    try {
        window.localStorage.setItem(SHEET_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
        window.alert("시트 데이터를 저장하지 못했습니다: " + error.message);
        return;
    }

    const url = new URL("sheet.html", window.location.href);
    window.open(url.toString(), "_blank", "noopener");

});

initSheetShare(buildSheetPayload);