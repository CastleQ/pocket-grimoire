import Template from "../classes/Template.js";
import InfoToken from "../classes/InfoToken.js";
import Observer from "../classes/Observer.js";
import Dialog from "../classes/Dialog.js";
import SelectDialog from "../classes/SelectDialog.js";
import TokenStore from "../classes/TokenStore.js";
import {
    lookupOne,
    lookupOneCached
} from "../utils/elements.js";

const buttonHolder = lookupOne("#info-token-button-holder");
const dialogHolder = lookupOne("#info-token-dialog-holder");

InfoToken.setTemplates({
    button: Template.create(lookupOne("#info-token-button-template")),
    dialog: Template.create(lookupOne("#info-token-dialog-template"))
});
const sheetHolder = lookupOne("#info-token-sheet-holder");

InfoToken.setHolders({
    button: buttonHolder,
    custom: lookupOne("#info-token-custom-holder"),
    sheet: sheetHolder,
    dialog: dialogHolder
});

// 캐릭터 선택 칸이 있는 정보 토큰("당신은" 등)은 그리모어의 캐릭터 선택창을
// 그대로 재사용해 이야기꾼이 고른 캐릭터 토큰을 보여준다. 최대 PLATE_MAX 개까지
// 여러 개를 고를 수 있어서, 고르는 동안은 목록 아래 [확인][취소]로 끝낸다.
const characterListDialog = SelectDialog.get();
const PLATE_MAX = 5;
const pickActions = lookupOne("#character-list-actions");
const pickStatus = lookupOne("#character-list-status");
const pickList = lookupOne("#character-list__list");
let activePick = null;

// 지금 고른 캐릭터를 목록에 표시한다(테두리 + 고른 순서 번호).
function markPicked(ids) {

    pickList.querySelectorAll("[data-token-id]").forEach((button) => {

        const order = ids.indexOf(button.dataset.tokenId);

        button.classList.toggle("is-picked", order > -1);

        if (order > -1) {
            button.dataset.pickOrder = String(order + 1);
        } else {
            delete button.dataset.pickOrder;
        }

    });

    pickStatus.textContent = `${ids.length} / ${PLATE_MAX}개 선택`;

}

lookupOne("#character-list-confirm").addEventListener("click", () => {

    if (activePick) {
        activePick.confirm();
    }

    characterListDialog.hide();

});

lookupOne("#character-list-cancel").addEventListener("click", () => {
    characterListDialog.hide();
});

// 정보 토큰마다 접시를 비우는 방법을 모아 둔다(마도서 지우기 때 쓴다).
const plateResets = new Set();

function wireCharacterSelect(token, initialId = "") {

    const button = token.getCharacterSelectButton();
    const initial = initialId ? [initialId] : [];
    let selected = initial.slice();

    const draw = () => {

        TokenStore.ready((tokenStore) => {

            const characters = selected
                .map((id) => tokenStore.getCharacter(id))
                .filter(Boolean);

            token.setCharacterTokens(
                characters.length
                ? characters.map((character) => character.drawToken())
                : [tokenStore.getEmptyCharacter().drawToken()]
            );

        });

    };

    // 아무 캐릭터도 고르지 않은 초기 상태는 악마의 속임수 칸과 똑같은 빈 캐릭터
    // 토큰(크림색 원판)으로 보여준다. CSS로 흉내낸 점선 원은 쓰지 않는다.
    // 시트가 처음부터 보여줄 캐릭터를 정해 두었으면 그 토큰으로 시작한다.
    draw();

    // 마도서 지우기: 빈 접시로(시트가 정해 둔 캐릭터가 있으면 그 캐릭터로) 되돌린다.
    const reset = () => {
        selected = initial.slice();
        draw();
    };

    plateResets.add(reset);
    token.forgetPlates = () => plateResets.delete(reset);

    // #character-list는 "그리모어" 접이식 패널(<details id="grimoire">) 안에 있다.
    // 그 패널이 접혀 있으면 다이얼로그를 열어도 크기가 0이 되어 화면에 보이지 않으므로
    // (general.js의 #character-select 처리와 같은 이유), 여는 동안만 강제로 펼친다.
    let grimoireWasOpen = true;
    let picking = [];

    const process = {

        click(tokenId) {

            const index = picking.indexOf(tokenId);

            if (index > -1) {
                picking.splice(index, 1);
            } else if (picking.length < PLATE_MAX) {
                picking.push(tokenId);
            }

            markPicked(picking);

        },

        confirm() {
            selected = picking.slice();
            draw();
        },

        hide() {

            characterListDialog.removeProcess(process);
            activePick = null;
            pickActions.hidden = true;
            markPicked([]);

            if (!grimoireWasOpen) {
                lookupOneCached("#grimoire").open = false;
            }

        }

    };

    button.addEventListener("click", () => {

        const grimoireSection = lookupOneCached("#grimoire");
        grimoireWasOpen = grimoireSection.open;
        grimoireSection.open = true;

        picking = selected.slice();
        activePick = process;
        pickActions.hidden = false;
        markPicked(picking);

        characterListDialog.addProcess(process);
        characterListDialog.show();

    });

}

