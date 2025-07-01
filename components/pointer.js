import { Vector2, Raycaster } from "three";

export default class {
    constructor({ scene, camera, interactiveObjects }) {
        this.#scene = scene;
        this.#camera = camera;
        this.#interactiveObjects = interactiveObjects;
    }

    #scene;
    #camera;
    #interactiveObjects;
    #position = new Vector2();
    #raycaster = new Raycaster();

    initialize(width, height) {
        addEventListener("mousemove", event => {
            this.#position.x = (event.clientX / width) * 2 - 1;
            this.#position.y = -(event.clientY / height) * 2 + 1;
            this.#raycaster.setFromCamera(this.#position, this.#camera);
            const intersects = this.#raycaster.intersectObjects(this.#scene.children);
            if (intersects.length && this.#interactiveObjects.includes(intersects[0].object)) {
                document.body.style.cursor = "pointer";
            } else {
                document.body.style.cursor = "default";
            }
        });

        addEventListener("click", event => {
            this.#raycaster.setFromCamera(this.#position, this.#camera);
            const intersects = this.#raycaster.intersectObjects(this.#scene.children);
            if (intersects.length && this.#interactiveObjects.includes(intersects[0].object)) {
                if (!event.defaultPrevented) {
                    intersects[0].object.userData.onClick(intersects[0].instanceId);
                    event.preventDefault();
                }
            };
        });
    }

    update() {
        // do nothing
    }

    resize(width, height) {
        this.#camera.aspect = width / height;
        this.#camera.updateProjectionMatrix();
        this.#raycaster.setFromCamera(this.#position, this.#camera);
    }
}