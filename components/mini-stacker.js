import { Vector3, Quaternion } from "three";

const MODEL_PATH = "./assets/mini-stacker.glb";
const DROP_POSITION = "drop-position";
const PIVOT_POSITION = "pivot-position";
const ARM_PROTECTION_LID_PIVOT_POSITION = "arm-protection-lid-pivot-position";
const COIN_ROTATION = new Vector3(0, 0, 0);
const COIN_HEIGHT = 0.006;
const X_AXIS = new Vector3(1, 0, 0);
const Y_AXIS = new Vector3(0, 1, 0);
const ARM_SPEED = 0.02;
const ARM_DOOR_SPEED = 0.0005;
const BASE_SPEED = 0.0005;
const STACKER_RAISING_SPEED = 0.003;
const STACKER_LOWERING_SPEED = 0.001;
const BASE_ROTATION_CLEANUP_SPEED = Math.PI / 9;
const ARM_PROTECTION_LID_SPEED = 0.1;
const BASE_CLEANUP_ROTATIONS = 3;
const COIN_SETTLED_POSITION_Y = 0.14;
const COIN_IMPULSE_FORCE = new Vector3(0, 0, 0.00001);
const ARM_RETRACTED_POSITION = 0;
const ARM_DROP_POSITION = 0.08;
const ARM_DOOR_CLOSED_POSITION = 0;
const ARM_DOOR_OPENED_POSITION = -0.025;
const BASE_INITIAL_ANGLE = 0;
const BASE_INITIAL_POSITION = 0;
const BASE_CLEANUP_POSITION = 0.005;
const BASE_READY_POSITION = -0.03;
const SUPPORT_INITIAL_POSITION = 0;
const SUPPORT_READY_POSITION = -0.01;
const STACKER_INITIAL_POSITION = 0;
const STACKER_CLEANUP_POSITION = 0.15;
const STACKER_MAX_POSITION = 0.225;
const COMPLETE_TURN_ANGLE = Math.PI * 2;
const ARM_PROTECTION_LID_CLOSED_ANGLE = 0;
const ARM_PROTECTION_LID_OPENED_ANGLE = -Math.PI / 3;
const LEVEL_INITIAL = 0;
const LEVELS_MIN = 5;
const LEVELS_MAX = 80;
const BASE_PART_NAME = "base";
const SUPPORT_PART_NAME = "support";
const ARM_PART_NAME = "arm";
const ARM_PROTECTION_PART_NAME = "arm-protection";
const ARM_PROTECTION_LID_PART_NAME = "arm-protection-lid";
const ARM_DOOR_PART_NAME = "arm-door";
const LIGHTS_MIN_INTENSITY = 0;
const LIGHTS_MAX_INTENSITY = 5;
const LIGHTS_EMISSIVE_COLOR = 0xff00ff;
const LIGHTS_BLINKING_DURATION = 35;
const LIGHTS_DELIVERY_BLINKING_DURATION = 10;

