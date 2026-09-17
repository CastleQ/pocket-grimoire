import Observer from "../../classes/Observer.js";
import {
    lookupOne,
    lookupOneCached
} from "../../utils/elements.js";

const gameObserver = Observer.create("game");
const pad = lookupOneCached(".js--pad").pad;

lookupOne("#reset-height").addEventListener("click", () => {
    lookupOneCached(".js--pad").style.height = "";
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

});
