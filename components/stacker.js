import { Vector3, Quaternion } from "three";

const MODEL_PATH = "./../assets/stacker.glb";
const DROP_POSITION = "drop-position";
const PIVOT_POSITION = "pivot-position";
const ARM_PROTECTION_LID_PIVOT_POSITION = "arm-protection-lid-pivot-position";
const COIN_ROTATION = new Vector3(0, 0, 0);
const COIN_HEIGHT = 0.006;
const X_AXIS = new Vector3(1, 0, 0);
const Y_AXIS = new Vector3(0, 1, 0);
const ARM_SPEED = 0.02;
const ARM_DOOR_SPEED = 0.0005;
const BASE_SPEED = 0.0015;
const STACKER_RAISING_SPEED = 0.003;
const STACKER_LOWERING_SPEED = 0.001;
const BASE_ROTATION_SPEED = Math.PI / 12;
const BASE_ROTATION_CLEANUP_SPEED = Math.PI / 9;
const ARM_PROTECTION_LID_SPEED = 0.1;
const BASE_CLEANUP_ROTATIONS = 4;
const COIN_SETTLED_POSITION_Y = 0.148;
const COIN_IMPULSE_FORCE = new Vector3(0, 0, 0.0001);
const ARM_RETRACTED_POSITION = 0;
const ARM_CIRCUMFERENCE_POSITION = 0.08;
const ARM_CENTER_POSITION = 0.15;
const ARM_DOOR_CLOSED_POSITION = 0;
const ARM_DOOR_OPENED_POSITION = -0.025;
const ROTATIONS_MAX = 6;
const BASE_INITIAL_ANGLE = 0;
const BASE_INITIAL_ROTATIONS = 0;
const BASE_INITIAL_POSITION = 0;
const BASE_READY_POSITION = -0.03;
const SUPPORT_INITIAL_POSITION = 0;
const SUPPORT_READY_POSITION = -0.01;
const STACKER_INITIAL_POSITION = 0;
const STACKER_CLEANUP_POSITION = 0.15;
const STACKER_MAX_POSITION = 0.225;
const COMPLETE_TURN_ANGLE = Math.PI * 2;
const ARM_PROTECTION_LID_CLOSED_ANGLE = 0;
const ARM_PROTECTION_LID_OPENED_ANGLE = -Math.PI / 2;
const LEVEL_INITIAL = 0;
const STACKS_MIN = 1;
const STACKS_MAX = 7;
const LEVELS_MIN = 5;
const LEVELS_MAX = 80;
const BASE_PART_NAME = "base";
const SUPPORT_PART_NAME = "support";
const ARM_PART_NAME = "arm";
const ARM_PROTECTION_PART_NAME = "arm-protection";
const ARM_PROTECTION_LID_PART_NAME = "arm-protection-lid";
const ARM_DOOR_PART_NAME = "arm-door";

