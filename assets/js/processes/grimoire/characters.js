import Dialog from "../../classes/Dialog.js";
import SelectDialog from "../../classes/SelectDialog.js";
import Observer from "../../classes/Observer.js";
import Pad from "../../classes/Pad.js";
import Template from "../../classes/Template.js";
import TokenStore from "../../classes/TokenStore.js";
import TokenDialog from "../../classes/TokenDialog.js";
import Names from "../../classes/Names.js";
import {
    identify,
    lookup,
    lookupOne,
    lookupOneCached,
    replaceContentsMany
} from "../../utils/elements.js";

const gameObserver = Observer.create("game");
const tokenObserver = Observer.create("token");
const pad = lookupOneCached(".js--pad").pad;
const recentReminders = lookupOneCached("#character-show-reminders");
const characterShowDialog = Dialog.create(lookupOneCached("#character-show"));
const tokenDialog = TokenDialog.get();
tokenDialog.setEntryTemplate(new Template(lookupOne("#token-entry-template")));

// ── 캐릭터 Wiki 바로가기 ───────────────────────────────────────────────────
// 공식 캐릭터(홈브류 아님 + 번역 가이드가 있는 id)는 [자세히보기] 대신
// [캐릭터 Wiki 바로가기] → 확인창 → 새 창으로 guide.html?id=... 를 연다.
// 가이드 위치: 정적 배포(/pocket-grimoire/)는 그리모어와 같은 폴더,
// 개발 환경(/ko_KR/ 등 로케일 경로)은 public 루트. (distribute.js 의 claim.html 규칙과 동일)
const wikiConfirmDialog = Dialog.create(lookupOneCached("#character-wiki-confirm"));
const guideBase = /\/[a-z]{2}_[A-Z]{2}(\/|$)/.test(window.location.pathname)
    ? "/"
    : window.location.pathname.replace(/[^/]*$/, "");
//
// 커스텀 시트(파일·URL·내장 커스텀/틴시빌)의 캐릭터는 앱에서 홈브류(isCustom)로 만들어지는 경우가
// 많다(시트 id 가 "noble1"처럼 정발 데이터 방식이라 앱 id "noble"과 짝이 안 맞음). 그래서 위키 버튼
// 판단에만 아래 순서로 공식 캐릭터를 추론한다. 화면의 능력 문구 등 시트 내용은 그대로 둔다(A안).
//   1) id 그대로 / 끝의 "1" 제거 / 알려진 철자 오타  → 그 캐릭터 가이드
//   2) 한글 이름(띄어쓰기 무시)이 정발 이름과 같고 유형(team)도 같음, 또는 옛 이름 대조표 → 그 캐릭터 가이드
//   3) 확신하기 어려움(이름이 정발 이름을 포함하거나, 이름은 같은데 유형이 다름) → 도감 메인 페이지
//      단, 시트 대부분이 공식 캐릭터로 추론되는 "커스텀 시트"일 때만. 홈브류 위주 시트는 [자세히보기] 그대로.
const WIKI_SITE_URL = "https://castleq.github.io/botc-wiki-ko/";
const ID_TYPOS = { begger: "beggar", spritofivory: "spiritofivory" };
// 내장 커스텀 시트의 옛 번역 이름 → 정발 id (능력 문구로 대조 확인함)
const OLD_NAMES = {
    몽상가: "dreamer",
    야간경비대: "nightwatchman",
    궁정신하: "courtier",
    어부: "fisherman",
    까마귀사육사: "ravenkeeper",
    양귀비재배자: "poppygrower",
    고자질쟁이: "snitch",
    돌연변이: "mutant",
    공포조장가: "fearmonger",
    붐댄디: "boomdandy",
    팡구: "fanggu",
    슈겐자: "shugenja",
    기구조종사: "balloonist",
    마을바보: "villageidiot",
    진홍색여인: "scarletwoman",
    비고모르티스: "vigormortis",
    밀수업자: "bootlegger",
    "진(지니)": "djinn",
    상아의정령: "spiritofivory"
};
const CUSTOM_SCRIPT_KEY = "pg_wiki_custom_script";
let guideIds = [];
let officialByName = Object.create(null);
let officialTeam = Object.create(null);
let customScript = false;

function squash(text) {
    return String(text || "").replace(/\s+/g, "");
}

