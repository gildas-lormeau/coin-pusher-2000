import { Vector3, MeshPhongMaterial } from "three";

const SPEED = .001;
const SPEED_TRAP = .002;
const SPEED_DOORS = .003;
const DISTANCE = 0.13;
const DISTANCE_TRAP = 0.25;
const START_ANGLE = -Math.PI / 2;
const MODEL_PATH = "./../assets/coin-roller.glb";
const LAUNCHER_PART_NAME = "launcher";
const TRAP_DOOR_PART_NAME = "trap-door";
const DOORS_PART_NAME = "doors";
const TRAP_SENSOR_NAME = "trap";
const INIT_POSITION = "init-position";
const BONUS_VALUES = ["slot-3", "slot-2", "slot-1"];
const COIN_IMPULSE_STRENGTH = 0.00003;
const COIN_IMPULSE = new Vector3(0, 0, -1).multiplyScalar(COIN_IMPULSE_STRENGTH);
const MAX_DELAY_MOVING_COIN = 1500;
const MIN_LAUNCHER_POSITION = 0.0001;
const INITIALIZATION_COIN_POSITION = 0.14;
const COIN_ROTATION = new Vector3(Math.PI / 2, 0, Math.PI / 2);
const MIN_TRAP_POSITION = 0.0001;
const MAX_TRAP_POSITION = 0.25 - MIN_TRAP_POSITION;
const MIN_DOORS_POSITION = 0;
const MAX_DOORS_POSITION = 0.03;
const LIGHTS_COLOR = 0xFFFFFF;
const LIGHTS_EMISSIVE_COLOR = 0xFF00FF;
const LIGHTS_MIN_INTENSITY = 0;
const LIGHTS_MAX_INTENSITY = 1;
const LIGHTS_REMANENCE_DURATION = 500;
const LIGHTS_HEAD_SIZE = 8;
const LIGHTS_SPEED_DELAY = 50;
const CABINET_COLLISION_GROUP = 0x00010001;

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
    CLOSING_DOORS: Symbol.for("coin-roller-closing-doors"),
    PREPARING_IDLE: Symbol.for("coin-roller-preparing-idle")
};

export default class {

