import { Vector3, MeshPhongMaterial } from "three";

const SPEED = .02;
const SPEED_TRAP = .01;
const SPEED_DOORS = .003;
const DISTANCE = 0.13;
const MODEL_PATH = "./assets/coin-roller.glb";
const LAUNCHER_PART_NAME = "launcher";
const TRAP_DOOR_PART_NAME = "trap-door";
const DOORS_PART_NAME = "doors";
const TRAP_SENSOR_NAME = "trap";
const INIT_POSITION = "init-position";
const BONUS_VALUES = ["slot-3", "slot-2", "slot-1"];
const COIN_IMPULSE_STRENGTH = 0.00003;
const COIN_IMPULSE = new Vector3(0, 0, -1).multiplyScalar(COIN_IMPULSE_STRENGTH);
const INITIALIZATION_COIN_POSITION = 0.09;
const COIN_ROTATION = new Vector3(Math.PI / 2, 0, Math.PI / 2);
const MIN_TRAP_POSITION = 0;
const MAX_TRAP_POSITION = 0.25 - MIN_TRAP_POSITION;
const MIN_DOORS_POSITION = 0;
const MAX_DOORS_POSITION = 0.03;
const COIN_MIN_LINEAR_VELOCITY = 0.0001;
const LAUNCHER_MIN_PHASE = 0.05;
const LIGHTS_COLOR = 0xFFFFFF;
const LIGHTS_EMISSIVE_COLOR = 0xFF00FF;
const LIGHTS_MIN_INTENSITY = 0;
const LIGHTS_MAX_INTENSITY = 1;
const LIGHTS_ON_DURATION = 2;
const LIGHTS_REMANENCE_DURATION = 30;
const LIGHTS_HEAD_SIZE = 8;

const COIN_ROLLER_STATES = {
    IDLE: Symbol.for("coin-roller-idle"),
    ACTIVATING: Symbol.for("coin-roller-activating"),
    INITIALIZING: Symbol.for("coin-roller-initializing"),
    INITIALIZING_COIN: Symbol.for("coin-roller-initializing-coin"),
    OPENING_DOORS: Symbol.for("coin-roller-opening-doors"),
    MOVING_LAUNCHER: Symbol.for("coin-roller-moving-launcher"),
    TRIGGERING_COIN: Symbol.for("coin-roller-triggering-coin"),
    DELIVERING_COIN: Symbol.for("coin-roller-delivering-coin"),
    MOVING_COIN: Symbol.for("coin-roller-moving-coin"),
    OPENING_TRAP: Symbol.for("coin-roller-opening-trap"),
    CLOSING_TRAP: Symbol.for("coin-roller-closing-trap"),
    MOVING_LAUNCHER_TO_BASE: Symbol.for("coin-roller-moving-launcher-to-base"),
    CLOSING_DOORS: Symbol.for("coin-roller-closing-doors")
};

export default class {