const wikiDataReady = Promise.all([
    fetch(guideBase + "guide/data/index.json", { cache: "no-cache" })
        .then((response) => (response.ok ? response.json() : [])),
    fetch(guideBase + "guide/data/roles.json", { cache: "no-cache" })
        .then((response) => (response.ok ? response.json() : {}))
]).then(([ids, roles]) => {

    guideIds = Array.isArray(ids) ? ids : [];
    Object.entries(roles || {}).forEach(([id, role]) => {
        officialByName[squash(role.name)] = id;
        officialTeam[id] = role.team;
    });

}).catch(() => {
    guideIds = [];
});

// 새로고침 뒤에도 같은 시트라면 "커스텀 시트" 판정을 이어서 쓴다.
try {
    const saved = JSON.parse(window.localStorage.getItem(CUSTOM_SCRIPT_KEY) || "null");
    customScript = Boolean(
        saved
        && saved.name === (window.localStorage.getItem("pg_current_script") || "")
        && saved.custom
    );
} catch (ignore) {
    customScript = false;
}

function findOfficialId(character) {

    const rawId = String(character.getId() || "").replace(/[-_]/g, "").toLowerCase();
    const candidates = [rawId, rawId.replace(/1$/, "")];

    candidates.push(ID_TYPOS[candidates[1]] || "");

    const byId = candidates.find((id) => id && guideIds.includes(id));

    if (byId) {
        return byId;
    }

    const name = squash(character.getName());
    const byName = officialByName[name];

    if (byName && officialTeam[byName] === character.getTeam()) {
        return byName;
    }

    return OLD_NAMES[name] || "";

}

function isUncertainOfficial(character) {

    const name = squash(character.getName());

    if (officialByName[name]) {
        return true; // 이름은 같은데 유형이 다름
    }

    return Object.keys(officialByName).some((official) => (
        official.length >= 2 && name.includes(official)
    ));

}

// 반환: { url, subject } 또는 null(홈브류 → [자세히보기])
function getWikiTarget(character) {

    if (!character) {
        return null;
    }

    if (!character.isCustom()) {
        const id = character.getId();
        return guideIds.includes(id)
            ? { url: guideBase + "guide.html?id=" + encodeURIComponent(id), subject: "이 캐릭터의" }
            : null;
    }

    const officialId = findOfficialId(character);

    if (officialId) {
        return { url: guideBase + "guide.html?id=" + encodeURIComponent(officialId), subject: "이 캐릭터의" };
    }

    if (customScript && isUncertainOfficial(character)) {
        return { url: WIKI_SITE_URL, subject: "공식" };
    }

    return null;

}

// 시트를 고를 때마다, 그 시트의 캐릭터 대부분(절반 이상)이 공식으로 추론되면 "커스텀 시트"로 본다.
gameObserver.on("characters-selected", ({ detail }) => {

    const characters = (detail && detail.characters) || [];

    wikiDataReady.then(() => {

        const official = characters.filter((character) => (
            character && (!character.isCustom() || findOfficialId(character))
        )).length;

        customScript = characters.length > 0 && official / characters.length >= 0.5;

        try {
            window.localStorage.setItem(CUSTOM_SCRIPT_KEY, JSON.stringify({
                name: (detail && detail.name) || "",
                custom: customScript
            }));
        } catch (ignore) {
            // localStorage 사용 불가 시 무시
        }

    });

});

// ── 작업 5: 사망/제거/변경 시 관련 리마인더 자동 제거 ─────────────────────────
// 캐릭터의 ability에 "죽어도(사망 후에도) 효과가 유지"됨을 뜻하는 문구가 있으면
// 리마인더를 남겨야 하므로 확인창을 띄우지 않는다. (공식/커스텀 JSON 공통 적용)
const DEATH_PERSIST_PATTERNS = [
    /당신이[^.。\n]{0,15}사망/,      // 당신이 사망하면 / 당신이 (조건) 사망할 때 / 사망하더라도
    /당신이[^.。\n]{0,15}죽/,        // 당신이 죽으면
    /당신을[^.。\n]{0,12}죽이/,      // 당신을 죽이면
    /[(（][^)）]{0,20}(사망|죽)[^)）]{0,20}[)）]/  // (사망한 상태에서도)/(죽었더라도)/(죽은 뒤에도) 등
];

function deathMattersAbility(ability) {

    if (!ability) {
        return false;
    }

    return DEATH_PERSIST_PATTERNS.some((pattern) => pattern.test(ability));

}