const STACKER_STATES = {
    IDLE: Symbol.for("stacker-idle"),
    ACTIVATING: Symbol.for("stacker-activating"),
    RAISING_STACKER_TO_CLEANUP_POSITION: Symbol.for("stacker-raising-stacker-to-cleanup-position"),
    CLOSING_ARM_DOOR: Symbol.for("stacker-closing-arm-door"),
    RAISING_ARM_PROTECTION_LID: Symbol.for("stacker-raising-arm-protection-lid"),
    LOWERING_ARM_PROTECTION_LID: Symbol.for("stacker-lowering-arm-protection-lid"),
    LOWERING_SUPPORT_TO_READY_POSITION: Symbol.for("stacker-lowering-support-to-ready-position"),
    LOWERING_BASE_TO_READY_POSITION: Symbol.for("stacker-lowering-base-to-ready-position"),
    CLEANING_UP_BASE_LEFT: Symbol.for("stacker-cleaning-up-base-left"),
    CLEANING_UP_BASE_RIGHT: Symbol.for("stacker-cleaning-up-base-right"),
    RAISING_STACKER: Symbol.for("stacker-raising-stacker"),
    OPENING_ARM_DOOR: Symbol.for("stacker-opening-arm-door"),
    MOVING_ARM_TO_CIRCUMFERENCE_POSITION: Symbol.for("stacker-moving-arm-to-circumference-position"),
    INITIALIZING_COIN: Symbol.for("stacker-initializing-coin"),
    PUSHING_COIN: Symbol.for("stacker-pushing-coin"),
    ROTATING_BASE: Symbol.for("stacker-rotating-base"),
    MOVING_ARM_TO_CENTER_POSITION: Symbol.for("stacker-moving-arm-to-center-position"),
    LOWERING_BASE: Symbol.for("stacker-lowering-base"),
    MOVING_ARM_BACK_TO_CIRCUMFERENCE_POSITION: Symbol.for("stacker-retracting-arm"),
    FINISHING_LEVEL: Symbol.for("stacker-finishing-level"),
    MOVING_ARM_TO_INITIAL_POSITION: Symbol.for("stacker-moving-arm-to-initial-position"),
    ALIGNING_COINS: Symbol.for("stacker-aligning-coins"),
    LOWERING_STACKER: Symbol.for("stacker-lowering-stacker"),
    RESETTING_BASE_ROTATION: Symbol.for("stacker-resetting-base-rotation"),
    PREPARING_IDLE: Symbol.for("stacker-preparing-idle")
};

export default class {

