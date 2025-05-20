import Coins from "./instanced-meshes/coins.js";

const DEFAULT_COLOR = 0xE7E7E7;
const HIGHLIGHT_COLOR = 0xffffff;
const DEFAULT_OPACITY = 0.1;
const HIGHLIGHT_OPACITY = 0.25;
const EMISSIVE_COLOR = 0xffffff;
const EMISSIVE_INTENSITY = 0;
const EMISSIVE_HIGHLIGHT_INTENSITY = 0.25;
const BONUS_FLASHING_DELAY = 150;
const LETTER_FLASHING_DELAY = 100;
const LETTERS_COUNT = 6;
const POSITION = [0, 0.33, -0.27];
const WIDTH = 0.6;
const HEIGHT = 0.03;
const DEPTH = 0.04;
const MIN_POSITION_X = -0.22;
const MAX_POSITION_X = 0.22;
const SLOT_WIDTH = 0.075;
const PROBABILITY_LETTER_WIN = 1 / 5;
const COUNT_BONUS_FLASHING = 5;
const COUNT_LETTER_FLASHING = 5;
const TYPE = "sensor-gate";
const MODEL_PATH = "./../assets/sensor-gate.glb";

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
    BONUS_DELIVERED: Symbol.for("sensor-letter-bonus-delivered")
};

export default class {

    constructor({ scene, onBonusWon }) {
        this.#scene = scene;
        this.#onBonusWon = onBonusWon;
    }

    #scene;
    #onBonusWon;
    #materials;
    #collider;
    #sensor = {
        state: SENSOR_STATES.IDLE,
        flashStartTime: -1,
        flashCount: 0,
        letters: [{
            state: LETTER_STATES.OFF,
            flashStartTime: -1,
            flashCount: 0
        }, {
            state: LETTER_STATES.OFF,
            flashStartTime: -1,
            flashCount: 0
        }, {
            state: LETTER_STATES.OFF,
            flashStartTime: -1,
            flashCount: 0
        }, {
            state: LETTER_STATES.OFF,
            flashStartTime: -1,
            flashCount: 0
        }, {
            state: LETTER_STATES.OFF,
            flashStartTime: -1,
            flashCount: 0
        }, {
            state: LETTER_STATES.OFF,
            flashStartTime: -1,
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
                onIntersect: userData => onCoinIntersect({ userData, sensor: this.#sensor })
            }
        });
    }

    update(time) {
        this.#sensor.letters.forEach(letter => updateLetterState({ letter, time }));
        if (this.#sensor.state === SENSOR_STATES.IDLE &&
            this.#sensor.letters.every(letter => letter.state === LETTER_STATES.LOCKED_ON)) {
            this.#sensor.state = SENSOR_STATES.ACTIVATING;
        }
        updateSensorState({ sensor: this.#sensor, time });
        if (this.#sensor.state === SENSOR_STATES.BONUS_DELIVERED) {
            this.#sensor.letters.forEach(letter => letter.state = LETTER_STATES.OFF);
            this.#onBonusWon();
        }
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
                letters: this.#sensor.letters.map(letter => ({
                    state: letter.state.description,
                    flashStartTime: letter.flashStartTime,
                    flashCount: letter.flashCount
                }))
            }
        };
    }

    load(sensorGate) {
        this.#collider = this.#scene.worldColliders.get(sensorGate.colliderHandle);
        this.#collider.userData = {
            objectType: TYPE,
            onIntersect: userData => onCoinIntersect({ sensor: this.#sensor, userData })
        };
        this.#sensor.state = Symbol.for(sensorGate.sensor.state);
        this.#sensor.letters.forEach((letter, indexLetter) => {
            letter.state = Symbol.for(sensorGate.sensor.letters[indexLetter].state);
            letter.flashStartTime = sensorGate.sensor.letters[indexLetter].flashStartTime;
            letter.flashCount = sensorGate.sensor.letters[indexLetter].flashCount;
        });
    }
}

function onCoinIntersect({ sensor, userData }) {
    if (userData.objectType === Coins.TYPE) {
        const coin = Coins.getCoin(userData);
        if (coin) {
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

function updateSensorState({ sensor, time }) {
    switch (sensor.state) {
        case SENSOR_STATES.ACTIVATING:
            sensor.flashStartTime = time;
            sensor.state = SENSOR_STATES.FLASHING_ON;
            break;
        case SENSOR_STATES.FLASHING_ON:
            if (time - sensor.flashStartTime >= BONUS_FLASHING_DELAY) {
                sensor.flashStartTime = time;
                if (sensor.flashCount < COUNT_BONUS_FLASHING) {
                    sensor.state = SENSOR_STATES.FLASHING_OFF;
                } else {
                    sensor.state = SENSOR_STATES.AWAITING_BONUS_DELIVERY;
                }
            }
            break;
        case SENSOR_STATES.FLASHING_OFF:
            if (time - sensor.flashStartTime >= BONUS_FLASHING_DELAY) {
                sensor.flashStartTime = time;
                sensor.flashCount++;
                sensor.state = SENSOR_STATES.FLASHING_ON;
            }
            break;
        case SENSOR_STATES.AWAITING_BONUS_DELIVERY:
            sensor.flashCount = 0;
            sensor.flashStartTime = -1;
            sensor.bonusWonStartTime = time;
            sensor.state = SENSOR_STATES.BONUS_DELIVERED;
            break;
        case SENSOR_STATES.BONUS_DELIVERED:
            sensor.bonusWonStartTime = -1;
            sensor.state = SENSOR_STATES.IDLE;
            break;
    }
}

function updateLetterState({ letter, time }) {
    switch (letter.state) {
        case LETTER_STATES.OFF:
            break;
        case LETTER_STATES.ACTIVATING:
            if (Math.random() < PROBABILITY_LETTER_WIN) {
                letter.state = LETTER_STATES.FLASHING_ON;
                letter.flashStartTime = time;
            } else {
                letter.state = LETTER_STATES.OFF;
            }
            break;
        case LETTER_STATES.FLASHING_ON:
            if (time - letter.flashStartTime >= LETTER_FLASHING_DELAY) {
                letter.flashStartTime = time;
                if (letter.flashCount < COUNT_LETTER_FLASHING) {
                    letter.state = LETTER_STATES.FLASHING_OFF;
                } else {
                    letter.state = LETTER_STATES.LOCKED_ON;
                }
            }
            break;
        case LETTER_STATES.FLASHING_OFF:
            if (time - letter.flashStartTime >= LETTER_FLASHING_DELAY) {
                letter.flashStartTime = time;
                letter.flashCount++;
                letter.state = LETTER_STATES.FLASHING_ON;
            }
            break;
        case LETTER_STATES.LOCKED_ON:
            letter.flashCount = 0;
            letter.flashStartTime = -1;
            break;

    }
}

async function initializeModel({ scene }) {
    const sensorGateModel = await scene.loadModel(MODEL_PATH);
    sensorGateModel.scene.traverse(child => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
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