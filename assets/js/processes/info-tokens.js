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
InfoToken.setHolders({
    button: buttonHolder,
    custom: lookupOne("#info-token-custom-holder"),
    dialog: dialogHolder
});

// 캐릭터 선택 칸이 있는 정보 토큰("당신은")은 그리모어의 캐릭터 선택창을
// 그대로 재사용해 이야기꾼이 고른 캐릭터 토큰을 보여준다.
const characterListDialog = SelectDialog.get();

function wireCharacterSelect(token) {

    const button = token.getCharacterSelectButton();

    // 아무 캐릭터도 고르지 않은 초기 상태는 악마의 속임수 칸과 똑같은 빈 캐릭터
    // 토큰(크림색 원판)으로 보여준다. CSS로 흉내낸 점선 원은 쓰지 않는다.
    TokenStore.ready((tokenStore) => {
        token.setCharacterToken(tokenStore.getEmptyCharacter().drawToken());
    });

    // #character-list는 "그리모어" 접이식 패널(<details id="grimoire">) 안에 있다.
    // 그 패널이 접혀 있으면 다이얼로그를 열어도 크기가 0이 되어 화면에 보이지 않으므로
    // (general.js의 #character-select 처리와 같은 이유), 여는 동안만 강제로 펼친다.
    let grimoireWasOpen = true;

    const process = {

        click(tokenId) {

            TokenStore.ready((tokenStore) => {
                token.setCharacterToken(tokenStore.getCharacter(tokenId).drawToken());
            });

            characterListDialog.hide();

        },

        hide() {

            characterListDialog.removeProcess(process);

            if (!grimoireWasOpen) {
                lookupOneCached("#grimoire").open = false;
            }

        }

    };

    button.addEventListener("click", () => {

        const grimoireSection = lookupOneCached("#grimoire");
        grimoireWasOpen = grimoireSection.open;
        grimoireSection.open = true;

        characterListDialog.addProcess(process);
        characterListDialog.show();

    });

}

JSON.parse(buttonHolder.dataset.infoTokens).forEach((data) => {

    const token = new InfoToken(data);
    token.draw();

    if (data.characterSelect) {
        wireCharacterSelect(token);
    }

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
