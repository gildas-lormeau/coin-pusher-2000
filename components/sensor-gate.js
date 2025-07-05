import Coins from "./instanced-meshes/coins.js";

const DEFAULT_COLOR = 0xE7E7E7;
const HIGHLIGHT_COLOR = 0xffffff;
const DEFAULT_OPACITY = 0.1;
const HIGHLIGHT_OPACITY = 0.25;
const EMISSIVE_COLOR = 0xffffff;
const EMISSIVE_INTENSITY = 0;
const EMISSIVE_HIGHLIGHT_INTENSITY = 0.25;
const LETTER_FLASHING_DURATION = 5;
const LETTERS_COUNT = 6;
const POSITION = [0, 0.335, -0.27];
const WIDTH = 0.6;
const HEIGHT = 0.01;
const DEPTH = 0.04;
const MIN_POSITION_X = -0.22;
const MAX_POSITION_X = 0.22;
const SLOT_WIDTH = 0.075;
const PROBABILITY_LETTER_WIN = 1 / 5;
const COUNT_BONUS_FLASHING = 5;
const COUNT_LETTER_FLASHING = 5;
const TYPE = "sensor-gate";
const MODEL_PATH = "./assets/sensor-gate.glb";

const LETTER_STATES = {
    OFF: Symbol.for("sensor-gate-off"),
    ACTIVATING: Symbol.for("sensor-gate-activating"),
    FLASHING_ON: Symbol.for("sensor-gate-flashing-on"),
    FLASHING_OFF: Symbol.for("sensor-gate-flashing-off"),
    LOCKED_ON: Symbol.for("sensor-gate-locked-on")
};
const SENSOR_STATES = {
    IDLE: Symbol.for("sensor-letter-idle"),
    ACTIVATING: Symbol.for("sensor-letter-activating"),
    FLASHING_ON: Symbol.for("sensor-letter-flashing-on"),
    FLASHING_OFF: Symbol.for("sensor-letter-flashing-off"),
    AWAITING_BONUS_DELIVERY: Symbol.for("sensor-letter-awaiting-bonus-delivery"),
    AWAITING_BONUS_DELIVERED: Symbol.for("sensor-letter-awaiting-bonus-delivered")
};

export default class {

    constructor({ scene, onBonusWon, onCoinFallen }) {
        this.#scene = scene;
        this.#onBonusWon = onBonusWon;
        this.#onCoinFallen = onCoinFallen;
    }

