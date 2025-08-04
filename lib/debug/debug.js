import DebugWireframes from "./components/wireframes.js";
import DebugFPS from "./components/fps.js";
import DebugPolygons from "./components/polygons.js";
import DebugControls from "./components/controls.js";

export default class {

    static DEBUG_COLLIDERS = false;
    static DEBUG_FPS = false;
    static DEBUG_POLYGONS = false;
    static DEBUG_CONTROLS = false;

    static #scene;
    static #containerElement;
    static #camera;
    static #debugWireframes;
    static #debugFPS;
    static #debugPolygons;
    static #debugControls;

    static async initialize({ scene, containerElement, camera, joints }) {
        this.#scene = scene;
        this.#containerElement = containerElement;
        this.#camera = camera;
        if (this.DEBUG_COLLIDERS) {
            this.#debugWireframes = new DebugWireframes({ scene: this.#scene, joints });
            this.#debugWireframes.initialize();
        }
        if (this.DEBUG_FPS) {
            this.#debugFPS = new DebugFPS({ containerElement: this.#containerElement });
            this.#debugFPS.initialize();
        }
        if (this.DEBUG_POLYGONS) {
            this.#debugPolygons = new DebugPolygons({ scene: this.#scene, containerElement: this.#containerElement });
            this.#debugPolygons.initialize();
        }
        if (this.DEBUG_CONTROLS) {
            this.#debugControls = new DebugControls({
                scene: this.#scene,
                containerElement: this.#containerElement,
                camera: this.#camera
            });
            this.#debugControls.initialize();
        }
    }

    static update() {
        if (this.DEBUG_COLLIDERS) {
            this.#debugWireframes.update();
        }
        if (this.DEBUG_FPS) {
            this.#debugFPS.update();
        }
        if (this.DEBUG_POLYGONS) {
            this.#debugPolygons.update();
        }
        if (this.DEBUG_CONTROLS) {
            this.#debugControls.update();
        }
    }
}