// 악마·하수인 정보 토큰: 마도서 토큰에 적힌 참가자 이름을 골라 이름만 보여 준다.
const namesDialog = Dialog.create(lookupOne("#info-token-names-dialog"));
const namesList = lookupOne("#info-token-names-list");
let activeNames = null;

function padNames() {

    // 이 파일이 마도서(pad)보다 먼저 불릴 수 있어 쓸 때 찾는다.
    const pad = lookupOneCached(".js--pad").pad;
    const names = pad.characters
        .map(({ character }) => pad.getPlayerName(character).trim())
        .filter(Boolean);

    return Array.from(new Set(names));

}

lookupOne("#info-token-names-confirm").addEventListener("click", () => {

    if (activeNames) {
        activeNames.confirm(
            Array.from(namesList.querySelectorAll(".is-picked")).map((button) => button.dataset.name)
        );
    }

    namesDialog.hide();

});

lookupOne("#info-token-names-cancel").addEventListener("click", () => namesDialog.hide());
namesDialog.on(Dialog.HIDE, () => {
    activeNames = null;
});

namesList.addEventListener("click", ({ target }) => {

    const button = target.closest("[data-name]");

    if (button) {
        button.classList.toggle("is-picked");
    }

});

function wireNameSelect(token) {

    let names = [];
    const reset = () => {
        names = [];
        token.setNames(names);
    };

    reset();
    plateResets.add(reset);

    token.getNamesButton().addEventListener("click", () => {

        // 마도서에서 이름이 바뀌었을 수 있으므로, 지금 없는 이름도 고른 상태로 남겨 둔다.
        const choices = Array.from(new Set([...padNames(), ...names]));

        namesList.innerHTML = "";
        choices.forEach((name) => {

            const item = document.createElement("li");
            const button = document.createElement("button");

            button.type = "button";
            button.className = "button info-token-names__option";
            button.dataset.name = name;
            button.textContent = name;
            button.classList.toggle("is-picked", names.includes(name));
            item.append(button);
            namesList.append(item);

        });

        lookupOne("#info-token-names-empty").hidden = choices.length > 0;
        activeNames = {
            confirm(picked) {
                names = picked;
                token.setNames(names);
            }
        };
        namesDialog.show();

    });

}

// 마도서 지우기: 정보 토큰의 캐릭터 접시·참가자 이름을 비운다(커스텀 정보 토큰은 그대로).
Observer.create("game").on("clear", () => plateResets.forEach((reset) => reset()));
Observer.create("game").on("plates-reset", () => plateResets.forEach((reset) => reset()));

JSON.parse(buttonHolder.dataset.infoTokens).forEach((data) => {

    const token = new InfoToken(data);
    token.draw();

    if (data.characterSelect) {
        wireCharacterSelect(token);
    }

    if (data.nameSelect) {
        wireNameSelect(token);
    }

});

