import { Vector3 } from "three";

const SPEED = .001;
const SPEED_TRAP = .002;
const DISTANCE = 0.13;
const DISTANCE_TRAP = 0.25;
const START_ANGLE = -Math.PI / 2;
const MODEL_PATH = "./../assets/coin-roller.glb";
const RESTITUTION = 0.5;
const LAUNCHER_PART_NAME = "launcher";
const TRAP_PART_NAME = "trap";
const TRAP_SENSOR_NAME = "trap-sensor";
const INIT_POSITION = "init-position";
const BONUS_VALUES = ["slot-3", "slot-2", "slot-1"];
const COIN_IMPULSE_STRENGTH = 0.00003;
const COIN_IMPULSE = new Vector3(0, 0, -1).multiplyScalar(COIN_IMPULSE_STRENGTH);
const MAX_DELAY_MOVING_COIN = 2000;
const MIN_LAUNCHER_POSITION = 0.0001;
const INITIALIZATION_COIN_POSITION = 0.14;
const COIN_ROTATION = new Vector3(Math.PI / 2, 0, Math.PI / 2);
const MIN_TRAP_POSITION = 0.0001;
const MAX_TRAP_POSITION = 0.25 - MIN_TRAP_POSITION;

const COIN_ROLLER_STATES = {
    IDLE: Symbol.for("coin-roller-idle"),
    ACTIVATING: Symbol.for("coin-roller-activating"),
    INITIALIZING: Symbol.for("coin-roller-initializing"),
    INITIALIZING_COIN: Symbol.for("coin-roller-initializing-coin"),
    MOVING_LAUNCHER: Symbol.for("coin-roller-moving-launcher"),
    TRIGGERING_COIN: Symbol.for("coin-roller-triggering-coin"),
    DELIVERING_COIN: Symbol.for("coin-roller-delivering-coin"),
    MOVING_COIN: Symbol.for("coin-roller-moving-coin"),
    OPENING_TRAP: Symbol.for("coin-roller-opening-trap"),
    CLOSING_TRAP: Symbol.for("coin-roller-closing-trap"),
    PREPARING_TO_IDLE: Symbol.for("coin-roller-preparing-to-idle")
};

export default class {

