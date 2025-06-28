import { Vector3, Quaternion } from "three";

const MODEL_PATH = "./../assets/card-reader.glb";
const INSERT_POSITION = "insert-position";
const CARD_INITIAL_POSITION = 0;

const CARS_READER_STATES = {
    IDLE: Symbol.for("card-reader-idle"),
    ACTIVATING: Symbol.for("card-reader-activating")
};

export default class {

    #scene;
    #insertPosition;
    #onCardRead;
    #cardReader = {
        state: CARS_READER_STATES.IDLE,
        cardPosition: CARD_INITIAL_POSITION,
        pendingCards: [],
        nextState: null
    };

    constructor({ scene, onCardRead }) {
        this.#scene = scene;
        this.#onCardRead = onCardRead;
    }

    async initialize() {
        const scene = this.#scene;
        const { parts, insertPosition } = await initializeModel({ scene });
        this.#insertPosition = insertPosition;
        parts.forEach(({ meshes }) => meshes.forEach(({ data }) => this.#scene.addObject(data)));
        Object.assign(this.#cardReader, { parts });
    }

    update() {
        updateCardReaderState({ cardReader: this.#cardReader });
        const { parts, state } = this.#cardReader;
        if (state !== CARS_READER_STATES.IDLE) {
            // TODO
        }
        if (this.#cardReader.nextState) {
            this.#cardReader.state = this.#cardReader.nextState;
        }
    }

    readCard(card) {
        if (this.#cardReader.state === CARS_READER_STATES.IDLE) {
            this.#cardReader.state = CARS_READER_STATES.ACTIVATING;
        } else {
            this.#cardReader.pendingCards.push(card);
        }
    }

    save() {
        // TODO
    }

    load(cardReader) {
        // TODO
    }
}

function updateCardReaderState({ cardReader }) {
    cardReader.nextState = null;
    switch (cardReader.state) {
        case CARS_READER_STATES.IDLE:
            break;
        case CARS_READER_STATES.ACTIVATING:
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
        partData = { meshes: [], colliders: [] };
        parts.set(name, partData);
    } else {
        partData = parts.get(name);
    }
    return partData;
}