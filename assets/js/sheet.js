/**
 * 캐릭터 시트 페이지.
 *
 * 새 탭으로 열리며, 마도서 쪽에서 브라우저 저장소에 넣어둔 시트 데이터를 읽어
 * 화면을 직접 그린다. 서버 렌더링에 의존하지 않는다.
 *
 * 3장을 세로로 그린다.
 *   1) 캐릭터 시트  — 팀별 2단 구성
 *   2) 첫날 밤 시트 — 밤 순서 + 이야기꾼 지시문
 *   3) 다른 밤 시트 — 위와 동일
 */

import html2canvas from "html2canvas";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./processes/setup/supabase-config.js";
import roleImages from "../data/role-images.json";

const STORAGE_KEY = "pg-sheet-data";

// A4 세로 비율(210mm x 297mm). 내보낼 때 이 비율로 높이를 맞춘다.
const A4_RATIO = 297 / 210;

// A4 안에 담기지 않을 때 글자와 여백을 줄이는 하한과 간격.
const SCALE_FLOOR = 0.6;
const SCALE_STEP = 0.03;

const TEAM_LABEL = {
    townsfolk: "주민",
    outsider: "외지인",
    minion: "하수인",
    demon: "악마",
    traveller: "여행자",
    fabled: "전설 & 설화",
    loric: "전설 & 설화"
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

// 밤 시트의 시작과 끝. 앱 데이터에 없는 항목이라 여기서 정의한다.
const NIGHT_BOOKENDS = {
    dusk: {
        name: "황혼",
        text: "밤 단계를 실행합니다.",
        kind: "dusk"
    },
    dawn: {
        name: "새벽",
        text: "밤 단계를 종료합니다.",
        kind: "dawn"
    }
};

// 밤 순서 배열에 들어 있지만 캐릭터가 아닌 항목.
const NIGHT_INFO_STEPS = {
    minioninfo: {
        name: "하수인 정보",
        text: "하수인들에게 서로와 악마를 알려줍니다.",
        kind: "info"
    },
    demoninfo: {
        name: "악마 정보",
        text: "악마에게 하수인들과 블러핑용 캐릭터 3개를 알려줍니다.",
        kind: "info"
    }
};

/**
 * 브라우저 저장소에서 시트 데이터를 읽는다.
 *
 * @return {Object|null}
 *         저장된 시트 데이터. 없거나 깨졌으면 null.
 */
function readPayload() {

    try {
        return JSON.parse(window.localStorage.getItem(STORAGE_KEY)) || null;
    } catch (ignore) {
        return null;
    }

}

/**
 * 이미지 필드에서 첫 번째 주소를 꺼낸다.
 *
 * @param  {Array.<String>|String} image
 *         캐릭터의 image 필드.
 * @return {String}
 *         첫 번째 이미지 주소.
 */
function firstImage(image) {

    const source = (
        Array.isArray(image)
        ? (image[0] || "")
        : (image || "")
    );

    if (!source) {
        return "";
    }

    // html2canvas 는 주소 없는 임시 창에서 촬영하므로, "/foo/bar.webp" 같은
    // 상대 주소는 그 창에서 길을 잃는다. 항상 완전한 주소로 바꿔둔다.
    try {
        return new URL(source, window.location.href).href;
    } catch (ignore) {
        return source;
    }

}

/**
 * 캐릭터에 쓸 아이콘 주소를 정한다.
 *
 * 공식 캐릭터와 같은 id라면 저장소에 내장된 아이콘을 쓴다. 시트 제작자가 적어둔
 * 주소는 외부 사이트인 경우가 많고, 그중 일부는 이미지로 저장할 때 촬영을
 * 막는다. 이름과 능력은 시트에 적힌 그대로 두고 아이콘만 바꾼다.
 *
 * @param  {Object} character
 *         대상 캐릭터.
 * @return {String}
 *         쓸 아이콘 주소.
 */
function characterImage(character) {

    const key = normaliseId(character && character.id);
    const official = roleImages[key] || roleImages[key.replace(/\d+$/, "")];

    if (Array.isArray(official) && official[0]) {
        return firstImage(official[0]);
    }

    return firstImage(character && character.image);

}

/**
 * id를 비교하기 쉬운 형태로 다듬는다.
 *
 * @param  {String} id
 *         다듬을 id.
 * @return {String}
 *         소문자 영숫자만 남은 id.
 */
function normaliseId(id) {
    return String(id || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * 요소를 만든다.
 *
 * @param  {String} tag
 *         만들 요소의 태그 이름.
 * @param  {String} [className]
 *         요소에 붙일 class.
 * @param  {String} [text]
 *         요소에 넣을 글자.
 * @return {Element}
 *         만들어진 요소.
 */
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

/**
 * 이야기꾼 지시문을 요소로 만든다. *별표*는 굵게, :reminder:는 토큰 표시로
 * 바꾼다. 글자는 textContent로만 넣으므로 태그로 해석되지 않는다.
 *
 * @param  {String} text
 *         원본 지시문.
 * @return {Element}
 *         꾸며진 문단.
 */
function renderReminderText(text) {

    const paragraph = element("p", "sheet-role__ability");
    const source = String(text || "").split(":reminder:").join("\u25cf");

    source.split(/(\*[^*]+\*)/).forEach((chunk) => {

        if (!chunk) {
            return;
        }

        if (chunk.startsWith("*") && chunk.endsWith("*") && chunk.length > 2) {
            paragraph.append(element("strong", null, chunk.slice(1, -1)));
            return;
        }

        paragraph.append(document.createTextNode(chunk));

    });

    return paragraph;

}

/**
 * 황혼·새벽 자리에 넣을 그림을 만든다. 앱에 해당 아이콘 파일이 없어 직접 그린다.
 *
 * @param  {String} kind
 *         "dusk" 또는 "dawn".
 * @return {Element}
 *         그림 요소.
 */
function bookendIcon(kind) {

    const wrapper = element("span", `sheet-bookend sheet-bookend--${kind}`);

    wrapper.append(element("span", "sheet-bookend__shape"));

    return wrapper;

}

/**
 * 캐릭터 한 명을 그린다.
 *
 * @param  {Object} character
 *         그릴 캐릭터 데이터.
 * @return {Element}
 *         캐릭터 요소.
 */
function renderCharacter(character) {

    const team = character.team || "townsfolk";
    const row = element("div", `sheet-role sheet-role--${team}`);
    const icon = element("div", "sheet-role__icon");
    const image = document.createElement("img");

    image.src = characterImage(character);
    image.alt = "";
    icon.append(image);

    const body = element("div", "sheet-role__body");

    body.append(element("p", "sheet-role__name", character.name || character.id));
    body.append(element("p", "sheet-role__ability", character.ability || ""));

    row.append(icon, body);

    return row;

}

/**
 * 페이지 아래쪽 표기를 만든다.
 *
 * @param  {String} note
 *         오른쪽에 넣을 문구.
 * @return {Element}
 *         완성된 표기.
 */
function renderFooter(note) {

    const footer = element("footer", "sheet-page__footer");

    footer.append(element(
        "span",
        null,
        "\u00a9 Steven Medway, bloodontheclocktower.com"
    ));
    footer.append(element("span", null, note));

    return footer;

}

/**
 * 캐릭터 시트 한 장을 그린다.
 *
 * @param  {Object} payload
 *         시트 데이터.
 * @param  {Array.<Object>} characters
 *         표시할 캐릭터 목록.
 * @return {Element}
 *         완성된 페이지.
 */
function renderCharacterPage(payload, characters) {

    const page = element("section", "sheet-page");
    const header = element("header", "sheet-page__header");
    const heading = element("div", "sheet-page__heading");

    heading.append(element("h1", "sheet-page__title", payload.name || "캐릭터 시트"));

    if (payload.meta && payload.meta.author) {
        heading.append(element("p", "sheet-page__author", `지은이: ${payload.meta.author}`));
    }

    header.append(heading);

    if (payload.meta && payload.meta.logo) {

        const logo = document.createElement("img");

        logo.src = firstImage(payload.meta.logo);
        logo.alt = "";
        logo.className = "sheet-page__logo";
        header.append(logo);

    }

    page.append(header);

    const groups = new Map();

    TEAM_ORDER.forEach((team) => {

        const members = characters.filter((character) => character.team === team);

        if (!members.length) {
            return;
        }

        const label = TEAM_LABEL[team] || team;
        let list = groups.get(label);

        if (!list) {

            const group = element("section", "sheet-team");

            group.append(element("h2", "sheet-team__label", label));
            list = element("div", "sheet-team__list");
            group.append(list);
            page.append(group);
            groups.set(label, list);

        }

        members.forEach((character) => list.append(renderCharacter(character)));

    });

    page.append(renderFooter("* 첫날 제외"));

    return page;

}

/**
 * 밤 순서를 정한다. 시트 JSON이 순서를 지정했으면 그것을 쓰고, 없으면 각
 * 캐릭터의 밤 순서 숫자로 정렬한다.
 *
 * @param  {Object} payload
 *         시트 데이터.
 * @param  {Array.<Object>} characters
 *         전체 캐릭터 목록.
 * @param  {String} which
 *         "firstNight" 또는 "otherNight".
 * @return {Array.<Object>}
 *         밤 시트에 그릴 줄 목록.
 */
function buildNightOrder(payload, characters, which) {

    const reminderKey = `${which}Reminder`;
    const byId = new Map();

    characters.forEach((character) => {

        const key = normaliseId(character.id);

        byId.set(key, character);

        const stripped = key.replace(/\d+$/, "");

        if (stripped && !byId.has(stripped)) {
            byId.set(stripped, character);
        }

    });

    const toRow = (character) => ({
        name: character.name || character.id,
        text: character[reminderKey] || "",
        image: characterImage(character),
        team: character.team || "townsfolk",
        kind: "character"
    });

    const declared = (
        payload.meta && Array.isArray(payload.meta[which])
        ? payload.meta[which]
        : null
    );

    if (declared && declared.length) {

        const rows = [];

        declared.forEach((entry) => {

            const key = normaliseId(entry);

            if (NIGHT_BOOKENDS[key]) {
                rows.push({ ...NIGHT_BOOKENDS[key], image: "", team: "bookend" });
                return;
            }

            if (NIGHT_INFO_STEPS[key]) {
                rows.push({ ...NIGHT_INFO_STEPS[key], image: "", team: "bookend" });
                return;
            }

            const character = byId.get(key) || byId.get(key.replace(/\d+$/, ""));

            if (character) {
                rows.push(toRow(character));
            }

        });

        return rows;

    }

    const ordered = characters
        .filter((character) => Number(character[which]) > 0)
        .sort((a, b) => Number(a[which]) - Number(b[which]))
        .map(toRow);

    return [
        { ...NIGHT_BOOKENDS.dusk, image: "", team: "bookend" },
        ...ordered,
        { ...NIGHT_BOOKENDS.dawn, image: "", team: "bookend" }
    ];

}

/**
 * 밤 시트 한 장을 그린다.
 *
 * @param  {String} title
 *         시트 제목.
 * @param  {Array.<Object>} rows
 *         표시할 줄 목록.
 * @return {Element}
 *         완성된 페이지.
 */
function renderNightPage(title, rows) {

    const page = element("section", "sheet-page sheet-page--night");

    page.append(element("h2", "sheet-night__title", title));

    const list = element("div", "sheet-night__list");

    rows.forEach((row) => {

        const line = element("div", `sheet-role sheet-role--${row.team}`);
        const icon = element("div", "sheet-role__icon sheet-role__icon--night");

        if (row.kind === "dusk" || row.kind === "dawn") {

            icon.append(bookendIcon(row.kind));

        } else if (row.image) {

            const image = document.createElement("img");

            image.src = row.image;
            image.alt = "";
            icon.append(image);

        }

        const body = element("div", "sheet-role__body");

        body.append(element("p", "sheet-role__name", row.name));
        body.append(renderReminderText(row.text));

        line.append(icon, body);
        list.append(line);

    });

    page.append(list);
    page.append(renderFooter(""));

    return page;

}

/**
 * 페이지를 한 화면에 담기 위한 액자로 감싼다.
 *
 * @param  {Element} page
 *         감쌀 페이지.
 * @return {Element}
 *         액자 요소.
 */
function frame(page, label, fileBase) {

    const block = element("div", "sheet-block");
    const actions = element("div", "sheet-actions");
    const button = element("button", "button sheet-button");

    button.type = "button";
    button.append(element("span", "button__text", "이미지 저장"));

    const loader = element("span", "button__loader");

    loader.append(element("span", "loader"));
    button.append(loader);
    actions.append(button);

    const box = element("div", "sheet-frame");
    const inner = element("div", "sheet-frame__inner");

    inner.append(page);
    box.append(inner);
    block.append(actions, box);

    button.addEventListener("click", () => {
        exportPage(page, inner, box, button, `${fileBase}_${label}`);
    });

    return block;

}

/**
 * 페이지 한 장을 PNG로 저장한다.
 *
 * 화면에 맞춰 줄여 놓은 상태 그대로 촬영하면 흐릿해지므로, 촬영 직전에 원래
 * 크기로 되돌렸다가 끝나면 다시 줄인다.
 *
 * @param {Element} page
 *        촬영할 페이지.
 * @param {Element} inner
 *        크기를 줄여 놓은 액자 속.
 * @param {Element} box
 *        액자.
 * @param {Element} button
 *        누른 버튼.
 * @param {String} fileName
 *        저장할 파일 이름(확장자 제외).
 */
/**
 * 촬영 전에 페이지 안의 모든 그림을 PNG 데이터로 바꿔 심어둔다.
 *
 * html2canvas 가 그림을 직접 불러오게 하면 형식이나 출처에 따라 실패하는
 * 경우가 있다. 미리 우리가 읽어서 넣어두면 그런 변수가 사라진다.
 *
 * @param  {Element} root
 *         대상 영역.
 * @return {Promise}
 *         원래대로 되돌리는 함수를 담은 약속.
 */
function inlineImages(root) {

    const images = Array.from(root.querySelectorAll("img"));
    const originals = new Map();

    const jobs = images.map((image) => new Promise((resolve) => {

        const source = image.currentSrc || image.src;

        if (!source || source.startsWith("data:")) {
            resolve();
            return;
        }

        const probe = new Image();

        probe.crossOrigin = "anonymous";

        probe.onload = () => {

            try {

                const canvas = document.createElement("canvas");

                canvas.width = probe.naturalWidth;
                canvas.height = probe.naturalHeight;
                canvas.getContext("2d").drawImage(probe, 0, 0);

                originals.set(image, image.getAttribute("src"));
                image.setAttribute("src", canvas.toDataURL("image/png"));

            } catch (ignore) {
                // 준비에 실패하면 원래 주소 그대로 둔다.
            }

            resolve();

        };

        probe.onerror = () => resolve();
        probe.src = source;

    }));

    return Promise.all(jobs).then(() => () => {

        originals.forEach((value, image) => {

            if (value === null) {
                image.removeAttribute("src");
            } else {
                image.setAttribute("src", value);
            }

        });

    });

}

function exportPage(page, inner, box, button, fileName) {

    const transform = inner.style.transform;
    const height = box.style.height;

    let undoInline = () => {};

    const pageHeight = page.style.minHeight;

    const restore = () => {
        undoInline();
        page.style.minHeight = pageHeight;
        page.style.removeProperty("--sheet-scale");
        inner.style.transform = transform;
        box.style.height = height;
        button.classList.remove("is-loading");
        button.disabled = false;
    };

    // 줄여 놓은 상태에서는 크기를 정확히 잴 수 없으므로 먼저 원래대로 편다.
    inner.style.transform = "none";
    box.style.height = "auto";

    // A4 안에 담길 때까지 글자와 여백을 조금씩 줄여본다.
    let fitted = 0;

    for (let scale = 1; scale >= SCALE_FLOOR; scale -= SCALE_STEP) {

        page.style.setProperty("--sheet-scale", scale.toFixed(3));

        const limit = Math.round(page.offsetWidth * A4_RATIO);

        if (Math.round(page.getBoundingClientRect().height) <= limit) {
            fitted = limit;
            break;
        }

    }

    if (fitted) {

        page.style.minHeight = fitted + "px";

    } else {

        // 줄여도 담기지 않으면 읽기 편한 원래 크기로 되돌리고 물어본다.
        page.style.removeProperty("--sheet-scale");

        if (!window.confirm("시트 이미지가 너무 큽니다. 그래도 저장 할까요?")) {
            inner.style.transform = transform;
            box.style.height = height;
            return;
        }

    }

    button.disabled = true;
    button.classList.add("is-loading");

    inlineImages(page).then((undo) => {

        undoInline = undo;

        return html2canvas(page, {
            backgroundColor: "#ffffff",
            useCORS: true,
            scale: 2,
            logging: false
        });

    }).then((canvas) => new Promise((resolve, reject) => {

        canvas.toBlob((blob) => {

            if (blob) {
                resolve(blob);
            } else {
                reject(new Error("이미지를 만들지 못했습니다."));
            }

        }, "image/png");

    })).then((blob) => {

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = fileName.replace(/[\\/:*?"<>|]/g, "_") + ".png";
        document.body.append(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);

    }).catch((error) => {

        window.alert(
            "이미지 저장에 실패했습니다.\n"
            + "외부 사이트의 캐릭터 그림이 저장을 막았을 수 있습니다.\n\n"
            + error.message
        );

    }).then(restore, restore);

}

/**
 * 각 페이지를 화면 크기에 맞게 줄인다. 세로·가로 어느 쪽도 넘치지 않도록
 * 둘 중 작은 비율을 쓴다. 글자가 작아지면 사용자가 확대해서 본다.
 */
// 좁은 화면(휴대폰)에서는 세로 높이를 기준으로 줄이지 않는다.
// 높이로 줄이면 가로 폭이 남아 여백이 생기고, 모바일 브라우저의
// 주소창이 숨었다 나타날 때마다 화면 높이가 바뀌어 시트가 출렁인다.
const NARROW_WIDTH = 768;
let lastFitWidth = -1;

function fitPages() {

    lastFitWidth = window.innerWidth;

    const frames = Array.from(document.querySelectorAll(".sheet-frame"));

    frames.forEach((box) => {

        const inner = box.querySelector(".sheet-frame__inner");

        inner.style.transform = "none";
        box.style.height = "auto";

        const width = inner.scrollWidth;
        const height = inner.scrollHeight;

        if (!width || !height) {
            return;
        }

        const available = box.clientWidth;
        const narrow = window.innerWidth <= NARROW_WIDTH;
        const scale = narrow
            ? Math.min(available / width, 1)
            : Math.min(available / width, window.innerHeight / height, 1);

        inner.style.transform = `scale(${scale})`;
        inner.style.width = `${width}px`;
        box.style.height = `${Math.ceil(height * scale)}px`;

    });

}

let fitTimer = 0;

window.addEventListener("resize", () => {
    // 폭이 그대로면 주소창이 숨었다 나타난 것뿐이므로 손대지 않는다.
    if (window.innerWidth === lastFitWidth) {
        return;
    }

    window.clearTimeout(fitTimer);
    fitTimer = window.setTimeout(fitPages, 150);
});

window.addEventListener("load", fitPages);

/**
 * 시트 전체를 그린다.
 */
/**
 * 주소에 실린 공유 번호를 꺼낸다. 형식이 어긋나면 빈 문자열.
 */
function getShareToken() {

    try {

        const token = new URL(window.location.href).searchParams.get("s");

        if (!token || !/^[A-Za-z0-9_-]{10,64}$/.test(token)) {
            return "";
        }

        return token;

    } catch (ignore) {
        return "";
    }

}

/**
 * 공유된 시트를 서버에서 받아온다.
 *
 * 테이블 직접 접근은 막혀 있고, 이 함수(RPC)만이 유일한 통로다.
 * 폴리필이 꺼져 있으므로 async/await 를 쓰지 않는다. (규약 C-8)
 */
function fetchSharedSheet(token) {

    return fetch(SUPABASE_URL + "/rest/v1/rpc/get_shared_sheet", {
        method: "POST",
        headers: {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": "Bearer " + SUPABASE_ANON_KEY,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ p_token: token })
    }).then((response) => {

        if (!response.ok) {
            throw new Error("서버 응답 " + response.status);
        }

        return response.json();

    });

}

/**
 * 남이 만든 링크의 그림 주소를 검사한다. http/https 와 상대경로만 통과.
 */
function safeImage(value) {

    if (Array.isArray(value)) {
        return value.map(safeImage).filter((item) => item);
    }

    const source = String(value || "").trim();

    if (!source) {
        return "";
    }

    if (/^https?:\/\//i.test(source)) {
        return source;
    }

    return source.indexOf(":") === -1 ? source : "";

}

/**
 * 받아온 시트의 그림 주소를 모두 검사한다.
 */
function sanitizePayload(payload) {

    if (payload && Array.isArray(payload.characters)) {
        payload.characters.forEach((character) => {
            character.image = safeImage(character.image);
        });
    }

    if (payload && payload.meta) {
        payload.meta.logo = safeImage(payload.meta.logo);
        payload.meta.background = safeImage(payload.meta.background);
    }

    return payload;

}

/**
 * 안내 문구 한 줄만 화면에 띄운다.
 */
function showNotice(message) {

    document.body.innerHTML = "";
    document.body.className = "body-sheet";
    document.body.append(element("p", "sheet-empty", message));

}

/**
 * 시작. 주소에 공유 번호가 있으면 서버에서 받아오고, 없으면 저장소에서 읽는다.
 */
function boot() {

    const token = getShareToken();

    if (!token) {
        render(readPayload());
        return;
    }

    showNotice("공유된 시트를 불러오는 중입니다…");

    fetchSharedSheet(token).then((payload) => {

        if (!payload || !payload.characters || !payload.characters.length) {
            showNotice("링크가 만료되었거나 올바르지 않습니다.");
            return;
        }

        render(sanitizePayload(payload));

    }).catch((error) => {

        showNotice("시트를 불러오지 못했습니다: " + error.message);

    });

}


function render(payload) {

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

    const wrapper = element("div", "sheet-wrapper");

    wrapper.append(element("div", "sheet-toolbar"));

    const fileBase = payload.name || "캐릭터 시트";

    [
        [renderCharacterPage(payload, characters), "캐릭터 시트"],
        [renderNightPage("첫날 밤", buildNightOrder(payload, characters, "firstNight")), "첫날 밤"],
        [renderNightPage("다른 밤", buildNightOrder(payload, characters, "otherNight")), "다른 밤"]
    ].forEach(([page, label]) => wrapper.append(frame(page, label, fileBase)));

    root.append(wrapper);
    fitPages();

    document.title = `${payload.name || "캐릭터 시트"} — 포그플러스`;

}

boot();