    #scene;
    #onInitializeCoin;
    #onBonusWon;
    #onCoinLost;
    #onGetCoin;
    #initPosition;
    #sensorColliders = new Map();
    #coinRoller = {
        state: COIN_ROLLER_STATES.IDLE,
        pendingShots: 0,
        timeActive: -1,
        timeMovingCoin: -1,
        timeOpeningTrap: -1
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
        const { parts, initPosition } = await initializeModel({
            scene,
            sensorColliders: this.#sensorColliders
        });
        this.#initPosition = initPosition;
        initializeColliders({
            scene,
            parts,
            sensorColliders: this.#sensorColliders,
            onBonusWon: this.#onBonusWon,
            onCoinLost: this.#onCoinLost
        });
        parts.forEach(({ body, meshes }) => {
            meshes.forEach(({ data }) => this.#scene.addObject(data));
            body.setEnabled(true);
        });
        Object.assign(this.#coinRoller, { parts });
        this.#coinRoller.launcher = this.#coinRoller.parts.get(LAUNCHER_PART_NAME);
        this.#coinRoller.launcher.body.setEnabledRotations(false, false, false);
        this.#coinRoller.launcher.body.setEnabledTranslations(false, false, false);
        this.#coinRoller.trap = this.#coinRoller.parts.get(TRAP_PART_NAME);
    }

    update(time) {
        updateCoinRollerState({
            coinRoller: this.#coinRoller,
            time
        });
        const { parts, state, launcher, trap, coin } = this.#coinRoller;
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
            timeActive: this.#coinRoller.timeActive,
            timeMovingCoin: this.#coinRoller.timeMovingCoin,
            timeOpeningTrap: this.#coinRoller.timeOpeningTrap,
            pendingShots: this.#coinRoller.pendingShots
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
        if (coinRoller.coin) {
            this.#coinRoller.coin = this.#onGetCoin(coinRoller.coin);
        }
    }
}

function updateCoinRollerState({ coinRoller, time }) {
    switch (coinRoller.state) {
        case COIN_ROLLER_STATES.IDLE:
            break;
        case COIN_ROLLER_STATES.ACTIVATING:
            coinRoller.state = COIN_ROLLER_STATES.INITIALIZING;
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
                coinRoller.state = COIN_ROLLER_STATES.PREPARING_TO_IDLE;
            }
            break;
        case COIN_ROLLER_STATES.OPENING_TRAP:
            updateLauncherPosition({ coinRoller, time });
            updateTrapPosition({ coinRoller, time });
            if (coinRoller.trap.position > MAX_TRAP_POSITION) {
                coinRoller.state = COIN_ROLLER_STATES.CLOSING_TRAP;
            }
            break;
        case COIN_ROLLER_STATES.CLOSING_TRAP:
            updateLauncherPosition({ coinRoller, time });
            updateTrapPosition({ coinRoller, time });
            if (coinRoller.trap.position < MIN_TRAP_POSITION) {
                coinRoller.trap.position = 0;
                coinRoller.state = COIN_ROLLER_STATES.PREPARING_TO_IDLE;
                coinRoller.timeOpeningTrap = -1;
            }
            break;
        case COIN_ROLLER_STATES.PREPARING_TO_IDLE:
            updateLauncherPosition({ coinRoller, time });
            if (coinRoller.launcher.position < MIN_LAUNCHER_POSITION) {
                coinRoller.launcher.position = 0;
                coinRoller.timeMovingCoin = -1;
                coinRoller.timeActive = -1;
                if (coinRoller.pendingShots) {
                    coinRoller.pendingShots--;
                    coinRoller.state = COIN_ROLLER_STATES.ACTIVATING;
                } else {
                    coinRoller.state = COIN_ROLLER_STATES.IDLE;
                }
            }
        default:
            break;
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
    const initPosition = new Vector3();
    mesh.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            const { material, geometry } = child;
            const userData = material.userData;
            if (userData.collider || userData.sensor) {
                const name = userData.name;
                const index = geometry.index;
                const position = geometry.attributes.position;
                const vertices = [];
                const indices = [];
                for (let indexVertex = 0; indexVertex < index.count; indexVertex += 3) {
                    const vertexA = index.getX(indexVertex);
                    const vertexB = index.getX(indexVertex + 1);
                    const vertexC = index.getX(indexVertex + 2);
                    vertices.push(
                        position.getX(vertexA), position.getY(vertexA), position.getZ(vertexA),
                        position.getX(vertexB), position.getY(vertexB), position.getZ(vertexB),
                        position.getX(vertexC), position.getY(vertexC), position.getZ(vertexC)
                    );
                    indices.push(indexVertex, indexVertex + 1, indexVertex + 2);
                }
                const partData = getPart(parts, name);
                partData.sensor = userData.sensor;
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
            }
        } else if (child.name == INIT_POSITION) {
            initPosition.copy(child.position);
        }
    });
    return {
        parts,
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
    parts.forEach((partData, name) => {
        const { meshes, friction, sensor } = partData;
        let body;
        if (name === LAUNCHER_PART_NAME || name === TRAP_PART_NAME) {
            body = partData.body = scene.createKinematicBody();
            partData.position = 0;
        } else {
            body = partData.body = scene.createFixedBody();
        }
        body.setEnabled(false);
        meshes.forEach(meshData => {
            const { vertices, indices } = meshData;
            if (vertices && indices) {
                meshData.collider = scene.createTrimeshCollider({
                    vertices,
                    indices,
                    friction,
                    restitution: RESTITUTION,
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
                body.setSoftCcdPrediction(.01);
                if (sensor) {
                    sensorColliders.set(name, meshData.collider);
                }
            }
        });
    });
}