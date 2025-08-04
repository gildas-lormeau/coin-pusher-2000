import { Vector3, Quaternion } from "three";

const MODEL_PATH = "./assets/token-slot.glb";
const INIT_POSITION = "init-position";
const TOKEN_INITIAL_POSITION = 0;
const TOKEN_VALIDATED_POSITION_MAX = 0.045;
const TOKEN_SPEED = 0.0005;
const ROTATION_STEPS = 24;
const ROTATION_FORWARD_STEPS = 12;
const ROTATION_FORWARD_MAX_STEPS = 36;
const ROTATION_BACKWARD_STEPS = 6;
const ROTATION_BACKWARD_MAX_STEPS = 18;
const ROTATION_PAUSE_DURATION = 10;
const ROTATION_SPEED = Math.PI / ROTATION_STEPS;
const LIGHTS_ON_DURATION = 8;
const LIGHTS_FAST_ON_DURATION = 4;
const LIGHTS_DEFAULT_COLOR = 0xe7e7e7;
const LIGHTS_COLOR = 0x00ff22;
const LIGHTS_EMISSIVE_COLOR = 0xdddddd;
const LIGHTS_EMISSIVE_INTENSITY_ON = .05;
const LIGHTS_EMISSIVE_INTENSITY_OFF = 0;

const TOKEN_SLOT_STATES = {
    IDLE: Symbol.for("token-slot-idle"),
    ACTIVATING: Symbol.for("token-slot-activating"),
    RETRIEVING_TOKEN: Symbol.for("token-slot-retrieving-token"),
    READING_TOKEN: Symbol.for("token-slot-reading-token"),
    PUSHING_TOKEN: Symbol.for("token-slot-pushing-token"),
    ROTATING_TOKEN_FORWARD: Symbol.for("token-slot-rotating-token-forward"),
    PAUSING_TOKEN_FORWARD: Symbol.for("token-slot-pausing-token-forward"),
    ROTATING_TOKEN_BACKWARD: Symbol.for("token-slot-rotating-token-backward"),
    PAUSING_TOKEN_BACKWARD: Symbol.for("token-slot-pausing-token-backward"),
    RETRACTING_TOKEN: Symbol.for("token-slot-retracting-token"),
    PREPARING_IDLE: Symbol.for("token-slot-preparing-idle")
};

export default class {

