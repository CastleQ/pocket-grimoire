import Observer from "../classes/Observer.js";
import NightOrder from "../classes/NightOrder.js";
import CharacterToken from "../classes/CharacterToken.js";
import TokenStore from "../classes/TokenStore.js";
import officialNightOrder from "../../data/night-order.json";
import {
    NIGHT_INFO_STEPS,
    normaliseInfoName,
    buildOrderLookup,
    resolveInfoOrders,
    pickInfoOrder
} from "../utils/night-info.js";
import {
    lookupOne,
    lookupOneCached,
    announceInput,
} from "../utils/elements.js";
import {
    debounce,
} from "../utils/functions.js";

const gameObserver = Observer.create("game");
const tokenObserver = Observer.create("token");
const nightOrder = new NightOrder();
const pad = lookupOneCached(".js--pad").pad;

nightOrder.setHolders({
    first: lookupOneCached("#first-night"),
    other: lookupOneCached("#other-nights")
});

/**
 * 하수인·악마 정보를 밤 순서 목록에 끼워 넣는다.
 *
 * 시트가 이 항목을 캐릭터로 직접 넣어 두었다면 제작자의 뜻이므로 손대지 않는다.
 * 자리는 시트가 `_meta.firstNight` 에 적어 둔 순서를 먼저 따르고, 적혀 있지
 * 않으면 공식 순번표를 기준으로 정한다.
 *
 * @param {Array.<CharacterToken>} characters
 *        밤 순서에 올라간 캐릭터 목록.
 * @param {Object|null} meta
 *        시트의 `_meta` 정보. 없을 수 있다.
 */
function addNightInfoSteps(characters, meta) {

    // 시트가 이 항목을 직접 넣어 두는 방식은 두 가지다. ID를 그대로 쓰는 경우와,
    // 홈브류 캐릭터로 만들면서 이름만 "하수인 정보"로 붙이는 경우(예: 내장 시트
    // "7번 시트의 발라드"). 둘 다 확인해야 항목이 두 번 나오지 않는다.
    const presentIds = new Set(
        characters.map((character) => TokenStore.normaliseId(character.getId()))
    );
    const presentNames = new Set(
        characters.map((character) => normaliseInfoName(character.getName()))
    );
    const missing = NIGHT_INFO_STEPS.filter(({ id, name }) => (
        !presentIds.has(id) && !presentNames.has(normaliseInfoName(name))
    ));

    if (!missing.length) {
        return;
    }

    const lookup = buildOrderLookup(characters.map((character) => ({
        id: character.getId(),
        order: character.getFirstNight()
    })));
    const declaredOrders = resolveInfoOrders(
        meta && Array.isArray(meta.firstNight) ? meta.firstNight : null,
        lookup
    );
    const officialOrders = resolveInfoOrders(
        officialNightOrder.firstNight,
        lookup
    );

    missing.forEach((info) => {

        const token = new CharacterToken({
            id: info.id,
            name: info.name,
            team: info.team,
            image: __webpack_public_path__ + `img/icons/${info.team}.webp`,
            firstNight: pickInfoOrder(info, declaredOrders, officialOrders),
            firstNightReminder: info.reminder,
            otherNight: 0,
            otherNightReminder: ""
        });

        nightOrder.setCharacter(token);

        // 이 항목은 누가 뽑히든 상관없이 늘 진행되므로, "판에 올라와 있고 살아
        // 있는" 상태로 표시해 "참여 중인 캐릭터만 보기"에서도 사라지지 않게 한다.
        const data = nightOrder.getData(token);

        nightOrder.adjustInPlay(data, 1);
        nightOrder.adjustAlive(data, 1);

    });

}

gameObserver.on("characters-selected", ({ detail }) => {

    const characters = detail.characters.filter((character) => {
        return ![
            "traveller",
            "fabled",
            "loric"
        ].includes(character.getTeam());
    });

    nightOrder.reset();
    nightOrder.setCharacters(characters);
    addNightInfoSteps(characters, detail.meta);
    nightOrder.drawAllNightOrders();

});

