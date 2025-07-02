import { MeshPhongMaterial } from "three";

const MAX_ITEMS = 8;
const REEL_MIN_SPEED = Math.PI / 20;
const REEL_MAX_SPEED = Math.PI / 10;
const REEL_ACCELERATION = Math.PI / 90;
const REEL_DECELERATION = Math.PI / 60;
const REEL_MAX_TURN_COUNT = 10;
const REEL_MIN_TURN_COUNT = 3;
const REEL_ON_WON_DURATION = 100;
const MODEL_PATH = "./assets/reels-box.glb";
const LIGHTS_OPACITY_OFF = 0.2;
const LIGHTS_OPACITY_ON = 1.0;
const LIGHTS_COLOR = 0xfbd04a;
const LIGHTS_EMISSIVE_COLOR = 0xfbd04a;
const LIGHTS_MIN_INTENSITY = 0;
const LIGHTS_MAX_INTENSITY = 1.5;
const LIGHTS_BLINKING_DURATION = 5;
const LIGHTS_ROTATING_DURATION = 10;
const REELS_BOX_STATES = {
    IDLE: Symbol.for("reels-box-idle"),
    ACTIVATING: Symbol.for("reels-box-activating"),
    SPINNING_REELS: Symbol.for("reels-box-spinning-reels"),
    STOPPING: Symbol.for("reels-box-stopping"),
    PREPARING_BONUS_DELIVERY: Symbol.for("reels-box-preparing-bonus-delivery"),
    DELIVERING_BONUS: Symbol.for("reels-box-delivering-bonus")
};
const REEL_STATES = {
    IDLE: Symbol.for("reel-idle"),
    STARTING: Symbol.for("reel-starting"),
    ACCELERATING: Symbol.for("reel-accelerating"),
    SPINNING: Symbol.for("reel-spinning"),
    DECELERATING: Symbol.for("reel-decelerating")
};
const LIGHTS_STATES = {
    IDLE: Symbol.for("reels-box-lights-idle"),
    ACTIVATING: Symbol.for("reels-box-lights-activating"),
    STARTING_ROTATING: Symbol.for("reels-box-lights-starting-rotating"),
    ROTATING: Symbol.for("reels-box-lights-rotating"),
    STARTING_BLINKING: Symbol.for("reels-box-lights-starting-blinking"),
    BLINKING: Symbol.for("reels-box-lights-blinking"),
    STOPPING_BLINKING: Symbol.for("reels-box-lights-stopping-blinking")
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
        nextState: null,
        pendingSpins: 0,
        frameActive: -1,
        reels: [{
            state: REEL_STATES.IDLE,
            nextState: null,
            index: 0,
            rotation: 0,
            previousRotation: 0,
            currentSpeed: 0,
            targetIndex: -1,
            targetRotation: -1
        }, {
            state: REEL_STATES.IDLE,
            nextState: null,
            index: 0,
            rotation: 0,
            previousRotation: 0,
            currentSpeed: 0,
            targetIndex: -1,
            targetRotation: -1
        }, {
            state: REEL_STATES.IDLE,
            nextState: null,
            index: 0,
            rotation: 0,
            previousRotation: 0,
            currentSpeed: 0,
            targetIndex: -1,
            targetRotation: -1
        }],
        lights: {
            state: LIGHTS_STATES.IDLE,
            nextState: null,
            headIndex: 0,
            frameLastRefresh: -1,
            bulbs: []
        }
    };

    async initialize() {
        const scene = this.#scene;
        const { reelsMeshes, lightBulbsMaterials } = await initializeModel({ scene });
        this.#reelsMeshes = reelsMeshes;
        this.#lightBulbsMaterials = lightBulbsMaterials;
        initializeLights({
            scene,
            lightBulbsMaterials,
            lights: this.#reelsBox.lights
        });
    }

    update() {
        const reelsBox = this.#reelsBox;
        const { state, reels, lights } = reelsBox;
        if (state !== REELS_BOX_STATES.IDLE) {
            updateReelsBoxState({ reelsBox });
            updateLightsState({ reelsBox });
            reels.forEach(reel => updateReelState({ reel }));
            reels.forEach((reel, indexReel) => this.#reelsMeshes[indexReel].rotation.x = reel.rotation);
            if (state === REELS_BOX_STATES.DELIVERING_BONUS) {
                this.#onBonusWon(reels.map(reel => reel.index));
            }
        }
        if (lights.state !== LIGHTS_STATES.IDLE) {
            lights.bulbs.forEach((bulb, indexBulb) => {
                this.#lightBulbsMaterials[indexBulb].emissiveIntensity = bulb.intensity;
                this.#lightBulbsMaterials[indexBulb].opacity = bulb.opacity;
            });
        }
        if (reelsBox.nextState) {
            reelsBox.state = reelsBox.nextState;
        }
        reels.forEach(reel => {
            if (reel.nextState) {
                reel.state = reel.nextState;
            }
        });
        if (lights.nextState) {
            lights.state = lights.nextState;
        }
    }

    spinReels() {
        if (this.#reelsBox.state === REELS_BOX_STATES.IDLE) {
            this.#reelsBox.state = REELS_BOX_STATES.ACTIVATING;
        } else {
            this.#reelsBox.pendingSpins++;
        }
    }

    save() {
        return {
            state: this.#reelsBox.state.description,
            nextState: this.#reelsBox.nextState ? this.#reelsBox.nextState.description : null,
            pendingSpins: this.#reelsBox.pendingSpins,
            frameActive: this.#reelsBox.frameActive,
            reels: this.#reelsBox.reels.map(reel => ({
                state: reel.state.description,
                nextState: reel.nextState ? reel.nextState.description : null,
                index: reel.index,
                rotation: reel.rotation,
                previousRotation: reel.previousRotation,
                currentSpeed: reel.currentSpeed,
                targetIndex: reel.targetIndex,
                targetRotation: reel.targetRotation
            })),
            lights: {
                state: this.#reelsBox.lights.state.description,
                headIndex: this.#reelsBox.lights.headIndex,
                frameLastRefresh: this.#reelsBox.lights.frameLastRefresh,
                bulbs: this.#reelsBox.lights.bulbs.map(bulb => ({
                    intensity: bulb.intensity
                }))
            }
        };
    }

    load(reelsBox) {
        this.#reelsBox.state = Symbol.for(reelsBox.state);
        this.#reelsBox.nextState = reelsBox.nextState ? Symbol.for(reelsBox.nextState) : null;
        this.#reelsBox.pendingSpins = reelsBox.pendingSpins;
        this.#reelsBox.frameActive = reelsBox.frameActive;
        this.#reelsBox.reels.forEach((reel, indexReel) => {
            reel.state = Symbol.for(reelsBox.reels[indexReel].state);
            reel.nextState = reelsBox.reels[indexReel].nextState ? Symbol.for(reelsBox.reels[indexReel].nextState) : null;
            reel.index = reelsBox.reels[indexReel].index;
            reel.rotation = reelsBox.reels[indexReel].rotation;
            reel.targetIndex = reelsBox.reels[indexReel].targetIndex;
            reel.targetRotation = reelsBox.reels[indexReel].targetRotation;
            reel.previousRotation = reelsBox.reels[indexReel].previousRotation;
            reel.currentSpeed = reelsBox.reels[indexReel].currentSpeed;
            this.#reelsMeshes[indexReel].rotation.x = reel.rotation;
        });
        this.#reelsBox.lights.state = Symbol.for(reelsBox.lights.state);
        this.#reelsBox.lights.headIndex = reelsBox.lights.headIndex;
        this.#reelsBox.lights.frameLastRefresh = reelsBox.lights.frameLastRefresh;
        this.#reelsBox.lights.bulbs.forEach((bulb, indexBulb) => {
            bulb.intensity = reelsBox.lights.bulbs[indexBulb].intensity;
        });
    }
}