// 캐릭터의 관련 리마인더(글로벌 제외)를 확인창을 거쳐 제거한다.
// ability가 "사망 후에도 유효" 문구를 포함하면 확인창 자체를 띄우지 않는다.
function maybeRemoveReminders(character) {

    if (!character || deathMattersAbility(character.getAbility())) {
        return;
    }

    const count = pad.getCharacterReminderCount(character);

    if (count < 1) {
        return;
    }

    const name = character.getName() || "이 캐릭터";
    const confirmed = window.confirm(
        `${name}의 관련 리마인더 ${count}개도 함께 제거할까요?\n(글로벌 리마인더는 유지됩니다)`
    );

    if (confirmed) {
        pad.removeCharacterReminders(character);
    }

}

// Set up the token dialog when a character token is clicked.
tokenObserver.on("character-click", ({ detail }) => {

    const {
        element
    } = detail;
    const character = pad.getCharacterByToken(element);

    characterShowDialog.getElement().dataset.token = `#${identify(element)}`;
    lookupOneCached("#character-show-name").textContent = character.getName();
    lookupOneCached("#character-show-ability").textContent = character.getAbility();

    const showButton = lookupOneCached("#character-show-token");
    const wikiTarget = getWikiTarget(character);
    const wikiId = wikiTarget ? wikiTarget.url : "";
    showButton.dataset.wikiId = wikiId;
    showButton.dataset.wikiSubject = wikiTarget ? wikiTarget.subject : "";
    showButton.textContent = (
        wikiId
        ? showButton.dataset.labelWiki
        : showButton.dataset.labelDefault
    );
    recentReminders.dataset.coords = JSON.stringify(pad.getTokenPosition(element));

    characterShowDialog.show();

});

// Update the recently-added-reminders list as a reminder is added.
tokenObserver.on("reminder-add", ({ detail }) => {

    const {
        reminder
    } = detail;
    const id = reminder.getId();
    const items = lookup(".js--reminder-list--item", recentReminders);

    const existing = items.find(({ dataset }) => dataset.reminderId === id);

    if (existing && existing === items[0]) {
        return;
    }

    if (items.length > 2 || (existing && existing !== items[0])) {
        (existing || items[items.length - 1]).remove();
    }

    recentReminders.prepend(reminder.drawList());

});

function getToken(target) {
    return lookupOne(target.closest("[data-token]").dataset.token);
}

function hideDialog(target) {
    Dialog.create(target.closest(".dialog")).hide();
}

TokenStore.ready(() => {

    // Show a token as it's clicked from the "show tokens" dialog.
    lookupOne("#character-show-token").addEventListener("click", ({ target }) => {

        const wikiId = target.dataset.wikiId;

        if (wikiId) {

            wikiConfirmDialog.getElement().dataset.url = wikiId;
            lookupOneCached("#character-wiki-subject").textContent = target.dataset.wikiSubject || "이 캐릭터의";
            hideDialog(target);
            wikiConfirmDialog.show();
            return;

        }

        tokenDialog.setIds([
            pad.getCharacterByToken(getToken(target)).getId()
        ]);
        tokenDialog.show();

        hideDialog(target);

    });

});

lookupOne("#character-wiki-yes").addEventListener("click", () => {

    const url = wikiConfirmDialog.getElement().dataset.url;

    wikiConfirmDialog.hide();

    if (url) {
        window.open(url, "_blank", "noopener");
    }

});

lookupOne("#character-shroud-toggle").addEventListener("click", ({ target }) => {

    const token = getToken(target);
    const character = pad.getCharacterByToken(token);
    pad.toggleDeadByToken(token);
    hideDialog(target);

    // 사망 상태로 "전환"된 경우에만 리마인더 제거를 확인한다.
    if (character && character.getIsDead()) {
        maybeRemoveReminders(character);
    }

});

lookupOne("#character-rotate").addEventListener("click", ({ target }) => {

    pad.rotateByToken(getToken(target));
    hideDialog(target);

});

const imageToggleButton = lookupOne("#character-image-toggle");
if (imageToggleButton) {
    imageToggleButton.addEventListener("click", ({ target }) => {
        pad.toggleImageByToken(getToken(target));
        hideDialog(target);
    });
}

lookupOne("#character-reminder").addEventListener("click", ({ target }) => {

    const reminder = lookupOneCached("#reminder-list");
    const token = getToken(target);

    reminder.dataset.coords = JSON.stringify(pad.getTokenPosition(token));
    Dialog.create(reminder).show();
    hideDialog(target);

});