const STACKER_STATES = {
    IDLE: Symbol.for("stacker-idle"),
    ACTIVATING: Symbol.for("stacker-activating"),
    RAISING_STACKER_TO_CLEANUP_POSITION: Symbol.for("stacker-raising-stacker-to-cleanup-position"),
    RAISING_BASE_TO_CLEANUP_POSITION: Symbol.for("stacker-raising-base-to-cleanup-position"),
    CLOSING_ARM_DOOR: Symbol.for("stacker-closing-arm-door"),
    RAISING_ARM_PROTECTION_LID: Symbol.for("stacker-raising-arm-protection-lid"),
    LOWERING_ARM_PROTECTION_LID: Symbol.for("stacker-lowering-arm-protection-lid"),
    LOWERING_SUPPORT_TO_READY_POSITION: Symbol.for("stacker-lowering-support-to-ready-position"),
    LOWERING_BASE_TO_READY_POSITION: Symbol.for("stacker-lowering-base-to-ready-position"),
    CLEANING_UP_BASE_LEFT: Symbol.for("stacker-cleaning-up-base-left"),
    CLEANING_UP_BASE_RIGHT: Symbol.for("stacker-cleaning-up-base-right"),
    RAISING_STACKER: Symbol.for("stacker-raising-stacker"),
    OPENING_ARM_DOOR: Symbol.for("stacker-opening-arm-door"),
    MOVING_ARM_TO_DROP_POSITION: Symbol.for("stacker-moving-arm-to-drop-position"),
    INITIALIZING_COIN: Symbol.for("stacker-initializing-coin"),
    PUSHING_COIN: Symbol.for("stacker-pushing-coin"),
    LOWERING_BASE: Symbol.for("stacker-lowering-base"),
    FINISHING_LEVEL: Symbol.for("stacker-finishing-level"),
    MOVING_ARM_TO_INITIAL_POSITION: Symbol.for("stacker-moving-arm-to-initial-position"),
    LOWERING_STACKER: Symbol.for("stacker-lowering-stacker"),
    PREPARING_IDLE: Symbol.for("stacker-preparing-idle")
};
const LIGHTS_STATES = {
    IDLE: Symbol.for("stacker-lights-idle"),
    ACTIVATING: Symbol.for("stacker-lights-activating"),
    BLINKING: Symbol.for("stacker-lights-blinking"),
    ROTATING: Symbol.for("stacker-lights-rotating"),
    DELIVERING: Symbol.for("stacker-lights-delivering"),
    PREPARING_IDLE: Symbol.for("stacker-lights-preparing-idle")
};

export default class {

