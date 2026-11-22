// 참가자용 마도서 깔기 (주소 ?play=…). 판별·저장 칸은 utils/play-mode.js.
//
// 처음 여는 링크면: 장부에서 시트를 받아 고르고 → 판 비율을 맞추고 →
// 참가자 이름이 적힌 빈 접시를 이야기꾼 마도서와 같은 자리에 놓는다.
// 이후 바뀌는 것은 평소처럼 참가자 저장 칸에 저장되고, 다시 열면 그대로 복원된다.
//
// ⚠️ 브라우저 코드: async/await 금지 (규약 C-8)
import TokenStore from "../classes/TokenStore.js";
import Observer from "../classes/Observer.js";
import {
    IS_PLAY_MODE,
    PLAY_TOKEN,
    PLAY_SEATS,
    PLAY_IS_NEW,
    markPlaySetupDone
} from "../utils/play-mode.js";
import {
    fetchSharedSheet
} from "./setup/sheet-share.js";
import {
    lookupOne
} from "../utils/elements.js";
import {
    isInAppBrowser
} from "../utils/in-app.js";

const gameObserver = Observer.create("game");

// 남이 만든 링크의 그림 주소는 http(s)와 상대 경로만 받는다(sheet.js 의 safeImage 와 같은 기준).
function safeImage(value) {

    if (Array.isArray(value)) {
        return value.map(safeImage).filter(Boolean);
    }

    const source = String(value || "").trim();

    // 주소 맨 앞(첫 / 전)에 "xxx:" 가 있으면 http(s) 말고는 거른다(javascript:, data: 등).
    return ((/^https?:\/\//i).test(source) || !(/^[^/]*:/).test(source)) ? source : "";

}

function showStatus(message) {

    const status = lookupOne("#play-mode-status");

    status.textContent = message;
    status.hidden = !message;

}

function placeSeats(tokenStore) {

    const grimoire = lookupOne("#grimoire");
    const padElement = lookupOne(".js--pad");
    const pad = padElement.pad;

    grimoire.open = true;

    const seats = PLAY_SEATS.seats.map(([name, x, y]) => {

        const { token, character } = pad.addCharacter(tokenStore.getEmptyCharacter());

        if (name) {
            pad.setPlayerName(character, name);
        }

        return { token, x, y, zIndex: pad.tokens.advanceZIndex() };

    });

    // 판 높이와 접시 자리를 지금 판 폭에 맞춘다.
    function layout() {

        if (PLAY_SEATS.ratio) {

            const height = Math.round(padElement.getBoundingClientRect().width * PLAY_SEATS.ratio) + "px";

            padElement.style.height = height;
            gameObserver.trigger("pad-height-change", { height });

        }

        const { width, height } = pad.getPadDimensions();
        const size = pad.getTokenDimensions();

        seats.forEach(({ token, x, y, zIndex }) => pad.moveToken(
            token,
            x * Math.max(0, width - size.width),
            y * Math.max(0, height - size.height),
            zIndex
        ));

    }

    layout();

    // 웨일 "모바일 창" 등은 넓은 폭으로 열었다가 곧 줄어든다 → 그때 접시가 판 밖으로 나갔다.
    // 참가자가 판을 처음 만지기 전까지는 폭이 바뀌면 다시 맞춘다(직접 옮긴 자리는 지킨다).
    let lastWidth = pad.getPadDimensions().width;
    const onResize = () => {

        const { width } = pad.getPadDimensions();

        if (width && width !== lastWidth) {
            lastWidth = width;
            layout();
        }

    };
    const stop = () => {
        window.removeEventListener("resize", onResize);
        padElement.removeEventListener("pointerdown", stop);
    };

    window.addEventListener("resize", onResize);
    padElement.addEventListener("pointerdown", stop);

}

if (IS_PLAY_MODE) {

    // 원래 앱(이야기꾼 마도서)으로 돌아가는 링크: 주소에서 ?play=… 만 뺀다.
    lookupOne("#play-mode-exit").href = window.location.pathname;
    lookupOne("#play-mode-inapp").hidden = !isInAppBrowser();

    // [캐릭터 시트]는 공유·QR 창 없이 바로 시트 화면을 연다.
    // 캡처 단계에서 막아야 body 의 data-dialog 위임(setup/general.js)이 창을 띄우지 않는다.
    lookupOne("#qr-code-button").addEventListener("click", (event) => {
        event.stopPropagation();
        lookupOne("#open-sheet").click();
    }, true);

}

if (IS_PLAY_MODE && PLAY_IS_NEW) {

    showStatus("참가자용 마도서를 준비하는 중입니다…");

    TokenStore.ready((tokenStore) => fetchSharedSheet(PLAY_TOKEN).then((payload) => {

        if (!payload || !Array.isArray(payload.characters) || !payload.characters.length) {
            throw new Error("링크가 만료되었거나 올바르지 않습니다.");
        }

        // 공식 캐릭터는 앱의 정발 데이터를, 그 밖(홈브류)은 링크의 데이터를 쓴다
        // (select-edition.js 의 홈브류 시트 처리와 같은 방식).
        const characters = payload.characters
            .filter((data) => data && data.id)
            .map((data) => (
                tokenStore.getOfficialCharacter(TokenStore.normaliseId(String(data.id)))
                || tokenStore.createCustomCharacter({
                    ...data,
                    image: safeImage(data.image)
                })
            ));

        gameObserver.trigger("characters-selected", {
            name: String(payload.name || ""),
            characters,
            game: null,
            meta: payload.meta || null
        });

        placeSeats(tokenStore);

        // 처음 켜 둘 설정(나중에 참가자가 바꿀 수 있음). "input"은 저장(store.js), "change"는 화면 반영용.
        // - 접시의 밤 순서 숫자: 참가자 메모에는 헷갈리기만 하므로 끔
        // - 밤 순서 [플레이중이 아닌 캐릭터 표시]: 켬 (접시에 올린 캐릭터는 플레이 중으로 따로 표시됨)
        [["#show-night-order", false], ["#show-all", true]].forEach(([selector, checked]) => {
            const input = lookupOne(selector);
            input.checked = checked;
            ["input", "change"].forEach((type) => input.dispatchEvent(new Event(type, { bubbles: true })));
        });

        markPlaySetupDone();
        showStatus("");

    })).catch((error) => {
        showStatus("참가자용 마도서를 불러오지 못했습니다: " + error.message);
    });

}