function updateReelsBoxState({ reelsBox }) {
    reelsBox.nextState = null;
    switch (reelsBox.state) {
        case REELS_BOX_STATES.ACTIVATING:
            reelsBox.reels.forEach(reel => reel.state = REEL_STATES.STARTING);
            reelsBox.nextState = REELS_BOX_STATES.SPINNING_REELS;
            reelsBox.lights.state = LIGHTS_STATES.ACTIVATING;
            break;
        case REELS_BOX_STATES.SPINNING_REELS:
            if (reelsBox.reels.every(reel => reel.state === REEL_STATES.IDLE)) {
                reelsBox.frameActive = 0;
                reelsBox.nextState = REELS_BOX_STATES.STOPPING;
            }
            break;
        case REELS_BOX_STATES.STOPPING:
            reelsBox.frameActive++;
            if (reelsBox.frameActive > REEL_ON_WON_DURATION) {
                reelsBox.frameActive = 0;
                reelsBox.nextState = REELS_BOX_STATES.PREPARING_BONUS_DELIVERY;
            }
            break;
        case REELS_BOX_STATES.PREPARING_BONUS_DELIVERY:
            reelsBox.nextState = REELS_BOX_STATES.DELIVERING_BONUS;
            break;
        case REELS_BOX_STATES.DELIVERING_BONUS:
            if (reelsBox.pendingSpins > 0) {
                reelsBox.pendingSpins--;
                reelsBox.nextState = REELS_BOX_STATES.ACTIVATING;
            } else {
                reelsBox.nextState = REELS_BOX_STATES.IDLE;
            }
            break;
    }
}

