import Cards from "./cards.js";
import Coins from "./coins.js";
import Tokens from "./tokens.js";
import Buttons from "./buttons.js";
import Digits from "./digits.js";

export default class {
    static async initialize({ scene, onSpawnedCoin }) {
        await Promise.all([
            Cards.initialize({ scene }),
            Coins.initialize({ scene, onSpawnedCoin }),
            Tokens.initialize({ scene }),
            Buttons.initialize({ scene }),
            Digits.initialize({ scene })
        ]);
    }

    static update(time) {
        Cards.update();
        Coins.update(time);
        Tokens.update();
        Buttons.update(time);
        Digits.update();
    }

    static load(data) {
        Cards.load(data.cards);
        Coins.load(data.coins);
        Tokens.load(data.tokens);
        Buttons.load(data.buttons);
    }

    static save(data) {
        data.cards = Cards.save();
        data.coins = Coins.save();
        data.tokens = Tokens.save();
        data.buttons = Buttons.save();
    }    

}