    #scene;
    #onBonusWon;
    #onCoinFallen;
    #materials;
    #collider;
    #sensor = {
        state: SENSOR_STATES.IDLE,
        nextState: null,
        frameFlashStart: -1,
        flashCount: 0,
        letters: [{
            state: LETTER_STATES.OFF,
            nextState: null,
            frameFlashStart: -1,
            flashCount: 0
        }, {
            state: LETTER_STATES.OFF,
            nextState: null,
            frameFlashStart: -1,
            flashCount: 0
        }, {
            state: LETTER_STATES.OFF,
            nextState: null,
            frameFlashStart: -1,
            flashCount: 0
        }, {
            state: LETTER_STATES.OFF,
            nextState: null,
            frameFlashStart: -1,
            flashCount: 0
        }, {
            state: LETTER_STATES.OFF,
            nextState: null,
            frameFlashStart: -1,
            flashCount: 0
        }, {
            state: LETTER_STATES.OFF,
            nextState: null,
            frameFlashStart: -1,
            flashCount: 0
        }]
    };

    async initialize() {
        this.#materials = await initializeModel({ scene: this.#scene });
        this.#collider = this.#scene.createCuboidCollider({
            width: WIDTH,
            height: HEIGHT,
            depth: DEPTH,
            position: [POSITION[0], POSITION[1], POSITION[2] - DEPTH],
            sensor: true,
            userData: {
                objectType: TYPE,
                onIntersect: userData => onCoinIntersect({
                    userData,
                    sensor: this.#sensor,
                    onCoinFallen: this.#onCoinFallen
                })
            }
        });
    }

    update() {
        this.#sensor.letters.forEach(letter => updateLetterState({ letter }));
        if (this.#sensor.state === SENSOR_STATES.IDLE &&
            this.#sensor.letters.every(letter => letter.state === LETTER_STATES.LOCKED_ON)) {
            this.#sensor.state = SENSOR_STATES.ACTIVATING;
        }
        updateSensorState({ sensor: this.#sensor });
        if (this.#sensor.state === SENSOR_STATES.AWAITING_BONUS_DELIVERED) {
            this.#sensor.letters.forEach(letter => letter.state = LETTER_STATES.OFF);
            this.#onBonusWon();
        }
        if (this.#sensor.nextState) {
            this.#sensor.state = this.#sensor.nextState;
        }
        this.#sensor.letters.forEach(letter => {
            if (letter.nextState) {
                letter.state = letter.nextState;
            }
        });
    }

    refresh() {
        this.#sensor.letters.forEach((letter, indexLetter) => {
            const letterMaterial = this.#materials[indexLetter];
            if ((letter.state === LETTER_STATES.FLASHING_ON ||
                this.#sensor.state === SENSOR_STATES.FLASHING_ON ||
                this.#sensor.state === SENSOR_STATES.AWAITING_BONUS_DELIVERY ||
                (this.#sensor.state === SENSOR_STATES.IDLE && letter.state === LETTER_STATES.LOCKED_ON))) {
                letterMaterial.color.setHex(HIGHLIGHT_COLOR);
                letterMaterial.opacity = HIGHLIGHT_OPACITY;
                letterMaterial.emissiveIntensity = EMISSIVE_HIGHLIGHT_INTENSITY;
            } else {
                letterMaterial.color.setHex(DEFAULT_COLOR);
                letterMaterial.opacity = DEFAULT_OPACITY;
                letterMaterial.emissiveIntensity = EMISSIVE_INTENSITY;
            }
        });
    }

    save() {
        return {
            colliderHandle: this.#collider.handle,
            sensor: {
                state: this.#sensor.state.description,
                nextState: this.#sensor.nextState ? this.#sensor.nextState.description : null,
                frameFlashStart: this.#sensor.frameFlashStart,
                flashCount: this.#sensor.flashCount,
                letters: this.#sensor.letters.map(letter => ({
                    state: letter.state.description,
                    nextState: letter.nextState ? letter.nextState.description : null,
                    frameFlashStart: letter.frameFlashStart,
                    flashCount: letter.flashCount
                }))
            }
        };
    }

    load(sensorGate) {
        this.#collider = this.#scene.worldColliders.get(sensorGate.colliderHandle);
        this.#collider.userData = {
            objectType: TYPE,
            onIntersect: userData => onCoinIntersect({
                sensor: this.#sensor,
                userData,
                onCoinFallen: this.#onCoinFallen
            })
        };
        this.#sensor.state = Symbol.for(sensorGate.sensor.state);
        this.#sensor.nextState = sensorGate.sensor.nextState ? Symbol.for(sensorGate.sensor.nextState) : null;
        this.#sensor.frameFlashStart = sensorGate.sensor.frameFlashStart;
        this.#sensor.flashCount = sensorGate.sensor.flashCount;
        this.#sensor.letters.forEach((letter, indexLetter) => {
            letter.state = Symbol.for(sensorGate.sensor.letters[indexLetter].state);
            letter.nextState = sensorGate.sensor.letters[indexLetter].nextState ? Symbol.for(sensorGate.sensor.letters[indexLetter].nextState) : null;
            letter.frameFlashStart = sensorGate.sensor.letters[indexLetter].frameFlashStart;
            letter.flashCount = sensorGate.sensor.letters[indexLetter].flashCount;
        });
    }
}

function onCoinIntersect({ sensor, userData, onCoinFallen }) {
    if (userData.objectType === Coins.TYPE) {
        const coin = Coins.getCoin(userData);
        if (coin) {
            onCoinFallen(coin);
            const positionX = coin.position.x;
            if (positionX > MIN_POSITION_X && positionX < MAX_POSITION_X) {
                const indexLetter = Math.floor((positionX + MAX_POSITION_X) / SLOT_WIDTH);
                const letter = sensor.letters[indexLetter];
                if (sensor.state === SENSOR_STATES.IDLE && letter.state === LETTER_STATES.OFF) {
                    letter.state = LETTER_STATES.ACTIVATING;
                }
            }
        }
    }
}

