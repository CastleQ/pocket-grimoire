import Observer from "../../classes/Observer.js";
import { archiveCustomScript } from "./script-archive.js";
import { sortByOfficialOrder } from "../../data/official-order.js";
import TokenStore from "../../classes/TokenStore.js";
import Dialog from "../../classes/Dialog.js";
import {
    lookup,
    lookupOne,
    lookupOneCached,
    getLabelText,
    announceInput
} from "../../utils/elements.js";
import {
    supplant
} from "../../utils/strings.js";
import {
    post
} from "../../utils/fetch.js";

/**
 * Checks to see if the given data looks like a script.
 *
 * @param  {Array.<Object|String>} json
 *         Data to check.
 * @return {Boolean}
 *         true if the data looks like a script, false if it doesn't.
 */
function isScriptJson(json) {

    return (
        Array.isArray(json)
        && json.length
        && json.every((item) => (
            (
                typeof item === "object"
                && typeof item?.id === "string"
            )
            || typeof item === "string"
        ))
    );

}

/**
 * Checks to see if the given json looks like it contains any homebrew content.
 *
 * @param  {Array.<Object>} json
 *         Data to check.
 * @return {Boolean}
 *         true if the data seems to contain any homebrew, false if it doesn't
 *         seem to contain any homebrew.
 */
function containsHomebrew(json) {

    return json
        .filter(({ id }) => id !== "_meta")
        .some(({ ability }) => typeof ability === "string");

}

/**
 * Announces that a script has been added to the grimoire.
 *
 * @param {String} name
 *        Name of the script. This may be an empty string.
 * @param {Array.<Object>} characters
 *        Characters in the script.
 * @param {String|null} [game=null]
 *        The ID of the homebrew script that was uploaded. This will be null for
 *        a game that only consists of recognised characters.
 */
function announceScript(name, characters, game = null) {

    // 배포(캐릭터 배포) 시 games.script_name + 플레이 빈도에 쓰기 위해 현재 시트 이름 저장.
    try {
        window.localStorage.setItem("pg_current_script", name || "");
    } catch (ignore) {
        // localStorage 사용 불가 시 무시
    }

    Observer.create("game").trigger("characters-selected", {
        name,
        characters,
        game
    });
    Dialog.create(lookupOneCached("#edition-list")).hide();

}

/**
 * Shows the given error message on the given input.
 *
 * @param {Element} input
 *        Element that should show an error.
 * @param {String} error
 *        Error message to show.
 */
function showInputError(input, error) {

    // 내장 시트는 연결된 입력 필드가 없다(input === null). 이 경우 알림으로 대체.
    if (!input) {
        window.alert(error);
        return;
    }

    input.setCustomValidity(error);
    input.form.reportValidity();

}

// A map of any common mistakes that we find in the homebrew code.
const normalMap = {
    team: {
        // The American spelling has one L, but I'm British and I use two L's.
        "traveler": "traveller"
    }
};

/**
 * Fixes any common mistakes in the homebrew code.
 *
 * @param  {Array} json
 *         Homebrew JSON.
 * @return {Array}
 *         The homebrew JSON, mapped so that it works with our system.
 */
function normaliseHomebrew(json) {

    return json.map((entry) => {

        // An official character may be a simple string rather than the
        // old-school approach of an object with an "id" key.
        if (typeof entry === "string") {
            entry = { id: entry };
        }

        Object.entries(normalMap).forEach(([key, map]) => {
            entry[key] = map[entry[key]] || entry[key];
        });

        // 배열 이미지(선/악 두 URL)는 그대로 보존한다. CharacterToken이 배열을
        // 처리하여 기본값으로 [0]을 사용하고, 향후 선/악 토글의 토대가 된다.

        if (entry.team && (!entry.image || (Array.isArray(entry.image) && entry.image.length === 0))) {
            entry.image = __webpack_public_path__ + `img/icons/${entry.team}.webp`;
        }

        return entry;

    });

}

/**
 * Removes the "_meta" entry from the given JSON data, if it exists, and returns
 * the name within that entry. If the entry isn't found, an empty string is
 * returned.
 *
 * @param  {Array.<Object>} json
 *         JSON data whose "_meta" entry should be removed.
 * @return {String}
 *         Name of the script, taking from the "_meta" entry, or an empty string
 *         if the name cannot be found.
 */
