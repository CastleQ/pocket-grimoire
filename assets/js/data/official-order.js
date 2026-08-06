/**
 * 공식 3종 시나리오(TB/BMR/SNV)의 캐릭터 표시 순서.
 *
 * 내장 시트와 사용자 커스텀 시트는 JSON 파일에 적힌 순서를 그대로 쓰지만,
 * 공식 3종은 JSON 파일 없이 DB에서 직접 읽어오기 때문에 영문 id 알파벳순으로
 * 나온다. 이 표는 그 세 시나리오에만 적용되는 순번표다.
 *
 * - 여행자는 의도적으로 제외한다(기존 순서 유지).
 * - 이 표에 없는 캐릭터는 목록 맨 뒤로 밀리며, 서로의 상대 순서는 유지된다.
 */

const OFFICIAL_ORDER = {

    tb: [
        "washerwoman",
        "librarian",
        "investigator",
        "chef",
        "empath",
        "fortuneteller",
        "monk",
        "undertaker",
        "ravenkeeper",
        "mayor",
        "slayer",
        "soldier",
        "virgin",
        "butler",
        "saint",
        "drunk",
        "recluse",
        "poisoner",
        "spy",
        "scarletwoman",
        "baron",
        "imp"
    ],

    bmr: [
        "grandmother",
        "sailor",
        "chambermaid",
        "innkeeper",
        "gambler",
        "exorcist",
        "gossip",
        "minstrel",
        "courtier",
        "professor",
        "tealady",
        "fool",
        "pacifist",
        "goon",
        "lunatic",
        "tinker",
        "moonchild",
        "godfather",
        "devilsadvocate",
        "mastermind",
        "assassin",
        "pukka",
        "zombuul",
        "shabaloth",
        "po"
    ],

    snv: [
        "clockmaker",
        "snakecharmer",
        "dreamer",
        "mathematician",
        "flowergirl",
        "towncrier",
        "oracle",
        "savant",
        "philosopher",
        "seamstress",
        "sage",
        "juggler",
        "artist",
        "barber",
        "sweetheart",
        "mutant",
        "klutz",
        "witch",
        "cerenovus",
        "pithag",
        "eviltwin",
        "fanggu",
        "nodashii",
        "vigormortis",
        "vortox"
    ]

};

/**
 * 공식 시나리오의 캐릭터를 순번표 순서로 정렬한다. 원본 배열은 건드리지 않고
 * 정렬된 새 배열을 돌려준다. 순번표가 없는 시나리오는 원본을 그대로 돌려준다.
 *
 * @param  {String} edition
 *         시나리오 식별자. "tb", "bmr", "snv" 중 하나.
 * @param  {Array.<CharacterToken>} characters
 *         정렬할 캐릭터 목록.
 * @return {Array.<CharacterToken>}
 *         정렬된 캐릭터 목록.
 */
export function sortByOfficialOrder(edition, characters) {

    const order = OFFICIAL_ORDER[edition];

    if (!Array.isArray(order)) {
        return characters;
    }

    const rank = (character) => {

        const index = order.indexOf(character.getId());

        return (
            index < 0
            ? Number.MAX_SAFE_INTEGER
            : index
        );

    };

    return characters
        .map((character, index) => ({ character, index }))
        .sort((a, b) => (rank(a.character) - rank(b.character)) || (a.index - b.index))
        .map(({ character }) => character);

}