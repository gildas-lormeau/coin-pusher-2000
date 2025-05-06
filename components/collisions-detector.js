export default class {
    constructor({ scene }) {
        this.#scene = scene;
        this.#previousCollisions = new WeakMap();
    }

    #scene;
    #previousCollisions;

    initialize() {
        // do nothing
    }

    update() {
        const currentCollisions = new WeakMap();
        this.#scene.forEachCollision((userData, otherUserData) => {
            if (userData.objectType !== undefined && otherUserData.objectType !== undefined) {
                addCollision(currentCollisions, userData, otherUserData);
                addCollision(currentCollisions, otherUserData, userData);
                let wasColliding = false;
                if (this.#previousCollisions.has(userData)) {
                    const collidedSet = this.#previousCollisions.get(userData);
                    if (collidedSet.has(otherUserData)) {
                        wasColliding = true;
                    }
                }
                if (!wasColliding) {
                    userData.onIntersect?.(otherUserData);
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