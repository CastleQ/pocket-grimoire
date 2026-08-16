import Observer from "../classes/Observer.js";
import NightOrder from "../classes/NightOrder.js";
import CharacterToken from "../classes/CharacterToken.js";
import TokenStore from "../classes/TokenStore.js";
import officialNightOrder from "../../data/night-order.json";
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

// 첫날 밤에 고정으로 존재하지만 캐릭터 데이터에는 없는 항목.
// 앱의 캐릭터 목록(characters.json)에 minioninfo / demoninfo 가 아예 없기 때문에
// 밤 순서 목록에서도 조용히 빠진다. 그래서 여기서 직접 만들어 끼워 넣는다.
// defaultOrder 는 기준으로 삼을 이웃을 하나도 못 찾았을 때만 쓰는 최후의 값이며,
// 시트 이미지(sheet.js)의 기본값과 같은 공식 순번이다.
const NIGHT_INFO_STEPS = [
    {
        id: "minioninfo",
        name: "하수인 정보",
        team: "minion",
        defaultOrder: 19,
        reminder: "7명 이상이 플레이 중이라면, 모든 하수인을 깨웁니다. *이 사람이 악마입니다* 토큰을 보여줍니다. 악마를 가리킵니다."
    },
    {
        id: "demoninfo",
        name: "악마 정보",
        team: "demon",
        defaultOrder: 23,
        reminder: "7명 이상이 플레이 중이라면, 악마를 깨웁니다. *이들이 당신의 하수인입니다* 토큰을 보여줍니다. 모든 하수인을 번갈아가며 가리킵니다. *이 캐릭터는 참여하지 않습니다* 토큰을 보여줍니다. 참가중이지 않은 선한 캐릭터 토큰 3개를 보여줍니다."
    }
];

const NIGHT_INFO_IDS = NIGHT_INFO_STEPS.map(({ id }) => id);

nightOrder.setHolders({
    first: lookupOneCached("#first-night"),
    other: lookupOneCached("#other-nights")
});

/**
 * 지금 밤 순서에 올라와 있는 캐릭터들의 "첫날 밤 순번"을 이름표로 정리한다.
 * 시트마다 ID 표기가 조금씩 다르므로(예: "19_out"), 끝의 숫자를 뗀 형태도 함께
 * 등록해 둔다. 이는 sheet.js 가 쓰는 방식과 같다.
 *
 * @param  {Array.<CharacterToken>} characters
 *         밤 순서에 올라간 캐릭터 목록.
 * @return {Map}
 *         정규화한 ID → 첫날 밤 순번.
 */
function buildOrderLookup(characters) {

    const lookup = new Map();

    characters.forEach((character) => {

        const order = Number(character.getFirstNight());

        if (!(order > 0)) {
            return;
        }

        const key = TokenStore.normaliseId(character.getId());

        if (!lookup.has(key)) {
            lookup.set(key, order);
        }

        const stripped = key.replace(/\d+$/, "");

        if (stripped && !lookup.has(stripped)) {
            lookup.set(stripped, order);
        }

    });

    return lookup;

}

/**
 * 이름을 견주기 좋게 다듬는다. 띄어쓰기만 다른 "하수인 정보"와 "하수인정보"를
 * 같은 것으로 보기 위해서다.
 *
 * @param  {String} name
 *         캐릭터 이름.
 * @return {String}
 *         공백을 없앤 이름.
 */
function nameKey(name) {
    return String(name || "").replace(/\s+/g, "");
}

/**
 * 밤 순서 목록의 항목 하나가 지금 몇 번 순번인지 찾는다.
 *
 * @param  {String} key
 *         정규화한 ID.
 * @param  {Map} lookup
 *         {@link buildOrderLookup} 가 만든 이름표.
 * @return {Number|null}
 *         찾은 순번. 그 캐릭터가 지금 없으면 null.
 */
function lookupOrder(key, lookup) {

    if (lookup.has(key)) {
        return lookup.get(key);
    }

    const stripped = key.replace(/\d+$/, "");

    if (stripped && lookup.has(stripped)) {
        return lookup.get(stripped);
    }

    return null;

}

/**
 * 순서가 적힌 목록을 훑어, 하수인·악마 정보가 들어갈 자리의 순번을 계산한다.
 *
 * 정보 항목 앞뒤로 "지금 실제로 있는" 캐릭터를 찾아 그 사이를 균등하게 나눈다.
 * 예를 들어 앞이 19번, 뒤가 22번이고 그 사이에 정보 항목이 하나라면 20.5번이
 * 된다. 소수점을 쓰는 이유는 기존 캐릭터의 번호를 건드리지 않고 사이에 끼우기
 * 위해서다.
 *
 * @param  {Array.<String>} list
 *         순서가 적힌 ID 목록. 시트의 `_meta.firstNight` 또는 공식 순번표.
 * @param  {Map} lookup
 *         {@link buildOrderLookup} 가 만든 이름표.
 * @return {Map}
 *         정보 항목 ID → 계산된 순번. 계산할 수 없으면 담기지 않는다.
 */
function resolveOrdersFromList(list, lookup) {

    const resolved = new Map();
    const gaps = [];
    let gap = null;
    let previousOrder = null;

    list.forEach((entry) => {

        const key = TokenStore.normaliseId(String(entry || ""));

        if (NIGHT_INFO_IDS.indexOf(key) > -1) {

            if (!gap) {

                gap = {
                    before: previousOrder,
                    after: null,
                    ids: []
                };
                gaps.push(gap);

            }

            gap.ids.push(key);
            return;

        }

        const order = lookupOrder(key, lookup);

        if (order === null) {
            return;
        }

        if (gap) {

            gap.after = order;
            gap = null;

        }

        previousOrder = order;

    });

    gaps.forEach(({ before, after, ids }) => {

        let start = 0;
        let span = 1;

        if (before !== null && after !== null) {

            start = before;
            span = after - before;

        } else if (before !== null) {
            start = before;
        } else if (after !== null) {
            start = after - 1;
        } else {
            return;
        }

        // 앞뒤 순번이 뒤집힌 이상한 데이터라면 균등 분배를 포기하고 1칸만 쓴다.
        if (!(span > 0)) {
            span = 1;
        }

        ids.forEach((id, index) => {
            resolved.set(id, start + span * ((index + 1) / (ids.length + 1)));
        });

    });

    return resolved;

}

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
        characters.map((character) => nameKey(character.getName()))
    );
    const missing = NIGHT_INFO_STEPS.filter(({ id, name }) => (
        !presentIds.has(id) && !presentNames.has(nameKey(name))
    ));

    if (!missing.length) {
        return;
    }

    const lookup = buildOrderLookup(characters);
    const declared = (
        meta && Array.isArray(meta.firstNight)
        ? meta.firstNight
        : null
    );
    const declaredOrders = (
        declared
        ? resolveOrdersFromList(declared, lookup)
        : new Map()
    );
    const officialOrders = resolveOrdersFromList(
        officialNightOrder.firstNight,
        lookup
    );

    missing.forEach((step) => {

        let order = step.defaultOrder;

        if (declaredOrders.has(step.id)) {
            order = declaredOrders.get(step.id);
        } else if (officialOrders.has(step.id)) {
            order = officialOrders.get(step.id);
        }

        const token = new CharacterToken({
            id: step.id,
            name: step.name,
            team: step.team,
            image: __webpack_public_path__ + `img/icons/${step.team}.webp`,
            firstNight: order,
            firstNightReminder: step.reminder,
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