    #scene;
    #cabinet;
    #initPosition;
    #onRetrieveToken;
    #onReadToken;
    #token;
    #position = new Vector3();
    #rotation = new Quaternion();
    #lightMaterial;
    #tokenSlot = {
        state: TOKEN_SLOT_STATES.IDLE,
        tokenType: null,
        tokenPosition: TOKEN_INITIAL_POSITION,
        tokenRotation: 0,
        frameLastRotation: 0,
        pendingTokenTypes: [],
        nextState: null,
        light: {
            on: false,
            frameLastRefresh: -1
        }
    };

    constructor({ scene, cabinet, onRetrieveToken, onReadToken }) {
        this.#scene = scene;
        this.#cabinet = cabinet;
        this.#onRetrieveToken = onRetrieveToken;
        this.#onReadToken = onReadToken;
    }

    async initialize() {
        const scene = this.#scene;
        const { parts, initPosition, lightMaterial } = await initializeModel({ scene });
        this.#initPosition = initPosition;
        this.#lightMaterial = lightMaterial;
        parts.forEach(({ meshes }) => meshes.forEach(({ data }) => this.#scene.addObject(data)));
    }

    update() {
        if (this.#tokenSlot.nextState) {
            this.#tokenSlot.state = this.#tokenSlot.nextState;
            this.#tokenSlot.nextState = null;
        }
        updateTokenSlotState({ tokenSlot: this.#tokenSlot });
        const { state } = this.#tokenSlot;
        if (state !== TOKEN_SLOT_STATES.IDLE) {
            if (state === TOKEN_SLOT_STATES.RETRIEVING_TOKEN) {
                this.#rotation
                    .setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2)
                    .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2));
                this.#token = this.#onRetrieveToken({
                    type: this.#tokenSlot.tokenType,
                    position: this.#position,
                    rotation: this.#rotation
                });
                this.#token.body.collider(0).setEnabled(false);
            }
            if (this.#token) {
                this.#position.copy(this.#initPosition);
                this.#position.y += this.#tokenSlot.tokenPosition;
                this.#token.body.setTranslation(this.#position);
                this.#rotation.setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2)
                    .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2))
                    .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), this.#tokenSlot.tokenRotation / ROTATION_SPEED));
                this.#token.body.setRotation(this.#rotation);
            }
            if (state === TOKEN_SLOT_STATES.PREPARING_IDLE) {
                this.#token.body.collider(0).setEnabled(true);
                this.#cabinet.recycleObject(this.#token);
                this.#token = null;
            }
            if (state === TOKEN_SLOT_STATES.READING_TOKEN) {
                this.#onReadToken(this.#token);
            }
        }
    }

    refresh() {
        const { state } = this.#tokenSlot;
        if (state !== TOKEN_SLOT_STATES.IDLE) {
            if (this.#tokenSlot.light.on) {
                this.#lightMaterial.color.setHex(LIGHTS_COLOR);
                this.#lightMaterial.emissiveIntensity = LIGHTS_EMISSIVE_INTENSITY_ON;
            } else {
                this.#lightMaterial.color.setHex(LIGHTS_DEFAULT_COLOR);
                this.#lightMaterial.emissiveIntensity = LIGHTS_EMISSIVE_INTENSITY_OFF;
            }
        }
    }

    readToken(token) {
        if (this.#tokenSlot.state === TOKEN_SLOT_STATES.IDLE) {
            this.#tokenSlot.tokenType = token.type;
            this.#tokenSlot.state = TOKEN_SLOT_STATES.ACTIVATING;
        } else {
            this.#tokenSlot.pendingTokenTypes.push(token.type);
        }
    }

    save() {
        return {
            state: this.#tokenSlot.state.description,
            nextState: this.#tokenSlot.nextState ? this.#tokenSlot.nextState.description : null,
            tokenType: this.#tokenSlot.tokenType,
            tokenIndex: this.#token ? this.#token.index : null,
            tokenPosition: this.#tokenSlot.tokenPosition,
            tokenRotation: this.#tokenSlot.tokenRotation,
            frameLastRotation: this.#tokenSlot.frameLastRotation,
            light: {
                on: this.#tokenSlot.light.on,
                frameLastRefresh: this.#tokenSlot.light.frameLastRefresh
            },
            pendingTokenTypes: this.#tokenSlot.pendingTokenTypes.slice(),
        };
    }

    load(tokenSlot) {
        this.#tokenSlot.state = Symbol.for(tokenSlot.state);
        this.#tokenSlot.nextState = tokenSlot.nextState ? Symbol.for(tokenSlot.nextState) : null;
        this.#tokenSlot.tokenType = tokenSlot.tokenType;
        this.#tokenSlot.tokenPosition = tokenSlot.tokenPosition || TOKEN_INITIAL_POSITION;
        this.#tokenSlot.tokenRotation = tokenSlot.tokenRotation || 0;
        this.#tokenSlot.frameLastRotation = tokenSlot.frameLastRotation || 0;
        this.#tokenSlot.light.on = tokenSlot.light.on || false;
        this.#tokenSlot.light.frameLastRefresh = tokenSlot.light.frameLastRefresh || -1;
        this.#tokenSlot.pendingTokenTypes = tokenSlot.pendingTokenTypes || [];
        if (tokenSlot.tokenIndex != null) {
            this.#token = this.#cabinet.getToken({ index: tokenSlot.tokenIndex, type: this.#tokenSlot.tokenType });
        }
    }
}