function updateSensorState({ sensor }) {
    sensor.nextState = null;
    switch (sensor.state) {
        case SENSOR_STATES.ACTIVATING:
            sensor.frameFlashStart = 0;
            sensor.nextState = SENSOR_STATES.FLASHING_ON;
            break;
        case SENSOR_STATES.FLASHING_ON:
            sensor.frameFlashStart++;
            if (sensor.frameFlashStart > LETTER_FLASHING_DURATION) {
                sensor.frameFlashStart = 0;
                if (sensor.flashCount < COUNT_BONUS_FLASHING) {
                    sensor.nextState = SENSOR_STATES.FLASHING_OFF;
                } else {
                    sensor.nextState = SENSOR_STATES.AWAITING_BONUS_DELIVERY;
                }
            }
            break;
        case SENSOR_STATES.FLASHING_OFF:
            sensor.frameFlashStart++;
            if (sensor.frameFlashStart > LETTER_FLASHING_DURATION) {
                sensor.frameFlashStart = 0;
                sensor.flashCount++;
                sensor.nextState = SENSOR_STATES.FLASHING_ON;
            }
            break;
        case SENSOR_STATES.AWAITING_BONUS_DELIVERY:
            sensor.flashCount = 0;
            sensor.frameFlashStart = -1;
            sensor.nextState = SENSOR_STATES.AWAITING_BONUS_DELIVERED;
            break;
        case SENSOR_STATES.AWAITING_BONUS_DELIVERED:
            sensor.nextState = SENSOR_STATES.IDLE;
            break;
    }
}

function updateLetterState({ letter }) {
    letter.nextState = null;
    switch (letter.state) {
        case LETTER_STATES.OFF:
            break;
        case LETTER_STATES.ACTIVATING:
            if (Math.random() < PROBABILITY_LETTER_WIN) {
                letter.nextState = LETTER_STATES.FLASHING_ON;
                letter.frameFlashStart = 0;
            } else {
                letter.nextState = LETTER_STATES.OFF;
            }
            break;
        case LETTER_STATES.FLASHING_ON:
            letter.frameFlashStart++;
            if (letter.frameFlashStart > LETTER_FLASHING_DURATION) {
                letter.frameFlashStart = 0;
                if (letter.flashCount < COUNT_LETTER_FLASHING) {
                    letter.nextState = LETTER_STATES.FLASHING_OFF;
                } else {
                    letter.nextState = LETTER_STATES.LOCKED_ON;
                }
            }
            break;
        case LETTER_STATES.FLASHING_OFF:
            letter.frameFlashStart++;
            if (letter.frameFlashStart > LETTER_FLASHING_DURATION) {
                letter.frameFlashStart = 0;
                letter.flashCount++;
                letter.nextState = LETTER_STATES.FLASHING_ON;
            }
            break;
        case LETTER_STATES.LOCKED_ON:
            letter.flashCount = 0;
            letter.frameFlashStart = -1;
            break;

    }
}

async function initializeModel({ scene }) {
    const sensorGateModel = await scene.loadModel(MODEL_PATH);
    const mesh = sensorGateModel.scene.children[0];
    const materials = [];
    for (let indexLetter = 0; indexLetter < LETTERS_COUNT; indexLetter++) {
        const letterMaterial = mesh.children[indexLetter].material;
        letterMaterial.color.setHex(DEFAULT_COLOR);
        letterMaterial.transparent = true;
        letterMaterial.opacity = DEFAULT_OPACITY;
        letterMaterial.emissiveIntensity = EMISSIVE_INTENSITY;
        letterMaterial.emissive.setHex(EMISSIVE_COLOR);
        mesh.children[indexLetter].material = letterMaterial;
        materials.push(letterMaterial);
    }
    scene.addObject(mesh);
    return materials;
}