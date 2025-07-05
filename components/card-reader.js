import { Vector3, Quaternion } from "three";

const MODEL_PATH = "./assets/card-reader.glb";
const INIT_POSITION = "init-position";
const CARD_INITIAL_POSITION_Z = 0;
const CARD_VALIDATION_POSITION_Z = 0.05;
const CARD_POSITION_Z_MAX = 0.175;
const CARD_VALIDATED_POSITION_Z_MAX = 0.125;
const CARD_INITIAL_POSITION_Y = -0.01;
const CARD_POSITION_Y_MAX = 0;
const CARD_Y_SPEED = 0.001;
const CARD_Z_SPEED = 0.0025;
const LIGHTS_ON_DURATION = 5;
const LIGHTS_DEFAULT_COLOR = 0xe7e7e7;
const LIGHTS_COLOR = 0x00ff22;
const LIGHTS_EMISSIVE_COLOR = 0xdddddd;
const LIGHTS_EMISSIVE_INTENSITY_ON = .05;
const LIGHTS_EMISSIVE_INTENSITY_OFF = 0;

const CARD_READER_STATES = {
    IDLE: Symbol.for("card-reader-idle"),
    ACTIVATING: Symbol.for("card-reader-activating"),
    RETRIEVING_CARD: Symbol.for("card-reader-retrieving-card"),
    READING_CARD: Symbol.for("card-reader-reading-card"),
    RAISING_CARD: Symbol.for("card-reader-raising-card"),
    PUSHING_CARD: Symbol.for("card-reader-pushing-card"),
    RETRACTING_CARD: Symbol.for("card-reader-retracting-card"),
    LOWERING_CARD: Symbol.for("card-reader-lowering-card"),
    PREPARING_IDLE: Symbol.for("card-reader-preparing-idle")
};

export default class {

    #scene;
    #initPosition;
    #onRetrieveCard;
    #onGetCard;
    #onRecycleCard;
    #onReadCard;
    #card;
    #position = new Vector3();
    #rotation = new Quaternion();
    #lightsMaterials;
    #cardReader = {
        state: CARD_READER_STATES.IDLE,
        cardType: null,
        cardPositionY: CARD_INITIAL_POSITION_Y,
        cardPositionZ: CARD_INITIAL_POSITION_Z,
        cardValidated: false,
        pendingCardTypes: [],
        nextState: null,
        lights: {
            on: false,
            frameLastRefresh: -1
        }
    };

    constructor({ scene, onRetrieveCard, onGetCard, onRecycleCard, onReadCard }) {
        this.#scene = scene;
        this.#onRetrieveCard = onRetrieveCard;
        this.#onGetCard = onGetCard;
        this.#onRecycleCard = onRecycleCard;
        this.#onReadCard = onReadCard;
    }

    async initialize() {
        const scene = this.#scene;
        const { parts, initPosition, lightsMaterials } = await initializeModel({ scene });
        this.#initPosition = initPosition;
        this.#lightsMaterials = lightsMaterials;
        parts.forEach(({ meshes }) => meshes.forEach(({ data }) => this.#scene.addObject(data)));
    }

    update() {
        updateCardReaderState({ cardReader: this.#cardReader });
        const { state } = this.#cardReader;
        if (state !== CARD_READER_STATES.IDLE) {
            if (state === CARD_READER_STATES.RETRIEVING_CARD) {
                this.#rotation.setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);
                this.#card = this.#onRetrieveCard({
                    type: this.#cardReader.cardType,
                    position: this.#position,
                    rotation: this.#rotation
                });
                this.#card.body.collider(0).setEnabled(false);
            }
            if (this.#card) {
                this.#position.copy(this.#initPosition);
                this.#position.z += this.#cardReader.cardPositionZ;
                this.#position.y += this.#cardReader.cardPositionY;
                this.#card.body.setTranslation(this.#position);
                this.#card.body.setRotation(this.#rotation);
            }
            if (state === CARD_READER_STATES.PREPARING_IDLE) {
                this.#card.body.collider(0).setEnabled(true);
                this.#onRecycleCard(this.#card);
                this.#card = null;
            }
            if (state === CARD_READER_STATES.READING_CARD) {
                this.#onReadCard(this.#card);
            }
        }
    }

    refresh() {
        const { state } = this.#cardReader;
        if (state !== CARD_READER_STATES.IDLE) {
            this.#lightsMaterials.forEach(material => {
                if (this.#cardReader.lights.on) {
                    material.color.setHex(LIGHTS_COLOR);
                    material.emissiveIntensity = LIGHTS_EMISSIVE_INTENSITY_ON;
                } else {
                    material.color.setHex(LIGHTS_DEFAULT_COLOR);
                    material.emissiveIntensity = LIGHTS_EMISSIVE_INTENSITY_OFF;
                }
            });
        }
    }

    next() {
        if (this.#cardReader.nextState) {
            this.#cardReader.state = this.#cardReader.nextState;
        }
    }

    readCard(card) {
        if (this.#cardReader.state === CARD_READER_STATES.IDLE) {
            this.#cardReader.cardType = card.type;
            this.#cardReader.state = CARD_READER_STATES.ACTIVATING;
        } else {
            this.#cardReader.pendingCardTypes.push(card.type);
        }
    }

    save() {
        return {
            state: this.#cardReader.state.description,
            nextState: this.#cardReader.nextState ? this.#cardReader.nextState.description : null,
            cardType: this.#cardReader.cardType,
            cardIndex: this.#card ? this.#card.index : null,
            cardPositionY: this.#cardReader.cardPositionY,
            cardPositionZ: this.#cardReader.cardPositionZ,
            cardValidated: this.#cardReader.cardValidated,
            lights: {
                on: this.#cardReader.lights.on,
                frameLastRefresh: this.#cardReader.lights.frameLastRefresh
            },
            pendingCardTypes: [...this.#cardReader.pendingCardTypes]
        };
    }

    load(cardReader) {
        this.#cardReader.state = Symbol.for(cardReader.state);
        this.#cardReader.nextState = cardReader.nextState ? Symbol.for(cardReader.nextState) : null;
        this.#cardReader.cardType = cardReader.cardType;
        this.#cardReader.cardPositionY = cardReader.cardPositionY;
        this.#cardReader.cardPositionZ = cardReader.cardPositionZ;
        this.#cardReader.cardValidated = cardReader.cardValidated;
        this.#cardReader.lights.on = cardReader.lights.on;
        this.#cardReader.lights.frameLastRefresh = cardReader.lights.frameLastRefresh;
        this.#cardReader.pendingCardTypes = [...cardReader.pendingCardTypes];
        if (cardReader.cardIndex != null) {
            this.#card = this.#onGetCard({ index: cardReader.cardIndex, type: this.#cardReader.cardType });
        }
    }
}