function extractMetaEntry(json) {

    let name = "";
    const metaIndex = json.findIndex(({ id }) => id === "_meta");

    if (metaIndex > -1) {

        name = json[metaIndex].name;
        json.splice(metaIndex, 1);

    }

    return name;

}

/**
 * Sets the loading state of the form, setting the state of the loading
 * animation in the submit button.
 *
 * @param {Element} form
 *        Form whose loading state should be set.
 * @param {Boolean} state
 *        true if the form is loading, false if it's not.
 */
function setFormLoadingState(form, state) {

    if (
        form.dataset.isLoading === state
        || String(form.dataset.isLoading) === String(state)
    ) {
        return;
    }

    form.dataset.isLoading = state;

    const submit = lookupOneCached("[type=\"submit\"]", form);
    submit.classList.toggle("is-loading", state);

    const progress = lookupOneCached("[role=\"progressbar\"]", submit);
    progress.setAttribute("aria-busy", state);
    progress.setAttribute(
        "aria-valuenow",
        (
            state
            ? "0"
            : progress.getAttribute("aria-valuemax")
        )
    );

}

/**
 * Converts a character entry into a normalised ID.
 *
 * @param  {Object|String} item
 *         Item whose normalised ID should be returned.
 * @return {String}
 *         Normalised character ID.
 */
function convertCharacterId(item) {

    let id = "";

    if (typeof item === "string") {
        id = item;
    } else if (item && typeof item === "object") {
        id = item.id || "";
    }

    return TokenStore.normaliseId(id);

}

/**
 * Processes the JSON to set up the game.
 *
 * @param  {Object} json
 *         JSON to process.
 * @param  {Element} json.form
 *         The form that was submitted so the JSON could be processed.
 * @param  {Array.<Object>} json.json
 *         Script to process.
 * @param  {Element} json.input
 *         File input that uploads scripts.
 * @param  {TokenStore} json.store
 *         Store for any data.
 * @return {Promise}
 *         An empty, resolved Promise.
 */
function processJSON({
    form,
    json,
    input,
    store,
    isCustom = false
}) {

    // N-1: 직접 입력(URL/파일/붙여넣기)된 시트는 불러오는 즉시 아카이브한다.
    // 내장 시트는 이미 저장소에 있으므로 수집하지 않는다.
    // 아카이브는 비동기로 진행되며 실패해도 시트 로드에 영향을 주지 않는다.
    if (isCustom) {
        archiveCustomScript(json);
    }

    if (!isScriptJson(json)) {

        showInputError(input, I18N.invalidScript);
        return Promise.resolve();

    }

    if (containsHomebrew(json)) {

        const normalised = normaliseHomebrew(json);

        // 정적 호스팅(GitHub Pages): 서버 저장(homebrew POST)을 건너뛰고
        // 브라우저에서 커스텀 캐릭터를 바로 생성해 로드한다.
        announceScript(
            extractMetaEntry(normalised),
            normalised.map((item) => (
                store.getOfficialCharacter(convertCharacterId(item))
                || store.createCustomCharacter(item)
            ))
        );

        return Promise.resolve();

    }

    const name = extractMetaEntry(json);
    const characters = json
        .map((item) => store.getCharacter(convertCharacterId(item)))
        .filter(Boolean);

    if (!characters.length) {

        showInputError(input, I18N.noCharacters);
        return Promise.resolve();

    }

    announceScript(name, characters);
    return Promise.resolve();

}

/**
 * Sets the validation on the given fields.
 *
 * @param {Array.<Element>} fields
 *        Input fields that should have their validity set.
 * @param {Boolean} isVisible
 *        true if the fields are visible and their validity should be set, false
 *        if they're not visible and their validity should be removed.
 */
function setFieldsValidity(fields, isVisible) {

    if (isVisible) {

        const inputted = fields.find((field) => field.value);
        fields.forEach((field) => {
            field.required = !inputted || field === inputted;
        });

    } else {

        fields.forEach((field) => {

            field.setCustomValidity("");
            field.required = false;

        });

    }

}

const form = lookupOne("#select-edition-form");
const fileInput = lookupOne("#custom-script-upload");
const fileInputRender = fileInput.nextElementSibling;
const urlInput = lookupOne("#custom-script-url");
const pasteInput = lookupOne("#custom-script-paste");
const uploader = lookupOne("#custom-script");
const radios = lookup("[name=\"edition\"]", form);
const customInputs = [fileInput, urlInput, pasteInput];

