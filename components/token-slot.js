import { Vector3, Quaternion } from "three";

const MODEL_PATH = "./assets/token-slot.glb";
const INSERT_POSITION = "insert-position";
const TOKEN_INITIAL_POSITION = 0;

const TOKEN_SLOT_STATES = {
    IDLE: Symbol.for("token-slot-idle"),
    ACTIVATING: Symbol.for("token-slot-activating")
};

export default class {

    #scene;
    #insertPosition;
    #onTokenInserted;
    #tokenSlot = {
        state: TOKEN_SLOT_STATES.IDLE,
        cardPosition: TOKEN_INITIAL_POSITION,
        pendingTokens: [],
        nextState: null
    };

    constructor({ scene, onTokenInserted }) {
        this.#scene = scene;
        this.#onTokenInserted = onTokenInserted;
    }

    async initialize() {
        const scene = this.#scene;
        const { parts, insertPosition } = await initializeModel({ scene });
        this.#insertPosition = insertPosition;
        parts.forEach(({ meshes }) => meshes.forEach(({ data }) => this.#scene.addObject(data)));
        Object.assign(this.#tokenSlot, { parts });
    }

    update() {
        updateTokenSlotState({ tokenSlot: this.#tokenSlot });
        const { parts, state } = this.#tokenSlot;
        if (state !== TOKEN_SLOT_STATES.IDLE) {
            // TODO
        }
        if (this.#tokenSlot.nextState) {
            this.#tokenSlot.state = this.#tokenSlot.nextState;
        }
    }

    insertToken(token) {
        if (this.#tokenSlot.state === TOKEN_SLOT_STATES.IDLE) {
            this.#tokenSlot.state = TOKEN_SLOT_STATES.ACTIVATING;
        } else {
            this.#tokenSlot.pendingTokens.push(token);
        }
    }

    save() {
        // TODO
    }

    load(tokenSlot) {
        // TODO
    }
}

function updateTokenSlotState({ tokenSlot }) {
    tokenSlot.nextState = null;
    switch (tokenSlot.state) {
        case TOKEN_SLOT_STATES.IDLE:
            break;
        case TOKEN_SLOT_STATES.ACTIVATING:
            // TODO
            break;
        default:
            break;
    }
}

async function initializeModel({ scene }) {
    const model = await scene.loadModel(MODEL_PATH);
    const mesh = model.scene;
    const parts = new Map();
    const insertPosition = new Vector3();
    mesh.traverse((child) => {
        if (child.isMesh) {
            const partData = getPart(parts, child.name);
            partData.meshes.push({ data: child });
        } else if (child.name == INSERT_POSITION) {
            insertPosition.copy(child.position);
        }
    });
    return {
        parts,
        insertPosition
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