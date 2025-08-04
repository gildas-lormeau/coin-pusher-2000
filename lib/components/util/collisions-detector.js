export default class {
    constructor({ scene, cabinet }) {
        this.#scene = scene;
        this.#cabinet = cabinet;
        this.#previousCollisions = new WeakMap();
    }

    #scene;
    #cabinet;
    #sensorColliders;
    #previousCollisions;

    initialize() {
        this.#sensorColliders = this.#cabinet.sensorColliders();
    }

    update() {
        const currentCollisions = new WeakMap();
        this.#scene.forEachSensorCollision(this.#sensorColliders, (userData, otherUserData) => {
            if (userData.onIntersect !== undefined || otherUserData.onIntersect !== undefined) {
                addCollision(currentCollisions, userData, otherUserData);
                addCollision(currentCollisions, otherUserData, userData);
                let wasColliding = false;
                if (this.#previousCollisions.has(userData)) {
                    const collidedSet = this.#previousCollisions.get(userData);
                    if (collidedSet.has(otherUserData)) {
                        wasColliding = true;
                    }
                }
                if (!wasColliding && userData.onIntersect !== undefined) {
                    userData.onIntersect(otherUserData);
                }
            }
        });
        this.#previousCollisions = currentCollisions;
    }
}

function addCollision(map, a, b) {
    if (!map.has(a)) {
        map.set(a, new WeakSet());
    }
    map.get(a).add(b);
}