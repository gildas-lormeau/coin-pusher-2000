export default class {
    constructor({ containerElement }) {
        this.#fpsCounter = document.createElement("div");
        this.#fpsCounter.style.position = "absolute";
        this.#fpsCounter.style.top = "10px";
        this.#fpsCounter.style.left = "10px";
        this.#fpsCounter.style.color = "white";
        this.#fpsCounter.style.fontSize = "20px";
        this.#fpsCounter.style.zIndex = "1000";
        this.#fpsCounter.style.pointerEvents = "none";
        this.#fpsCounter.style.userSelect = "none";
        this.#fpsCounter.style.fontFamily = "Arial, sans-serif";
        this.#fpsCounter.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
        this.#fpsCounter.style.padding = "5px";
        this.#fpsCounter.style.borderRadius = "5px";
        this.#fpsCounter.style.boxShadow = "0 0 10px rgba(0, 0, 0, 0.5)";
        containerElement.appendChild(this.#fpsCounter);
    }

    #fpsCounter = null;
    #lastTime = 0;

    initialize() {
        // do nothing
    }

    update() {
        const time = performance.now();
        if (this.#lastTime) {
            const deltaTime = time - this.#lastTime;
            let fps = Math.round(1000 / deltaTime);
            this.#fpsCounter.innerText = `FPS: ${fps}`;
        }
        this.#lastTime = time;
    }
}
