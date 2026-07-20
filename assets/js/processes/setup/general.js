import Pad from "../../classes/Pad.js";
import Positioner from "../../classes/Positioner.js";
import Observer from "../../classes/Observer.js";
import ReminderToken from "../../classes/ReminderToken.js";
import Dialog from "../../classes/Dialog.js";
import TokenStore from "../../classes/TokenStore.js";
import {
    lookup,
    lookupOne,
    lookupOneCached,
    replaceContentsMany
} from "../../utils/elements.js";

const gameObserver = Observer.create("game");
const tokenObserver = Observer.create("token");

const padElement = lookupOneCached(".js--pad");
const pad = new Pad(padElement, tokenObserver);
padElement.pad = pad;

const styleObserver = new MutationObserver((mutations) => {

    gameObserver.trigger("pad-height-change", {
        height: mutations[0].target.style.height
    });

});

styleObserver.observe(padElement, {
    attributes: true,
    attributeFilter: ["style"]
});

// If the elements are within a closed <details> element then their height and
// width will be 0. Listen for the pad becoming visible and update the class.
lookup("details").forEach((details) => {

    details.addEventListener("toggle", () => {
        pad.updateDimensions();
    });

});

gameObserver.on("characters-selected", ({ detail }) => {

    const characters = detail.characters.filter((character) => {
        const team = character.getTeam();
        return team !== "traveller" && team !== "fabled" && team !== "loric";
    });

    replaceContentsMany(
        lookupOneCached("#character-list__list"),
        characters.map((character) => character.drawList())
    );

    const reminders = characters.reduce((reminders, character) => {
        return reminders.concat(character.getReminders());
    }, ReminderToken.getGlobal());

    replaceContentsMany(
        lookupOneCached("#reminder-list__list"),
        reminders.map((reminder) => reminder.drawList())
    );

    lookupOneCached("#add-token").disabled = false;
    lookupOneCached("#add-reminder").disabled = false;
    lookupOneCached("#show-tokens").disabled = false;

});

gameObserver.on("character-drawn", ({ detail }) => {
    pad.addNewCharacter(detail.character);
});

lookupOne("#show-night-order").addEventListener("change", ({ target }) => {

    padElement.style[
        target.checked
        ? "removeProperty"
        : "setProperty"
    ]("--night-order-display", "none");

});

// 토큰 잠금 (작업 6): 마도서 헤더의 스위치로 모든 토큰(캐릭터·리마인더)의 드래그
// 이동을 막는다. 클릭(다이얼로그 열기)은 그대로 동작한다.
const lockToggle = lookupOne("#lock-tokens");

if (lockToggle) {

    lockToggle.addEventListener("change", ({ target }) => {
        pad.tokens.setLocked(target.checked);
    });

    // 스위치 컨테이너(노브/텍스트/여백 어디든) 클릭 시 잠금을 토글한다.
    // 하위 요소는 CSS로 pointer-events:none 처리돼 클릭 대상이 항상 이 컨테이너가
    // 되므로, 작은 노브를 정확히 누르지 않아도 동작한다. 마도서(details) 접힘은 막고
    // 체크 상태만 직접 토글한다(네이티브 토글과 겹쳐 상쇄되는 문제도 방지).
    const lockAside = lockToggle.closest(".details__summary-aside");

    if (lockAside) {
        lockAside.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            lockToggle.checked = !lockToggle.checked;
            lockToggle.dispatchEvent(new Event("change", { bubbles: true }));
        });
    }

    // 게임 중 새 토큰(캐릭터·리마인더)이 추가되면 잠금을 자동 해제한다.
    // (추가 직후 자연스럽게 옮기는 흐름이므로, 수동으로 잠금을 끄는 동작을 없앤다.)
    // 잠긴 상태일 때만 해제하며, change 이벤트로 기존 핸들러를 재사용해 상태를 동기화한다.
    // 교체(replace)는 tokenObserver.suppressAutoUnlock 플래그로 제외한다(순수 추가만 해제).
    ["character-add", "reminder-add"].forEach((eventName) => {
        tokenObserver.on(eventName, () => {
            if (tokenObserver.suppressAutoUnlock) {
                return;
            }
            if (lockToggle.checked) {
                lockToggle.checked = false;
                lockToggle.dispatchEvent(new Event("change", { bubbles: true }));
            }
        });
    });

}

gameObserver.on("clear", () => pad.reset());

// Character and Reminder token sizes.

const html = document.documentElement;

lookupOne("#token-size").addEventListener("input", ({ target }) => {
    html.style.setProperty("--token-size", target.value);
});

lookupOne("#reminder-size").addEventListener("input", ({ target }) => {
    html.style.setProperty("--reminder-size", target.value);
});

// Token auto-placements.

pad.setPositioner(new Positioner());

const tokenLayout = lookupOne("#token-layout");

pad.updatePositioner({
    layout: tokenLayout.value,
    // At this stage, most of the positioner probably hasn't been set up so we'd
    // get a few issues if we try to generate the co-ordinates. Better to just
    // give the positioner some data and generate the co-ordinates later.
    generate: false
});

tokenLayout.addEventListener("change", () => {
    pad.updatePositioner({ layout: tokenLayout.value });
});

gameObserver.on("player-count", ({ detail }) => {
    pad.updatePositioner({ total: detail.count });
});

gameObserver.on("pad-height-change", () => {
    pad.updatePositioner({ container: true });
});

Dialog.create(lookupOneCached("#character-select")).on(Dialog.SHOW, () => {

    const grimoireSection = lookupOneCached("#grimoire");
    const isOpen = grimoireSection.open;

    if (!isOpen) {
        grimoireSection.open = true;
    }

    pad.updatePositioner({
        container: true,
        tokens: true,
        total: lookupOneCached("#player-count").value
    });

    if (!isOpen) {
        grimoireSection.open = false;
    }

});

TokenStore.ready((tokenStore) => {
    pad.setTokenStore(tokenStore);
});