function updateCardReaderState({ cardReader }) {
    cardReader.nextState = null;
    switch (cardReader.state) {
        case CARD_READER_STATES.IDLE:
            break;
        case CARD_READER_STATES.ACTIVATING:
            cardReader.nextState = CARD_READER_STATES.RETRIEVING_CARD;
            break;
        case CARD_READER_STATES.RETRIEVING_CARD:
            cardReader.nextState = CARD_READER_STATES.RAISING_CARD;
            break;
        case CARD_READER_STATES.RAISING_CARD:
            cardReader.cardPositionY += CARD_Y_SPEED;
            if (cardReader.cardPositionY >= CARD_POSITION_Y_MAX) {
                cardReader.cardPositionY = CARD_POSITION_Y_MAX;
                cardReader.nextState = CARD_READER_STATES.PUSHING_CARD;
            }
            break;
        case CARD_READER_STATES.PUSHING_CARD:
            cardReader.cardPositionZ += CARD_Z_SPEED;
            if (cardReader.cardValidated && cardReader.cardPositionZ >= CARD_VALIDATED_POSITION_Z_MAX) {
                cardReader.cardPositionZ = CARD_VALIDATED_POSITION_Z_MAX;
                cardReader.nextState = CARD_READER_STATES.RETRACTING_CARD;
            } else if (!cardReader.cardValidated && cardReader.cardPositionZ >= CARD_POSITION_Z_MAX) {
                cardReader.cardPositionZ = CARD_POSITION_Z_MAX;
                cardReader.nextState = CARD_READER_STATES.RETRACTING_CARD;
            }
            if (cardReader.cardValidated) {
                cardReader.lights.frameLastRefresh++;
                if (cardReader.lights.frameLastRefresh > LIGHTS_ON_DURATION) {
                    cardReader.lights.frameLastRefresh = 0;
                    cardReader.lights.on = !cardReader.lights.on;
                }
            }
            break;
        case CARD_READER_STATES.RETRACTING_CARD:
            cardReader.cardPositionZ -= CARD_Z_SPEED;
            if (cardReader.cardValidated && cardReader.cardPositionZ <= CARD_INITIAL_POSITION_Z) {
                cardReader.cardPositionZ = CARD_INITIAL_POSITION_Z;
                cardReader.lights.on = false;
                cardReader.lights.frameLastRefresh = -1;
                cardReader.nextState = CARD_READER_STATES.READING_CARD;
            } else if (!cardReader.cardValidated && cardReader.cardPositionZ <= CARD_VALIDATION_POSITION_Z) {
                cardReader.cardPositionZ = CARD_VALIDATION_POSITION_Z;
                cardReader.cardValidated = true;
                cardReader.nextState = CARD_READER_STATES.PUSHING_CARD;
            }
            if (cardReader.cardValidated) {
                cardReader.lights.frameLastRefresh++;
                if (cardReader.lights.frameLastRefresh > LIGHTS_ON_DURATION) {
                    cardReader.lights.frameLastRefresh = 0;
                    cardReader.lights.on = !cardReader.lights.on;
                }
            } else {
                cardReader.lights.on = true;
            }
            break;
        case CARD_READER_STATES.READING_CARD:
            cardReader.nextState = CARD_READER_STATES.LOWERING_CARD;
            break;
        case CARD_READER_STATES.LOWERING_CARD:
            cardReader.cardPositionY -= CARD_Y_SPEED;
            if (cardReader.cardPositionY <= CARD_INITIAL_POSITION_Y) {
                cardReader.cardPositionY = CARD_INITIAL_POSITION_Y;
                cardReader.nextState = CARD_READER_STATES.PREPARING_IDLE;
            }
            break;
        case CARD_READER_STATES.PREPARING_IDLE:
            cardReader.cardValidated = false;
            cardReader.nextState = CARD_READER_STATES.IDLE;
        default:
            break;
    }
}

async function initializeModel({ scene }) {
    const model = await scene.loadModel(MODEL_PATH);
    const mesh = model.scene;
    const parts = new Map();
    const initPosition = new Vector3();
    const lightsMaterials = [];
    mesh.traverse((child) => {
        if (child.isMesh) {
            const partData = getPart(parts, child.userData.name);
            partData.meshes.push({ data: child });
            const { material } = child;
            if (material.userData.light) {
                material.emissive.setHex(LIGHTS_EMISSIVE_COLOR);
                material.emissiveIntensity = LIGHTS_EMISSIVE_INTENSITY_OFF;
                lightsMaterials[material.userData.index] = material;
            }
        } else if (child.name == INIT_POSITION) {
            initPosition.copy(child.position);
        }
    });
    return {
        parts,
        initPosition,
        lightsMaterials
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