    #scene;
    #cabinet;
    #lightBulbsMaterials;
    #canActivate;
    #onInitializeCoin;
    #dropPosition;
    #pivotPosition;
    #armProtectionLidPivotPosition;
    #offsetX;
    #stacker = {
        parts: null,
        level: LEVEL_INITIAL,
        coin: null,
        coins: [],
        nextState: null,
        levels: -1,
        pendingDeliveries: [],
        state: STACKER_STATES.IDLE,
        position: STACKER_INITIAL_POSITION,
        supportPosition: SUPPORT_INITIAL_POSITION,
        basePosition: BASE_INITIAL_POSITION,
        armPosition: ARM_RETRACTED_POSITION,
        armDoorPosition: ARM_DOOR_CLOSED_POSITION,
        armProtectionLidAngle: ARM_PROTECTION_LID_CLOSED_ANGLE,
        baseAngle: BASE_INITIAL_ANGLE,
        lights: {
            state: LIGHTS_STATES.IDLE,
            frameLastRefresh: -1,
            bulbs: [],
            nextState: null
        }
    };

    constructor({ scene, cabinet, onInitializeCoin, offsetX = 0 }) {
        this.#scene = scene;
        this.#cabinet = cabinet;
        this.#offsetX = offsetX;
        this.#onInitializeCoin = onInitializeCoin;
    }

    async initialize() {
        const scene = this.#scene;
        const {
            parts,
            dropPosition,
            pivotPosition,
            armProtectionLidPivotPosition,
            lightBulbsMaterials
        } = await initializeModel({ scene, offsetX: this.#offsetX });
        this.#dropPosition = dropPosition;
        this.#pivotPosition = pivotPosition;
        this.#armProtectionLidPivotPosition = armProtectionLidPivotPosition;
        this.#lightBulbsMaterials = lightBulbsMaterials;
        initializeColliders({
            scene,
            parts,
            offsetX: this.#offsetX
        });
        initializeLights({
            lightBulbsMaterials,
            lights: this.#stacker.lights
        });
        parts.forEach(({ body, meshes }) => {
            meshes.forEach(({ data }) => this.#scene.addObject(data));
            body.setEnabled(true);
        });
        Object.assign(this.#stacker, { parts });
    }

    update() {
        if (this.#stacker.nextState) {
            this.#stacker.state = this.#stacker.nextState;
            this.#stacker.nextState = null;
        }
        if (this.#stacker.lights.nextState) {
            this.#stacker.lights.state = this.#stacker.lights.nextState;
            this.#stacker.lights.nextState = null;
        }
        updateStackerState({
            stacker: this.#stacker,
            canActivate: () => this.#cabinet.canActivate(this)
        });
        updateLightsState({ stacker: this.#stacker });
        const { parts, state } = this.#stacker;
        if (state !== STACKER_STATES.IDLE) {
            const base = parts.get(BASE_PART_NAME);
            const support = parts.get(SUPPORT_PART_NAME);
            const arm = parts.get(ARM_PART_NAME);
            const armProtection = parts.get(ARM_PROTECTION_PART_NAME);
            const armProtectionLid = parts.get(ARM_PROTECTION_LID_PART_NAME);
            const armDoor = parts.get(ARM_DOOR_PART_NAME);
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
            if (state === STACKER_STATES.LOWERING_STACKER ||
                state === STACKER_STATES.PREPARING_IDLE) {
                this.#stacker.coins.forEach(coin => {
                    coin.body.setAngvel(new Vector3(0, 0, 0), false);
                    coin.body.setLinvel(new Vector3(0, 0, 0), false);
                    coin.body.sleep();
                });
            }
            if (state === STACKER_STATES.RAISING_BASE_TO_CLEANUP_POSITION ||
                state === STACKER_STATES.RAISING_BASE ||
                state === STACKER_STATES.LOWERING_BASE ||
                state === STACKER_STATES.LOWERING_BASE_TO_READY_POSITION) {
                const basePosition = new Vector3().copy(base.body.translation());
                basePosition.setY(this.#stacker.position + this.#stacker.supportPosition + this.#stacker.basePosition);
                base.body.setNextKinematicTranslation(basePosition);
            }
            if (state === STACKER_STATES.MOVING_ARM_TO_DROP_POSITION ||
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
                state === STACKER_STATES.CLEANING_UP_BASE_RIGHT) {
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
                position.setZ(position.z + this.#stacker.armPosition);
                position.setY(position.y + this.#stacker.position);
                this.#stacker.coin = this.#onInitializeCoin({
                    position,
                    rotation: COIN_ROTATION
                });
                this.#stacker.coins.push(this.#stacker.coin);
            }
            if (state === STACKER_STATES.PUSHING_COIN) {
                this.#stacker.coin.body.applyImpulse(COIN_IMPULSE_FORCE, true);
            }
            if (state === STACKER_STATES.LOWERING_BASE) {
                this.#stacker.coin.body.setRotation(new Quaternion(COIN_ROTATION.x, COIN_ROTATION.y, COIN_ROTATION.z, 1), false);
                const position = this.#stacker.coin.body.translation();
                this.#stacker.coin.body.setTranslation(new Vector3(this.#offsetX, position.y, this.#pivotPosition.z), false);
            }
        }
    }

    refresh() {
        const { parts, state, lights } = this.#stacker;
        if (state !== STACKER_STATES.IDLE) {
            parts.forEach(({ meshes, body }) => {
                meshes.forEach(({ data }) => {
                    data.position.copy(body.translation());
                    data.quaternion.copy(body.rotation());
                });
            });
            if (lights.state !== LIGHTS_STATES.IDLE) {
                lights.bulbs.forEach((bulb, indexBulb) => {
                    this.#lightBulbsMaterials[indexBulb].emissiveIntensity = bulb.intensity;
                });
            }
        }
    }

    deliver({ levels = LEVELS_MIN } = { levels: LEVELS_MIN }) {
        levels = Math.max(LEVELS_MIN, Math.min(LEVELS_MAX, levels));
        if (this.#stacker.state === STACKER_STATES.IDLE) {
            this.#stacker.levels = levels;
            this.#stacker.state = STACKER_STATES.ACTIVATING;
        } else {
            this.#stacker.pendingDeliveries.push({ levels });
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
            baseAngle: this.#stacker.baseAngle,
            level: this.#stacker.level,
            levels: this.#stacker.levels,
            pendingDeliveries: this.#stacker.pendingDeliveries.map(delivery => ({ levels: delivery.levels })),
            nextState: this.#stacker.nextState ? this.#stacker.nextState.description : null,
            coinHandle: this.#stacker.coin ? this.#stacker.coin.handle : null,
            coinsHandles,
            lights: {
                state: this.#stacker.lights.state.description,
                nextState: this.#stacker.lights.nextState ? this.#stacker.lights.nextState.description : null,
                frameLastRefresh: this.#stacker.lights.frameLastRefresh,
                bulbs: this.#stacker.lights.bulbs.map(bulb => ({
                    intensity: bulb.intensity
                }))
            }
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
        this.#stacker.baseAngle = stacker.baseAngle;
        this.#stacker.level = stacker.level;
        this.#stacker.levels = stacker.levels;
        this.#stacker.pendingDeliveries = stacker.pendingDeliveries.map(delivery => ({ levels: delivery.levels }));
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
        this.#stacker.lights.state = Symbol.for(stacker.lights.state);
        this.#stacker.lights.nextState = stacker.lights.nextState ? Symbol.for(stacker.lights.nextState) : null;
        this.#stacker.lights.frameLastRefresh = stacker.lights.frameLastRefresh;
        this.#stacker.lights.bulbs = stacker.lights.bulbs.map(bulb => ({
            intensity: bulb.intensity
        }));
    }

    get active() {
        return this.#stacker.state !== STACKER_STATES.IDLE && this.#stacker.state !== STACKER_STATES.ACTIVATING;
    }
}