function updateTokenSlotState({ tokenSlot }) {
    switch (tokenSlot.state) {
        case TOKEN_SLOT_STATES.IDLE:
            break;
        case TOKEN_SLOT_STATES.ACTIVATING:
            tokenSlot.nextState = TOKEN_SLOT_STATES.RETRIEVING_TOKEN;
            break;
        case TOKEN_SLOT_STATES.RETRIEVING_TOKEN:
            tokenSlot.nextState = TOKEN_SLOT_STATES.PUSHING_TOKEN;
            break;
        case TOKEN_SLOT_STATES.PUSHING_TOKEN:
            tokenSlot.tokenPosition += TOKEN_SPEED;
            if (tokenSlot.tokenPosition >= TOKEN_VALIDATED_POSITION_MAX) {
                tokenSlot.tokenPosition = TOKEN_VALIDATED_POSITION_MAX;
                tokenSlot.light.on = true;
                tokenSlot.frameLastRotation = 0;
                tokenSlot.nextState = TOKEN_SLOT_STATES.ROTATING_TOKEN_FORWARD;
            } else {
                tokenSlot.light.frameLastRefresh++;
                if (tokenSlot.light.frameLastRefresh > LIGHTS_ON_DURATION) {
                    tokenSlot.light.frameLastRefresh = 0;
                    tokenSlot.light.on = !tokenSlot.light.on;
                }
            }
            break;
        case TOKEN_SLOT_STATES.ROTATING_TOKEN_FORWARD:
            tokenSlot.tokenRotation++;
            if (tokenSlot.tokenRotation % ROTATION_FORWARD_STEPS == 0) {
                tokenSlot.nextState = TOKEN_SLOT_STATES.PAUSING_TOKEN_FORWARD;
            }
            break;
        case TOKEN_SLOT_STATES.PAUSING_TOKEN_FORWARD:
            tokenSlot.frameLastRotation++;
            if (tokenSlot.frameLastRotation > ROTATION_PAUSE_DURATION) {
                tokenSlot.frameLastRotation = 0;
                if (tokenSlot.tokenRotation == ROTATION_FORWARD_MAX_STEPS) {
                    tokenSlot.tokenRotation = 0;
                    tokenSlot.nextState = TOKEN_SLOT_STATES.ROTATING_TOKEN_BACKWARD;
                } else {
                    tokenSlot.nextState = TOKEN_SLOT_STATES.ROTATING_TOKEN_FORWARD;
                }
            }
            break;
        case TOKEN_SLOT_STATES.ROTATING_TOKEN_BACKWARD:
            tokenSlot.tokenRotation--;
            if (tokenSlot.tokenRotation % ROTATION_BACKWARD_STEPS == 0) {
                tokenSlot.nextState = TOKEN_SLOT_STATES.PAUSING_TOKEN_BACKWARD;
            }
            break;
        case TOKEN_SLOT_STATES.PAUSING_TOKEN_BACKWARD:
            tokenSlot.frameLastRotation++;
            if (tokenSlot.frameLastRotation > ROTATION_PAUSE_DURATION) {
                if (tokenSlot.tokenRotation == -ROTATION_BACKWARD_MAX_STEPS) {
                    tokenSlot.frameLastRotation = -1;
                    tokenSlot.tokenRotation = 0;
                    tokenSlot.nextState = TOKEN_SLOT_STATES.RETRACTING_TOKEN;
                } else {
                    tokenSlot.frameLastRotation = 0;
                    tokenSlot.nextState = TOKEN_SLOT_STATES.ROTATING_TOKEN_BACKWARD;
                }
            }
            break;
        case TOKEN_SLOT_STATES.RETRACTING_TOKEN:
            tokenSlot.tokenPosition -= TOKEN_SPEED;
            if (tokenSlot.tokenPosition <= TOKEN_INITIAL_POSITION) {
                tokenSlot.tokenPosition = TOKEN_INITIAL_POSITION;
                tokenSlot.light.on = false;
                tokenSlot.light.frameLastRefresh = -1;
                tokenSlot.nextState = TOKEN_SLOT_STATES.READING_TOKEN;
            }
            tokenSlot.light.frameLastRefresh++;
            if (tokenSlot.light.frameLastRefresh > LIGHTS_FAST_ON_DURATION) {
                tokenSlot.light.frameLastRefresh = 0;
                tokenSlot.light.on = !tokenSlot.light.on;
            }
            break;
        case TOKEN_SLOT_STATES.READING_TOKEN:
            tokenSlot.nextState = TOKEN_SLOT_STATES.PREPARING_IDLE;
            break;
        case TOKEN_SLOT_STATES.PREPARING_IDLE:
            tokenSlot.nextState = TOKEN_SLOT_STATES.IDLE;
        default:
            break;
    }
}

async function initializeModel({ scene }) {
    const model = await scene.loadModel(MODEL_PATH);
    const mesh = model.scene;
    const parts = new Map();
    const initPosition = new Vector3();
    let lightMaterial;
    mesh.traverse((child) => {
        if (child.isMesh) {
            const partData = getPart(parts, child.userData.name);
            partData.meshes.push({ data: child });
            const { material } = child;
            if (material.userData.light) {
                material.emissive.setHex(LIGHTS_EMISSIVE_COLOR);
                material.emissiveIntensity = LIGHTS_EMISSIVE_INTENSITY_OFF;
                lightMaterial = material;
            }
        } else if (child.name == INIT_POSITION) {
            initPosition.copy(child.position);
        }
    });
    return {
        parts,
        initPosition,
        lightMaterial
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