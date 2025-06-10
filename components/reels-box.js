import { MeshPhongMaterial } from "three";

const MAX_ITEMS = 8;
const REEL_MIN_SPEED = Math.PI / 20;
const REEL_MAX_SPEED = Math.PI / 10;
const REEL_ACCELERATION = Math.PI / 90;
const REEL_DECELERATION = Math.PI / 60;
const REEL_MAX_TURN_COUNT = 10;
const REEL_MIN_TURN_COUNT = 3;
const REEL_ON_WON_DELAY = 1000;
const MODEL_PATH = "./../assets/reels-box.glb";
const REEL_PREFIX_NAME = "reel-";
const LIGHT_PREFIX_NAME = "light-";
const LIGHTS_COLOR = 0xfbd04a;
const LIGHTS_EMISSIVE_COLOR = 0xfbd04a;
const LIGHTS_MIN_INTENSITY = -.2;
const LIGHTS_MAX_INTENSITY = 1.5;
const LIGHTS_DELAY_BLINKING_ON = 100;
const LIGHTS_DELAY_BLINKING_OFF = 250;
const LIGHTS_DELAY_ROTATING = 200;
const REELS_BOX_STATES = {
    IDLE: Symbol.for("reels-box-idle"),
    ACTIVATING: Symbol.for("reels-box-activating"),
    ACTIVE: Symbol.for("reels-box-active"),
    STOPPING: Symbol.for("reels-box-stopping"),
    SETTLED: Symbol.for("reels-box-settled")
};
const REEL_STATES = {
    IDLE: Symbol.for("reel-idle"),
    STARTING: Symbol.for("reel-starting"),
    ACCELERATING: Symbol.for("reel-accelerating"),
    SPINNING: Symbol.for("reel-spinning"),
    DECELERATING: Symbol.for("reel-decelerating"),
    SETTLED: Symbol.for("reel-settled")
};
const LIGHTS_STATES = {
    IDLE: Symbol.for("reels-box-lights-idle"),
    STARTING_ROTATING: Symbol.for("reels-box-lights-starting-rotating"),
    ROTATING: Symbol.for("reels-box-lights-rotating"),
    STARTING_BLINKING: Symbol.for("reels-box-lights-starting-blinking"),
    BLINKING: Symbol.for("reels-box-lights-blinking"),
    STOPPING_BLINKING: Symbol.for("reels-box-lights-stopping-blinking"),
    PREPARING_IDLE: Symbol.for("reels-box-lights-preparing-idle")
};

export default class {
    constructor({ scene, onBonusWon }) {
        this.#scene = scene;
        this.#onBonusWon = onBonusWon;
    }

    #scene;
    #lightBulbsMaterials;
    #reelsMeshes;
    #onBonusWon;
    #reelsBox = {
        state: REELS_BOX_STATES.IDLE,
        pendingSpins: 0,
        timeNextSpin: -1,
        timeActive: -1,
        reels: [{
            state: REEL_STATES.IDLE,
            index: 0,
            rotation: 0,
            targetIndex: -1,
            targetRotation: -1
        }, {
            state: REEL_STATES.IDLE,
            index: 0,
            rotation: 0,
            targetIndex: -1,
            targetRotation: -1
        }, {
            state: REEL_STATES.IDLE,
            index: 0,
            rotation: 0,
            targetIndex: -1,
            targetRotation: -1
        }],
        lights: {
            state: LIGHTS_STATES.IDLE,
            headIndex: 0,
            timeRefresh: -1,
            bulbs: []
        }
    };

    async initialize() {
        const scene = this.#scene;
        const { reelsMeshes, lightsMaterials } = await initializeModel({ scene });
        this.#reelsMeshes = reelsMeshes;
        this.#lightBulbsMaterials = lightsMaterials;
        initializeLights({
            scene,
            lightsMaterials,
            lights: this.#reelsBox.lights
        });
    }

    update(time) {
        const reelsBox = this.#reelsBox;
        const { state, reels, lights } = reelsBox;
        updateReelsBoxState({ reelsBox, time });
        updateLightsState({ reelsBox, time });
        reels.forEach(reel => updateReelState({ reel }));
        if (state !== REELS_BOX_STATES.IDLE) {
            reels.forEach((reel, indexReel) => this.#reelsMeshes[indexReel].rotation.x = reel.rotation);
            if (state === REELS_BOX_STATES.SETTLED) {
                this.#onBonusWon(reels.map(reel => reel.index));
            }
        }
        if (lights.state !== LIGHTS_STATES.IDLE) {
            lights.bulbs.forEach((bulb, indexBulb) => {
                this.#lightBulbsMaterials[indexBulb].emissiveIntensity = bulb.intensity;
            });
        }
    }

    spinReels() {
        this.#reelsBox.pendingSpins++;
        if (this.#reelsBox.state === REELS_BOX_STATES.IDLE) {
            this.#reelsBox.state = REELS_BOX_STATES.ACTIVATING;
        }
    }

    save() {
        return {
            state: this.#reelsBox.state.description,
            pendingSpins: this.#reelsBox.pendingSpins,
            timeNextSpin: this.#reelsBox.timeNextSpin,
            timeActive: this.#reelsBox.timeActive,
            reels: this.#reelsBox.reels.map(reel => ({
                state: reel.state.description,
                index: reel.index,
                rotation: reel.rotation,
                targetIndex: reel.targetIndex,
                targetRotation: reel.targetRotation
            })),
            lights: {
                state: this.#reelsBox.lights.state.description,
                headIndex: this.#reelsBox.lights.headIndex,
                timeRefresh: this.#reelsBox.lights.timeRefresh,
                bulbs: this.#reelsBox.lights.bulbs.map(bulb => ({
                    intensity: bulb.intensity
                }))
            }
        };
    }

    load(reelsBox) {
        this.#reelsBox.state = Symbol.for(reelsBox.state);
        this.#reelsBox.pendingSpins = reelsBox.pendingSpins;
        this.#reelsBox.timeNextSpin = reelsBox.timeNextSpin;
        this.#reelsBox.timeActive = reelsBox.timeActive;
        this.#reelsBox.reels.forEach((reel, indexReel) => {
            reel.state = Symbol.for(reelsBox.reels[indexReel].state);
            reel.index = reelsBox.reels[indexReel].index;
            reel.rotation = reelsBox.reels[indexReel].rotation;
            reel.targetIndex = reelsBox.reels[indexReel].targetIndex;
            reel.targetRotation = reelsBox.reels[indexReel].targetRotation;
            this.#reelsMeshes[indexReel].rotation.x = reel.rotation;
        });
        this.#reelsBox.lights.state = Symbol.for(reelsBox.lights.state);
        this.#reelsBox.lights.headIndex = reelsBox.lights.headIndex;
        this.#reelsBox.lights.timeRefresh = reelsBox.lights.timeRefresh;
        this.#reelsBox.lights.bulbs.forEach((bulb, indexBulb) => {
            bulb.intensity = reelsBox.lights.bulbs[indexBulb].intensity;
        });
    }
}