const characterListDialog = SelectDialog.get();
characterListDialog.addProcess({

    // The generic process: add a token to the pad when the icon is clicked.

    click(tokenId) {

        TokenStore.ready((tokenStore) => {
            pad.addCharacter(tokenStore.getCharacterClone(tokenId));
        });
        characterListDialog.hide();

    }

});

// The process that will replace one token in the grimoire with another one.
const replaceOnPadProcess = {

    data: null,

    click(tokenId) {

        TokenStore.ready((tokenStore) => {

            const {
                character,
                token: newToken
            } = (() => {
                // 교체는 자동 잠금해제 대상에서 제외한다(순수 추가만 해제).
                tokenObserver.suppressAutoUnlock = true;
                try {
                    return pad.addCharacter(tokenStore.getCharacterClone(tokenId));
                } finally {
                    tokenObserver.suppressAutoUnlock = false;
                }
            })();
            const {
                data
            } = this;

            if (data) {

                const {
                    token,
                    coords: {
                        x,
                        y,
                        z
                    }
                } = data;

                const oldCharacter = pad.getCharacterByToken(lookupOne(token));
                pad.toggleDead(character, oldCharacter.getIsDead());
                pad.rotate(character, oldCharacter.getIsUpsideDown());
                pad.toggleImage(character, oldCharacter.getImageIndex());
                pad.setPlayerName(character, pad.getPlayerName(oldCharacter));
                maybeRemoveReminders(oldCharacter);
                pad.removeCharacter(oldCharacter);
                pad.moveToken(newToken, x, y, z);

            }

        });

        characterListDialog.hide();

    },

    hide() {
        this.data = null;
        characterListDialog.removeProcess(replaceOnPadProcess);
    }

};

lookupOne("#character-replace").addEventListener("click", ({ target }) => {

    const token = getToken(target);
    replaceOnPadProcess.data = {
        coords: pad.getTokenPosition(token),
        token: `#${identify(token)}`
    };
    characterListDialog.addProcess(replaceOnPadProcess);
    characterListDialog.show();
    hideDialog(target);

});

// The process that will add another token to the token dialog.
const addToDialogProcess = {

    click(tokenId) {
        tokenDialog.addId(tokenId);
        tokenDialog.show();
        characterListDialog.hide();
    },

    hide() {
        characterListDialog.removeProcess(addToDialogProcess);
    }

};

lookupOne(".js--token--add").addEventListener("click", () => {
    characterListDialog.addProcess(addToDialogProcess);
    characterListDialog.show();
    tokenDialog.hide();
});

const characterNameInput = lookupOne("#character-name-input");
lookupOne("#character-name").addEventListener("click", ({ target }) => {

    const {
        value
    } = characterNameInput;
    const name = (value || "").trim();

    pad.setPlayerNameForToken(getToken(target), name);
    hideDialog(target);

});

const ghostVoteButton = lookupOneCached("#character-ghost-vote");

function setGhostButtonState(character) {

    ghostVoteButton.disabled = (
        ghostVoteButton,
        !character.getIsDead() || !character.getHasGhostVote()
    );

}

lookupOneCached("#character-show").addEventListener(Dialog.SHOW, ({ target }) => {

    const token = lookupOne(target.dataset.token);
    const character = pad.getCharacterByToken(token);

    setGhostButtonState(character);

});

ghostVoteButton.addEventListener("click", ({ target }) => {

    const token = getToken(target);
    pad.setGhostVoteForToken(token, false);

    const character = pad.getCharacterByToken(token);
    setGhostButtonState(character);

    hideDialog(target);

});

characterShowDialog.on(Dialog.SHOW, () => {

    const token = getToken(characterShowDialog.getElement());
    characterNameInput.value = pad.getPlayerNameForToken(token);

    lookupOneCached("#character-show-orphan").hidden = (
        !token.classList.contains("is-orphan")
    );

});

characterShowDialog.on(Dialog.HIDE, () => {
    characterNameInput.value = characterNameInput.defaultValue;
});

lookupOne("#character-remove").addEventListener("click", ({ target }) => {

    const token = getToken(target);
    const character = pad.getCharacterByToken(token);

    if (character) {
        maybeRemoveReminders(character);
    }

    pad.removeCharacterByToken(token);
    hideDialog(target);

});

// Update the night order on the tokens.
// #72: Use objects rather than arrays to allow for decimals in night orders.
const nightOrder = {
    first: Object.create(null),
    other: Object.create(null)
};

function getSortedKeys(object) {
    return Object.keys(object).sort((a, b) => Number(a) - Number(b));
}

