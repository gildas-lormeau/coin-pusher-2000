import Debug from "./debug/debug.js";
import Scene from "./scene.js";
import Cabinet from "./cabinet.js";
import Pointer from "./pointer.js";
import Camera from "./camera.js";

import initialState from "./data/initial-state.json" assert { type: "json" };

const STEP_DELAY = Scene.TIMESTEP * 1000;

export default class {

    static DEBUG_STEP_NO_DELAY = false;
    static DEBUG_EMPTY_POOL = false;
    static DEBUG_COLLIDERS = false;
    static DEBUG_FPS = false;
    static DEBUG_POLYGONS = false;
    static DEBUG_CONTROLS = false;
    static DEBUG_AUTOPLAY = false;

    static #state = {
        score: 0,
        coinsInPool: 20,
        time: 0
    };
    static #cabinet;
    static #containerElement;
    static #stopped = false;
    static #restart = false;
    static #scene;
    static #pointer;

    static async initialize() {
        const camera = new Camera();
        this.#containerElement = document.body;
        addEventListener("resize", () => this.#onWindowResize());
        const resizeObserver = new ResizeObserver(() => this.#onContainerResize());
        resizeObserver.observe(this.#containerElement);
        this.#scene = new Scene({
            containerElement: this.#containerElement,
            camera
        });
        this.#cabinet = new Cabinet(({
            scene: this.#scene,
            state: this.#state
        }));
        this.#cabinet.DEBUG_AUTOPLAY = this.DEBUG_AUTOPLAY;
        await this.#cabinet.initialize();
        if (!this.DEBUG_EMPTY_POOL) {
            await this.load(initialState);
        }
        this.#pointer = new Pointer({
            scene: this.#scene,
            camera,
            interactiveObjects: this.#cabinet.interactiveObjects
        });
        this.#pointer.initialize();
        Debug.DEBUG_COLLIDERS = this.DEBUG_COLLIDERS;
        Debug.DEBUG_FPS = this.DEBUG_FPS;
        Debug.DEBUG_POLYGONS = this.DEBUG_POLYGONS;
        Debug.DEBUG_CONTROLS = this.DEBUG_CONTROLS;
        await Debug.initialize({
            scene: this.#scene,
            camera,
            containerElement: this.#containerElement
        });
        onkeydown = async (event) => {
            if ((event.key === "s" || event.key === "S") && event.ctrlKey) {
                event.preventDefault();
                console.log(await this.save());
            }
            if ((event.key === "l" || event.key === "L") && event.ctrlKey) {
                event.preventDefault();
                await this.load(initialState);
            }
        };
    }

    static run() {
        this.#update();
    }

    static #update() {
        if (this.#restart) {
            this.#restart = false;
            this.#stopped = false;
        }
        if (!this.#stopped) {
            this.#cabinet.update(this.#state.time);
            this.#pointer.update();
            this.#scene.step();
            this.#scene.render();
            Debug.update();
            this.#state.time += STEP_DELAY;
        }
        if (this.DEBUG_STEP_NO_DELAY) {
            setTimeout(() => this.#update(), 0);
        } else {
            requestAnimationFrame(() => this.#update());
        }
    }

    static async save() {
        return {
            state: {
                score: this.#state.score,
                coinsInPool: this.#state.coinsInPool,
                time: this.#state.time
            },
            cabinet: await this.#cabinet.save()
        };
    }

    static async load(game) {
        this.#stopped = true;
        this.#state.score = game.state.score;
        this.#state.coinsInPool = game.state.coinsInPool;
        this.#state.time = game.state.time;
        await this.#cabinet.load(game.cabinet);
        this.#stopped = false;
        this.#restart = true;
    }

    static #onWindowResize() {
        this.#scene.resize(innerWidth, innerHeight);
    }

    static #onContainerResize() {
        const width = this.#containerElement.clientWidth;
        const height = this.#containerElement.clientHeight;
        this.#scene.resize(width, height);
    }
}