function updateReelState({ reel }) {
    reel.nextState = null;
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
            reel.nextState = REEL_STATES.ACCELERATING;
            break;
        case REEL_STATES.ACCELERATING:
            if (reel.currentSpeed < REEL_MAX_SPEED) {
                reel.currentSpeed += REEL_ACCELERATION;
            }
            if (reel.rotation - reel.previousRotation > Math.PI || reel.targetRotation - reel.rotation < 0) {
                reel.nextState = REEL_STATES.SPINNING;
            }
            reel.rotation += reel.currentSpeed;
            break;
        case REEL_STATES.SPINNING:
            if (reel.targetRotation - reel.rotation < Math.PI) {
                reel.nextState = REEL_STATES.DECELERATING;
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
                reel.index = reel.targetIndex;
                reel.rotation = reel.index * ((Math.PI * 2) / MAX_ITEMS);
                reel.previousRotation = reel.rotation;
                reel.targetIndex = -1;
                reel.targetRotation = -1;
                reel.currentSpeed = 0;
                reel.nextState = REEL_STATES.IDLE;
            } else {
                reel.rotation += reel.currentSpeed;
            }
            break;
    }
}

function updateLightsState({ reelsBox }) {
    reelsBox.lights.nextState = null;
    switch (reelsBox.lights.state) {
        case LIGHTS_STATES.IDLE:
            break;
        case LIGHTS_STATES.ACTIVATING:
            reelsBox.lights.nextState = LIGHTS_STATES.STARTING_ROTATING;
            break;
        case LIGHTS_STATES.STARTING_ROTATING:
            reelsBox.lights.frameLastRefresh = 0;
            reelsBox.lights.nextState = LIGHTS_STATES.ROTATING;
            break;
        case LIGHTS_STATES.ROTATING:
            reelsBox.lights.frameLastRefresh++;
            if (reelsBox.lights.frameLastRefresh > LIGHTS_ROTATING_DURATION) {
                reelsBox.lights.headIndex = (reelsBox.lights.headIndex + 1) % 3;
                reelsBox.lights.bulbs.forEach((bulb, indexBulb) => {
                    enableBulb(bulb, indexBulb % 3 === reelsBox.lights.headIndex || (indexBulb + 1) % 3 === reelsBox.lights.headIndex);
                });
                reelsBox.lights.frameLastRefresh = 0;
            }
            if (reelsBox.state === REELS_BOX_STATES.STOPPING) {
                reelsBox.lights.nextState = LIGHTS_STATES.STARTING_BLINKING;
            }
            break;
        case LIGHTS_STATES.STARTING_BLINKING:
            reelsBox.lights.bulbs.forEach((bulb, indexBulb) => enableBulb(bulb, indexBulb % 2 === 0));
            reelsBox.lights.headIndex = 0;
            reelsBox.lights.frameLastRefresh = 0;
            reelsBox.lights.nextState = LIGHTS_STATES.BLINKING;
            break;
        case LIGHTS_STATES.BLINKING:
            reelsBox.lights.frameLastRefresh++;
            if (reelsBox.lights.frameLastRefresh > LIGHTS_BLINKING_DURATION) {
                reelsBox.lights.bulbs.forEach(bulb => enableBulb(bulb, bulb.intensity === LIGHTS_MIN_INTENSITY));
                reelsBox.lights.frameLastRefresh = 0;
            }
            if (reelsBox.state === REELS_BOX_STATES.PREPARING_BONUS_DELIVERY) {
                reelsBox.lights.nextState = LIGHTS_STATES.STOPPING_BLINKING;
            }
            break;
        case LIGHTS_STATES.STOPPING_BLINKING:
            reelsBox.lights.bulbs.forEach(bulb => enableBulb(bulb, false));
            reelsBox.lights.frameLastRefresh = -1;
            reelsBox.lights.nextState = LIGHTS_STATES.IDLE;
            break;
        default:
    }
}

async function initializeModel({ scene }) {
    const reelsMeshes = [];
    const lightBulbsMaterials = [];
    const model = await scene.loadModel(MODEL_PATH);
    model.scene.traverse(child => {
        if (child.isMesh) {
            if (child.userData.reel) {
                reelsMeshes[child.userData.index] = child;
            } else if (child.material.userData.light) {
                lightBulbsMaterials[child.material.userData.index] = child.material = new MeshPhongMaterial({
                    color: LIGHTS_COLOR,
                    emissive: LIGHTS_EMISSIVE_COLOR,
                    emissiveIntensity: LIGHTS_MIN_INTENSITY,
                    opacity: LIGHTS_OPACITY_OFF,
                    transparent: true
                });
            }
        }
    });
    scene.addObject(model.scene);
    return {
        reelsMeshes,
        lightBulbsMaterials
    };
}

function initializeLights({ lightBulbsMaterials, lights }) {
    lightBulbsMaterials.forEach((_, indexMaterial) => {
        lights.bulbs[indexMaterial] = {
            intensity: LIGHTS_MIN_INTENSITY,
            opacity: LIGHTS_OPACITY_OFF,
            frameLastRefresh: -1
        };
    });
}

function enableBulb(bulb, enabled) {
    if (enabled) {
        bulb.intensity = LIGHTS_MAX_INTENSITY;
        bulb.opacity = LIGHTS_OPACITY_ON;
    } else {
        bulb.intensity = LIGHTS_MIN_INTENSITY;
        bulb.opacity = LIGHTS_OPACITY_OFF;
    }
}