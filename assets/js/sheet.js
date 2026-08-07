/**
 * 캐릭터 시트 페이지.
 *
 * 새 탭으로 열리며, 마도서 쪽에서 브라우저 저장소에 넣어둔 시트 데이터를 읽어
 * 화면을 직접 그린다. 서버 렌더링에 의존하지 않는다.
 */

const STORAGE_KEY = "pg-sheet-data";

const TEAM_LABEL = {
    townsfolk: "주민",
    outsider: "외지인",
    minion: "하수인",
    demon: "악마",
    traveller: "여행자",
    fabled: "전설",
    loric: "설화"
};

const TEAM_ORDER = [
    "townsfolk",
    "outsider",
    "minion",
    "demon",
    "traveller",
    "fabled",
    "loric"
];

function readPayload() {

    try {
        return JSON.parse(window.localStorage.getItem(STORAGE_KEY)) || null;
    } catch (ignore) {
        return null;
    }

}

function firstImage(image) {

    if (Array.isArray(image)) {
        return image[0] || "";
    }

    return image || "";

}

function element(tag, className, text) {

    const node = document.createElement(tag);

    if (className) {
        node.className = className;
    }

    if (text !== undefined) {
        node.textContent = text;
    }

    return node;

}

function renderCharacter(character) {

    const row = element("div", "sheet-role");
    const icon = element("div", "sheet-role__icon");
    const image = document.createElement("img");

    image.src = firstImage(character.image);
    image.alt = "";
    image.loading = "lazy";
    icon.append(image);

    const body = element("div", "sheet-role__body");
    body.append(
        element("p", "sheet-role__name", character.name || character.id),
        element("p", "sheet-role__ability", character.ability || "")
    );

    row.append(icon, body);

    return row;

}

function render() {

    const payload = readPayload();
    const root = document.body;

    root.innerHTML = "";
    root.className = "body-sheet";

    if (!payload || !payload.characters || !payload.characters.length) {

        root.append(element(
            "p",
            "sheet-empty",
            "표시할 시트가 없습니다. 마도서에서 시나리오를 먼저 선택한 뒤 다시 열어주세요."
        ));

        return;

    }

    const teams = new Set(["townsfolk", "outsider", "minion", "demon"]);

    if (payload.includeTravellers) {
        teams.add("traveller");
    }

    if (payload.includeFabled) {
        teams.add("fabled");
        teams.add("loric");
    }

    const characters = payload.characters.filter(
        (character) => teams.has(character.team)
    );

    const page = element("section", "sheet-page");
    const header = element("header", "sheet-page__header");

    header.append(element("h1", "sheet-page__title", payload.name || "캐릭터 시트"));

    if (payload.meta && payload.meta.author) {
        header.append(element("p", "sheet-page__author", "지은이: " + payload.meta.author));
    }

    page.append(header);

    TEAM_ORDER.forEach((team) => {

        const members = characters.filter((character) => character.team === team);

        if (!members.length) {
            return;
        }

        const group = element("div", "sheet-group");
        group.append(element("h2", "sheet-group__title", TEAM_LABEL[team] || team));

        const list = element("div", "sheet-group__list");
        members.forEach((character) => list.append(renderCharacter(character)));

        group.append(list);
        page.append(group);

    });

    root.append(page);

    document.title = (payload.name || "캐릭터 시트") + " — 포그플러스";

}

render();
