import { Vector3 } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const TARGET_POSITION = new Vector3(0, 0.45, 0);

export default class {
    constructor({ camera, containerElement }) {
        this.#camera = camera;
        this.#containerElement = containerElement;
    }

    #camera;
    #containerElement;

    initialize() {
        const controls = new OrbitControls(this.#camera, this.#containerElement);
        controls.target.copy(TARGET_POSITION);
        controls.update();
    }

    update() {
        // do nothing
    }
}