function updateStackerState({ stacker, canActivate }) {
    switch (stacker.state) {
        case STACKER_STATES.IDLE:
            break;
        case STACKER_STATES.ACTIVATING:
            if (canActivate()) {
                stacker.state = stacker.nextState = STACKER_STATES.RAISING_STACKER_TO_CLEANUP_POSITION;
                stacker.lights.state = LIGHTS_STATES.ACTIVATING;
            }
            break;
        case STACKER_STATES.RAISING_STACKER_TO_CLEANUP_POSITION:
            stacker.position += STACKER_RAISING_SPEED;
            if (stacker.position > STACKER_CLEANUP_POSITION) {
                stacker.position = STACKER_CLEANUP_POSITION;
                stacker.nextState = STACKER_STATES.RAISING_BASE_TO_CLEANUP_POSITION;
            }
            break;
        case STACKER_STATES.RAISING_BASE_TO_CLEANUP_POSITION:
            stacker.basePosition += BASE_SPEED;
            if (stacker.basePosition > BASE_CLEANUP_POSITION) {
                stacker.basePosition = BASE_CLEANUP_POSITION;
                stacker.nextState = STACKER_STATES.CLEANING_UP_BASE_LEFT;
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
                stacker.nextState = STACKER_STATES.OPENING_ARM_DOOR;
            }
            break;
        case STACKER_STATES.OPENING_ARM_DOOR:
            stacker.armDoorPosition -= ARM_DOOR_SPEED;
            if (stacker.armDoorPosition < ARM_DOOR_OPENED_POSITION) {
                stacker.armDoorPosition = ARM_DOOR_OPENED_POSITION;
                stacker.nextState = STACKER_STATES.MOVING_ARM_TO_DROP_POSITION;
            }
            break;
        case STACKER_STATES.MOVING_ARM_TO_DROP_POSITION:
            stacker.armPosition += ARM_SPEED;
            if (stacker.armPosition > ARM_DROP_POSITION) {
                stacker.armPosition = ARM_DROP_POSITION;
                stacker.nextState = STACKER_STATES.INITIALIZING_COIN;
            }
            break;
        case STACKER_STATES.INITIALIZING_COIN:
            stacker.nextState = STACKER_STATES.PUSHING_COIN;
            break;
        case STACKER_STATES.PUSHING_COIN:
            if (stacker.coin.position.y < COIN_SETTLED_POSITION_Y + stacker.position) {
                stacker.nextState = STACKER_STATES.LOWERING_BASE;
            }
            break;
        case STACKER_STATES.LOWERING_BASE:
            stacker.basePosition -= BASE_SPEED;
            if (COIN_SETTLED_POSITION_Y + stacker.position - stacker.coin.position.y > COIN_HEIGHT) {
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
                stacker.nextState = STACKER_STATES.LOWERING_STACKER;
            }
            break;
        case STACKER_STATES.LOWERING_STACKER:
            stacker.position -= STACKER_LOWERING_SPEED;
            if (stacker.position < STACKER_INITIAL_POSITION) {
                stacker.position = STACKER_INITIAL_POSITION;
                stacker.basePosition = BASE_INITIAL_POSITION;
                stacker.supportPosition = SUPPORT_INITIAL_POSITION;
                stacker.baseAngle = BASE_INITIAL_ANGLE;
                stacker.nextState = STACKER_STATES.PREPARING_IDLE;
            }
            break;
        case STACKER_STATES.PREPARING_IDLE:
            stacker.coin = null;
            stacker.coins = [];
            if (stacker.pendingDeliveries.length > 0) {
                const { levels } = stacker.pendingDeliveries.shift();
                stacker.levels = levels;
                stacker.nextState = STACKER_STATES.ACTIVATING;
            } else {
                stacker.nextState = STACKER_STATES.IDLE;
            }
            break;
        default:
            break;
    }
}

