export default class {
    constructor({ scene, containerElement }) {
        this.#scene = scene;
        this.#polygonsCounter = document.createElement("div");
        this.#polygonsCounter.style.position = "absolute";
        this.#polygonsCounter.style.bottom = "10px";
        this.#polygonsCounter.style.left = "10px";
        this.#polygonsCounter.style.color = "white";
        this.#polygonsCounter.style.fontSize = "20px";
        this.#polygonsCounter.style.zIndex = "1000";
        this.#polygonsCounter.style.pointerEvents = "none";
        this.#polygonsCounter.style.userSelect = "none";
        this.#polygonsCounter.style.fontFamily = "Arial, sans-serif";
        this.#polygonsCounter.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
        this.#polygonsCounter.style.padding = "5px";
        this.#polygonsCounter.style.borderRadius = "5px";
        this.#polygonsCounter.style.boxShadow = "0 0 10px rgba(0, 0, 0, 0.5)";
        containerElement.appendChild(this.#polygonsCounter);
    }

    #scene = null;
    #polygonsCounter = null;

    initialize() {
        // do nothing
    }

    update() {
        const drawnTriangles = this.#scene.triangles;
        this.#polygonsCounter.innerText = `Polygons: ${Intl.NumberFormat("en-US").format(drawnTriangles)}`;
    }
}