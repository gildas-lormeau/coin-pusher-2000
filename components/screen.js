import { CSS3DRenderer, CSS3DObject } from "three/examples/jsm/renderers/CSS3DRenderer.js";
import { Vector3 } from "three";

const MODEL_PATH = "./../assets/screen.glb";

const DISPLAY_MATERIAL_NAME = "display";
const SCREEN_WIDTH = 0.437;
const SCREEN_HEIGHT = 0.316;

export default class {

    #scene;
    #window;
    #css3DRenderer;
    #css3DObject;

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
        this.#window.src = "views/index.html";
        this.#css3DObject = new CSS3DObject(this.#window);
        this.#css3DObject.position.copy(screenPosition);
        this.#css3DObject.rotation.copy(screenRotation);
        this.#css3DObject.scale.set(0.001, 0.001, 0.001);
        this.#scene.css3DScene.add(this.#css3DObject);
    }

    update() {
        const cameraPosition = this.#scene.camera.position.clone();
        const screenPosition = this.#css3DObject.position.clone();
        const screenNormal = new Vector3(0, 0, 1);
        screenNormal.applyQuaternion(this.#css3DObject.quaternion);
        const viewVector = cameraPosition.sub(screenPosition).normalize();
        const dot = viewVector.dot(screenNormal);
        this.#css3DObject.visible = dot > 0;
        this.#css3DRenderer.render(this.#scene.css3DScene, this.#scene.camera);
    }

    resize(width, height) {
        if (this.#css3DRenderer) {
            this.#css3DRenderer.setSize(width, height);
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