// 직접 입력 드롭다운(선택지 하나뿐)은 라디오 단계 없이, 열면 즉시 custom 선택으로 처리한다.
const editionDirect = lookupOne("#edition-direct");
const customRadio = lookupOne("#edition-custom");

// 라디오는 매니페스트로 동적 추가되므로 폼 위임으로 처리한다.
form.addEventListener("input", ({ target }) => {

    if (!target || target.name !== "edition") {
        return;
    }

    const isCustom = target.value === "custom";

    setFieldsValidity(customInputs, isCustom);

    // 공식/내장 시트를 고르면 열려 있던 직접 입력 드롭다운을 닫는다.
    if (!isCustom && editionDirect && editionDirect.open) {
        editionDirect.open = false;
    }

});

// 직접 입력 드롭다운을 열면 즉시 custom 라디오를 선택하고 입력 영역을 활성화한다.
if (editionDirect && customRadio) {

    editionDirect.addEventListener("toggle", () => {

        if (editionDirect.open) {
            customRadio.checked = true;
            setFieldsValidity(customInputs, true);
        } else {
            setFieldsValidity(customInputs, false);
        }

    });

}

// 내장 시나리오(커스텀/홈브류/틴시빌)를 매니페스트에서 읽어 드롭다운을 채운다.
const scriptsBase = (typeof URLS !== "undefined" && URLS.scriptsBase) || "/scripts/";

// 공식 시트: 파일 없이 tb/bmr/snv 에디션으로 로드. 이름은 앱 표기와 동일하게 유지.
const OFFICIAL_SHEETS = [
    { value: "tb", name: "Trouble Brewing(점철되는 혼란)" },
    { value: "bmr", name: "Bad Moon Rising(피로 물든 달)" },
    { value: "snv", name: "Sects and Violets(화단에 꽃피운 이단)" }
];