function assignCounts(object, dataKey) {

    let count = 0;

    getSortedKeys(object).forEach((key) => {

        const tokens = object[key];

        count += 1;

        tokens.forEach(({ token }) => {
            Pad.getToken(token).dataset[dataKey] = count;
        });

    });

}

function updateTokens() {

    assignCounts(nightOrder.first, "firstNight");
    assignCounts(nightOrder.other, "otherNight");

}

tokenObserver.on("character-add", ({ detail }) => {

    const {
        character,
        token
    } = detail;
    const {
        first,
        other
    } = nightOrder;

    const firstNight = character.getFirstNight();

    if (firstNight) {

        if (!first[firstNight]) {
            first[firstNight] = [];
        }

        first[firstNight].push({
            character,
            token
        });

    }

    const otherNight = character.getOtherNight();

    if (otherNight) {

        if (!other[otherNight]) {
            other[otherNight] = [];
        }

        other[otherNight].push({
            character,
            token
        });

    }

    updateTokens();

});

tokenObserver.on("character-remove", ({ detail }) => {

    const {
        character,
        token
    } = detail;
    const {
        first,
        other
    } = nightOrder;

    const firstNight = character.getFirstNight();
    const firstArray = first[firstNight];

    if (firstArray) {

        const index = firstArray.findIndex((info) => info.token === token);

        if (index > -1) {
            firstArray.splice(index, 1);
        }

        if (!firstArray.length) {
            delete first[firstNight];
        }

    }

    const otherNight = character.getOtherNight();
    const otherArray = other[otherNight];

    if (otherArray) {

        const index = otherArray.findIndex((info) => info.token === token);

        if (index > -1) {
            otherArray.splice(index, 1);
        }

        if (!otherArray.length) {
            delete other[otherNight];
        }

    }

    updateTokens();

});

// List of tokens.
// TODO: could we use character.drawList() here?

const tokenListTemplate = Template.create(lookupOne("#token-list-template"));
const tokenList = lookupOne("#token-list__list");

gameObserver.on("characters-selected", ({ detail }) => {

    const characters = detail.characters.filter((character) => {
        const team = character.getTeam();
        return team !== "traveller";
    });

    replaceContentsMany(
        tokenList,
        characters.map((character) => tokenListTemplate.draw({
            ".js--token-list--button"(element) {
                element.dataset.tokenId = character.getId();
            },
            ".js--token-list--token"(element) {
                element.append(character.drawToken());
            }
        }))
    );

});

// #131 - highlight any orphan character and reminder tokens.
gameObserver.on("characters-selected", ({ detail }) => {

    TokenStore.ready((store) => {

        pad.characters.forEach(({ character, token }) => {

            if (["traveller", "fabled", "loric"].includes(character.getTeam())) {
                return;
            }

            const index = detail.characters.findIndex((char) => {
                return char.getId() === character.getId();
            });

            token.classList.toggle("is-orphan", index < 0);

        });

        pad.reminders.forEach(({ reminder, token }) => {

            const character = store.getCharacter(reminder.getCharacterId());

            // 커스텀 알림(custom-alert)처럼 연결된 캐릭터가 없는 알림은 건너뛴다.
            // (여기서 멈추면 뒤따르는 알림들의 is-orphan 표시가 빠진다.)
            if (!character) {
                return;
            }

            if (["traveller", "fabled", "loric"].includes(character.getTeam())) {
                return;
            }

            const index = detail.characters.findIndex((char) => {
                return char.getId() === character.getId();
            });

            token.classList.toggle("is-orphan", index < 0);

        });

    });

});

TokenStore.ready((tokenStore) => {

    tokenDialog.setTokenStore(tokenStore);
    const tokenListDialog = Dialog.create(lookupOne("#token-list"));

    tokenList.addEventListener("click", ({ target }) => {

        const button = target.closest("[data-token-id]");

        if (!button) {
            return;
        }

        tokenDialog.setIds([button.dataset.tokenId]);
        tokenDialog.show();
        tokenListDialog.hide();

    });

});

// Update the list of suggested names that can be set when a token is drawn.

const names = Names.create();

names.on("names-added", () => {

    replaceContentsMany(
        lookupOneCached("#player-name-options"),
        names.drawList()
    );
    replaceContentsMany(
        lookupOneCached("#character-name-input-options"),
        names.drawList()
    );

});

names.on("names-cleared", () => {

    empty(lookupOneCached("#player-name-options"));
    empty(lookupOneCached("#character-name-input-options"));

});