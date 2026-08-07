import Observer from "../../classes/Observer.js";
import { lookupOneCached } from "../../utils/elements.js";

/**
 * 캐릭터 시트 열기.
 *
 * 예전에는 캐릭터 목록을 주소에 실어 QR로 넘겼지만, 정적 배포본에는 시트를
 * 그려줄 서버가 없어 404가 났다. 이제는 현재 시트 데이터를 브라우저 저장소에
 * 넣고 새 탭에서 sheet.html 이 그것을 읽어 직접 그린다.
 */

const gameObserver = Observer.create("game");

export const SHEET_STORAGE_KEY = "pg-sheet-data";

let current = {
    name: "",
    meta: null,
    characters: []
};

gameObserver.on("characters-selected", ({ detail }) => {

    current = {
        name: detail.name || "",
        meta: detail.meta || null,
        characters: detail.characters.map((character) => character.getAllData())
    };

    lookupOneCached("#qr-code-button").disabled = false;
    lookupOneCached("#open-sheet").disabled = false;

});

lookupOneCached("#open-sheet").addEventListener("click", () => {

    const payload = {
        name: current.name,
        meta: current.meta,
        characters: current.characters,
        includeTravellers: lookupOneCached("#include-travellers").checked,
        includeFabled: lookupOneCached("#include-fabled").checked,
        savedAt: Date.now()
    };

    try {
        window.localStorage.setItem(SHEET_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
        window.alert("시트 데이터를 저장하지 못했습니다: " + error.message);
        return;
    }

    const url = new URL("sheet.html", window.location.href);
    window.open(url.toString(), "_blank", "noopener");

});