    #scene;
    #onInitializeCoin;
    #onBonusWon;
    #onCoinLost;
    #onGetCoin;
    #initPosition;
    #sensorColliders = new Map();
    #lightsMaterials = [];
    #coinRoller = {
        state: COIN_ROLLER_STATES.IDLE,
        pendingShots: 0,
        timeActive: -1,
        timeMovingCoin: -1,
        timeOpeningTrap: -1,
        lights: [],
        lightsHeadIndex: -1,
        lightsDirection: 1,
        timeLightsRefresh: -1
    };

    constructor({ scene, onInitializeCoin, onRecycleCoin, onBonusWon, onGetCoin }) {
        this.#scene = scene;
        this.#onInitializeCoin = onInitializeCoin;
        this.#onBonusWon = (userData, slotName) => {
            const { state, coin } = this.#coinRoller;
            if (coin && userData.objectType === coin.objectType && userData.index === coin.index && state === COIN_ROLLER_STATES.MOVING_COIN) {
                const value = BONUS_VALUES.indexOf(slotName);
                onRecycleCoin(coin);
                this.#coinRoller.coin = null;
                onBonusWon(value);
            }
        };
        this.#onCoinLost = () => {
            onRecycleCoin(this.#coinRoller.coin);
            this.#coinRoller.coin = null;
        };
        this.#onGetCoin = onGetCoin;
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
            sensorColliders: this.#sensorColliders,
            onBonusWon: this.#onBonusWon,
            onCoinLost: this.#onCoinLost
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

    update(time) {
        updateCoinRollerState({
            coinRoller: this.#coinRoller,
            time
        });
        updateLightsState({
            coinRoller: this.#coinRoller,
            time
        });
        const { parts, state, launcher, trap, coin, doors, lights } = this.#coinRoller;
        if (state !== COIN_ROLLER_STATES.IDLE) {
            parts.forEach(({ meshes, body }) => {
                meshes.forEach(({ data }) => {
                    data.position.copy(body.translation());
                    data.quaternion.copy(body.rotation());
                });
            });
            const launcherPosition = launcher.body.translation();
            launcherPosition.x = launcher.position;
            launcher.body.setNextKinematicTranslation(launcherPosition);
            const trapPosition = trap.body.translation();
            trapPosition.z = trap.position;
            trap.body.setNextKinematicTranslation(trapPosition);
            const doorsPosition = doors.body.translation();
            doorsPosition.x = doors.position;
            doors.body.setNextKinematicTranslation(doorsPosition);
            if (state === COIN_ROLLER_STATES.INITIALIZING) {
                this.#coinRoller.coin = this.#onInitializeCoin({ position: this.#initPosition, rotation: COIN_ROTATION });
            }
            if (state === COIN_ROLLER_STATES.MOVING_LAUNCHER) {
                coin.body.setEnabledRotations(false, false, false);
                coin.body.setNextKinematicTranslation(launcherPosition);
            }
            if (state === COIN_ROLLER_STATES.DELIVERING_COIN) {
                coin.body.setEnabledRotations(true, true, true);
                coin.body.applyImpulse(COIN_IMPULSE);
            }
            lights.forEach((light, index) => {
                const material = this.#lightsMaterials[index];
                if (light.on) {
                    material.emissiveIntensity = light.intensity;
                } else {
                    material.emissiveIntensity = 0;
                }
            });
        }
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
        let coin;
        if (this.#coinRoller.coin) {
            coin = {
                index: this.#coinRoller.coin.index
            };
        }
        return {
            state: this.#coinRoller.state.description,
            sensorCollidersHandles,
            coin,
            launcher: {
                bodyHandle: this.#coinRoller.launcher.body.handle,
                position: this.#coinRoller.launcher.position
            },
            trap: {
                bodyHandle: this.#coinRoller.trap.body.handle,
                position: this.#coinRoller.trap.position
            },
            doors: {
                bodyHandle: this.#coinRoller.doors.body.handle,
                position: this.#coinRoller.doors.position
            },
            timeActive: this.#coinRoller.timeActive,
            timeMovingCoin: this.#coinRoller.timeMovingCoin,
            timeOpeningTrap: this.#coinRoller.timeOpeningTrap,
            pendingShots: this.#coinRoller.pendingShots,
            lights: this.#coinRoller.lights.map(light => ({
                on: light.on,
                intensity: light.intensity,
                lastVisited: light.lastVisited
            })),
            lightsHeadIndex: this.#coinRoller.lightsHeadIndex,
            lightsDirection: this.#coinRoller.lightsDirection,
            timeLightsRefresh: this.#coinRoller.timeLightsRefresh
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
                                    if (name === TRAP_SENSOR_NAME) {
                                        this.#onCoinLost();
                                    } else {
                                        this.#onBonusWon(userData, objectType);
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
        this.#coinRoller.timeActive = coinRoller.timeActive;
        this.#coinRoller.timeMovingCoin = coinRoller.timeMovingCoin;
        this.#coinRoller.timeOpeningTrap = coinRoller.timeOpeningTrap;
        this.#coinRoller.pendingShots = coinRoller.pendingShots;
        this.#coinRoller.launcher.body = this.#scene.worldBodies.get(coinRoller.launcher.bodyHandle);
        this.#coinRoller.launcher.position = coinRoller.launcher.position;
        this.#coinRoller.trap.body = this.#scene.worldBodies.get(coinRoller.trap.bodyHandle);
        this.#coinRoller.trap.position = coinRoller.trap.position;
        this.#coinRoller.doors.body = this.#scene.worldBodies.get(coinRoller.doors.bodyHandle);
        this.#coinRoller.doors.position = coinRoller.doors.position;
        if (coinRoller.coin) {
            this.#coinRoller.coin = this.#onGetCoin(coinRoller.coin);
        }
        this.#coinRoller.lights = coinRoller.lights.map(light => ({
            on: light.on,
            intensity: light.intensity,
            lastVisited: light.lastVisited
        }));
        this.#coinRoller.lightsHeadIndex = coinRoller.lightsHeadIndex;
        this.#coinRoller.lightsDirection = coinRoller.lightsDirection;
        this.#coinRoller.timeLightsRefresh = coinRoller.timeLightsRefresh;
    }
}

