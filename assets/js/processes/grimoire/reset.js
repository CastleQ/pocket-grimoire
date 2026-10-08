import Observer from "../../classes/Observer.js";
import Dialog from "../../classes/Dialog.js";
import {
    lookupOne,
    lookupOneCached
} from "../../utils/elements.js";
import {
    sheetWikiReady,
    getCurrentSheetWiki
} from "../../utils/sheet-wiki.js";

const gameObserver = Observer.create("game");
const pad = lookupOneCached(".js--pad").pad;

// (옛 [패드 높이 초기화] 자리) 공식 캐릭터 도감 사이트를 확인창 후 새 창으로 연다.
// 확인창은 캐릭터 토큰의 [캐릭터 Wiki 바로가기]와 같은 것(characters.js 가 [확인] 처리).
const WIKI_SITE_URL = "https://castleq.github.io/botc-wiki-ko/";

// 제작자 위키가 있는 시트(점소이 등)를 불러온 상태에서는 공식 도감 대신 그 위키 첫 화면으로 간다.
lookupOne("#reset-height").addEventListener("click", () => {

    const confirmDialog = Dialog.create(lookupOneCached("#character-wiki-confirm"));

    sheetWikiReady.then(() => {

        const sheetWiki = getCurrentSheetWiki();

        confirmDialog.getElement().dataset.url = sheetWiki || WIKI_SITE_URL;
        lookupOneCached("#character-wiki-subject").textContent = (
            sheetWiki
            ? "이 시트의"
            : "공식"
        );
        confirmDialog.show();

    });

});

lookupOne("#clear-grimoire").addEventListener("click", ({ target }) => {

    if (!window.confirm(target.dataset.confirm)) {
        return;
    }

    const fabled = pad.characters
        .map(({ character }) => character)
        .filter((character) => character.getTeam() === "fabled");

    if (!fabled.length || window.confirm("전설(fabled) 토큰도 제거할까요?")) {
        gameObserver.trigger("clear");
        return;
    }

    // "아니오": 전설 토큰과 그 자리는 남기고, 그 외 캐릭터와 리마인더(전설
    // 자신의 리마인더 포함, 글로벌 여부 상관없이)는 새 게임을 위해 모두 지운다.
    pad.characters
        .map(({ character }) => character)
        .filter((character) => character.getTeam() !== "fabled")
        .forEach((character) => pad.removeCharacter(character));

    pad.reminders
        .map(({ reminder }) => reminder)
        .forEach((reminder) => pad.removeReminder(reminder));

    // 마도서 가운데 인원 현황도 지운다 (tally.js).
    gameObserver.trigger("tally-reset");

});
