import DigitsPanel from "./digits-panel.js";

const DIGITS_COUNT_SCORE = 6;
const COLOR_SCORE = 2;
const POSITION_SCORE = [0.5, 0.9, -0.32];
const ROTATION_SCORE = [0, 0, 0];
const DIGITS_COUNT_COINS_IN_POOL = 6;
const COLOR_COINS_IN_POOL = 0;
const POSITION_COINS_IN_POOL = [0.5, 0.75, -0.32];
const ROTATION_COINS_IN_POOL = [0, 0, 0];
const DIGITS_COUNT_COINS_IN_PLAY = 3;
const COLOR_COINS_IN_PLAY = 1;
const POSITION_COINS_IN_PLAY = [-0.95, 0.29, 0.67];
const ROTATION_COINS_IN_PLAY = [-Math.PI / 2, 0, 0];

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
            position: POSITION_COINS_IN_POOL,
            rotation: ROTATION_COINS_IN_POOL,
            digitsCount: DIGITS_COUNT_COINS_IN_POOL,
            color: COLOR_COINS_IN_POOL
        });
        await this.#coinsInPool.initialize();
        this.#coinsInPlay = new DigitsPanel({
            scene: this.#scene,
            position: POSITION_COINS_IN_PLAY,
            rotation: ROTATION_COINS_IN_PLAY,
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