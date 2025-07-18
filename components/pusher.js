import { Vector3 } from "three";

const SPEED = Math.PI / 60;
const DISTANCE = 0.10;
const PUSHER_PHASE_PRECISION = 0.001;
const DOOR_POSITION_PRECISION = 0.0001;
const DOOR_SPEED = 0.003;
const DOOR_MAX_DISTANCE = 0.3;
const MODEL_PATH = "./assets/pusher.glb";
const DOOR_PART_NAME = "door";
const PLATFORM_PART_NAME = "platform";
const DELIVERY_POSITION = "delivery-position";
const LIGHTS_EMISSIVE_COLOR = 0x5353A6;
const LIGHTS_MIN_INTENSITY = 0;
const LIGHTS_MAX_INTENSITY = 1.5;
const LIGHTS_ON_DURATION = 10; // ms

const PUSHER_STATES = {
    MOVING: Symbol.for("pusher-moving"),
    PREPARING_DELIVERY: Symbol.for("pusher-preparing-delivery"),
    OPENING_DOOR: Symbol.for("pusher-opening-door"),
    DELIVERING_BONUS: Symbol.for("pusher-delivering-bonus"),
    DELIVER_BONUS: Symbol.for("pusher-deliver-bonus"),
    CLOSING_DOOR: Symbol.for("pusher-closing-door")
};
const LIGHTS_STATES = {
    IDLE: Symbol.for("pusher-lights-idle"),
    ACTIVATING: Symbol.for("pusher-lights-activating"),
    ROTATING: Symbol.for("pusher-lights-rotating"),
    DELIVERING: Symbol.for("pusher-lights-delivering")
};


export default class {
    constructor({ scene, onDeliverBonus }) {
        this.#scene = scene;
        this.#onDeliverBonus = onDeliverBonus;
    }