    #scene;
    #cabinet;
    #onInitializeCoin;
    #onBonusWon;
    #onGameLost;
    #initPosition;
    #sensorColliders = new Map();
    #lightsMaterials = [];
    #launcherPosition = new Vector3();
    #trapPosition = new Vector3();
    #doorsPosition = new Vector3();
    #coinRoller = {
        state: COIN_ROLLER_STATES.IDLE,
        nextState: null,
        pendingShots: 0,
        launcherPhase: 0,
        trapPosition: 0,
        doorsPosition: 0,
        lights: [],
        lightsHeadIndex: -1,
        lightsDirection: 1,
        lightsRefreshes: -1
    };

    constructor({ scene, cabinet, onInitializeCoin, onBonusWon, onGameLost }) {
        this.#scene = scene;
        this.#cabinet = cabinet;
        this.#onInitializeCoin = onInitializeCoin;
        this.#onBonusWon = (userData, slotName) => {
            const { state, coin } = this.#coinRoller;
            if (coin && userData.objectType === coin.objectType && userData.index === coin.index && state === COIN_ROLLER_STATES.MOVING_COIN) {
                const value = BONUS_VALUES.indexOf(slotName);
                cabinet.recycleObject(coin);
                this.#coinRoller.coin = null;
                onBonusWon(value);
            }
        };
        this.#onGameLost = () => {
            cabinet.recycleObject(this.#coinRoller.coin);
            this.#coinRoller.coin = null;
            onGameLost();
        };
    }

    async initialize() {
        const scene = this.#scene;
        const { parts, lightsMaterials, initPosition } = await initializeModel({
            scene,
            sensorColliders: this.#sensorColliders
        });
        this.#initPosition = initPosition;
        this.#lightsMaterials = lightsMaterials;
        initializeColliders({
            scene,
            parts,
            coinRoller: this.#coinRoller,
            sensorColliders: this.#sensorColliders,
            onBonusWon: this.#onBonusWon,
            onGameLost: this.#onGameLost
        });
        initializeLights({
            scene,
            lightsMaterials,
            lights: this.#coinRoller.lights
        });
        parts.forEach(({ body, meshes }) => {
            meshes.forEach(({ data }) => this.#scene.addObject(data));
            body.setEnabled(true);
        });
        Object.assign(this.#coinRoller, { parts });
        this.#coinRoller.launcher = this.#coinRoller.parts.get(LAUNCHER_PART_NAME);
        this.#coinRoller.launcher.body.setEnabledRotations(false, false, false);
        this.#coinRoller.launcher.body.setEnabledTranslations(false, false, false);
        this.#coinRoller.trap = this.#coinRoller.parts.get(TRAP_DOOR_PART_NAME);
        this.#coinRoller.doors = this.#coinRoller.parts.get(DOORS_PART_NAME);
    }

    update() {
        if (this.#coinRoller.nextState) {
            this.#coinRoller.state = this.#coinRoller.nextState;
            this.#coinRoller.nextState = null;
        }
        updateCoinRollerState({ coinRoller: this.#coinRoller });
        updateLightsState({ coinRoller: this.#coinRoller });
        const { state, launcher, trap, coin, doors } = this.#coinRoller;
        if (state !== COIN_ROLLER_STATES.IDLE) {
            this.#launcherPosition.setX(-Math.cos(this.#coinRoller.launcherPhase) * DISTANCE + DISTANCE);
            this.#trapPosition.z = this.#coinRoller.trapPosition;
            this.#doorsPosition.x = this.#coinRoller.doorsPosition;
            launcher.body.setNextKinematicTranslation(this.#launcherPosition);
            trap.body.setNextKinematicTranslation(this.#trapPosition);
            doors.body.setNextKinematicTranslation(this.#doorsPosition);
            if (state === COIN_ROLLER_STATES.INITIALIZING) {
                this.#coinRoller.coin = this.#onInitializeCoin({ position: this.#initPosition, rotation: COIN_ROTATION });
                this.#coinRoller.coin.body.setEnabledTranslations(false, true, true);
            }
            if (state === COIN_ROLLER_STATES.MOVING_LAUNCHER) {
                coin.body.setEnabledTranslations(true, true, true);
                coin.body.setEnabledRotations(false, false, false);
            }
            if (state === COIN_ROLLER_STATES.DELIVERING_COIN) {
                coin.body.setEnabledRotations(true, true, true);
                coin.body.applyImpulse(COIN_IMPULSE);
            }
        }
    }

    refresh() {
        const { parts, state, lights } = this.#coinRoller;
        if (state !== COIN_ROLLER_STATES.IDLE) {
            parts.forEach(({ meshes, body }) => {
                meshes.forEach(({ data }) => {
                    data.position.copy(body.translation());
                    data.quaternion.copy(body.rotation());
                });
            });
            lights.forEach((light, index) => {
                const material = this.#lightsMaterials[index];
                if (light.on) {
                    material.emissiveIntensity = Math.max(LIGHTS_MIN_INTENSITY, LIGHTS_MAX_INTENSITY * (1 - light.refreshes / LIGHTS_REMANENCE_DURATION));
                } else {
                    material.emissiveIntensity = 0;
                }
            });
        }
    }

    sensorColliders() {
        return Array.from(this.#sensorColliders.values());
    }

    shootCoin() {
        if (this.#coinRoller.state === COIN_ROLLER_STATES.IDLE) {
            this.#coinRoller.state = COIN_ROLLER_STATES.ACTIVATING;
        } else {
            this.#coinRoller.pendingShots++;
        }
    }

    triggerCoin() {
        if (this.#coinRoller.state === COIN_ROLLER_STATES.MOVING_LAUNCHER) {
            this.#coinRoller.state = COIN_ROLLER_STATES.TRIGGERING_COIN;
        }
    }

    save() {
        const sensorCollidersHandles = {};
        this.#sensorColliders.forEach((collider, key) => sensorCollidersHandles[key] = collider.handle);
        return {
            state: this.#coinRoller.state.description,
            nextState: this.#coinRoller.nextState ? this.#coinRoller.nextState.description : null,
            sensorCollidersHandles,
            coinIndex: this.#coinRoller.coin ? this.#coinRoller.coin.index : null,
            launcherBodyHandle: this.#coinRoller.launcher.body.handle,
            trapBodyHandle: this.#coinRoller.trap.body.handle,
            doorsBodyHandle: this.#coinRoller.doors.body.handle,
            launcherPhase: this.#coinRoller.launcherPhase,
            trapPosition: this.#coinRoller.trapPosition,
            doorsPosition: this.#coinRoller.doorsPosition,
            pendingShots: this.#coinRoller.pendingShots,
            lights: this.#coinRoller.lights.map(light => ({
                on: light.on,
                refreshes: light.refreshes
            })),
            lightsHeadIndex: this.#coinRoller.lightsHeadIndex,
            lightsDirection: this.#coinRoller.lightsDirection,
            lightsRefreshes: this.#coinRoller.lightsRefreshes
        };
    }

    load(coinRoller) {
        this.#coinRoller.parts.forEach((partData, name) => {
            partData.meshes.forEach(({ data }) => {
                data.traverse((child) => {
                    if (child.isMesh) {
                        const userData = child.material.userData;
                        const objectType = name;
                        if (userData.sensor) {
                            const colliderHandle = coinRoller.sensorCollidersHandles[name];
                            const collider = this.#scene.worldColliders.get(colliderHandle);
                            collider.userData = {
                                objectType,
                                onIntersect: userData => {
                                    if (this.#coinRoller.coin && userData.objectType === this.#coinRoller.coin.objectType && userData.index === this.#coinRoller.coin.index) {
                                        if (name === TRAP_SENSOR_NAME) {
                                            this.#onGameLost();
                                        } else {
                                            this.#onBonusWon(userData, objectType);
                                        }
                                    }
                                }
                            };
                            this.#sensorColliders.set(objectType, collider);
                        }
                    }
                });
            });
        });
        this.#coinRoller.state = Symbol.for(coinRoller.state);
        this.#coinRoller.nextState = coinRoller.nextState ? Symbol.for(coinRoller.nextState) : null;
        this.#coinRoller.launcherPhase = coinRoller.launcherPhase;
        this.#coinRoller.pendingShots = coinRoller.pendingShots;
        this.#coinRoller.launcher.body = this.#scene.worldBodies.get(coinRoller.launcherBodyHandle);
        this.#coinRoller.trap.body = this.#scene.worldBodies.get(coinRoller.trapBodyHandle);
        this.#coinRoller.doors.body = this.#scene.worldBodies.get(coinRoller.doorsBodyHandle);
        this.#coinRoller.trapPosition = coinRoller.trapPosition;
        this.#coinRoller.doorsPosition = coinRoller.doorsPosition;
        if (coinRoller.coinIndex) {
            this.#coinRoller.coin = this.#cabinet.getCoin({ index: coinRoller.coinIndex });
        }
        this.#coinRoller.lights = coinRoller.lights.map(light => ({
            on: light.on,
            refreshes: light.refreshes
        }));
        this.#coinRoller.lightsHeadIndex = coinRoller.lightsHeadIndex;
        this.#coinRoller.lightsDirection = coinRoller.lightsDirection;
        this.#coinRoller.lightsRefreshes = coinRoller.lightsRefreshes;
    }
}

function updateCoinRollerState({ coinRoller }) {
    switch (coinRoller.state) {
        case COIN_ROLLER_STATES.IDLE:
            break;
        case COIN_ROLLER_STATES.ACTIVATING:
            coinRoller.lightsRefreshes = 0;
            coinRoller.lightsHeadIndex = 0;
            coinRoller.nextState = COIN_ROLLER_STATES.OPENING_DOORS;
            break;
        case COIN_ROLLER_STATES.OPENING_DOORS:
            coinRoller.doorsPosition += SPEED_DOORS;
            if (coinRoller.doorsPosition > MAX_DOORS_POSITION) {
                coinRoller.nextState = COIN_ROLLER_STATES.INITIALIZING;
            }
            break;
        case COIN_ROLLER_STATES.INITIALIZING:
            coinRoller.nextState = COIN_ROLLER_STATES.INITIALIZING_COIN;
            break;
        case COIN_ROLLER_STATES.INITIALIZING_COIN:
            if (coinRoller.coin.position.z < INITIALIZATION_COIN_POSITION) {
                coinRoller.nextState = COIN_ROLLER_STATES.MOVING_LAUNCHER;
            }
            break;
        case COIN_ROLLER_STATES.MOVING_LAUNCHER:
            updateLauncherPosition({ coinRoller });
            break;
        case COIN_ROLLER_STATES.TRIGGERING_COIN:
            updateLauncherPosition({ coinRoller });
            coinRoller.nextState = COIN_ROLLER_STATES.DELIVERING_COIN;
            break;
        case COIN_ROLLER_STATES.DELIVERING_COIN:
            updateLauncherPosition({ coinRoller });
            coinRoller.nextState = COIN_ROLLER_STATES.MOVING_COIN;
            break;
        case COIN_ROLLER_STATES.MOVING_COIN:
            updateLauncherPosition({ coinRoller });
            if (coinRoller.coin) {
                const linearVelocity = coinRoller.coin.body.linvel();
                const linearSpeed =
                    linearVelocity.x * linearVelocity.x +
                    linearVelocity.y * linearVelocity.y +
                    linearVelocity.z * linearVelocity.z;
                if (linearSpeed < COIN_MIN_LINEAR_VELOCITY) {
                    coinRoller.nextState = COIN_ROLLER_STATES.OPENING_TRAP;
                }
            } else {
                coinRoller.nextState = COIN_ROLLER_STATES.MOVING_LAUNCHER_TO_BASE;
            }
            break;
        case COIN_ROLLER_STATES.OPENING_TRAP:
            if (coinRoller.launcherPhase > LAUNCHER_MIN_PHASE) {
                updateLauncherPosition({ coinRoller });
            }
            coinRoller.trapPosition += SPEED_TRAP;
            if (coinRoller.trapPosition > MAX_TRAP_POSITION) {
                coinRoller.nextState = COIN_ROLLER_STATES.CLOSING_TRAP;
            }
            break;
        case COIN_ROLLER_STATES.CLOSING_TRAP:
            if (coinRoller.launcherPhase > LAUNCHER_MIN_PHASE) {
                updateLauncherPosition({ coinRoller });
            }
            coinRoller.trapPosition -= SPEED_TRAP;
            if (coinRoller.trapPosition < MIN_TRAP_POSITION) {
                coinRoller.trapPosition = 0;
                coinRoller.nextState = COIN_ROLLER_STATES.MOVING_LAUNCHER_TO_BASE;
            }
            break;
        case COIN_ROLLER_STATES.MOVING_LAUNCHER_TO_BASE:
            if (coinRoller.launcherPhase > LAUNCHER_MIN_PHASE) {
                updateLauncherPosition({ coinRoller });
            } else {
                coinRoller.launcherPhase = 0;
                if (coinRoller.pendingShots) {
                    coinRoller.pendingShots--;
                    coinRoller.nextState = COIN_ROLLER_STATES.ACTIVATING;
                } else {
                    coinRoller.nextState = COIN_ROLLER_STATES.CLOSING_DOORS;
                }
            }
            break;
        case COIN_ROLLER_STATES.CLOSING_DOORS:
            coinRoller.doorsPosition -= SPEED_DOORS;
            if (coinRoller.doorsPosition < MIN_DOORS_POSITION) {
                coinRoller.doorsPosition = 0;
                coinRoller.lightsRefreshes = -1;
                coinRoller.lightsHeadIndex = -1;
                coinRoller.lightsDirection = 1;
                coinRoller.nextState = COIN_ROLLER_STATES.IDLE;
            }
            break;
        default:
            break;
    }
}
function updateLightsState({ coinRoller }) {
    const { lights, lightsHeadIndex, lightsDirection } = coinRoller;
    const lightsCount = lights.length;
    const headSize = LIGHTS_HEAD_SIZE;
    if (coinRoller.state === COIN_ROLLER_STATES.IDLE || coinRoller.state === COIN_ROLLER_STATES.CLOSING_DOORS) {
        lights.forEach(light => {
            light.on = false;
            light.refreshes = -1;
        });
    } else if (coinRoller.lightsRefreshes !== -1) {
        coinRoller.lightsRefreshes++;
        if (coinRoller.lightsRefreshes > LIGHTS_ON_DURATION) {
            coinRoller.lightsRefreshes = 0;
            coinRoller.lightsHeadIndex += lightsDirection;
            if (coinRoller.lightsHeadIndex > lightsCount) {
                coinRoller.lightsDirection = -1;
                coinRoller.lightsHeadIndex = lightsCount - 1;
            } else if (coinRoller.lightsHeadIndex < 0) {
                coinRoller.lightsDirection = 1;
                coinRoller.lightsHeadIndex = 0;
            }
        }
        lights.forEach((light, index) => {
            const minIndex = lightsDirection > 0 ? lightsHeadIndex - headSize : lightsHeadIndex;
            const maxIndex = lightsDirection > 0 ? lightsHeadIndex : lightsHeadIndex + headSize;
            if (index >= minIndex && index <= maxIndex) {
                light.on = true;
                light.refreshes = 0;
            } else if (light.refreshes > -1 && light.refreshes < LIGHTS_REMANENCE_DURATION) {
                light.refreshes++;
            } else {
                light.on = false;
                light.refreshes = -1;
            }
        });
    }
}

function updateLauncherPosition({ coinRoller }) {
    coinRoller.launcherPhase = (coinRoller.launcherPhase + SPEED) % (Math.PI * 2);
}

async function initializeModel({ scene }) {
    const model = await scene.loadModel(MODEL_PATH);
    const mesh = model.scene;
    const parts = new Map();
    const lightsMaterials = [];
    const initPosition = new Vector3();
    mesh.traverse((child) => {
        if (child.isMesh) {
            const { material, geometry } = child;
            const userData = material.userData;
            if (userData.collider || userData.sensor) {
                const name = userData.name;
                const partData = getPart(parts, name);
                partData.sensor = userData.sensor;
                partData.friction = userData.friction;
                partData.restitution = userData.restitution;
                partData.kinematic = userData.kinematic;
                partData.meshes.push({
                    data: child,
                    geometry
                });
            } else {
                const name = child.userData.name;
                const partData = getPart(parts, name);
                partData.meshes.push({
                    data: child
                });
                if (child.material.userData.light) {
                    lightsMaterials[child.material.userData.index] = child.material = new MeshPhongMaterial({
                        color: LIGHTS_COLOR,
                        emissive: LIGHTS_EMISSIVE_COLOR,
                        emissiveIntensity: LIGHTS_MIN_INTENSITY
                    });
                }
            }
        } else if (child.name == INIT_POSITION) {
            initPosition.copy(child.position);
        }
    });
    return {
        parts,
        lightsMaterials,
        initPosition
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

function initializeColliders({ scene, parts, coinRoller, sensorColliders, onBonusWon, onGameLost }) {
    let indexPart = 0;
    parts.forEach((partData, name) => {
        const { meshes, friction, restitution, sensor, kinematic } = partData;
        let body;
        if (kinematic) {
            body = partData.body = scene.createKinematicBody();
            partData.position = 0;
        } else {
            body = partData.body = scene.createFixedBody();
        }
        body.setEnabled(false);
        const geometries = [];
        meshes.forEach(meshData => {
            if (meshData.geometry) {
                geometries.push(meshData.geometry);
            }
        });
        if (geometries.length > 0) {
            const { vertices, indices } = scene.mergeGeometries(geometries);
            const collider = scene.createTrimeshCollider({
                vertices,
                indices,
                friction,
                restitution,
                sensor,
                userData: {
                    objectType: name,
                    onIntersect: userData => {
                        if (coinRoller.coin && userData.objectType === coinRoller.coin.objectType && userData.index === coinRoller.coin.index) {
                            if (name === TRAP_SENSOR_NAME) {
                                onGameLost();
                            } else {
                                onBonusWon(userData, name);
                            }
                        }
                    }
                }
            }, body);
            collider.setCollisionGroups((1 << (indexPart % 16)) << 16 | (1 << (indexPart % 16)));
            indexPart++;
            if (sensor) {
                sensorColliders.set(name, collider);
            }
        }
    });
}

function initializeLights({ lightsMaterials, lights }) {
    lightsMaterials.forEach((_, indexMaterial) => {
        lights[indexMaterial] = {
            on: false,
            refreshes: -1
        };
    });
}