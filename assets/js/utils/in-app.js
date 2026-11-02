// 카카오톡·인스타그램처럼 앱 안에서 열리는 브라우저(인앱 브라우저) 판별.
//
// 이런 브라우저는 <a download> 로 내려받는 파일 저장을 조용히 무시한다(눌러도 반응 없음).
// 그래서 저장 대신 그림을 화면에 띄우고 "길게 눌러 저장"을 안내한다.

const IN_APP = /KAKAOTALK|Instagram|FBAN|FBAV|NAVER\(inapp|\bLine\/|everytimeApp|DaumApps/i;

export function isInAppBrowser() {
    return IN_APP.test(navigator.userAgent || "");
}

export function isKakaoTalk() {
    return /KAKAOTALK/i.test(navigator.userAgent || "");
}

/**
 * 카카오톡 인앱 브라우저에서 지금 주소를 기기의 기본 브라우저로 연다.
 * 카카오톡이 제공하는 주소 형식(kakaotalk://web/openExternal)을 쓴다.
 *
 * @param {String} url
 *        열 주소.
 */
export function openInExternalBrowser(url) {
    window.location.href = "kakaotalk://web/openExternal?url=" + encodeURIComponent(url);
}

export const LONG_PRESS_HINT = "이 브라우저(카카오톡 등 앱 안 브라우저)는 파일 저장을 지원하지 않아요. 그림을 길게 눌러 '이미지 저장'을 눌러 주세요.";
