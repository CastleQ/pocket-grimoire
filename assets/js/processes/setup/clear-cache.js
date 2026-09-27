import Store from "../../classes/Store.js";
import Dialog from "../../classes/Dialog.js";
import Observer from "../../classes/Observer.js";
import {
    lookupOne,
    lookupCached,
    lookupOneCached,
    announceInput
} from "../../utils/elements.js";

const store = Store.create("pocket-grimoire");
const clears = lookupCached("input[name=\"clear\"]");

lookupOne("#clear-all").addEventListener("change", ({ target }) => {

    lookupOneCached("#clear-individual").hidden = target.checked;

    if (target.checked) {

        clears.forEach((input) => {

            input.checked = true;
            announceInput(input);

        });

    }

});

lookupOne("#clear-tokens").addEventListener("change", ({ target }) => {
    lookupOneCached("#token-warning").hidden = !target.checked;
});

lookupOne("#clear-infoTokens").addEventListener("change", ({ target }) => {
    lookupOneCached("#info-token-warning").hidden = !target.checked;
});

lookupOne("#cache-form").addEventListener("submit", (e) => {

    e.preventDefault();

    clears.forEach(({ value, checked }) => {

        if (checked) {
            store.delete(value);
        }

    });

    // 지워진 저장값을 화면에 반영한다 (마도서 인원 현황 등).
    Observer.create("game").trigger("cache-cleared");

    if (lookupOneCached("#clear-refresh").checked) {
        window.location.reload();
    }

    Dialog.create(lookupOneCached("#clear-cache")).hide();

});