    #scene;
    #onInitializeCoin;
    #dropPosition;
    #pivotPosition;
    #armProtectionLidPivotPosition;
    #stacker = {
        parts: null,
        level: LEVEL_INITIAL,
        coin: null,
        coins: [],
        nextState: null,
        stacks: -1,
        levels: -1,
        pendingDeliveries: [],
        state: STACKER_STATES.IDLE,
        position: STACKER_INITIAL_POSITION,
        supportPosition: SUPPORT_INITIAL_POSITION,
        basePosition: BASE_INITIAL_POSITION,
        armPosition: ARM_RETRACTED_POSITION,
        armDoorPosition: ARM_DOOR_CLOSED_POSITION,
        armProtectionLidAngle: ARM_PROTECTION_LID_CLOSED_ANGLE,
        rotations: BASE_INITIAL_ROTATIONS,
        baseAngle: BASE_INITIAL_ANGLE
    };

    constructor({ scene, onInitializeCoin }) {
        this.#scene = scene;
        this.#onInitializeCoin = onInitializeCoin;
    }

    async initialize() {
        const scene = this.#scene;
        const { parts, dropPosition, pivotPosition, armProtectionLidPivotPosition } = await initializeModel({ scene });
        this.#dropPosition = dropPosition;
        this.#pivotPosition = pivotPosition;
        this.#armProtectionLidPivotPosition = armProtectionLidPivotPosition;
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
        updateStackerState({ stacker: this.#stacker });
        const { parts, state } = this.#stacker;
        if (state !== STACKER_STATES.IDLE) {
            const base = parts.get(BASE_PART_NAME);
            const support = parts.get(SUPPORT_PART_NAME);
            const arm = parts.get(ARM_PART_NAME);
            const armProtection = parts.get(ARM_PROTECTION_PART_NAME);
            const armProtectionLid = parts.get(ARM_PROTECTION_LID_PART_NAME);
            const armDoor = parts.get(ARM_DOOR_PART_NAME);
            parts.forEach(({ meshes, body }) => {
                meshes.forEach(({ data }) => {
                    data.position.copy(body.translation());
                    data.quaternion.copy(body.rotation());
                });
            });
            if (state === STACKER_STATES.RAISING_STACKER_TO_CLEANUP_POSITION ||
                state === STACKER_STATES.RAISING_STACKER ||
                state === STACKER_STATES.LOWERING_STACKER) {
                const stackerPosition = new Vector3().copy(base.body.translation());
                const supportPosition = new Vector3().copy(support.body.translation());
                const basePosition = new Vector3().copy(base.body.translation());
                const armPosition = new Vector3().copy(arm.body.translation());
                const armDoorPosition = new Vector3().copy(armDoor.body.translation());
                const armProtectionPosition = new Vector3().copy(armProtection.body.translation());
                const armProtectionLidPosition = new Vector3().copy(armProtectionLid.body.translation());
                stackerPosition.setY(this.#stacker.position);
                let supportPositionY = this.#stacker.position + this.#stacker.supportPosition;
                if (supportPositionY < 0) {
                    supportPositionY = 0;
                }
                supportPosition.setY(this.#stacker.position + this.#stacker.supportPosition);
                let basePositionY = this.#stacker.position + this.#stacker.supportPosition + this.#stacker.basePosition;
                if (basePositionY < 0) {
                    basePositionY = 0;
                }
                basePosition.setY(basePositionY);
                armPosition.setY(this.#stacker.position + this.#stacker.armPosition);
                armDoorPosition.setY(this.#stacker.position + this.#stacker.armPosition + this.#stacker.armDoorPosition);
                armProtectionPosition.setY(this.#stacker.position + this.#stacker.armPosition);
                armProtectionLidPosition.setY(this.#stacker.position + this.#stacker.armPosition);
                support.body.setNextKinematicTranslation(supportPosition);
                base.body.setNextKinematicTranslation(basePosition);
                arm.body.setNextKinematicTranslation(armPosition);
                armProtection.body.setNextKinematicTranslation(armProtectionPosition);
                armProtectionLid.body.setNextKinematicTranslation(armProtectionLidPosition);
                armDoor.body.setNextKinematicTranslation(armDoorPosition);
            }
            if (state === STACKER_STATES.LOWERING_SUPPORT_TO_READY_POSITION) {
                const supportPosition = new Vector3().copy(support.body.translation());
                const basePosition = new Vector3().copy(base.body.translation());
                supportPosition.setY(this.#stacker.position + this.#stacker.supportPosition);
                basePosition.setY(this.#stacker.position + this.#stacker.supportPosition + this.#stacker.basePosition);
                base.body.setNextKinematicTranslation(basePosition);
                support.body.setNextKinematicTranslation(supportPosition);
            }
            if (state === STACKER_STATES.LOWERING_STACKER) {
                this.#stacker.coins.forEach(coin => coin.body.sleep());
            }
            if (state === STACKER_STATES.RAISING_BASE ||
                state === STACKER_STATES.LOWERING_BASE ||
                state === STACKER_STATES.LOWERING_BASE_TO_READY_POSITION) {
                const basePosition = new Vector3().copy(base.body.translation());
                basePosition.setY(this.#stacker.position + this.#stacker.supportPosition + this.#stacker.basePosition);
                base.body.setNextKinematicTranslation(basePosition);
            }
            if (state === STACKER_STATES.MOVING_ARM_TO_CIRCUMFERENCE_POSITION ||
                state === STACKER_STATES.MOVING_ARM_TO_CENTER_POSITION ||
                state === STACKER_STATES.MOVING_ARM_BACK_TO_CIRCUMFERENCE_POSITION ||
                state === STACKER_STATES.MOVING_ARM_TO_INITIAL_POSITION) {
                const armPosition = new Vector3().copy(arm.body.translation());
                armPosition.setZ(this.#stacker.armPosition);
                arm.body.setNextKinematicTranslation(armPosition);
            }
            if (state === STACKER_STATES.CLOSING_ARM_DOOR ||
                state === STACKER_STATES.OPENING_ARM_DOOR) {
                const armDoorPosition = new Vector3().copy(armDoor.body.translation());
                armDoorPosition.setY(this.#stacker.position + this.#stacker.armPosition + this.#stacker.armDoorPosition);
                armDoor.body.setNextKinematicTranslation(armDoorPosition);
            }
            if (state === STACKER_STATES.CLEANING_UP_BASE_LEFT ||
                state === STACKER_STATES.CLEANING_UP_BASE_RIGHT ||
                state === STACKER_STATES.ROTATING_BASE ||
                state === STACKER_STATES.ALIGNING_COINS ||
                state === STACKER_STATES.RESETTING_BASE_ROTATION) {
                const rotation = new Quaternion().setFromAxisAngle(Y_AXIS, this.#stacker.baseAngle);
                const basePosition = new Vector3().sub(this.#pivotPosition).applyQuaternion(rotation).add(this.#pivotPosition);
                basePosition.setY(this.#stacker.position + this.#stacker.supportPosition + this.#stacker.basePosition);
                base.body.setNextKinematicTranslation(basePosition);
                base.body.setNextKinematicRotation(rotation);
                const supportPosition = new Vector3().sub(this.#pivotPosition).applyQuaternion(rotation).add(this.#pivotPosition);
                supportPosition.setY(this.#stacker.position + this.#stacker.supportPosition);
                support.body.setNextKinematicTranslation(supportPosition);
                support.body.setNextKinematicRotation(rotation);
            }
            if (state === STACKER_STATES.RAISING_ARM_PROTECTION_LID ||
                state === STACKER_STATES.LOWERING_ARM_PROTECTION_LID) {
                let armProtectionLidPosition = new Vector3().setY(this.#stacker.position + this.#stacker.armPosition);
                const pivotPosition = this.#armProtectionLidPivotPosition.clone().setY(this.#armProtectionLidPivotPosition.y + this.#stacker.position);
                const armProtectionLidRotation = new Quaternion().setFromAxisAngle(X_AXIS, this.#stacker.armProtectionLidAngle);
                armProtectionLidPosition = armProtectionLidPosition.sub(pivotPosition).applyQuaternion(armProtectionLidRotation).add(pivotPosition);
                armProtectionLid.body.setNextKinematicTranslation(armProtectionLidPosition);
                armProtectionLid.body.setNextKinematicRotation(armProtectionLidRotation);
            }
            if (state === STACKER_STATES.INITIALIZING_COIN) {
                const position = this.#dropPosition.clone();
                position.setZ(position.z + this.#stacker.armPosition - ARM_CIRCUMFERENCE_POSITION);
                position.setY(position.y + this.#stacker.position);
                this.#stacker.coin = this.#onInitializeCoin({
                    position,
                    rotation: COIN_ROTATION,
                    impulse: COIN_IMPULSE_FORCE
                });
                this.#stacker.coins.push(this.#stacker.coin);
            }
        }
        if (this.#stacker.nextState) {
            this.#stacker.state = this.#stacker.nextState;
        }
    }

    deliver({ stacks = STACKS_MIN, levels = LEVELS_MIN } = { stacks: STACKS_MIN, levels: LEVELS_MIN }) {
        levels = Math.max(LEVELS_MIN, Math.min(LEVELS_MAX, levels));
        stacks = Math.max(STACKS_MIN, Math.min(STACKS_MAX, stacks));
        if (this.#stacker.state === STACKER_STATES.IDLE) {
            this.#stacker.stacks = stacks;
            this.#stacker.levels = levels;
            this.#stacker.state = STACKER_STATES.ACTIVATING;
        } else {
            this.#stacker.pendingDeliveries.push({ stacks, levels });
        }
    }

    save() {
        const parts = {};
        this.#stacker.parts.forEach(({ body }, name) => {
            parts[name] = {
                bodyHandle: body.handle
            };
        });
        const coinsHandles = this.#stacker.coins.map(coin => coin.body.handle);
        return {
            state: this.#stacker.state.description,
            parts,
            position: this.#stacker.position,
            supportPosition: this.#stacker.supportPosition,
            basePosition: this.#stacker.basePosition,
            armPosition: this.#stacker.armPosition,
            armDoorPosition: this.#stacker.armDoorPosition,
            armProtectionLidAngle: this.#stacker.armProtectionLidAngle,
            rotations: this.#stacker.rotations,
            baseAngle: this.#stacker.baseAngle,
            level: this.#stacker.level,
            stacks: this.#stacker.stacks,
            levels: this.#stacker.levels,
            pendingDeliveries: this.#stacker.pendingDeliveries.map(delivery => ({ stacks: delivery.stacks, levels: delivery.levels })),
            nextState: this.#stacker.nextState ? this.#stacker.nextState.description : null,
            coinHandle: this.#stacker.coin ? this.#stacker.coin.handle : null,
            coinsHandles
        };
    }

    load(stacker) {
        this.#stacker.state = Symbol.for(stacker.state);
        this.#stacker.position = stacker.position;
        this.#stacker.supportPosition = stacker.supportPosition;
        this.#stacker.basePosition = stacker.basePosition;
        this.#stacker.armPosition = stacker.armPosition;
        this.#stacker.armDoorPosition = stacker.armDoorPosition;
        this.#stacker.armProtectionLidAngle = stacker.armProtectionLidAngle;
        this.#stacker.rotations = stacker.rotations;
        this.#stacker.baseAngle = stacker.baseAngle;
        this.#stacker.level = stacker.level;
        this.#stacker.stacks = stacker.stacks;
        this.#stacker.levels = stacker.levels;
        this.#stacker.pendingDeliveries = stacker.pendingDeliveries.map(delivery => ({ stacks: delivery.stacks, levels: delivery.levels }));
        this.#stacker.nextState = stacker.nextState ? Symbol.for(stacker.nextState) : null;
        if (stacker.coinHandle) {
            this.#stacker.coin = this.#scene.worldBodies.get(stacker.coinHandle);
        } else {
            this.#stacker.coin = null;
        }
        this.#stacker.coins = [];
        stacker.coinsHandles.forEach(handle => this.#stacker.coins.push(this.#scene.worldBodies.get(handle)));
        this.#stacker.parts.forEach((partData, name) => {
            const loadedPart = stacker.parts[name];
            if (loadedPart) {
                partData.body = this.#scene.worldBodies.get(loadedPart.bodyHandle);
            }
        });
    }
}

function updateStackerState({ stacker }) {
    let targetAngle;
    stacker.nextState = null;
    switch (stacker.state) {
        case STACKER_STATES.IDLE:
            break;
        case STACKER_STATES.ACTIVATING:
            stacker.nextState = STACKER_STATES.RAISING_STACKER_TO_CLEANUP_POSITION;
            break;
        case STACKER_STATES.RAISING_STACKER_TO_CLEANUP_POSITION:
            stacker.position += STACKER_RAISING_SPEED;
            if (stacker.position > STACKER_CLEANUP_POSITION) {
                stacker.position = STACKER_CLEANUP_POSITION;
                stacker.nextState = STACKER_STATES.RAISING_ARM_PROTECTION_LID;
            }
            break;
        case STACKER_STATES.RAISING_ARM_PROTECTION_LID:
            stacker.armProtectionLidAngle -= ARM_PROTECTION_LID_SPEED;
            if (stacker.armProtectionLidAngle < ARM_PROTECTION_LID_OPENED_ANGLE) {
                stacker.armProtectionLidAngle = ARM_PROTECTION_LID_OPENED_ANGLE;
                stacker.nextState = STACKER_STATES.LOWERING_ARM_PROTECTION_LID;
            }
            break;
        case STACKER_STATES.LOWERING_ARM_PROTECTION_LID:
            stacker.armProtectionLidAngle += ARM_PROTECTION_LID_SPEED;
            if (stacker.armProtectionLidAngle > ARM_PROTECTION_LID_CLOSED_ANGLE) {
                stacker.armProtectionLidAngle = ARM_PROTECTION_LID_CLOSED_ANGLE;
                if (stacker.position == STACKER_CLEANUP_POSITION) {
                    stacker.nextState = STACKER_STATES.CLEANING_UP_BASE_LEFT;
                } else {
                    stacker.nextState = STACKER_STATES.OPENING_ARM_DOOR;
                }
            }
            break;
        case STACKER_STATES.CLEANING_UP_BASE_LEFT:
            stacker.baseAngle -= BASE_ROTATION_CLEANUP_SPEED;
            if (stacker.baseAngle < -BASE_CLEANUP_ROTATIONS * COMPLETE_TURN_ANGLE) {
                stacker.baseAngle = BASE_INITIAL_ANGLE;
                stacker.nextState = STACKER_STATES.CLEANING_UP_BASE_RIGHT;
            }
            break;
        case STACKER_STATES.CLEANING_UP_BASE_RIGHT:
            stacker.baseAngle += BASE_ROTATION_CLEANUP_SPEED;
            if (stacker.baseAngle > BASE_CLEANUP_ROTATIONS * COMPLETE_TURN_ANGLE) {
                stacker.baseAngle = BASE_INITIAL_ANGLE;
                stacker.nextState = STACKER_STATES.RAISING_STACKER;
            }
            break;
        case STACKER_STATES.RAISING_STACKER:
            stacker.position += STACKER_RAISING_SPEED;
            if (stacker.position > STACKER_MAX_POSITION) {
                stacker.position = STACKER_MAX_POSITION;
                stacker.nextState = STACKER_STATES.LOWERING_SUPPORT_TO_READY_POSITION;
            }
            break;
        case STACKER_STATES.LOWERING_SUPPORT_TO_READY_POSITION:
            stacker.supportPosition -= STACKER_LOWERING_SPEED;
            if (stacker.supportPosition < SUPPORT_READY_POSITION) {
                stacker.supportPosition = SUPPORT_READY_POSITION;
                stacker.nextState = STACKER_STATES.LOWERING_BASE_TO_READY_POSITION;
            }
            break;
        case STACKER_STATES.LOWERING_BASE_TO_READY_POSITION:
            stacker.basePosition -= BASE_SPEED;
            if (stacker.basePosition < BASE_READY_POSITION) {
                stacker.basePosition = BASE_READY_POSITION;
                stacker.nextState = STACKER_STATES.RAISING_ARM_PROTECTION_LID;
            }
            break;
        case STACKER_STATES.OPENING_ARM_DOOR:
            stacker.armDoorPosition -= ARM_DOOR_SPEED;
            if (stacker.armDoorPosition < ARM_DOOR_OPENED_POSITION) {
                stacker.armDoorPosition = ARM_DOOR_OPENED_POSITION;
                if (stacker.stacks == 1) {
                    stacker.nextState = STACKER_STATES.MOVING_ARM_TO_CENTER_POSITION;
                } else {
                    stacker.nextState = STACKER_STATES.MOVING_ARM_TO_CIRCUMFERENCE_POSITION;
                }
            }
            break;
        case STACKER_STATES.MOVING_ARM_TO_CIRCUMFERENCE_POSITION:
            stacker.armPosition += ARM_SPEED;
            if (stacker.armPosition > ARM_CIRCUMFERENCE_POSITION) {
                stacker.armPosition = ARM_CIRCUMFERENCE_POSITION;
                stacker.nextState = STACKER_STATES.INITIALIZING_COIN;
            }
            break;
        case STACKER_STATES.INITIALIZING_COIN:
            stacker.nextState = STACKER_STATES.PUSHING_COIN;
            break;
        case STACKER_STATES.PUSHING_COIN:
            if (stacker.coin.position.y < COIN_SETTLED_POSITION_Y + stacker.position) {
                if (stacker.stacks == 1) {
                    stacker.nextState = STACKER_STATES.LOWERING_BASE;
                } else if (stacker.armPosition === ARM_CIRCUMFERENCE_POSITION) {
                    if (stacker.stacks == 2 || stacker.stacks == 3) {
                        stacker.rotations += 3;
                    } else if (stacker.stacks == 4) {
                        stacker.rotations += 2;
                    } else if (stacker.stacks == 5) {
                        stacker.rotations += stacker.rotations % 3 == 0 ? 1 : 2;
                    } else {
                        stacker.rotations++;
                    }
                    stacker.nextState = STACKER_STATES.ROTATING_BASE;
                } else {
                    stacker.nextState = STACKER_STATES.LOWERING_BASE;
                }
            }
            break;
        case STACKER_STATES.ROTATING_BASE:
            stacker.baseAngle -= BASE_ROTATION_SPEED;
            targetAngle = -COMPLETE_TURN_ANGLE / ROTATIONS_MAX * stacker.rotations;
            if (stacker.baseAngle < targetAngle) {
                stacker.baseAngle = targetAngle;
                if (stacker.rotations == ROTATIONS_MAX) {
                    stacker.rotations = BASE_INITIAL_ROTATIONS;
                    stacker.baseAngle = BASE_INITIAL_ANGLE;
                    if (stacker.stacks == 2 || stacker.stacks == 6) {
                        stacker.nextState = STACKER_STATES.LOWERING_BASE;
                    } else {
                        stacker.nextState = STACKER_STATES.MOVING_ARM_TO_CENTER_POSITION;
                    }
                } else {
                    stacker.nextState = STACKER_STATES.INITIALIZING_COIN;
                }
            }
            break;
        case STACKER_STATES.MOVING_ARM_TO_CENTER_POSITION:
            stacker.armPosition -= ARM_SPEED;
            if (stacker.armPosition < ARM_CENTER_POSITION) {
                stacker.armPosition = ARM_CENTER_POSITION;
                stacker.nextState = STACKER_STATES.INITIALIZING_COIN;
            }
            break;
        case STACKER_STATES.LOWERING_BASE:
            stacker.basePosition -= BASE_SPEED;
            if (COIN_SETTLED_POSITION_Y + stacker.position - stacker.coin.position.y > COIN_HEIGHT) {
                if (stacker.stacks == 1) {
                    stacker.nextState = STACKER_STATES.FINISHING_LEVEL;
                } else {
                    stacker.nextState = STACKER_STATES.MOVING_ARM_BACK_TO_CIRCUMFERENCE_POSITION;
                }
            }
            break;
        case STACKER_STATES.MOVING_ARM_BACK_TO_CIRCUMFERENCE_POSITION:
            stacker.armPosition += ARM_SPEED;
            if (stacker.armPosition > ARM_CIRCUMFERENCE_POSITION) {
                stacker.armPosition = ARM_CIRCUMFERENCE_POSITION;
                stacker.nextState = STACKER_STATES.FINISHING_LEVEL;
            }
            break;
        case STACKER_STATES.FINISHING_LEVEL:
            stacker.level++;
            if (stacker.level < stacker.levels) {
                stacker.nextState = STACKER_STATES.INITIALIZING_COIN;
            } else {
                stacker.level = LEVEL_INITIAL;
                stacker.levels = -1;
                stacker.nextState = STACKER_STATES.MOVING_ARM_TO_INITIAL_POSITION;
            }
            break;
        case STACKER_STATES.MOVING_ARM_TO_INITIAL_POSITION:
            stacker.armPosition -= ARM_SPEED;
            if (stacker.armPosition < ARM_RETRACTED_POSITION) {
                stacker.armPosition = ARM_RETRACTED_POSITION;
                stacker.nextState = STACKER_STATES.CLOSING_ARM_DOOR;
            }
            break;
        case STACKER_STATES.CLOSING_ARM_DOOR:
            stacker.armDoorPosition += ARM_DOOR_SPEED;
            if (stacker.armDoorPosition > ARM_DOOR_CLOSED_POSITION) {
                stacker.armDoorPosition = ARM_DOOR_CLOSED_POSITION;
                if (stacker.stacks == 2 || stacker.stacks == 3 || stacker.stacks == 5) {
                    stacker.nextState = STACKER_STATES.ALIGNING_COINS;
                } else {
                    stacker.nextState = STACKER_STATES.LOWERING_STACKER;
                }
            }
            break;
        case STACKER_STATES.ALIGNING_COINS:
            stacker.baseAngle -= BASE_ROTATION_SPEED;
            targetAngle = (-COMPLETE_TURN_ANGLE / ROTATIONS_MAX) * (stacker.stacks == 5 ? 2 : 1.5);
            if (stacker.baseAngle < targetAngle) {
                stacker.baseAngle = targetAngle;
                stacker.nextState = STACKER_STATES.LOWERING_STACKER;
            }
            break;
        case STACKER_STATES.LOWERING_STACKER:
            stacker.position -= STACKER_LOWERING_SPEED;
            if (stacker.position < STACKER_INITIAL_POSITION) {
                stacker.position = STACKER_INITIAL_POSITION;
                stacker.basePosition = BASE_INITIAL_POSITION;
                stacker.supportPosition = SUPPORT_INITIAL_POSITION;
                if (stacker.stacks == 2 || stacker.stacks == 3 || stacker.stacks == 5) {
                    stacker.nextState = STACKER_STATES.RESETTING_BASE_ROTATION;
                } else {
                    stacker.rotations = BASE_INITIAL_ROTATIONS;
                    stacker.baseAngle = BASE_INITIAL_ANGLE;
                    stacker.nextState = STACKER_STATES.PREPARING_IDLE;
                }
            }
            break;
        case STACKER_STATES.RESETTING_BASE_ROTATION:
            stacker.baseAngle += BASE_ROTATION_SPEED;
            if (stacker.baseAngle > BASE_INITIAL_ANGLE) {
                stacker.baseAngle = BASE_INITIAL_ANGLE;
                stacker.rotations = BASE_INITIAL_ROTATIONS;
                stacker.nextState = STACKER_STATES.PREPARING_IDLE;
            }
            break;
        case STACKER_STATES.PREPARING_IDLE:
            stacker.coin = null;
            stacker.coins = [];
            if (stacker.pendingDeliveries.length > 0) {
                const { stacks, levels } = stacker.pendingDeliveries.shift();
                stacker.stacks = stacks;
                stacker.levels = levels;
                stacker.nextState = STACKER_STATES.ACTIVATING;
            } else {
                stacker.stacks = -1;
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
    const armProtectionLidPivotPosition = new Vector3();
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
                partData.cuboid = userData.cuboid;
                partData.cylinder = userData.cylinder;
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
        } else if (child.name == ARM_PROTECTION_LID_PIVOT_POSITION) {
            armProtectionLidPivotPosition.copy(child.position);
        }
    });
    return {
        parts,
        dropPosition,
        pivotPosition,
        armProtectionLidPivotPosition
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
    parts.forEach(partData => {
        const { meshes, colliders, friction, restitution, kinematic, cuboid, cylinder } = partData;
        const body = partData.body = kinematic ? scene.createKinematicBody() : scene.createFixedBody();
        body.setEnabled(false);
        if (cuboid || cylinder) {
            const boundingBox = meshes[0].data.geometry.boundingBox;
            const position = new Vector3().addVectors(boundingBox.min, boundingBox.max).multiplyScalar(0.5).toArray();
            const colliderSize = new Vector3(boundingBox.max.x - boundingBox.min.x, boundingBox.max.y - boundingBox.min.y, boundingBox.max.z - boundingBox.min.z);
            let collider;
            if (cuboid) {
                collider = scene.createCuboidCollider({
                    position,
                    width: colliderSize.x,
                    height: colliderSize.y,
                    depth: colliderSize.z,
                    friction,
                    restitution,
                }, body);
            } else {
                collider = scene.createCylinderCollider({
                    position,
                    radius: colliderSize.x / 2,
                    height: colliderSize.y,
                    friction,
                    restitution
                }, body);
            }
            collider.setCollisionGroups((1 << (indexPart % 16)) << 16 | (1 << (indexPart % 16)));
            indexPart++;
        } else {
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