function escapeHtml(value) {
    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// 4개 카테고리(공식/커스텀/홈브류/틴시빌)를 매니페스트 순서 그대로 렌더한다.
// (플레이 횟수는 Supabase에서만 집계하며 화면에는 표시하지 않는다.)
function renderSheets() {

    fetch(scriptsBase + "manifest.json")
        .then((response) => response.json())
        .catch(() => ({}))
        .then((manifest) => {

            lookup(".js--edition-list", form).forEach((list) => {

                const category = list.dataset.category;
                const isOfficial = category === "official";
                const sheets = isOfficial
                    ? OFFICIAL_SHEETS
                    : ((manifest && manifest[category]) || []);

                list.innerHTML = "";

                if (!sheets.length) {
                    const li = document.createElement("li");
                    li.className = "edition-group__empty";
                    li.textContent = "(준비 중)";
                    list.append(li);
                    return;
                }

                sheets.forEach((sheet) => {

                    const value = isOfficial ? sheet.value : ("sheet:" + sheet.file);
                    const idBase = isOfficial ? sheet.value : sheet.file;
                    const id = "edition-" + String(idBase).replace(/[^a-z0-9]+/gi, "-");
                    const nameHTML = "<strong>" + escapeHtml(sheet.name) + "</strong>";
                    const authorHTML = sheet.author ? " by " + escapeHtml(sheet.author) : "";

                    const li = document.createElement("li");
                    li.innerHTML = (
                        '<label for="' + id + '" class="radio">'
                        + '<span class="radio__wrapper">'
                        + '<input type="radio" name="edition" value="' + escapeHtml(value) + '" id="' + id + '" class="radio__input" data-sheet-name="' + escapeHtml(sheet.name) + '">'
                        + '<span class="radio__render"></span>'
                        + '</span>'
                        + '<span class="radio__label">' + nameHTML + authorHTML + '</span>'
                        + '</label>'
                    );
                    list.append(li);

                });

            });

        })
        .catch(() => {
            lookup(".js--edition-list", form).forEach((list) => {
                list.innerHTML = '<li class="edition-group__empty">목록을 불러오지 못했습니다.</li>';
            });
        });

}

renderSheets();

customInputs.forEach((input) => {

    input.addEventListener("input", () => {

        input.setCustomValidity("");
        setFieldsValidity(customInputs, true);

    });

});

form.addEventListener("submit", (e) => {

    e.preventDefault();

    if (form.dataset.isLoading === "true") {
        return;
    }

    // 내장 라디오는 동적 추가되므로 제출 시점에 다시 조회한다.
    const radio = lookup("[name=\"edition\"]", form).find(({ checked }) => checked);
    const edition = radio?.value;

    if (!edition) {
        return;
    }

    TokenStore.ready((tokenStore) => {

        if (edition === "custom") {

            if (urlInput.value) {

                setFormLoadingState(form, true);

                const myURL = supplant(window.decodeURIComponent(URLS.url), {
                    url: window.encodeURIComponent(urlInput.value)
                });

                fetch(myURL)
                    .catch((error) => {
                        showInputError(urlInput, error.message);
                        setFormLoadingState(form, false);
                    })
                    .then((response) => response.json())
                    .catch(() => {
                        showInputError(urlInput, I18N.invalidScript);
                        setFormLoadingState(form, false);
                        return null;
                    })
                    .then((json) => {

                        if (json === null) {
                            return;
                        }

                        if (!json.success) {
                            showInputError(urlInput, json.message);
                            setFormLoadingState(form, false);
                            return;
                        }

                        processJSON({
                            form,
                            json: json.data,
                            input: urlInput,
                            store: tokenStore,
                            isCustom: true
                        }).then(() => setFormLoadingState(form, false));

                    });

            } else if (fileInput.files.length) {

                const reader = new FileReader();

                reader.addEventListener("load", ({ target }) => {

                    let json = [];

                    try {
                        json = JSON.parse(target.result);
                    } catch (error) {
                        return showInputError(fileInput, I18N.invalidScript);
                    }

                    processJSON({
                        form,
                        json,
                        input: fileInput,
                        store: tokenStore,
                        isCustom: true
                    })

                });

                reader.readAsText(fileInput.files[0]);

            } else if (pasteInput.value) {

                let json = [];

                try {
                    json = JSON.parse(pasteInput.value);
                } catch (error) {
                    return showInputError(pasteInput, I18N.invalidScript);
                }

                processJSON({
                    form,
                    json,
                    input: pasteInput,
                    store: tokenStore,
                    isCustom: true
                })

            }

        } else if (edition.startsWith("sheet:")) {

            // 내장 시나리오: 개별 JSON 파일을 fetch해 기존 파이프라인으로 로드.
            setFormLoadingState(form, true);

            const file = edition.slice("sheet:".length);

            fetch(scriptsBase + file)
                .then((response) => response.json())
                .catch(() => {
                    window.alert(I18N.invalidScript);
                    setFormLoadingState(form, false);
                    return null;
                })
                .then((json) => {

                    if (json === null) {
                        return;
                    }

                    processJSON({
                        form,
                        json,
                        input: null,
                        store: tokenStore,
                        isCustom: false
                    }).then(() => setFormLoadingState(form, false));

                });

        } else {

            // 공식 3종(tb/bmr/snv)은 시트 JSON 없이 DB에서 직접 읽어오므로 영문
            // id 알파벳순으로 나온다. 순번표로 표시 순서를 맞춰준다.
            announceScript(
                radio.dataset.sheetName || getLabelText(radio),
                sortByOfficialOrder(
                    edition,
                    tokenStore
                        .getAllCharacters()
                        .filter((character) => character.getEdition() === edition)
                )
            );

        }

    });

});

fileInput.addEventListener("input", () => {

    const {
        value
    } = fileInput;

    fileInput.setCustomValidity("");
    fileInputRender.dataset.value = (
        value
        ? value.slice(value.lastIndexOf("\\") + 1)
        : fileInputRender.dataset.placeholder
    );

    if (value && urlInput.value) {

        urlInput.value = "";
        announceInput(urlInput);

    }

});

urlInput.addEventListener("input", () => {

    urlInput.setCustomValidity("");

    if (urlInput.value && fileInput.value) {

        fileInput.value = "";
        announceInput(fileInput);

    }

});

Dialog.create(lookupOne("#edition-list")).on(Dialog.HIDE, () => {

    fileInput.value = "";
    announceInput(fileInput);
    urlInput.value = "";
    announceInput(urlInput);

});