// 시트에 딸린 정보 토큰 — 시트 파일 _meta.infoTokens
//   { "text": "문구(**굵게** 가능)", "character": "캐릭터 id",
//     "characterSelect": true, "suffix": "캐릭터 아래 문구" }
// character 를 적으면 그 캐릭터 토큰을 처음부터 보여준다(눌러서 바꿀 수 있음).
// characterSelect 만 적으면 빈 토큰에서 시작한다.
// 시트를 고를 때마다 새로 만들고, 다른 시트로 바꾸면 지운다. 시트 정보(meta)는
// 새로고침해도 다시 전달되므로 따로 저장하지 않는다. 수정·삭제 버튼은 없다.
const SHEET_TOKEN_LIMIT = 20;
const SHEET_TEXT_LIMIT = 300;
let sheetTokens = [];

function escapeHtml(string) {

    return string
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

}

function cleanText(value) {

    return (
        typeof value === "string"
        ? value.trim().slice(0, SHEET_TEXT_LIMIT)
        : ""
    );

}

function makeSheetTokens(meta, characters) {

    sheetTokens.forEach((token) => {
        token.remove();
        (token.forgetPlates || (() => {}))();
    });
    sheetTokens = [];

    const list = (
        meta && Array.isArray(meta.infoTokens)
        ? meta.infoTokens.slice(0, SHEET_TOKEN_LIMIT)
        : []
    );

    list.forEach((item) => {

        const text = cleanText(item && item.text);

        if (!text) {
            return;
        }

        const suffix = cleanText(item.suffix);
        const characterId = cleanText(item.character);
        const preset = characterId && (characters || []).find((character) => (
            character.getId() === characterId
        ));
        const hasSlot = Boolean(preset || item.characterSelect);
        // 시트 파일은 남이 만든 것일 수 있으므로 HTML 은 글자로 바꾸고 굵게만 허용한다.
        const markup = escapeHtml(text).replace(
            /\*\*([^*]*)\*\*/g,
            "<strong>$1</strong>"
        );
        const plain = text.replace(/\*\*/g, "");

        const token = new InfoToken({
            markup,
            holder: "sheet",
            characterSelect: hasSlot,
            characterSelectSuffix: suffix,
            label: (
                hasSlot && suffix
                ? plain + " … " + suffix
                : plain
            )
        });

        token.draw();

        if (hasSlot) {
            wireCharacterSelect(token, preset ? preset.getId() : "");
        }

        sheetTokens.push(token);

    });

    sheetHolder.hidden = sheetTokens.length === 0;

}

Observer.create("game").on("characters-selected", ({ detail }) => {
    makeSheetTokens(detail.meta, detail.characters);
});

const observer = Observer.create("info-token");

lookupOne("#add-info-token").addEventListener("click", () => {

    const text = window.prompt(window.I18N.customInfoToken);

    if (!text) {
        return;
    }

    const token = new InfoToken({
        raw: text,
        custom: true
    });
    token.draw();

    observer.trigger("info-token-added", {
        token
    });

});

const dialog2token = new WeakMap();

observer.on("info-token-added", ({ detail }) => {

    const {
        token
    } = detail;

    dialog2token.set(token.getDialog(), token);

});

function editToken(token, raw) {

    token.updateRaw(raw);
    observer.trigger("info-token-updated", {
        token
    });

}

function deleteToken(token) {

    Dialog.create(token.getDialog()).hide();
    token.remove();
    observer.trigger("info-token-deleted", {
        token
    });

}

dialogHolder.addEventListener("click", ({ target }) => {

    const button = target.closest("button[data-action]");

    if (!button) {
        return;
    }

    const token = dialog2token.get(button.closest(".js--info-token--dialog"));

    if (!token) {
        return;
    }

    switch (button.dataset.action) {

    case "edit":

        const data = token.getData();
        const text = window.prompt(window.I18N.customInfoToken, data.raw);

        if (text) {
            editToken(token, text);
        } else {
            deleteToken(token);
        }

        break;

    case "delete":

        deleteToken(token);
        break;

    }

});
