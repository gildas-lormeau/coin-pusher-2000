import DigitsPanel from "./digits-panel.js";

const DIGITS_COUNT_SCORE = 6;
const COLOR_SCORE = 2;
const POSITION_SCORE = [0.6, .88, -0.33];
const ROTATION_SCORE = [0, 0, 0];
const DIGITS_COUNT_COINS = 6;
const COLOR_COINS = 0;
const POSITION_COINS = [0.6, 1.11, -0.33];
const ROTATION_COINS = [0, 0, 0];
const DIGITS_COUNT_COINS_IN_PLAY = 3;
const COLOR_COINS_IN_PLAY = 0;
const POSITION_COINS_IN_PLAY = [-0.8075, 0.22, 0.77];
const ROTATION_COINS_IN_PLAY = [0, 0, 0];
const SCALE_COINS_IN_PLAY = [.7, .7, 1];

export default class {

    constructor({ scene, cabinet, state }) {
        this.#scene = scene;
        this.#cabinet = cabinet;
        this.#state = state;
    }

    #scene;
    #cabinet;
    #state;
    #score;
    #coinsInPool;
    #coinsInPlay;

    async initialize() {
        this.#score = new DigitsPanel({
            scene: this.#scene,
            position: POSITION_SCORE,
            rotation: ROTATION_SCORE,
            digitsCount: DIGITS_COUNT_SCORE,
            color: COLOR_SCORE
        });
        await this.#score.initialize();
        this.#coinsInPool = new DigitsPanel({
            scene: this.#scene,
            position: POSITION_COINS,
            rotation: ROTATION_COINS,
            digitsCount: DIGITS_COUNT_COINS,
            color: COLOR_COINS
        });
        await this.#coinsInPool.initialize();
        this.#coinsInPlay = new DigitsPanel({
            scene: this.#scene,
            position: POSITION_COINS_IN_PLAY,
            rotation: ROTATION_COINS_IN_PLAY,
            scale: SCALE_COINS_IN_PLAY,
            digitsCount: DIGITS_COUNT_COINS_IN_PLAY,
            color: COLOR_COINS_IN_PLAY
        });
        await this.#coinsInPlay.initialize();
    }

    update(time) {
        this.#score.set(this.#state.score);
        this.#coinsInPool.set(this.#state.coinsInPool);
        this.#coinsInPlay.set(this.#cabinet.coinCount);
        this.#score.update(time);
        this.#coinsInPool.update(time);
        this.#coinsInPlay.update(time);
    }

}