function updateLightsState({ stacker }) {
    switch (stacker.lights.state) {
        case LIGHTS_STATES.IDLE:
            break;
        case LIGHTS_STATES.ACTIVATING:
            stacker.lights.frameLastRefresh = 0;
            stacker.lights.nextState = LIGHTS_STATES.BLINKING;
            break;
        case LIGHTS_STATES.BLINKING:
            stacker.lights.frameLastRefresh++;
            if (stacker.lights.frameLastRefresh > LIGHTS_BLINKING_DURATION) {
                stacker.lights.frameLastRefresh = 0;
                stacker.lights.bulbs.forEach(bulb => {
                    bulb.intensity = bulb.intensity > LIGHTS_MIN_INTENSITY ? 0 : LIGHTS_MAX_INTENSITY;
                });
            }
            if (stacker.state === STACKER_STATES.INITIALIZING_COIN) {
                stacker.lights.nextState = LIGHTS_STATES.ROTATING;
            }
            break;
        case LIGHTS_STATES.ROTATING:
            stacker.lights.bulbs.forEach((bulb, indexBulb) => {
                bulb.intensity = (indexBulb + stacker.level) % 2 < 1 ? 0 : LIGHTS_MAX_INTENSITY;
            });
            if (stacker.state === STACKER_STATES.LOWERING_STACKER) {
                stacker.lights.nextState = LIGHTS_STATES.DELIVERING;
            }
            break;
        case LIGHTS_STATES.DELIVERING:
            stacker.lights.frameLastRefresh++;
            if (stacker.lights.frameLastRefresh > LIGHTS_DELIVERY_BLINKING_DURATION) {
                stacker.lights.frameLastRefresh = 0;
                stacker.lights.bulbs.forEach((bulb) => {
                    bulb.intensity = bulb.intensity == LIGHTS_MAX_INTENSITY ? 0 : LIGHTS_MAX_INTENSITY;
                });
            }
            if (stacker.state === STACKER_STATES.PREPARING_IDLE) {
                stacker.lights.nextState = LIGHTS_STATES.PREPARING_IDLE;
            }
            break;
        case LIGHTS_STATES.PREPARING_IDLE:
            stacker.lights.bulbs.forEach(bulb => {
                bulb.intensity = LIGHTS_MIN_INTENSITY;
            });
            stacker.lights.frameLastRefresh = -1;
            stacker.lights.nextState = LIGHTS_STATES.IDLE;
            break;
        default:
    }
}

