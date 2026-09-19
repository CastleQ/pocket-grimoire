import Dialog from "../classes/Dialog.js";
import {
    lookupOne
} from "../utils/elements.js";

/**
 * 홍보용 안내 모달. "오늘은 그만보기"를 체크하고 닫으면 그날 자정까지만
 * 숨긴다. 자정이 지나면 (todayKey() 값이 바뀌므로) 다시 뜬다.
 *
 * PROMO_END 를 지나면 "그만보기" 체크 여부와 상관없이 아예 뜨지 않는다.
 * 행사가 끝나면 이 파일과 promo-notice.html.twig 를 통째로 지워도 된다.
 */

const STORAGE_KEY = "pg-promo-dismiss-date";
const PROMO_END = new Date(2026, 9, 3, 11, 0, 0); // 10월 3일(금) 오전 11시

function todayKey() {

    const now = new Date();

    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

}

const dialogEl = lookupOne("#promo-notice");

if (dialogEl && new Date() < PROMO_END) {

    let dismissedDate = "";

    try {
        dismissedDate = window.localStorage.getItem(STORAGE_KEY) || "";
    } catch (error) {
        dismissedDate = "";
    }

    if (dismissedDate !== todayKey()) {

        const dialog = Dialog.create(dialogEl);

        dialog.show();

        dialog.on(Dialog.HIDE, () => {

            const checkbox = lookupOne("#promo-notice-dismiss");

            if (checkbox && checkbox.checked) {

                try {
                    window.localStorage.setItem(STORAGE_KEY, todayKey());
                } catch (error) {
                    // 저장이 안 되면 다음에 또 뜰 뿐, 문제 없다.
                }

            }

        });

    }

}
