import { Vector3 } from "three";

const SPEED = 2;
const DISTANCE = 0.1075;
const WIDTH = 0.6;
const HEIGHT = 0.05;
const DEPTH = 0.6;
const COLOR = 0xffffff;
const FRICTION = 0;
const RESTITUTION = .05;
const POSITION = [0, 0.21, -0.22];
const START_ANGLE = Math.PI / 4;
const FLOOR_POSITION = [0, 0.135, 0];
const LEFT_WALL_POSITION = [-0.325, 0.285, -0.12];
const RIGHT_WALL_POSITION = [0.325, 0.285, -0.12];
const FLOOR_WIDTH = 0.7;
const FLOOR_HEIGHT = 0.1;
const FLOOR_DEPTH = 1.25;
const WALL_WIDTH = 0.05;
const WALL_HEIGHT = 0.4;
const WALL_DEPTH = 0.6;
const FLOOR_FRICTION = 0.05;
const FLOOR_RESTITUTION = 0;
const PUSHER_WALL_WIDTH = 0.005;
const BLOCKING_PLATFORM_POSITION_PRECISION = 0.00001;
const DELIVERY_DELAY = 800;
const DOOR_SPEED = 0.002;
const DELIVERY_POSITION = [0, 0.215, -0.25];
const EDGE_HEIGHT = 0.01;
const EDGE_DEPTH = 0.01;
const MODEL_PATH = "./../assets/pusher.glb";
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
    #depositBonus;
    #nextKinematicDoorTranslation = new Vector3();
    #pusher = {
        state: PUSHER_STATES.MOVING,
        pendingRewards: [],
        timeDelivery: -1,
        initialDeltaZ: -1,
        reward: {
            coinCount: 0,
            cardCount: 0,
            tokenCount: 0
        },
        platform: {
            position: new Vector3(...POSITION),
            bodies: []
        },
        door: {
            position: 0
        }
    };

    async initialize() {
        await initializeModel({ scene: this.#scene, pusher: this.#pusher });
        this.#pusher.platform.mesh.material.color.setHex(COLOR);
        this.#pusher.platform.bodies = [
            this.#scene.createKinematicBody(),
            this.#scene.createKinematicBody(),
            this.#scene.createKinematicBody(),
            this.#scene.createKinematicBody()
        ];
        this.#scene.createCuboidCollider({
            width: WIDTH,
            height: PUSHER_WALL_WIDTH,
            depth: DEPTH,
            friction: FRICTION,
            restitution: RESTITUTION,
            position: [0, (HEIGHT - PUSHER_WALL_WIDTH) / 2, 0]
        }, this.#pusher.platform.bodies[0]);
        this.#scene.createCuboidCollider({
            width: PUSHER_WALL_WIDTH,
            height: HEIGHT - PUSHER_WALL_WIDTH,
            depth: DEPTH,
            friction: FRICTION,
            restitution: RESTITUTION,
            position: [-(WIDTH - PUSHER_WALL_WIDTH) / 2, -PUSHER_WALL_WIDTH / 2, 0]
        }, this.#pusher.platform.bodies[1]);
        this.#scene.createCuboidCollider({
            width: PUSHER_WALL_WIDTH,
            height: HEIGHT - PUSHER_WALL_WIDTH,
            depth: DEPTH,
            friction: FRICTION,
            restitution: RESTITUTION,
            position: [(WIDTH - PUSHER_WALL_WIDTH) / 2, -PUSHER_WALL_WIDTH / 2, 0]
        }, this.#pusher.platform.bodies[2]);
        this.#scene.createCuboidCollider({
            width: WIDTH,
            height: EDGE_HEIGHT,
            depth: EDGE_DEPTH,
            friction: FRICTION,
            restitution: RESTITUTION,
            position: [0, HEIGHT / 2 - PUSHER_WALL_WIDTH, DEPTH / 2],
            rotation: [Math.PI / 4, 0, 0]
        }, this.#pusher.platform.bodies[3]);
        this.#pusher.door.body = this.#scene.createKinematicBody();
        this.#scene.createCuboidCollider({
            width: WIDTH - PUSHER_WALL_WIDTH * 2,
            height: HEIGHT - PUSHER_WALL_WIDTH,
            depth: PUSHER_WALL_WIDTH,
            friction: FRICTION,
            restitution: RESTITUTION,
            position: [0, -PUSHER_WALL_WIDTH / 2, (DEPTH - PUSHER_WALL_WIDTH) / 2 - this.#pusher.door.position]
        }, this.#pusher.door.body);
        this.#scene.createCuboidCollider({
            width: FLOOR_WIDTH,
            height: FLOOR_HEIGHT,
            depth: FLOOR_DEPTH,
            friction: FLOOR_FRICTION,
            restitution: FLOOR_RESTITUTION,
            position: FLOOR_POSITION
        });
        this.#scene.createCuboidCollider({
            width: WALL_WIDTH,
            height: WALL_HEIGHT,
            depth: WALL_DEPTH,
            friction: FRICTION,
            restitution: RESTITUTION,
            position: LEFT_WALL_POSITION
        });
        this.#scene.createCuboidCollider({
            width: WALL_WIDTH,
            height: WALL_HEIGHT,
            depth: WALL_DEPTH,
            friction: FRICTION,
            restitution: RESTITUTION,
            position: RIGHT_WALL_POSITION
        });
    }

    update(time) {
        updatePusherState({ pusher: this.#pusher, time });
        if (this.#pusher.state === PUSHER_STATES.DELIVER_BONUS) {
            this.#depositBonus({
                reward: this.#pusher.reward,
                position: new Vector3(...DELIVERY_POSITION)
            });
        }
        const position = this.#pusher.platform.position;
        const doorPosition = position.z - this.#pusher.door.position;
        this.#nextKinematicDoorTranslation.set(position.x, position.y, doorPosition);
        this.#pusher.platform.bodies.forEach(body => body.setNextKinematicTranslation(position));
        this.#pusher.door.body.setNextKinematicTranslation(this.#nextKinematicDoorTranslation);
        this.#pusher.platform.mesh.position.set(position.x, position.y, position.z);
        this.#pusher.door.mesh.position.set(position.x, position.y, doorPosition);
    }

    deliverBonus(reward) {
        this.#pusher.pendingRewards.push(reward);
        this.#pusher.reward = reward;
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
            pendingRewards: this.#pusher.pendingRewards,
            timeDelivery: this.#pusher.timeDelivery,
            initialDeltaZ: this.#pusher.initialDeltaZ,
            reward: {
                coinCount: this.#pusher.reward.coinCount,
                cardCount: this.#pusher.reward.cardCount,
                tokenCount: this.#pusher.reward.tokenCount
            },
            platform: {
                position: this.#pusher.platform.position.z,
                bodyHandles: this.#pusher.platform.bodies.map(body => body.handle)
            },
            door: {
                position: this.#pusher.door.position,
                bodyHandle: this.#pusher.door.body.handle
            }
        };
    }

    load(pusher) {
        this.#pusher.state = Symbol.for(pusher.state);
        this.#pusher.pendingRewards = pusher.pendingRewards;
        this.#pusher.timeDelivery = pusher.timeDelivery;
        this.#pusher.initialDeltaZ = pusher.initialDeltaZ;
        this.#pusher.reward = {
            coinCount: pusher.reward.coinCount,
            cardCount: pusher.reward.cardCount,
            tokenCount: pusher.reward.tokenCount
        };
        this.#pusher.platform.bodies = pusher.platform.bodyHandles.map(handle => this.#scene.worldBodies.get(handle));
        this.#pusher.door.body = this.#scene.worldBodies.get(pusher.door.bodyHandle);
        this.#pusher.platform.position.z = pusher.position;
        this.#pusher.door.position = pusher.door.position;
    }

}


