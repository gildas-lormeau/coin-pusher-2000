import Debug from "./debug/debug.js";
import Scene from "./scene.js";
import Cabinet from "./cabinet.js";
import Pointer from "./pointer.js";
import Camera from "./camera.js";

import initialState from "./data/initial-state.json" with { type: "json" };

const STEP_DELAY = Scene.TIMESTEP * 1000;

export default class {
    static DEBUG_MAX_SPEED = false;
    static DEBUG_EMPTY_POOL = false;
    static DEBUG_COLLIDERS = false;
    static DEBUG_FPS = false;
    static DEBUG_POLYGONS = false;
    static DEBUG_CONTROLS = false;
    static DEBUG_AUTOPLAY = false;
    static DEBUG_HIDE_CABINET = false;

    static #cabinet;
    static #time = 0;
    static #containerElement;
    static #stopped = false;
    static #restart = false;
    static #scene;
    static #pointer;

    static pixelRatio = 2;

    static async initialize({ rapier }) {
        this.#containerElement = document.body;
        const camera = new Camera(this.width / this.height);
        this.#scene = new Scene({
            containerElement: this.#containerElement,
            camera,
            rapier,
        });
        await this.#scene.initialize(this.width, this.height, this.pixelRatio);
        this.#cabinet = new Cabinet({ scene: this.#scene });
        this.#cabinet.DEBUG_AUTOPLAY = this.DEBUG_AUTOPLAY;
        this.#cabinet.DEBUG_HIDE_CABINET = this.DEBUG_HIDE_CABINET;
        await this.#cabinet.initialize();
        if (!this.DEBUG_EMPTY_POOL) {
            await this.load(initialState);
        }
        this.#pointer = new Pointer({
            scene: this.#scene,
            camera,
            interactiveObjects: this.#cabinet.interactiveObjects,
        });
        this.#pointer.initialize(this.width, this.height);
        Debug.DEBUG_COLLIDERS = this.DEBUG_COLLIDERS;
        Debug.DEBUG_FPS = this.DEBUG_FPS;
        Debug.DEBUG_POLYGONS = this.DEBUG_POLYGONS;
        Debug.DEBUG_CONTROLS = this.DEBUG_CONTROLS;
        await Debug.initialize({
            scene: this.#scene,
            camera,
            containerElement: this.#containerElement,
            joints: this.#cabinet.joints,
        });
        const resizeObserver = new ResizeObserver(() =>
            this.#onContainerResize()
        );
        resizeObserver.observe(this.#containerElement);
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
            this.#cabinet.update(this.#time);
            this.#pointer.update();
            Debug.update();
            this.#cabinet.refresh();
            this.#scene.render();
            this.#scene.step();
            this.#time += STEP_DELAY;
        }
        if (this.DEBUG_MAX_SPEED) {
            setTimeout(() => this.#update(), 0);
        } else {
            requestAnimationFrame(() => this.#update());
        }
    }

    static async save() {
        return {
            time: this.#time,
            cabinet: await this.#cabinet.save(),
        };
    }

    static async load(game) {
        this.#stopped = true;
        this.#time = game.time;
        await this.#cabinet.load(game.cabinet);
        this.#stopped = false;
        this.#restart = true;
    }

    static #onContainerResize() {
        this.#scene.resize(this.width, this.height, this.pixelRatio);
        this.#cabinet.resize(this.width, this.height);
        this.#pointer.resize(this.width, this.height);
    }

    static get width() {
        return this.#containerElement.clientWidth;
    }

    static get height() {
        return this.#containerElement.clientHeight;
    }
}
