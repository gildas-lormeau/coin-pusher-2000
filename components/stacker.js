import { Vector3, Quaternion } from "three";

const MODEL_PATH = "./../assets/stacker.glb";
const DROP_POSITION = "drop-position";
const PIVOT_POSITION = "pivot-position";
const COIN_ROTATION = new Vector3(0, 0, 0);
const COIN_HEIGHT = 0.006;
const Y_AXIS = new Vector3(0, 1, 0);
const ARM_SPEED = 0.02;
const BASE_MAX_SPEED = 0.01;
const BASE_SPEED = 0.002;
const STACKER_SPEED = 0.001;
const BASE_ROTATION_SPEED = Math.PI / 12;
const BASE_ROTATION_CLEANUP_SPEED = Math.PI / 9;
const BASE_CLEANUP_ROTATIONS = 2;
const COIN_SETTLED_POSITION_Y = 0.1475;
const COIN_SETTLED_RIGHT_POSITION_X = 0.07;
const COIN_IMPULSE_FORCE = new Vector3(-0.0000145, 0, 0);
const ARM_MAX_POSITION = 0.0825;
const ARM_INITIAL_POSITION = 0;
const ARM_MIN_POSITION = -0.07;
const STACKER_MAX_POSITION = 0.1;
const ROTATIONS_MAX = 6;
const BASE_INITIAL_ANGLE = 0;
const BASE_INITIAL_ROTATIONS = 0;
const BASE_INITIAL_POSITION = 0;
const STACKER_INITIAL_POSITION = 0;
const COMPLETE_TURN_ANGLE = Math.PI * 2;
const BASE_MAX_POSITION = 0.0125;
const LEVEL_MAX = 10;

const STACKER_STATES = {
    IDLE: Symbol.for("stacker-idle"),
    ACTIVATING: Symbol.for("stacker-activating"),
    RAISING_BASE: Symbol.for("stacker-raising-base"),
    HIDING_ARM: Symbol.for("stacker-hiding-arm"),
    CLEANING_UP_BASE: Symbol.for("stacker-cleaning-up-base"),
    LOWERING_BASE_TO_INITIAL_POSITION: Symbol.for("stacker-lowering-base-to-initial-position"),
    MOVING_ARM_TO_INITIAL_POSITION: Symbol.for("stacker-moving-arm-to-initial-position"),
    INITIALIZING_COIN: Symbol.for("stacker-initializing-coin"),
    PUSHING_COIN: Symbol.for("stacker-pushing-coin"),
    ROTATING_BASE: Symbol.for("stacker-rotating-base"),
    MOVING_ARM_TO_CENTER: Symbol.for("stacker-moving-arm-to-center"),
    MOVING_ARM_TO_RIGHT: Symbol.for("stacker-moving-arm-to-right"),
    LOWERING_BASE: Symbol.for("stacker-lowering-base"),
    RETRACTING_ARM: Symbol.for("stacker-retracting-arm"),
    LOWERING_STACKER: Symbol.for("stacker-lowering-stacker"),
    MOVING_ARM_BACK_TO_INITIAL_POSITION: Symbol.for("stacker-moving-arm-back-to-initial-position"),
    LOWERING_BASE_BACK_TO_INITIAL_POSITION: Symbol.for("stacker-lowering-base-back-to-initial-position")
};

export default class {

