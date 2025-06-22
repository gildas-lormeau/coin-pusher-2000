import { Vector3 } from "three";

const SPEED = Math.PI / 60;
const DISTANCE = 0.10;
const BLOCKING_PLATFORM_POSITION_PRECISION = 0.0001;
const DOOR_SPEED = 0.003;
const DOOR_MAX_DISTANCE = 0.3;
const MODEL_PATH = "./../assets/pusher.glb";
const DOOR_PART_NAME = "door";
const PLATFORM_PART_NAME = "platform";
const DELIVERY_POSITION = "delivery-position";
const PUSHER_STATES = {
    MOVING: Symbol.for("pusher-moving"),
    PREPARING_DELIVERY: Symbol.for("pusher-preparing-delivery"),
    OPENING_DOOR: Symbol.for("pusher-opening-door"),
    DELIVERING_BONUS: Symbol.for("pusher-delivering-bonus"),
    DELIVER_BONUS: Symbol.for("pusher-deliver-bonus"),
    CLOSING_DOOR: Symbol.for("pusher-closing-door")
};

export default class {
    constructor({ scene, depositBonus }) {
        this.#scene = scene;
        this.#depositBonus = depositBonus;
    }

    #scene;
    #parts;
    #door;
    #platform;
    #deliveryPosition;
    #depositBonus;
    #pusher = {
        state: PUSHER_STATES.MOVING,
        rewards: [],
        phase: 0,
        platform: {
            position: new Vector3()
        },
        door: {
            position: 0
        }
    };

    async initialize() {
        const { parts, deliveryPosition } = await initializeModel({ scene: this.#scene });
        this.#parts = parts;
        this.#deliveryPosition = deliveryPosition;
        initializeColliders({ scene: this.#scene, parts });
        this.#door = parts.get(DOOR_PART_NAME);
        this.#platform = parts.get(PLATFORM_PART_NAME);
        parts.forEach(({ body, meshes }) => {
            meshes.forEach(({ data }) => this.#scene.addObject(data));
            body.setEnabled(true);
        });
    }

    update() {
        updatePusherState({ pusher: this.#pusher });
        if (this.#pusher.state === PUSHER_STATES.DELIVERING_BONUS) {
            const reward = this.#pusher.rewards.shift();
            this.#depositBonus({
                reward,
                position: this.#deliveryPosition
            });
        }
        const position = this.#pusher.platform.position;
        this.#platform.body.setNextKinematicTranslation(position);
        this.#door.body.setNextKinematicTranslation(new Vector3().copy(position).sub(new Vector3(0, 0, this.#pusher.door.position)));
        this.#parts.forEach(({ meshes, body }) => {
            meshes.forEach(({ data }) => {
                data.position.copy(body.translation());
                data.quaternion.copy(body.rotation());
            });
        });
    }

    deliverBonus(reward) {
        this.#pusher.rewards.push(reward);
        if (this.#pusher.state === PUSHER_STATES.MOVING) {
            this.#pusher.state = PUSHER_STATES.PREPARING_DELIVERY;
        }
    }

    get position() {
        return this.#pusher.platform.position;
    }

    save() {
        return {
            state: this.#pusher.state.description,
            phase: this.#pusher.phase,
            rewards: this.#pusher.rewards,
            platformBodyHandle: this.#platform.body.handle,
            platform: {
                position: this.#pusher.platform.position.z,
            },
            doorBodyHandle: this.#door.body.handle,
            door: {
                position: this.#pusher.door.position
            }
        };
    }

    load(pusher) {
        this.#pusher.state = Symbol.for(pusher.state);
        this.#pusher.rewards = pusher.rewards;
        this.#pusher.phase = pusher.phase;
        this.#platform.body = this.#scene.worldBodies.get(pusher.platformBodyHandle);
        this.#pusher.platform.position.z = pusher.position;
        this.#door.body = this.#scene.worldBodies.get(pusher.doorBodyHandle);
        this.#pusher.door.position = pusher.door.position;
    }
}

function updatePusherState({ pusher }) {
    switch (pusher.state) {
        case PUSHER_STATES.MOVING:
            updatePusherPosition({ pusher });
            break;
        case PUSHER_STATES.PREPARING_DELIVERY:
            updatePusherPosition({ pusher });
            if (pusher.platform.position.z < -DISTANCE + BLOCKING_PLATFORM_POSITION_PRECISION) {
                pusher.platform.position.z = -DISTANCE;
                pusher.state = PUSHER_STATES.OPENING_DOOR;
            }
            break;
        case PUSHER_STATES.OPENING_DOOR:
            pusher.door.position = pusher.door.position + DOOR_SPEED;
            if (pusher.door.position > DOOR_MAX_DISTANCE) {
                pusher.state = PUSHER_STATES.DELIVERING_BONUS;
            }
            break;
        case PUSHER_STATES.DELIVERING_BONUS:
            pusher.state = PUSHER_STATES.CLOSING_DOOR;
            break;
        case PUSHER_STATES.CLOSING_DOOR:
            if (pusher.door.position > BLOCKING_PLATFORM_POSITION_PRECISION) {
                pusher.door.position = pusher.door.position - DOOR_SPEED;
            } else {
                pusher.door.position = 0;
                if (pusher.rewards.length > 1) {
                    pusher.state = PUSHER_STATES.PREPARING_DELIVERY;
                } else {
                    pusher.state = PUSHER_STATES.MOVING;
                }
            }
            break;
    }
}

function updatePusherPosition({ pusher }) {
    pusher.phase = (pusher.phase + SPEED) % (Math.PI * 2);
    pusher.platform.position.z = (Math.sin(pusher.phase) * DISTANCE);
}

async function initializeModel({ scene }) {
    const model = await scene.loadModel(MODEL_PATH);
    const mesh = model.scene;
    const parts = new Map();
    const deliveryPosition = new Vector3();
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
            }
        } else if (child.name === DELIVERY_POSITION) {
            deliveryPosition.copy(child.position);
        }
    });
    return {
        parts,
        deliveryPosition
    };
};

function getPart(parts, name) {
    let partData;
    if (!parts.has(name)) {
        partData = { meshes: [] };
        parts.set(name, partData);
    } else {
        partData = parts.get(name);
    }
    return partData;
}

function initializeColliders({ scene, parts }) {
    let indexPart = 0;
    parts.forEach(partData => {
        const { meshes, kinematic } = partData;
        const body = partData.body = kinematic ? scene.createKinematicBody() : scene.createFixedBody();
        body.setEnabled(false);
        meshes.forEach(({ data, friction, restitution, rotation, cuboid, size }) => {
            if (cuboid) {
                let colliderSize;
                const boundingBox = data.geometry.boundingBox;
                const position = new Vector3().addVectors(boundingBox.min, boundingBox.max).multiplyScalar(0.5).toArray();
                if (size) {
                    colliderSize = size;
                } else {
                    colliderSize = new Vector3(boundingBox.max.x - boundingBox.min.x, boundingBox.max.y - boundingBox.min.y, boundingBox.max.z - boundingBox.min.z);
                }
                const collider = scene.createCuboidCollider({
                    position,
                    width: colliderSize.x,
                    height: colliderSize.y,
                    depth: colliderSize.z,
                    rotation,
                    friction,
                    restitution,
                }, body);
                collider.setCollisionGroups((1 << (indexPart % 16)) << 16 | (1 << (indexPart % 16)));
                indexPart++;
            }
        });
    });
}