const TEAMS = ["townsfolk", "outsider", "minion", "demon", "traveller", "fabled"];

/**
 * 캐릭터 그림을 넣는다. 외부 그림 주소가 죽어 있으면 유형 기본 아이콘으로 바꿔 끼운다.
 *
 * @param {HTMLImageElement} element
 * @param {String} src
 * @param {String} [team]
 */
export function setCharacterImage(element, src, team) {

    const icon = __webpack_public_path__ + `img/icons/${
        TEAMS.includes(team) ? team : "townsfolk"
    }.webp`;

    // 한 번만 바꿔 끼운다(기본 아이콘마저 실패해도 무한 반복하지 않게).
    element.onerror = () => {
        element.onerror = null;
        element.src = icon;
    };
    element.src = src || icon;

}