    #scene;
    #parts;
    #door;
    #platform;
    #deliveryPosition;
    #onDeliverBonus;
    #lightBulbsMaterials;
    #platformPosition = new Vector3();
    #doorPosition = new Vector3();
    #pusher = {
        state: PUSHER_STATES.MOVING,
        nextState: null,
        rewards: [],
        phase: 0,
        platform: {},
        door: {
            position: 0
        },
        lights: {
            state: LIGHTS_STATES.IDLE,
            nextState: null,
            frameLastRefresh: -1,
            headIndex: 0,
            bulbs: []
        }
    };

    async initialize() {
        const { parts, deliveryPosition, lightBulbsMaterials } = await initializeModel({ scene: this.#scene });
        this.#parts = parts;
        this.#deliveryPosition = deliveryPosition;
        this.#lightBulbsMaterials = lightBulbsMaterials;
        initializeColliders({ scene: this.#scene, parts });
        initializeLights({ lightBulbsMaterials: this.#lightBulbsMaterials, lights: this.#pusher.lights });
        this.#door = parts.get(DOOR_PART_NAME);
        this.#platform = parts.get(PLATFORM_PART_NAME);
        parts.forEach(({ body, meshes }) => {
            meshes.forEach(({ data }) => this.#scene.addObject(data));
            body.setEnabled(true);
        });
    }

    update() {
        if (this.#pusher.nextState) {
            this.#pusher.state = this.#pusher.nextState;
            this.#pusher.nextState = null;
        }
        if (this.#pusher.lights.nextState) {
            this.#pusher.lights.state = this.#pusher.lights.nextState;
            this.#pusher.lights.nextState = null;
        }
        updatePusherState({ pusher: this.#pusher });
        updateLightsState({ pusher: this.#pusher });
        if (this.#pusher.state === PUSHER_STATES.DELIVERING_BONUS) {
            const reward = this.#pusher.rewards.shift();
            this.#onDeliverBonus({
                reward,
                position: this.#deliveryPosition
            });
        }
        this.#platformPosition.setZ(Math.sin(this.#pusher.phase) * DISTANCE);
        this.#doorPosition.setZ(this.#pusher.door.position);
        this.#platform.body.setNextKinematicTranslation(this.#platformPosition);
        this.#door.body.setNextKinematicTranslation(this.#platformPosition.sub(this.#doorPosition));
    }

    refresh() {
        this.#parts.forEach(({ meshes, body }) => {
            meshes.forEach(({ data }) => {
                data.position.copy(body.translation());
                data.quaternion.copy(body.rotation());
            });
        });
        if (this.#pusher.lights.state !== LIGHTS_STATES.IDLE) {
            this.#pusher.lights.bulbs.forEach((bulb, indexBulb) => {
                this.#lightBulbsMaterials[indexBulb].emissiveIntensity = bulb.intensity;
            });
        }
    }

    deliverBonus(reward) {
        this.#pusher.rewards.push(reward);
        if (this.#pusher.state === PUSHER_STATES.MOVING) {
            this.#pusher.state = PUSHER_STATES.PREPARING_DELIVERY;
        }
    }

    get phase() {
        return this.#pusher.phase;
    }

    save() {
        return {
            state: this.#pusher.state.description,
            nextState: this.#pusher.nextState ? this.#pusher.nextState.description : null,
            phase: this.#pusher.phase,
            rewards: [...this.#pusher.rewards],
            platformBodyHandle: this.#platform.body.handle,
            doorBodyHandle: this.#door.body.handle,
            door: {
                position: this.#pusher.door.position
            },
            lights: {
                state: this.#pusher.lights.state.description,
                nextState: this.#pusher.lights.nextState ? this.#pusher.lights.nextState.description : null,
                frameLastRefresh: this.#pusher.lights.frameLastRefresh,
                headIndex: this.#pusher.lights.headIndex,
                bulbs: this.#pusher.lights.bulbs.map(bulb => ({ intensity: bulb.intensity }))
            }
        };
    }

    load(pusher) {
        this.#pusher.state = Symbol.for(pusher.state);
        this.#pusher.nextState = pusher.nextState ? Symbol.for(pusher.nextState) : null;
        this.#pusher.rewards = pusher.rewards;
        this.#pusher.phase = pusher.phase;
        this.#platform.body = this.#scene.worldBodies.get(pusher.platformBodyHandle);
        this.#door.body = this.#scene.worldBodies.get(pusher.doorBodyHandle);
        this.#pusher.door.position = pusher.door.position;
        this.#pusher.lights.state = Symbol.for(pusher.lights.state);
        this.#pusher.lights.nextState = pusher.lights.nextState ? Symbol.for(pusher.lights.nextState) : null;
        this.#pusher.lights.frameLastRefresh = pusher.lights.frameLastRefresh;
        this.#pusher.lights.headIndex = pusher.lights.headIndex;
        this.#pusher.lights.bulbs = pusher.lights.bulbs.map(bulb => ({
            intensity: bulb.intensity
        }));
    }
}

function updatePusherState({ pusher }) {
    switch (pusher.state) {
        case PUSHER_STATES.MOVING:
            pusher.phase = (pusher.phase + SPEED) % (Math.PI * 2);
            break;
        case PUSHER_STATES.PREPARING_DELIVERY:
            pusher.phase = (pusher.phase + SPEED) % (Math.PI * 2);
            if (pusher.lights.state === LIGHTS_STATES.IDLE) {
                pusher.lights.state = LIGHTS_STATES.ACTIVATING;
            }
            if (pusher.phase > Math.PI * 1.5 && pusher.phase < Math.PI * 1.5 + PUSHER_PHASE_PRECISION) {
                pusher.nextState = PUSHER_STATES.OPENING_DOOR;
            }
            break;
        case PUSHER_STATES.OPENING_DOOR:
            pusher.door.position = pusher.door.position + DOOR_SPEED;
            if (pusher.door.position > DOOR_MAX_DISTANCE) {
                pusher.nextState = PUSHER_STATES.DELIVERING_BONUS;
            }
            break;
        case PUSHER_STATES.DELIVERING_BONUS:
            pusher.nextState = PUSHER_STATES.CLOSING_DOOR;
            break;
        case PUSHER_STATES.CLOSING_DOOR:
            if (pusher.door.position > DOOR_POSITION_PRECISION) {
                pusher.door.position = pusher.door.position - DOOR_SPEED;
            } else {
                pusher.door.position = 0;
                if (pusher.rewards.length > 1) {
                    pusher.nextState = PUSHER_STATES.PREPARING_DELIVERY;
                } else {
                    pusher.nextState = PUSHER_STATES.MOVING;
                }
            }
            break;
    }
}

function updateLightsState({ pusher }) {
    switch (pusher.lights.state) {
        case LIGHTS_STATES.IDLE:
            break;
        case LIGHTS_STATES.ACTIVATING:
            pusher.lights.frameLastRefresh = 0;
            pusher.lights.nextState = LIGHTS_STATES.ROTATING;
            break;
        case LIGHTS_STATES.ROTATING:
            refreshRotatingLights(pusher);
            if (pusher.state === PUSHER_STATES.DELIVERING_BONUS) {
                pusher.lights.nextState = LIGHTS_STATES.DELIVERING;
            }
            break;
        case LIGHTS_STATES.DELIVERING:
            refreshBlinkingLights(pusher);
            if (pusher.state === PUSHER_STATES.MOVING &&
                pusher.phase < Math.PI &&
                pusher.phase > .5 * Math.PI - PUSHER_PHASE_PRECISION) {
                pusher.lights.bulbs.forEach(bulb => {
                    bulb.intensity = LIGHTS_MIN_INTENSITY;
                });
                pusher.lights.headIndex = 0;
                pusher.lights.frameLastRefresh = -1;
                pusher.lights.nextState = LIGHTS_STATES.IDLE;
            }
            break;
        default:
            break;
    }
}

function refreshRotatingLights(pusher) {
    pusher.lights.frameLastRefresh++;
    if (pusher.lights.frameLastRefresh > LIGHTS_ON_DURATION) {
        pusher.lights.frameLastRefresh = 0;
        pusher.lights.bulbs.forEach((bulb, indexBulb) => {
            bulb.intensity = indexBulb >= pusher.lights.headIndex * 9 && indexBulb < (pusher.lights.headIndex + 1) * 9
                ? LIGHTS_MAX_INTENSITY
                : LIGHTS_MIN_INTENSITY;
        });
        pusher.lights.headIndex = (pusher.lights.headIndex + 2) % 3;
    }
}

function refreshBlinkingLights(pusher) {
    pusher.lights.frameLastRefresh++;
    if (pusher.lights.frameLastRefresh > LIGHTS_ON_DURATION) {
        const intensity = pusher.lights.bulbs[0].intensity;
        pusher.lights.frameLastRefresh = 0;
        pusher.lights.bulbs.forEach((bulb) => {
            bulb.intensity = intensity == LIGHTS_MAX_INTENSITY ? LIGHTS_MIN_INTENSITY : LIGHTS_MAX_INTENSITY;
        });
    }
}

async function initializeModel({ scene }) {
    const model = await scene.loadModel(MODEL_PATH);
    const mesh = model.scene;
    const parts = new Map();
    const deliveryPosition = new Vector3();
    const lightBulbsMaterials = [];
    mesh.traverse((child) => {
        if (child.isMesh) {
            const { material } = child;
            const userData = material.userData;
            const name = userData.name;
            if (userData.collider) {
                const partData = getPart(parts, name);
                partData.kinematic = partData.kinematic || userData.kinematic;
                partData.meshes.push({
                    friction: userData.friction,
                    restitution: userData.restitution,
                    kinematic: userData.kinematic,
                    cuboid: userData.cuboid,
                    rotation: userData.rotation ? new Vector3().fromArray(userData.rotation) : undefined,
                    size: userData.size ? new Vector3().fromArray(userData.size) : undefined,
                    data: child
                });
            } if (userData.light) {
                lightBulbsMaterials[child.material.userData.index] = child.material;
                const partData = getPart(parts, name);
                partData.meshes.push({
                    data: child
                });
            } else {
                const partData = getPart(parts, name);
                partData.meshes.push({
                    data: child
                });
            }
        } else if (child.userData.collider) {
            const partData = getPart(parts, child.userData.name);
            partData.colliders.push({
                friction: child.userData.friction,
                restitution: child.userData.restitution,
                kinematic: child.userData.kinematic,
                position: child.position,
                rotation: new Vector3().fromArray(child.userData.rotation),
                size: new Vector3().fromArray(child.userData.size)
            });
        } else if (child.name === DELIVERY_POSITION) {
            deliveryPosition.copy(child.position);
        }
    });
    return {
        parts,
        lightBulbsMaterials,
        deliveryPosition
    };
};

function getPart(parts, name) {
    let partData;
    if (!parts.has(name)) {
        partData = { meshes: [], colliders: [] };
        parts.set(name, partData);
    } else {
        partData = parts.get(name);
    }
    return partData;
}

function initializeColliders({ scene, parts }) {
    parts.forEach(partData => {
        const { meshes, kinematic, colliders } = partData;
        const body = partData.body = kinematic ? scene.createKinematicBody() : scene.createFixedBody();
        body.setEnabled(false);
        meshes.forEach(({ data, friction, restitution, cuboid }) => {
            if (cuboid) {
                const boundingBox = data.geometry.boundingBox;
                const position = new Vector3().addVectors(boundingBox.min, boundingBox.max).multiplyScalar(0.5).toArray();
                const size = new Vector3(boundingBox.max.x - boundingBox.min.x, boundingBox.max.y - boundingBox.min.y, boundingBox.max.z - boundingBox.min.z);
                const collider = scene.createCuboidCollider({
                    position,
                    width: size.x,
                    height: size.y,
                    depth: size.z,
                    friction,
                    restitution,
                }, body);
            }
        });
        colliders.forEach(({ friction, restitution, position, rotation, size }) => {
            const collider = scene.createCuboidCollider({
                position,
                width: size.x,
                height: size.y,
                depth: size.z,
                rotation,
                friction,
                restitution,
            }, body);
        });
    });
}

function initializeLights({ lightBulbsMaterials, lights }) {
    lightBulbsMaterials.forEach((material, indexMaterial) => {
        material.emissive.setHex(LIGHTS_EMISSIVE_COLOR);
        material.emissiveIntensity = LIGHTS_MIN_INTENSITY;
        lights.bulbs[indexMaterial] = {
            intensity: LIGHTS_MIN_INTENSITY
        };
    });
}