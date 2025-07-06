import { CSS3DRenderer, CSS3DObject } from "three/examples/jsm/renderers/CSS3DRenderer.js";
import { Vector3 } from "three";

const MODEL_PATH = "./assets/screen.glb";
const INDEX_VIEW_PATH = "./views/index.html";

const DISPLAY_MATERIAL_NAME = "display";
const SCREEN_WIDTH = 0.442;
const SCREEN_HEIGHT = 0.319;
const Z_AXIS = new Vector3(0, 0, 1);

export default class {

    #scene;
    #window;
    #css3DRenderer;
    #css3DObject;
    #screenReady;
    #cameraPosition = new Vector3();
    #screenNormal = new Vector3();
    #screenVisible;

    constructor({ scene }) {
        this.#scene = scene;
        this.#window = document.createElement("iframe");
        this.#window.style.width = `${SCREEN_WIDTH * 1000}px`;
        this.#window.style.height = `${SCREEN_HEIGHT * 1000}px`;
        this.#window.style.border = "none";
        this.#css3DRenderer = new CSS3DRenderer();
        this.#css3DRenderer.setSize(window.innerWidth, window.innerHeight);
        this.#css3DRenderer.domElement.style.position = "absolute";
        this.#css3DRenderer.domElement.style.top = 0;
        scene.containerElement.appendChild(this.#css3DRenderer.domElement);
    }

    async initialize() {
        const { screenPosition, screenRotation } = await initializeModel({ scene: this.#scene });
        this.#css3DObject = new CSS3DObject(this.#window);
        this.#css3DObject.position.copy(screenPosition);
        this.#css3DObject.rotation.copy(screenRotation);
        this.#css3DObject.scale.set(0.001, 0.001, 0.001);
        this.#scene.css3DScene.add(this.#css3DObject);
        addEventListener("message", () => this.#screenReady = true, { once: true });
        this.#window.src = INDEX_VIEW_PATH;
    }

    update() {
        this.#cameraPosition.copy(this.#scene.camera.position);
        this.#screenNormal.copy(Z_AXIS)
            .applyQuaternion(this.#css3DObject.quaternion);
        this.#screenVisible = this.#cameraPosition
            .sub(this.#css3DObject.position)
            .normalize()
            .dot(this.#screenNormal) > 0;
    }

    refresh() {
        this.#css3DObject.visible = this.#screenVisible;
        this.#css3DRenderer.render(this.#scene.css3DScene, this.#scene.camera);
    }

    resize(width, height) {
        if (this.#css3DRenderer) {
            this.#css3DRenderer.setSize(width, height);
        }
    }

    showDemoMode() {
        this.#postMessage({
            type: "showDemoMode"
        });
    }

    showRunStart(data) {
        this.#postMessage({
            type: "showRunStart",
            ...data
        });
    }

    showRunComplete(data) {
        this.#postMessage({
            type: "showRunComplete",
            ...data
        });
    }

    #postMessage(data) {
        if (this.#screenReady) {
            this.#window.contentWindow.postMessage(data, "*");
        }
    }
}

async function initializeModel({ scene }) {
    const model = await scene.loadModel(MODEL_PATH);
    const mesh = model.scene;
    let screenPosition, screenRotation;
    mesh.traverse(child => {
        const name = child.name;
        if (name === DISPLAY_MATERIAL_NAME) {
            screenPosition = child.position;
            screenRotation = child.rotation;
        }
    });
    scene.addObject(mesh);
    return {
        screenPosition,
        screenRotation
    };
}