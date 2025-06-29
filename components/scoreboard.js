import DigitsPanel from "./digits-panel.js";

const DIGITS_COUNT_SCORE = 8;
const COLOR_SCORE = 0;
const POSITION_SCORE = [-0.35, 1.115, -0.33];
const ROTATION_SCORE = [0, 0, 0];
const DIGITS_COUNT_COINS = 4;
const COLOR_COINS = 0;
const POSITION_COINS = [0.8, 1.115, -0.33];
const ROTATION_COINS = [0, 0, 0];
const DIGITS_COUNT_POINTS = 6;
const COLOR_POINTS = 0;
const POSITION_POINTS = [0.15, 1.115, -0.33];
const ROTATION_POINTS = [0, 0, 0];
const DIGITS_COUNT_COINS_IN_PLAY = 4;
const COLOR_COINS_IN_PLAY = 0;
const POSITION_COINS_IN_PLAY = [-0.8275, 0.22, 0.77];
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
    #points;
    #coins;
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
        this.#points = new DigitsPanel({
            scene: this.#scene,
            position: POSITION_POINTS,
            rotation: ROTATION_POINTS,
            digitsCount: DIGITS_COUNT_POINTS,
            color: COLOR_POINTS
        });
        await this.#points.initialize();
        this.#coins = new DigitsPanel({
            scene: this.#scene,
            position: POSITION_COINS,
            rotation: ROTATION_COINS,
            digitsCount: DIGITS_COUNT_COINS,
            color: COLOR_COINS
        });
        await this.#coins.initialize();
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
        this.#points.set(this.#state.points);
        this.#coins.set(this.#state.coins);
        this.#coinsInPlay.set(this.#cabinet.coinsInPlay);
        this.#score.update(time);
        this.#coins.update(time);
        this.#coinsInPlay.update(time);
        this.#points.update(time);
    }

}