function updateReelsBoxState({ reelsBox, time }) {
    switch (reelsBox.state) {
        case REELS_BOX_STATES.ACTIVATING:
            reelsBox.reels.forEach(reel => reel.state = REEL_STATES.STARTING);
            reelsBox.state = REELS_BOX_STATES.ACTIVE;
            reelsBox.lights.state = LIGHTS_STATES.STARTING_ROTATING;
            break;
        case REELS_BOX_STATES.ACTIVE:
            if (reelsBox.reels.every(reel => reel.state === REEL_STATES.IDLE)) {
                reelsBox.timeActive = time;
                reelsBox.state = REELS_BOX_STATES.STOPPING;
                reelsBox.lights.state = LIGHTS_STATES.STARTING_BLINKING;
            }
            break;
        case REELS_BOX_STATES.STOPPING:
            if (time - reelsBox.timeActive > REEL_ON_WON_DELAY) {
                reelsBox.timeActive = -1;
                reelsBox.pendingSpins--;
                reelsBox.state = REELS_BOX_STATES.SETTLED;
                reelsBox.lights.state = LIGHTS_STATES.STOPPING_BLINKING;
            }
            break;
        case REELS_BOX_STATES.SETTLED:
            if (reelsBox.pendingSpins > 0) {
                reelsBox.state = REELS_BOX_STATES.ACTIVATING;
            } else {
                reelsBox.state = REELS_BOX_STATES.IDLE;
            }
            break;
    }
}

function updateReelState({ reel }) {
    switch (reel.state) {
        case REEL_STATES.IDLE:
            break;
        case REEL_STATES.STARTING:
            reel.targetIndex = Math.floor(Math.random() * MAX_ITEMS);
            const turnsCount = Math.floor(Math.random() * (REEL_MAX_TURN_COUNT - REEL_MIN_TURN_COUNT + 1)) + REEL_MIN_TURN_COUNT;
            const distanceNewItem = reel.targetIndex - reel.index + (reel.targetIndex <= reel.index ? MAX_ITEMS : 0);
            reel.targetRotation = reel.rotation + (turnsCount * Math.PI * 2) + (distanceNewItem * ((Math.PI * 2) / MAX_ITEMS));
            reel.previousRotation = reel.rotation;
            reel.currentSpeed = 0;
            reel.state = REEL_STATES.ACCELERATING;
            break;
        case REEL_STATES.ACCELERATING:
            if (reel.currentSpeed < REEL_MAX_SPEED) {
                reel.currentSpeed += REEL_ACCELERATION;
            }
            if (reel.rotation - reel.previousRotation > Math.PI || reel.targetRotation - reel.rotation < 0) {
                reel.state = REEL_STATES.SPINNING;
            }
            reel.rotation += reel.currentSpeed;
            break;
        case REEL_STATES.SPINNING:
            if (reel.targetRotation - reel.rotation < Math.PI) {
                reel.state = REEL_STATES.DECELERATING;
            }
            reel.rotation += reel.currentSpeed;
            break;
        case REEL_STATES.DECELERATING:
            if (reel.currentSpeed > REEL_MIN_SPEED) {
                reel.currentSpeed -= REEL_DECELERATION;
            } else {
                reel.currentSpeed = REEL_MIN_SPEED;
            }
            if (reel.targetRotation - reel.rotation < 0) {
                reel.state = REEL_STATES.SETTLED;
            }
            reel.rotation += reel.currentSpeed;
            break;
        case REEL_STATES.SETTLED:
            reel.state = REEL_STATES.IDLE;
            reel.index = reel.targetIndex;
            reel.rotation = reel.index * ((Math.PI * 2) / MAX_ITEMS);
            reel.targetIndex = -1;
            reel.targetRotation = -1;
            break;
    }
}

