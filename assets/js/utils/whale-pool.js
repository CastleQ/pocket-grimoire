/**
 * 대왕고래 양동이 — 유형별 후보 목록 계산.
 *
 * 시트에는 공식 캐릭터가 유형별로 통째로 들어 있지만, 그중 일부는
 * 참가자가 고를 수 없다. 부트레거 규칙과 자리 표시용 더미 토큰을
 * 걸러내어 실제로 고를 수 있는 목록만 남긴다.
 */

/** 유형 자리 표시용 더미 토큰. 고를 수 없다. */
const PLACEHOLDER_IDS = [
    "demon1", "minion1", "outsider1", "townsfolk1", "traveller1", "whalebucket"
];

/** 이야기꾼만 지정할 수 있는 캐릭터. 어느 목록에도 넣지 않는다. */
const STORYTELLER_ONLY_IDS = ["drunk1", "lunatic1", "marionette1"];

/** 악마 유형인 사람만 고를 수 있는 캐릭터. 악마 목록에만 넣는다. */
const DEMON_ONLY_IDS = ["summoner1", "atheist1"];

/** 참가자에게 배정하는 유형. 여행자는 제외한다. */
export const WHALE_TEAMS = ["demon", "minion", "outsider", "townsfolk"];

/** 유형의 한국어 이름. */
export const TEAM_NAMES = {
    demon: "악마",
    minion: "하수인",
    outsider: "외지인",
    townsfolk: "마을 주민"
};

/**
 * 캐릭터 목록에서 유형별 후보 바구니를 만든다.
 *
 * @param  {Array.<Object>} characters
 *         시트의 전체 캐릭터 자료 (getAllData 결과).
 * @return {Object}
 *         유형 이름을 열쇠로 하는 후보 목록.
 */
export function buildPools(characters) {

    const pools = {
        demon: [],
        minion: [],
        outsider: [],
        townsfolk: []
    };

    characters.forEach((character) => {

        const id = character.id;

        if (PLACEHOLDER_IDS.indexOf(id) > -1) {
            return;
        }

        if (STORYTELLER_ONLY_IDS.indexOf(id) > -1) {
            return;
        }

        const entry = {
            id,
            name: character.name || id,
            ability: character.ability || "",
            image: pickImage(character.image)
        };

        if (DEMON_ONLY_IDS.indexOf(id) > -1) {
            pools.demon.push(entry);
            return;
        }

        if (Object.prototype.hasOwnProperty.call(pools, character.team)) {
            pools[character.team].push(entry);
        }

    });

    WHALE_TEAMS.forEach((team) => {
        pools[team].sort((a, b) => a.name.localeCompare(b.name, "ko"));
    });

    return pools;

}

/**
 * 캐릭터 그림 주소를 하나로 정리한다. 시트에 따라 문자열일 수도, 여러
 * 장이 담긴 배열일 수도 있다.
 *
 * @param  {String|Array|undefined} image
 *         그림 자료.
 * @return {String}
 *         그림 주소. 없으면 빈 문자열.
 */
function pickImage(image) {

    if (Array.isArray(image)) {
        return image[0] || "";
    }

    return typeof image === "string" ? image : "";

}