function updateCoinRollerState({ coinRoller, time }) {
    switch (coinRoller.state) {
        case COIN_ROLLER_STATES.IDLE:
            break;
        case COIN_ROLLER_STATES.ACTIVATING:
            coinRoller.timeLightsRefresh = time;
            coinRoller.lightsHeadIndex = 0;
            coinRoller.state = COIN_ROLLER_STATES.OPENING_DOORS;
            break;
        case COIN_ROLLER_STATES.OPENING_DOORS:
            coinRoller.doors.position += SPEED_DOORS;
            if (coinRoller.doors.position > MAX_DOORS_POSITION) {
                coinRoller.state = COIN_ROLLER_STATES.INITIALIZING;
            }
            break;
        case COIN_ROLLER_STATES.INITIALIZING:
            coinRoller.state = COIN_ROLLER_STATES.INITIALIZING_COIN;
            break;
        case COIN_ROLLER_STATES.INITIALIZING_COIN:
            if (coinRoller.coin.position.z < INITIALIZATION_COIN_POSITION) {
                coinRoller.timeActive = time;
                coinRoller.state = COIN_ROLLER_STATES.MOVING_LAUNCHER;
            }
            break;
        case COIN_ROLLER_STATES.MOVING_LAUNCHER:
            updateLauncherPosition({ coinRoller, time });
            break;
        case COIN_ROLLER_STATES.TRIGGERING_COIN:
            updateLauncherPosition({ coinRoller, time });
            coinRoller.state = COIN_ROLLER_STATES.DELIVERING_COIN;
            coinRoller.timeMovingCoin = time;
            break;
        case COIN_ROLLER_STATES.DELIVERING_COIN:
            updateLauncherPosition({ coinRoller, time });
            coinRoller.state = COIN_ROLLER_STATES.MOVING_COIN;
            break;
        case COIN_ROLLER_STATES.MOVING_COIN:
            updateLauncherPosition({ coinRoller, time });
            if (time - coinRoller.timeMovingCoin > MAX_DELAY_MOVING_COIN) {
                coinRoller.state = COIN_ROLLER_STATES.OPENING_TRAP;
                coinRoller.timeOpeningTrap = time;
            } else if (!coinRoller.coin) {
                coinRoller.state = COIN_ROLLER_STATES.MOVING_LAUNCHER_TO_BASE;
            }
            break;
        case COIN_ROLLER_STATES.OPENING_TRAP:
            if (coinRoller.launcher.position >= MIN_LAUNCHER_POSITION) {
                updateLauncherPosition({ coinRoller, time });
            }
            updateTrapPosition({ coinRoller, time });
            if (coinRoller.trap.position > MAX_TRAP_POSITION) {
                coinRoller.state = COIN_ROLLER_STATES.CLOSING_TRAP;
            }
            break;
        case COIN_ROLLER_STATES.CLOSING_TRAP:
            if (coinRoller.launcher.position >= MIN_LAUNCHER_POSITION) {
                updateLauncherPosition({ coinRoller, time });
            }
            updateTrapPosition({ coinRoller, time });
            if (coinRoller.trap.position < MIN_TRAP_POSITION) {
                coinRoller.trap.position = 0;
                coinRoller.state = COIN_ROLLER_STATES.MOVING_LAUNCHER_TO_BASE;
                coinRoller.timeOpeningTrap = -1;
            }
            break;
        case COIN_ROLLER_STATES.MOVING_LAUNCHER_TO_BASE:
            if (coinRoller.launcher.position >= MIN_LAUNCHER_POSITION) {
                updateLauncherPosition({ coinRoller, time });
            } else {
                coinRoller.launcher.position = 0;
                coinRoller.timeMovingCoin = -1;
                coinRoller.timeActive = -1;
                if (coinRoller.pendingShots) {
                    coinRoller.pendingShots--;
                    coinRoller.state = COIN_ROLLER_STATES.ACTIVATING;
                } else {
                    coinRoller.state = COIN_ROLLER_STATES.CLOSING_DOORS;
                }
            }
            break;
        case COIN_ROLLER_STATES.CLOSING_DOORS:
            coinRoller.doors.position -= SPEED_DOORS;
            if (coinRoller.doors.position < MIN_DOORS_POSITION) {
                coinRoller.doors.position = 0;
                coinRoller.timeLightsRefresh = -1;
                coinRoller.lightsHeadIndex = -1;
                coinRoller.lightsDirection = 1;
                coinRoller.state = COIN_ROLLER_STATES.PREPARING_IDLE;
            }
            break;
        case COIN_ROLLER_STATES.PREPARING_IDLE:
            coinRoller.state = COIN_ROLLER_STATES.IDLE;
            break;
        default:
            break;
    }
}
function updateLightsState({ coinRoller, time }) {
    const { lights, lightsHeadIndex, lightsDirection } = coinRoller;
    const lightsCount = lights.length;
    const headSize = LIGHTS_HEAD_SIZE;
    const remanenceDuration = LIGHTS_REMANENCE_DURATION;
    if (coinRoller.state === COIN_ROLLER_STATES.IDLE || coinRoller.state === COIN_ROLLER_STATES.CLOSING_DOORS) {
        lights.forEach(light => {
            light.on = false;
            light.intensity = 0;
            light.lastVisited = -1;
        });
    } else if (coinRoller.timeLightsRefresh !== -1) {
        const elapsedTime = time - coinRoller.timeLightsRefresh;
        if (elapsedTime > LIGHTS_SPEED_DELAY) {
            coinRoller.timeLightsRefresh = time;
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
                light.intensity = LIGHTS_MAX_INTENSITY;
                light.lastVisited = time;
            } else if (light.lastVisited > -1 && time - light.lastVisited < remanenceDuration) {
                const elapsedTime = time - light.lastVisited;
                light.intensity = Math.max(LIGHTS_MIN_INTENSITY, LIGHTS_MAX_INTENSITY * (1 - elapsedTime / remanenceDuration));
            } else {
                light.on = false;
                light.intensity = 0;
            }
        });
    }
}