// #145 - Show the "First Night" order after clearing the grimoire.
gameObserver.on("clear", () => {
    lookupOneCached(".js--night-order--carousel").scrollLeft = 0;
});

// #171 - Keep track of the visible night order between refreshes.
const carousel = lookupOneCached(".js--night-order--carousel");
const carouselParent = carousel.parentElement;
const nightOrderCheckbox = lookupOneCached("#night-order-swiped");
carousel.addEventListener("scroll", debounce(({ target }) => {

    const wasChecked = nightOrderCheckbox.checked;

    nightOrderCheckbox.checked = (
        target.scrollLeft === carouselParent.offsetWidth
    );

    if (nightOrderCheckbox.checked !== wasChecked) {
        announceInput(nightOrderCheckbox);
    }

}), { passive: true });
nightOrderCheckbox.addEventListener("input", () => {

    carousel.scrollLeft = (
        nightOrderCheckbox.checked
        ? carouselParent.offsetWidth
        : 0
    );

});

// TODO: Travellers and Fabled should be unique, it should only be possible to
// add 1 of each. Add that limitation so we don't need to count them anymore.
const specialRoles = {
    traveller: Object.create(null),
    fabled: Object.create(null),
    loric: Object.create(null)
}

tokenObserver.on("character-add", ({ detail }) => {

    const {
        character
    } = detail;
    const team = character.getTeam();

    // #155 - If we have a traveller or a fabled, add it to the night order.
    if (specialRoles[team]) {

        const id = character.getId();

        if (!specialRoles[team][id]) {
            specialRoles[team][id] = 0;
        }

        specialRoles[team][id] += 1;

        nightOrder.setCharacter(character);
        nightOrder.placeInOrder(character);

    }

    // #131 - check the character isn't from the previous script.
    if (!nightOrder.hasCharacter(character)) {
        return;
    }

    nightOrder.addCharacter(character);

});

tokenObserver.on("character-remove", ({ detail }) => {

    const {
        character
    } = detail;
    const team = character.getTeam();

    // #155 - If we're removing a fabled or traveller, remove them if necessary.
    if (specialRoles[team]) {

        const id = character.getId();

        if (specialRoles[team][id]) {

            specialRoles[team][id] -= 1;

            if (specialRoles[team][id] <= 0) {

                nightOrder.unsetCharacter(character);
                delete specialRoles[team][id];

            }

        }

    }

    // #131 - check the character isn't from the previous script.
    if (!nightOrder.hasCharacter(character)) {
        return;
    }

    nightOrder.removePlayerName(character, detail.token);
    nightOrder.removeCharacter(character);

});

tokenObserver.on("shroud-toggle", ({ detail }) => {

    // #131 - check the character isn't from the previous script.
    if (!nightOrder.hasCharacter(detail.character)) {
        return;
    }

    nightOrder.toggleDead(detail.character, detail.isDead);

    if (detail.isDead) {
        nightOrder.removePlayerName(detail.character, detail.token);
    } else {

        nightOrder.setPlayerName(
            detail.character,
            detail.token,
            pad.getPlayerName(detail.character)
        );

    }

});

tokenObserver.on("set-player-name", ({ detail }) => {

    if (!nightOrder.hasCharacter(detail.character) || detail.character.isDead) {
        return;
    }

    nightOrder.setPlayerName(detail.character, detail.token, detail.name);

});

const showDead = lookupOne("#show-dead");

showDead.addEventListener("change", ({ target }) => {

    const showDead = target.checked;

    nightOrder.setShowDead(showDead);
    gameObserver.trigger("night-order-show-dead", {
        showDead
    });

});

lookupOne("#show-all").addEventListener("change", ({ target }) => {

    const showAll = target.checked;

    nightOrder.setShowNotInPlay(showAll);
    gameObserver.trigger("night-order-show-all", {
        showAll
    });

    // Showing all characters not in play but hiding the dead can seem
    // confusing. This forces "show dead" to be true when showing all, although
    // the user can hide the dead seperately.
    if (showAll && !showDead.checked) {

        showDead.checked = true;
        announceInput(showDead);

    }

});