function updateLightsState({ reelsBox, time }) {
    switch (reelsBox.lights.state) {
        case LIGHTS_STATES.IDLE:
            break;
        case LIGHTS_STATES.STARTING_ROTATING:
            reelsBox.lights.timeRefresh = time;
            reelsBox.lights.state = LIGHTS_STATES.ROTATING;
            break;
        case LIGHTS_STATES.ROTATING:
            if (time - reelsBox.lights.timeRefresh > LIGHTS_DELAY_ROTATING) {
                reelsBox.lights.headIndex = (reelsBox.lights.headIndex + 1) % 3;
                reelsBox.lights.bulbs.forEach((bulb, indexBulb) => {
                    if (indexBulb % 3 === reelsBox.lights.headIndex || (indexBulb + 1) % 3 === reelsBox.lights.headIndex) {
                        bulb.intensity = LIGHTS_MAX_INTENSITY;
                    } else {
                        bulb.intensity = LIGHTS_MIN_INTENSITY;
                    }
                });
                reelsBox.lights.timeRefresh = time;
            }
            break;
        case LIGHTS_STATES.STARTING_BLINKING:
            reelsBox.lights.bulbs.forEach(bulb => bulb.intensity = LIGHTS_MIN_INTENSITY);
            reelsBox.lights.headIndex = 0;
            reelsBox.lights.timeRefresh = -1;
            reelsBox.lights.state = LIGHTS_STATES.BLINKING;
            break;
        case LIGHTS_STATES.BLINKING:
            if (time - reelsBox.lights.timeRefresh > LIGHTS_DELAY_BLINKING_ON) {
                reelsBox.lights.bulbs.forEach(bulb => {
                    if (bulb.intensity == LIGHTS_MIN_INTENSITY) {
                        bulb.intensity = LIGHTS_MAX_INTENSITY;
                    } else {
                        bulb.intensity = LIGHTS_MIN_INTENSITY;
                    }
                });
                reelsBox.lights.timeRefresh = time;
            }
            break;
        case LIGHTS_STATES.STOPPING_BLINKING:
            reelsBox.lights.bulbs.forEach(bulb => bulb.intensity = LIGHTS_MIN_INTENSITY);
            reelsBox.lights.timeRefresh = -1;
            reelsBox.lights.state = LIGHTS_STATES.PREPARING_IDLE;
            break;
        case LIGHTS_STATES.PREPARING_IDLE:
            reelsBox.lights.state = LIGHTS_STATES.IDLE;
            break;
        default:
    }
}

async function initializeModel({ scene }) {
    const reelsMeshes = [];
    const lightsMaterials = [];
    const model = await scene.loadModel(MODEL_PATH);
    model.scene.traverse(child => {
        if (child.isMesh) {
            if (child.material.name.startsWith(LIGHT_PREFIX_NAME)) {
                const indexLight = parseInt(child.material.name.substring(LIGHT_PREFIX_NAME.length));
                lightsMaterials[indexLight - 1] = child.material = new MeshPhongMaterial({
                    color: LIGHTS_COLOR,
                    emissive: LIGHTS_EMISSIVE_COLOR,
                    emissiveIntensity: LIGHTS_MIN_INTENSITY
                });
            }
            if (child.name.startsWith(REEL_PREFIX_NAME)) {
                const indexReel = parseInt(child.name.substring(REEL_PREFIX_NAME.length));
                reelsMeshes[indexReel - 1] = child;
            }
        }
    });
    scene.addObject(model.scene);
    return {
        reelsMeshes,
        lightsMaterials
    };
}

function initializeLights({ lightsMaterials, lights }) {
    lightsMaterials.forEach((_, indexMaterial) => {
        lights.bulbs[indexMaterial] = {
            intensity: LIGHTS_MIN_INTENSITY,
            timeRefresh: -1
        };
    });
}