async function initializeModel({ scene, offsetX }) {
    const model = await scene.loadModel(MODEL_PATH);
    const mesh = model.scene;
    const parts = new Map();
    const dropPosition = new Vector3();
    const pivotPosition = new Vector3();
    const armProtectionLidPivotPosition = new Vector3();
    const lightBulbsMaterials = [];
    mesh.traverse((child) => {
        if (child.isMesh) {
            const { material, geometry } = child;
            for (let indexVertex = 0; indexVertex < geometry.index.count; indexVertex++) {
                const position = geometry.attributes.position;
                position.setX(indexVertex, position.getX(indexVertex) + offsetX);
            }
            const userData = material.userData;
            if (userData.collider) {
                const name = userData.name;
                const index = geometry.index;
                const position = geometry.attributes.position;
                const vertices = [];
                const indices = [];
                for (let indexVertex = 0; indexVertex < position.count; indexVertex++) {
                    vertices.push(position.getX(indexVertex), position.getY(indexVertex), position.getZ(indexVertex));
                }
                for (let indexVertex = 0; indexVertex < index.count; indexVertex++) {
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
                if (child.material.userData.light) {
                    lightBulbsMaterials[child.material.userData.index] = child.material;
                }
                const name = child.userData.name;
                const partData = getPart(parts, name);
                partData.meshes.push({
                    data: child
                });
            }
        } else if (child.userData.collider) {
            const name = child.userData.name;
            const partData = getPart(parts, name);
            const position = child.position.clone();
            position.x += offsetX;
            partData.colliders.push({
                position: child.position,
                radius: child.userData.radius,
                height: child.userData.height
            });
        } else if (child.name == DROP_POSITION) {
            const position = child.position.clone();
            position.x += offsetX;
            dropPosition.copy(position);
        } else if (child.name == PIVOT_POSITION) {
            const position = child.position.clone();
            position.x += offsetX;
            pivotPosition.copy(position);
        } else if (child.name == ARM_PROTECTION_LID_PIVOT_POSITION) {
            const position = child.position.clone();
            position.x += offsetX;
            armProtectionLidPivotPosition.copy(position);
        }
    });
    return {
        parts,
        dropPosition,
        pivotPosition,
        armProtectionLidPivotPosition,
        lightBulbsMaterials
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

function initializeColliders({ scene, parts, offsetX }) {
    let indexPart = 0;
    parts.forEach(partData => {
        const { meshes, colliders, friction, restitution, kinematic, cuboid, cylinder } = partData;
        const body = partData.body = kinematic ? scene.createKinematicBody() : scene.createFixedBody();
        body.setEnabled(false);
        if (cuboid || cylinder) {
            const boundingBox = meshes[0].data.geometry.boundingBox;
            const position = new Vector3().addVectors(boundingBox.min, boundingBox.max).multiplyScalar(0.5);
            position.x += offsetX;
            const colliderSize = new Vector3(boundingBox.max.x - boundingBox.min.x, boundingBox.max.y - boundingBox.min.y, boundingBox.max.z - boundingBox.min.z);
            let collider;
            if (cuboid) {
                collider = scene.createCuboidCollider({
                    position: position.toArray(),
                    width: colliderSize.x,
                    height: colliderSize.y,
                    depth: colliderSize.z,
                    friction,
                    restitution,
                }, body);
            } else {
                collider = scene.createCylinderCollider({
                    position: position.toArray(),
                    radius: colliderSize.x / 2,
                    height: colliderSize.y,
                    friction,
                    restitution,
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
                    offsetIndex += Math.max(...meshData.indices) + 1;
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
            position.x += offsetX;
            const collider = scene.createCylinderCollider({
                radius,
                height,
                position,
                friction,
                restitution
            }, body);
            collider.setCollisionGroups((1 << (indexPart % 16)) << 16 | (1 << (indexPart % 16)));
        });
        indexPart++;
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