function updatePusherState({ pusher, time }) {
    switch (pusher.state) {
        case PUSHER_STATES.MOVING:
            updatePlatformPosition({ platform: pusher.platform, time });
            break;
        case PUSHER_STATES.PREPARING_DELIVERY:
            const deltaZ = updatePlatformPosition({ platform: pusher.platform, time });
            if (pusher.platform.position.z < POSITION[2] - DISTANCE + BLOCKING_PLATFORM_POSITION_PRECISION) {
                pusher.platform.position.z = POSITION[2] - DISTANCE;
                pusher.state = PUSHER_STATES.OPENING_DOOR;
                pusher.initialDeltaZ = deltaZ;
            }
            break;
        case PUSHER_STATES.OPENING_DOOR:
            pusher.door.position = pusher.door.position + DOOR_SPEED;
            if (pusher.door.position > POSITION[2] + DEPTH) {
                pusher.timeDelivery = time;
                pusher.state = PUSHER_STATES.DELIVERING_BONUS;
            }
            break;
        case PUSHER_STATES.DELIVERING_BONUS:
            if (time - pusher.timeDelivery > DELIVERY_DELAY) {
                pusher.state = PUSHER_STATES.DELIVER_BONUS;
            }
            break;
        case PUSHER_STATES.DELIVER_BONUS:
            pusher.state = PUSHER_STATES.CLOSING_DOOR;
            break;
        case PUSHER_STATES.CLOSING_DOOR:
            if (pusher.door.position > BLOCKING_PLATFORM_POSITION_PRECISION) {
                pusher.door.position = pusher.door.position - DOOR_SPEED;
            } else if (getDeltaZ(time) - pusher.initialDeltaZ < BLOCKING_PLATFORM_POSITION_PRECISION) {
                pusher.initialDeltaZ = -1;
                pusher.door.position = 0;
                pusher.pendingRewards.shift();
                if (pusher.pendingRewards.length > 0) {
                    pusher.reward = pusher.pendingRewards[0];
                    pusher.state = PUSHER_STATES.PREPARING_DELIVERY;
                } else {
                    pusher.reward = {
                        coinCount: 0,
                        cardCount: 0,
                        tokenCount: 0
                    };
                    pusher.state = PUSHER_STATES.MOVING;
                }
            }
            break;
    }
}

function updatePlatformPosition({ platform, time }) {
    const deltaZ = getDeltaZ(time);
    platform.position.z = POSITION[2] + deltaZ;
    return deltaZ;
}

function getDeltaZ(time) {
    return Math.sin((time / 1000) * SPEED + START_ANGLE) * DISTANCE;
}

async function initializeModel({ scene, pusher }) {
    const model = await scene.loadModel(MODEL_PATH);
    model.scene.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
    pusher.platform.mesh = model.scene.children[0];
    pusher.door.mesh = model.scene.children[1];
    scene.addObject(pusher.platform.mesh);
    scene.addObject(pusher.door.mesh);
}