import Cards from "./cards.js";
import Coins from "./coins.js";
import Tokens from "./tokens.js";
import DropButtons from "./drop-buttons.js";
import Digits from "./digits.js";

export default class {
    static async initialize({ scene }) {
        await Promise.all([
            Cards.initialize({ scene }),
            Coins.initialize({ scene }),
            Tokens.initialize({ scene }),
            DropButtons.initialize({ scene }),
            Digits.initialize({ scene })
        ]);
    }

    static update(time) {
        Cards.update();
        Coins.update(time);
        Tokens.update();
        DropButtons.update(time);
        Digits.update();
    }
}