function updateLauncherPosition({ coinRoller, time }) {
    coinRoller.launcher.position = Math.sin((time - coinRoller.timeActive) * SPEED + START_ANGLE) * DISTANCE + DISTANCE;
}

function updateTrapPosition({ coinRoller, time }) {
    coinRoller.trap.position = Math.sin((time - coinRoller.timeOpeningTrap) * SPEED_TRAP) * DISTANCE_TRAP;
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
                const index = geometry.index;
                const position = geometry.attributes.position;
                const vertices = [];
                const indices = [];
                for (let indexVertex = 0; indexVertex < index.count; indexVertex++) {
                    vertices.push(position.getX(indexVertex), position.getY(indexVertex), position.getZ(indexVertex));
                    indices.push(index.getX(indexVertex));
                }
                const partData = getPart(parts, name);
                partData.sensor = userData.sensor;
                partData.friction = userData.friction;
                partData.restitution = userData.restitution;
                partData.kinematic = userData.kinematic;
                partData.meshes.push({
                    data: child,
                    vertices,
                    indices
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

function initializeColliders({ scene, parts, sensorColliders, onBonusWon, onCoinLost }) {
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
        const vertices = [];
        const indices = [];
        let offsetIndex = 0;
        meshes.forEach(meshData => {
            if (meshData.vertices) {
                vertices.push(...meshData.vertices);
                indices.push(...meshData.indices.map(index => index + offsetIndex));
                offsetIndex += meshData.indices.length;
            }
        });
        if (vertices.length > 0) {
            const collider = scene.createTrimeshCollider({
                vertices,
                indices,
                friction,
                restitution,
                sensor,
                userData: {
                    objectType: name,
                    onIntersect: userData => {
                        if (name === TRAP_SENSOR_NAME) {
                            onCoinLost();
                        } else {
                            onBonusWon(userData, name);
                        }
                    }
                }
            }, body);
            if (kinematic) {
                collider.setCollisionGroups((1 << (indexPart % 16)) << 16 | (1 << (indexPart % 16)));
                indexPart++;
            } else {
                collider.setCollisionGroups(CABINET_COLLISION_GROUP);
            }
            body.setSoftCcdPrediction(.01);
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
            intensity: 0,
            lastVisited: -1
        };
    });
}