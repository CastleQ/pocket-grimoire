// import "./processes/errors.js";

import "./processes/setup/general.js";
import "./processes/setup/select-edition.js";
import "./processes/setup/select-characters.js";
import "./processes/setup/select-your-character.js";
import "./processes/setup/character-sheet.js";
import "./processes/setup/clear-cache.js";

import "./processes/grimoire/general.js";
import "./processes/grimoire/characters.js";
import "./processes/grimoire/reminders.js";
import "./processes/grimoire/demon-bluffs.js";
import "./processes/grimoire/reset.js";
import "./processes/grimoire/travellers.js";
import "./processes/grimoire/fabled.js";
import "./processes/grimoire/export.js";

import "./processes/jinxes.js";

import "./processes/night-order.js";

import "./processes/info-tokens.js";

import "./processes/notes.js";

import "./processes/acknowledgements.js";

// store.js 보다 반드시 먼저 와야 한다. store.js 가 처음 방문자에게도
// 판번호를 기록해버리기 때문에, 그 전에 확인해야 처음 온 사람을 가려낼 수 있다.
import "./processes/update-notice.js";

import "./processes/store.js";

import "./processes/setup/distribute.js";
import "./processes/setup/whale-bucket.js";
