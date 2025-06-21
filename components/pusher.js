import { Vector3 } from "three";

const SPEED = 2;
const DISTANCE = 0.1075;
const WIDTH = 0.6;
const HEIGHT = 0.055;
const DEPTH = 0.6;
const FRICTION = 0;
const RESTITUTION = .05;
const POSITION = [0, 0.21, -0.22];
const START_ANGLE = Math.PI / 4;
const FLOOR_BACK_POSITION = [0, 0.135, -.18];
const FLOOR_FRONT_POSITION = [0, 0.132, 0.42];
const LEFT_WALL_POSITION = [-0.325, 0.215, -0.12];
const RIGHT_WALL_POSITION = [0.325, 0.215, -0.12];
const FLOOR_BACK_WIDTH = 0.75;
const FLOOR_FRONT_WIDTH = 1.2;
const FLOOR_HEIGHT = 0.1;
const FLOOR_BACK_DEPTH = .5;
const FLOOR_FRONT_DEPTH = 0.84;
const WALL_WIDTH = 0.05;
const WALL_HEIGHT = 0.15;
const WALL_DEPTH = 0.6;
const FLOOR_FRICTION = 0.05;
const FLOOR_RESTITUTION = 0;
const PUSHER_WALL_WIDTH = 0.005;
const BLOCKING_PLATFORM_POSITION_PRECISION = 0.0001;
const DOOR_SPEED = 0.003;
const DOOR_SOFT_CCD_PREDICTION = 0.001;
const DELIVERY_POSITION = [0, 0.215, -0.25];
const EDGE_HEIGHT = 0.005;
const EDGE_DEPTH = 0.005;
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
        timeOffset: 0,
        timePlatformStopped: -1,
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
        initializeColliders({ scene: this.#scene, parts: this.#pusher });
    }

    update(time) {
        updatePusherState({ pusher: this.#pusher, time: time - this.#pusher.timeOffset });
        if (this.#pusher.state === PUSHER_STATES.DELIVERING_BONUS) {
            this.#depositBonus({
                reward: this.#pusher.reward,
                position: new Vector3(...DELIVERY_POSITION)
            });
        }
        const position = this.#pusher.platform.position;
        const doorPosition = position.z - this.#pusher.door.position;
        this.#nextKinematicDoorTranslation.copy(position).setZ(doorPosition);
        this.#pusher.platform.bodies.forEach(body => body.setNextKinematicTranslation(position));
        this.#pusher.door.body.setNextKinematicTranslation(this.#nextKinematicDoorTranslation);
        this.#pusher.platform.mesh.position.copy(position);
        this.#pusher.door.mesh.position.copy(position).setZ(doorPosition);
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
            timeOffset: this.#pusher.timeOffset,
            timePlatformStopped: this.#pusher.timePlatformStopped,
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
        this.#pusher.timeOffset = pusher.timeOffset;
        this.#pusher.timePlatformStopped = pusher.timePlatformStopped;
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
            updatePusherPosition({ pusher, time });
            break;
        case PUSHER_STATES.PREPARING_DELIVERY:
            updatePusherPosition({ pusher, time });
            if (pusher.platform.position.z < POSITION[2] - DISTANCE + BLOCKING_PLATFORM_POSITION_PRECISION) {
                pusher.platform.position.z = POSITION[2] - DISTANCE;
                pusher.state = PUSHER_STATES.OPENING_DOOR;
                pusher.timePlatformStopped = time;
            }
            break;
        case PUSHER_STATES.OPENING_DOOR:
            pusher.door.position = pusher.door.position + DOOR_SPEED;
            if (pusher.door.position > POSITION[2] + DEPTH) {
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
                pusher.timeOffset += time - pusher.timePlatformStopped;
                pusher.timePlatformStopped = -1;
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

function updatePusherPosition({ pusher, time }) {
    pusher.platform.position.z = (Math.sin((time / 1000) * SPEED + START_ANGLE) * DISTANCE) + POSITION[2];
}

async function initializeModel({ scene, pusher }) {
    const model = await scene.loadModel(MODEL_PATH);
    pusher.platform.mesh = model.scene.children[0];
    pusher.door.mesh = model.scene.children[1];
    scene.addObject(pusher.platform.mesh);
    scene.addObject(pusher.door.mesh);
}

function initializeColliders({ scene, parts }) {
    const { platform, door } = parts;
    platform.bodies = [
        scene.createKinematicBody(),
        scene.createKinematicBody(),
        scene.createKinematicBody(),
        scene.createKinematicBody()
    ];
    let indexPart = 0, collider;
    collider = scene.createCuboidCollider({
        width: WIDTH,
        height: PUSHER_WALL_WIDTH,
        depth: DEPTH,
        friction: FRICTION,
        restitution: RESTITUTION,
        position: [0, (HEIGHT - PUSHER_WALL_WIDTH) / 2, 0]
    }, platform.bodies[0]);
    collider.setCollisionGroups((1 << (indexPart % 16)) << 16 | (1 << (indexPart % 16)));
    collider = scene.createCuboidCollider({
        width: PUSHER_WALL_WIDTH,
        height: HEIGHT - PUSHER_WALL_WIDTH,
        depth: DEPTH,
        friction: FRICTION,
        restitution: RESTITUTION,
        position: [-(WIDTH - PUSHER_WALL_WIDTH) / 2, -PUSHER_WALL_WIDTH / 2, 0]
    }, platform.bodies[1]);
    collider.setCollisionGroups((1 << (indexPart % 16)) << 16 | (1 << (indexPart % 16)));
    collider = scene.createCuboidCollider({
        width: PUSHER_WALL_WIDTH,
        height: HEIGHT - PUSHER_WALL_WIDTH,
        depth: DEPTH,
        friction: FRICTION,
        restitution: RESTITUTION,
        position: [(WIDTH - PUSHER_WALL_WIDTH) / 2, -PUSHER_WALL_WIDTH / 2, 0]
    }, platform.bodies[2]);
    collider.setCollisionGroups((1 << (indexPart % 16)) << 16 | (1 << (indexPart % 16)));
    collider = scene.createCuboidCollider({
        width: WIDTH,
        height: EDGE_HEIGHT,
        depth: EDGE_DEPTH,
        friction: FRICTION,
        restitution: RESTITUTION,
        position: [0, HEIGHT / 2 - PUSHER_WALL_WIDTH, DEPTH / 2],
        rotation: [Math.PI / 4, 0, 0]
    }, platform.bodies[3]);
    collider.setCollisionGroups((1 << (indexPart % 16)) << 16 | (1 << (indexPart % 16)));
    indexPart++;
    door.body = scene.createKinematicBody();
    collider = scene.createCuboidCollider({
        width: WIDTH - PUSHER_WALL_WIDTH * 2,
        height: HEIGHT - PUSHER_WALL_WIDTH,
        depth: PUSHER_WALL_WIDTH,
        friction: FRICTION,
        restitution: RESTITUTION,
        position: [0, -PUSHER_WALL_WIDTH / 2, (DEPTH - PUSHER_WALL_WIDTH) / 2 - door.position]
    }, door.body);
    collider.setCollisionGroups((1 << (indexPart % 16)) << 16 | (1 << (indexPart % 16)));
    indexPart++;
    door.body.setSoftCcdPrediction(DOOR_SOFT_CCD_PREDICTION);
    const cabinetBody = scene.createFixedBody();
    collider = scene.createCuboidCollider({
        width: FLOOR_BACK_WIDTH,
        height: FLOOR_HEIGHT,
        depth: FLOOR_BACK_DEPTH,
        friction: FLOOR_FRICTION,
        restitution: FLOOR_RESTITUTION,
        position: FLOOR_BACK_POSITION
    }, cabinetBody);
    collider.setCollisionGroups((1 << (indexPart % 16)) << 16 | (1 << (indexPart % 16)));
    collider = scene.createCuboidCollider({
        width: FLOOR_FRONT_WIDTH,
        height: FLOOR_HEIGHT,
        depth: FLOOR_FRONT_DEPTH,
        friction: FLOOR_FRICTION,
        restitution: FLOOR_RESTITUTION,
        position: FLOOR_FRONT_POSITION
    }, cabinetBody);
    collider.setCollisionGroups((1 << (indexPart % 16)) << 16 | (1 << (indexPart % 16)));
    collider = scene.createCuboidCollider({
        width: WALL_WIDTH,
        height: WALL_HEIGHT,
        depth: WALL_DEPTH,
        friction: FRICTION,
        restitution: RESTITUTION,
        position: LEFT_WALL_POSITION
    }, cabinetBody);
    collider.setCollisionGroups((1 << (indexPart % 16)) << 16 | (1 << (indexPart % 16)));
    collider = scene.createCuboidCollider({
        width: WALL_WIDTH,
        height: WALL_HEIGHT,
        depth: WALL_DEPTH,
        friction: FRICTION,
        restitution: RESTITUTION,
        position: RIGHT_WALL_POSITION
    }, cabinetBody);
    collider.setCollisionGroups((1 << (indexPart % 16)) << 16 | (1 << (indexPart % 16)));
}