    #scene;
    #onInitializeCoin;
    #dropPosition;
    #pivotPosition;
    #stacker = {
        parts: null,
        level: 0,
        coin: null,
        coinPosition: 0,
        nextState: null,
        state: STACKER_STATES.IDLE,
        position: STACKER_INITIAL_POSITION,
        armPosition: ARM_INITIAL_POSITION,
        rotations: BASE_INITIAL_ROTATIONS,
        basePosition: BASE_INITIAL_POSITION,
        baseAngle: BASE_INITIAL_ANGLE
    };

    constructor({ scene, onInitializeCoin }) {
        this.#scene = scene;
        this.#onInitializeCoin = onInitializeCoin;
    }

    async initialize() {
        const scene = this.#scene;
        const { parts, dropPosition, pivotPosition } = await initializeModel({
            scene,
        });
        this.#dropPosition = dropPosition;
        this.#pivotPosition = pivotPosition;
        initializeColliders({
            scene,
            parts
        });
        parts.forEach(({ body, meshes }) => {
            meshes.forEach(({ data }) => this.#scene.addObject(data));
            body.setEnabled(true);
        });
        Object.assign(this.#stacker, { parts });
    }

    update() {
        updateStackerState({
            stacker: this.#stacker
        });
        const { parts, state } = this.#stacker;
        if (state !== STACKER_STATES.IDLE) {
            const base = parts.get("base");
            const support = parts.get("support");
            const arm = parts.get("arm");
            const armProtection = parts.get("arm-protection");
            parts.forEach(({ meshes, body }) => {
                meshes.forEach(({ data }) => {
                    data.position.copy(body.translation());
                    data.quaternion.copy(body.rotation());
                });
            });
            if (state === STACKER_STATES.ACTIVATING ||
                state === STACKER_STATES.LOWERING_STACKER) {
                const position = new Vector3().copy(base.body.translation());
                const armPosition = new Vector3().copy(arm.body.translation());
                const basePosition = new Vector3().copy(base.body.translation());
                position.setY(this.#stacker.position);
                armPosition.setY(this.#stacker.position);
                basePosition.setY(this.#stacker.position + this.#stacker.basePosition);
                base.body.setNextKinematicTranslation(basePosition);
                support.body.setNextKinematicTranslation(position);
                arm.body.setNextKinematicTranslation(armPosition);
                armProtection.body.setNextKinematicTranslation(position);
            }
            if (state === STACKER_STATES.RAISING_BASE ||
                state === STACKER_STATES.LOWERING_BASE_TO_INITIAL_POSITION ||
                state === STACKER_STATES.LOWERING_BASE ||
                state === STACKER_STATES.LOWERING_BASE_BACK_TO_INITIAL_POSITION) {
                const position = new Vector3().copy(base.body.translation());
                position.setY(this.#stacker.basePosition + this.#stacker.position);
                base.body.setNextKinematicTranslation(position);
            }
            if (state === STACKER_STATES.HIDING_ARM ||
                state === STACKER_STATES.MOVING_ARM_TO_INITIAL_POSITION ||
                state === STACKER_STATES.MOVING_ARM_TO_CENTER ||
                state === STACKER_STATES.MOVING_ARM_TO_RIGHT ||
                state === STACKER_STATES.RETRACTING_ARM ||
                state === STACKER_STATES.MOVING_ARM_BACK_TO_INITIAL_POSITION) {
                const position = new Vector3().copy(arm.body.translation());
                position.setX(this.#stacker.armPosition);
                arm.body.setNextKinematicTranslation(position);
            }
            if (state === STACKER_STATES.CLEANING_UP_BASE ||
                state === STACKER_STATES.ROTATING_BASE) {
                const rotation = new Quaternion().setFromAxisAngle(Y_AXIS, this.#stacker.baseAngle);
                const position = new Vector3().sub(this.#pivotPosition).applyQuaternion(rotation).add(this.#pivotPosition);
                position.setY(this.#stacker.basePosition + this.#stacker.position);
                base.body.setNextKinematicTranslation(position);
                base.body.setNextKinematicRotation(rotation);
                const supportPosition = new Vector3().sub(this.#pivotPosition).applyQuaternion(rotation).add(this.#pivotPosition);
                supportPosition.setY(this.#stacker.position);
                support.body.setNextKinematicTranslation(supportPosition);
                support.body.setNextKinematicRotation(rotation);
            }
            if (state === STACKER_STATES.INITIALIZING_COIN) {
                const position = this.#dropPosition.clone();
                position.setX(position.x + this.#stacker.armPosition);
                position.setY(position.y + this.#stacker.position);
                this.#stacker.coin = this.#onInitializeCoin({
                    position,
                    rotation: COIN_ROTATION,
                    impulse: COIN_IMPULSE_FORCE
                });
            }
        }
        if (this.#stacker.nextState) {
            this.#stacker.state = this.#stacker.nextState;
        }
    }

    save() {
        const parts = {};
        this.#stacker.parts.forEach(({ body }, name) => {
            parts[name] = {
                bodyHandle: body.handle
            };
        });
        return {
            state: this.#stacker.state.description,
            parts,
            position: this.#stacker.position,
            armPosition: this.#stacker.armPosition,
            rotations: this.#stacker.rotations,
            basePosition: this.#stacker.basePosition,
            baseAngle: this.#stacker.baseAngle,
            level: this.#stacker.level,
            coinPosition: this.#stacker.coinPosition,
            nextState: this.#stacker.nextState ? this.#stacker.nextState.description : null,
            coinHandle: this.#stacker.coin ? this.#stacker.coin.handle : null
        };
    }

    load(stacker) {
        this.#stacker.state = Symbol.for(stacker.state);
        this.#stacker.position = stacker.position;
        this.#stacker.armPosition = stacker.armPosition;
        this.#stacker.rotations = stacker.rotations;
        this.#stacker.basePosition = stacker.basePosition;
        this.#stacker.baseAngle = stacker.baseAngle;
        this.#stacker.level = stacker.level;
        this.#stacker.coinPosition = stacker.coinPosition;
        this.#stacker.nextState = stacker.nextState ? Symbol.for(stacker.nextState) : null;
        if (stacker.coinHandle) {
            this.#stacker.coin = this.#scene.worldBodies.get(stacker.coinHandle);
        } else {
            this.#stacker.coin = null;
        }
        this.#stacker.parts.forEach((partData, name) => {
            const loadedPart = stacker.parts[name];
            if (loadedPart) {
                partData.body = this.#scene.worldBodies.get(loadedPart.bodyHandle);
            }
        });
    }
}

function updateStackerState({ stacker }) {
    stacker.nextState = null;
    switch (stacker.state) {
        case STACKER_STATES.IDLE:
            break;
        case STACKER_STATES.ACTIVATING:
            stacker.position += STACKER_SPEED;
            if (stacker.position > STACKER_MAX_POSITION) {
                stacker.position = STACKER_MAX_POSITION;
                stacker.nextState = STACKER_STATES.RAISING_BASE;
            }
            break;
        case STACKER_STATES.RAISING_BASE:
            stacker.basePosition += BASE_MAX_SPEED;
            if (stacker.basePosition > BASE_MAX_POSITION) {
                stacker.basePosition = BASE_MAX_POSITION;
                stacker.nextState = STACKER_STATES.HIDING_ARM;
            }
            break;
        case STACKER_STATES.HIDING_ARM:
            stacker.armPosition += ARM_SPEED;
            if (stacker.armPosition > ARM_MAX_POSITION) {
                stacker.armPosition = ARM_MAX_POSITION;
                stacker.nextState = STACKER_STATES.CLEANING_UP_BASE;
            }
            break;
        case STACKER_STATES.CLEANING_UP_BASE:
            stacker.baseAngle -= BASE_ROTATION_CLEANUP_SPEED;
            if (stacker.baseAngle < -BASE_CLEANUP_ROTATIONS * COMPLETE_TURN_ANGLE) {
                stacker.baseAngle = BASE_INITIAL_ANGLE;
                stacker.nextState = STACKER_STATES.LOWERING_BASE_TO_INITIAL_POSITION;
            }
            break;
        case STACKER_STATES.LOWERING_BASE_TO_INITIAL_POSITION:
            stacker.basePosition -= BASE_MAX_SPEED;
            if (stacker.basePosition < BASE_INITIAL_POSITION) {
                stacker.basePosition = BASE_INITIAL_POSITION;
                stacker.nextState = STACKER_STATES.MOVING_ARM_TO_INITIAL_POSITION;
            }
            break;
        case STACKER_STATES.MOVING_ARM_TO_INITIAL_POSITION:
            stacker.armPosition -= ARM_SPEED;
            if (stacker.armPosition < ARM_INITIAL_POSITION) {
                stacker.armPosition = ARM_INITIAL_POSITION;
                stacker.nextState = STACKER_STATES.INITIALIZING_COIN;
            }
            break;
        case STACKER_STATES.INITIALIZING_COIN:
            stacker.nextState = STACKER_STATES.PUSHING_COIN;
            break;
        case STACKER_STATES.PUSHING_COIN:
            if (stacker.coin.position.x < COIN_SETTLED_RIGHT_POSITION_X &&
                stacker.coin.position.y < COIN_SETTLED_POSITION_Y + stacker.position) {
                if (stacker.armPosition === ARM_INITIAL_POSITION) {
                    stacker.rotations++;
                    stacker.nextState = STACKER_STATES.ROTATING_BASE;
                } else {
                    stacker.nextState = STACKER_STATES.MOVING_ARM_TO_RIGHT;
                }
            }
            break;
        case STACKER_STATES.ROTATING_BASE:
            stacker.baseAngle -= BASE_ROTATION_SPEED;
            const targetAngle = -COMPLETE_TURN_ANGLE / ROTATIONS_MAX * stacker.rotations;
            if (stacker.baseAngle < targetAngle) {
                stacker.baseAngle = targetAngle;
                if (stacker.rotations == ROTATIONS_MAX) {
                    stacker.rotations = BASE_INITIAL_ROTATIONS;
                    stacker.baseAngle = BASE_INITIAL_ANGLE;
                    stacker.nextState = STACKER_STATES.MOVING_ARM_TO_CENTER;
                } else {
                    stacker.nextState = STACKER_STATES.INITIALIZING_COIN;
                }
            }
            break;
        case STACKER_STATES.MOVING_ARM_TO_CENTER:
            stacker.armPosition -= ARM_SPEED;
            if (stacker.armPosition < ARM_MIN_POSITION) {
                stacker.armPosition = ARM_MIN_POSITION;
                stacker.nextState = STACKER_STATES.INITIALIZING_COIN;
            }
            break;
        case STACKER_STATES.MOVING_ARM_TO_RIGHT:
            stacker.armPosition += ARM_SPEED;
            if (stacker.armPosition > ARM_INITIAL_POSITION) {
                stacker.armPosition = ARM_INITIAL_POSITION;
                stacker.level++;
                stacker.coinPosition = stacker.coin.position.y;
                if (stacker.level < LEVEL_MAX) {
                    stacker.nextState = STACKER_STATES.LOWERING_BASE;
                } else {
                    stacker.nextState = STACKER_STATES.RETRACTING_ARM;
                }
            }
            break;
        case STACKER_STATES.LOWERING_BASE:
            stacker.basePosition -= BASE_SPEED;
            if (COIN_SETTLED_POSITION_Y + stacker.position - stacker.coin.position.y > COIN_HEIGHT) {
                stacker.nextState = STACKER_STATES.INITIALIZING_COIN;
            }
            break;
        case STACKER_STATES.RETRACTING_ARM:
            stacker.armPosition += ARM_SPEED;
            if (stacker.armPosition > ARM_MAX_POSITION) {
                stacker.armPosition = ARM_MAX_POSITION;
                stacker.nextState = STACKER_STATES.LOWERING_STACKER;
            }
            break;
        case STACKER_STATES.LOWERING_STACKER:
            stacker.position -= STACKER_SPEED;
            if (stacker.position < STACKER_INITIAL_POSITION) {
                stacker.position = STACKER_INITIAL_POSITION;
                stacker.nextState = STACKER_STATES.MOVING_ARM_BACK_TO_INITIAL_POSITION;
            }
            break;
        case STACKER_STATES.MOVING_ARM_BACK_TO_INITIAL_POSITION:
            stacker.armPosition -= ARM_SPEED;
            if (stacker.armPosition < ARM_INITIAL_POSITION) {
                stacker.armPosition = ARM_INITIAL_POSITION;
                stacker.nextState = STACKER_STATES.LOWERING_BASE_BACK_TO_INITIAL_POSITION;
            }
            break;
        case STACKER_STATES.LOWERING_BASE_BACK_TO_INITIAL_POSITION:
            stacker.basePosition += BASE_MAX_SPEED;
            if (stacker.basePosition > BASE_INITIAL_POSITION) {
                stacker.basePosition = BASE_INITIAL_POSITION;
                stacker.nextState = STACKER_STATES.IDLE;
            }
            break;
        default:
            break;
    }
}

async function initializeModel({ scene }) {
    const model = await scene.loadModel(MODEL_PATH);
    const mesh = model.scene;
    const parts = new Map();
    const dropPosition = new Vector3();
    const pivotPosition = new Vector3();
    mesh.traverse((child) => {
        if (child.isMesh) {
            const { material, geometry } = child;
            const userData = material.userData;
            if (userData.collider) {
                const name = userData.name;
                const index = geometry.index;
                const position = geometry.attributes.position;
                const vertices = [];
                const indices = [];
                for (let indexVertex = 0; indexVertex < index.count; indexVertex++) {
                    vertices.push(position.getX(indexVertex), position.getY(indexVertex), position.getZ(indexVertex));
                    indices.push(index.getX(indexVertex));
                }
                const partData = getPart(parts, name);
                partData.friction = userData.friction;
                partData.restitution = userData.restitution;
                partData.kinematic = userData.kinematic;
                partData.meshes.push({
                    data: child,
                    vertices,
                    indices
                });
            } else {
                const name = child.userData.name;
                const partData = getPart(parts, name);
                partData.meshes.push({
                    data: child
                });
            }
        } else if (child.userData.collider) {
            const name = child.userData.name;
            const partData = getPart(parts, name);
            partData.colliders.push({
                position: child.position,
                radius: child.userData.radius,
                height: child.userData.height
            });
        } else if (child.name == DROP_POSITION) {
            dropPosition.copy(child.position);
        } else if (child.name == PIVOT_POSITION) {
            pivotPosition.copy(child.position);
        }
    });
    return {
        parts,
        dropPosition,
        pivotPosition
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
    let indexPart = 0;
    parts.forEach((partData, name) => {
        const { meshes, colliders, friction, restitution, kinematic } = partData;
        let body;
        if (kinematic) {
            body = partData.body = scene.createKinematicBody();
        } else {
            body = partData.body = scene.createFixedBody();
        }
        body.setEnabled(false);
        const vertices = [];
        const indices = [];
        let offsetIndex = 0;
        meshes.forEach(meshData => {
            if (meshData.vertices) {
                vertices.push(...meshData.vertices);
                indices.push(...meshData.indices.map(index => index + offsetIndex));
                offsetIndex += meshData.indices.length;
            }
        });
        if (vertices.length > 0) {
            const collider = scene.createTrimeshCollider({
                vertices,
                indices,
                friction,
                restitution
            }, body);
            collider.setCollisionGroups((1 << (indexPart % 16)) << 16 | (1 << (indexPart % 16)));
            indexPart++;
        }
        colliders.forEach(colliderData => {
            const { radius, position, height } = colliderData;
            const collider = scene.createCylinderCollider({
                radius,
                height,
                position,
                friction,
                restitution
            }, body);
            collider.setCollisionGroups((1 << (indexPart % 16)) << 16 | (1 << (indexPart % 16)));
            indexPart++;
        });
    });
}