import Wall from "./wall.js";
import ControlPanel from "./control-panel.js";
import Pusher from "./pusher.js";
import InstancedMeshes from "./instanced-meshes/index.js";
import Coins from "./instanced-meshes/coins.js";
import Tokens from "./instanced-meshes/tokens.js";
import Cards from "./instanced-meshes/cards.js";
import CollisionsDetector from "./collisions-detector.js";
import ScoreBoard from "./scoreboard.js";
import SensorGate from "./sensor-gate.js";
import ReelsBox from "./reels-box.js";
import Excavator from "./excavator.js";
import Tower from "./tower.js";
import CoinRoller from "./coin-roller.js";
import Screen from "./screen.js";

const RESTITUTION = 0;
const MIN_POSITION_Y_OBJECTS = -1;
const MODEL_PATH = "./../assets/cabinet.glb";
const SENSOR_HEIGHT = 0.1;

export default class {

    DEBUG_AUTOPLAY = false;
    DEBUG_HIDE_CABINET = false;

    constructor({ scene, state }) {
        this.#scene = scene;
        this.#state = state;
    }

    #scene;
    #state;
    #mesh;
    #sensorColliders = new Map();
    #sensorListeners = {
        "left-trap-sensor": (userData) => {
            const object = this.#getObject(userData);
            if (object) {
                recycleObject(object);
            }
        },
        "right-trap-sensor": (userData) => {
            const object = this.#getObject(userData);
            if (object) {
                recycleObject(object);
            }
        },
        "gutter-sensor": (userData) => {
            const object = this.#getObject(userData);
            if (object) {
                recycleObject(object);
                if (object.objectType === Coins.TYPE) {
                    this.#state.score++;
                    this.#state.coinsInPool++;
                }
                if (object.objectType === Tokens.TYPE) {
                    this.#state.score += 5;
                }
                if (object.objectType === Cards.TYPE) {
                    this.#state.score += 10;
                }
            }
        }
    };
    #controlPanel;
    #pusher;
    #scoreboard;
    #sensorGate;
    #collisionsDetector;
    #reelsBox;
    #excavator;
    #tower;
    #coinRoller;
    #screen;

    async initialize() {
        const mesh = await initializeModel({
            scene: this.#scene,
            sensorListeners: this.#sensorListeners,
            sensorColliders: this.#sensorColliders,
            DEBUG_HIDE_CABINET: this.DEBUG_HIDE_CABINET
        });
        this.#mesh = mesh;
        await InstancedMeshes.initialize({ scene: this.#scene });
        const wall = new Wall({ scene: this.#scene });
        wall.initialize();
        this.#controlPanel = new ControlPanel({
            onPressDropButton: slot => {
                if (this.#state.coinsInPool) {
                    Coins.dropCoin({ slot });
                    this.#state.coinsInPool--;
                }
            },
            onPressActionButton: () => {
                this.#coinRoller.triggerCoin();
            },
            onPressBonusButton: () => {
                Coins.dropCoins({ count: 50 });
            }
        });
        await this.#controlPanel.initialize();
        this.#pusher = new Pusher({
            scene: this.#scene,
            depositBonus: ({ reward, position }) => {
                Coins.depositCoins({ position, count: reward.coinCount });
                Tokens.depositTokens({ position, count: reward.tokenCount });
                Cards.depositCards({ position, count: reward.cardCount });
            }
        });
        this.#pusher.initialize();
        this.#scoreboard = new ScoreBoard({ scene: this.#scene, cabinet: this, state: this.#state });
        await this.#scoreboard.initialize();
        this.#collisionsDetector = new CollisionsDetector({ scene: this.#scene });
        this.#collisionsDetector.initialize();
        this.#sensorGate = new SensorGate({
            scene: this.#scene,
            onBonusWon: () => {
                const random = Math.random();
                if (random < .25) {
                    this.#state.score += 10;
                    this.#reelsBox.spinReels();
                } else if (random < .5) {
                    this.#excavator.pick();
                } else if (random < .75) {
                    this.#coinRoller.shootCoin();
                } else {
                    this.#tower.shootCoins();
                }
            }
        });
        await this.#sensorGate.initialize();
        this.#reelsBox = new ReelsBox({
            scene: this.#scene,
            onBonusWon: (reels) => {
                this.#pusher.deliverBonus({ coinCount: 10, cardCount: 1, tokenCount: 2 });
            }
        });
        await this.#reelsBox.initialize();
        this.#excavator = new Excavator({
            scene: this.#scene,
            onPick: dropPosition => {
                const objects = [];
                for (let i = 0; i < 30 + Math.floor(Math.random() * 10); i++) {
                    const rotation = {
                        x: (Math.random() - 0.5) * Math.PI / 4,
                        y: (Math.random() - 0.5) * Math.PI / 4,
                        z: (Math.random() - 0.5) * Math.PI / 4
                    };
                    const position = {
                        x: dropPosition.x + (Math.random() - 0.5) * 0.02,
                        y: dropPosition.y,
                        z: dropPosition.z + (Math.random() - 0.5) * 0.02
                    };
                    objects.push(Coins.depositCoin({
                        position,
                        rotation
                    }));
                }
                if (Math.random() < .25) {
                    objects.push(Tokens.depositToken({
                        position: {
                            x: dropPosition.x + (Math.random() - 0.5) * 0.02,
                            y: dropPosition.y,
                            z: dropPosition.z + (Math.random() - 0.5) * 0.02
                        },
                        rotation: {
                            x: (Math.random() - 0.5) * Math.PI / 4,
                            y: (Math.random() - 0.5) * Math.PI / 4,
                            z: (Math.random() - 0.5) * Math.PI / 4
                        }
                    }));
                }
                return objects;
            },
            onGetObject: userData => {
                return this.#getObject(userData);
            },
            onRecycleObject: userData => {
                const object = this.#getObject(userData);
                if (object) {
                    recycleObject(object);
                }
            }
        });
        await this.#excavator.initialize();
        this.#tower = new Tower({
            scene: this.#scene,
            onShootCoin: ({ position, impulse }) => {
                Coins.depositCoin({ position, impulse });
            }
        });
        await this.#tower.initialize();
        this.#coinRoller = new CoinRoller({
            scene: this.#scene,
            onInitializeCoin: ({ position, rotation }) => Coins.depositCoin({ position, rotation }),
            onGetCoin: coinData => Coins.getCoin(coinData),
            onRecycleCoin: coin => Coins.recycle(coin),
            onBonusWon(bonus) {
                Coins.dropCoins({ count: Math.pow(bonus + 1, 2) * 5 });
            }
        });
        await this.#coinRoller.initialize();
        this.#screen = new Screen({ scene: this.#scene });
        await this.#screen.initialize();
    }

    update(time) {
        this.#pusher.update(time);
        InstancedMeshes.update(time);
        this.#collisionsDetector.update();
        this.#scoreboard.update(time);
        this.#controlPanel.update(time);
        this.#sensorGate.update(time);
        this.#reelsBox.update(time);
        this.#excavator.update(time);
        this.#tower.update(time);
        this.#coinRoller.update(time);
        this.#screen.update();
        this.dynamicBodies.forEach(({ object, objects }) => {
            if (object.position.y < MIN_POSITION_Y_OBJECTS) {
                console.warn("object recycled", object, structuredClone(object.position), structuredClone(object.rotation));
                objects.recycle(object);
            }
        });
        if (this.DEBUG_AUTOPLAY) {
            this.#autoplay();
        }
    }

    resize(width, height) {
        this.#screen.resize(width, height);
    }

    get interactiveObjects() {
        return this.#controlPanel.interactiveObjects;
    }

    get joints() {
        return this.#excavator.joints;
    }

    get coinCount() {
        return Coins.coinCount;
    }

    get dynamicBodies() {
        return [
            ...Coins.dynamicBodies,
            ...Tokens.dynamicBodies,
            ...Cards.dynamicBodies
        ];
    }

    async save() {
        const sensorCollidersHandles = {};
        this.#sensorColliders.forEach((collider, key) => sensorCollidersHandles[key] = collider.handle);
        return {
            sensorCollidersHandles,
            scene: await this.#scene.save(),
            coins: Coins.save(),
            tokens: Tokens.save(),
            cards: Cards.save(),
            pusher: this.#pusher.save(),
            sensorGate: this.#sensorGate.save(),
            reelsBox: this.#reelsBox.save(),
            excavator: this.#excavator.save(),
            tower: this.#tower.save(),
            coinRoller: this.#coinRoller.save()
        };
    }

    async load(cabinet) {
        await this.#scene.load(cabinet.scene);
        this.#mesh.traverse((child) => {
            if (child.isMesh) {
                const userData = child.material.userData;
                const objectType = child.material.name;
                if (userData.sensor) {
                    const colliderHandle = cabinet.sensorCollidersHandles[objectType];
                    const collider = this.#scene.worldColliders.get(colliderHandle);
                    collider.userData = {
                        objectType: objectType,
                        onIntersect: this.#sensorListeners[objectType]
                    };
                    this.#sensorColliders.set(objectType, collider);
                }
            }
        });
        Coins.load(cabinet.coins);
        Tokens.load(cabinet.tokens);
        Cards.load(cabinet.cards);
        await this.#pusher.load(cabinet.pusher);
        this.#sensorGate.load(cabinet.sensorGate);
        this.#reelsBox.load(cabinet.reelsBox);
        this.#excavator.load(cabinet.excavator);
        this.#tower.load(cabinet.tower);
        this.#coinRoller.load(cabinet.coinRoller);
    }

    #getObject(userData) {
        if (userData.objectType === Coins.TYPE) {
            return Coins.getCoin(userData);
        } else if (userData.objectType === Tokens.TYPE) {
            return Tokens.getToken(userData);
        } else if (userData.objectType === Cards.TYPE) {
            return Cards.getCard(userData);
        }
    }

    #autoplay() {
        if (this.#pusher.position.z > -.275 && this.#pusher.position.z < -0.272 && this.#pusher.position.z > this.lastPusherPosition) {
            Coins.dropCoins({ count: 2 });
        }
        this.lastPusherPosition = this.#pusher.position.z;
    }
}

function recycleObject(object) {
    if (object.objectType === Coins.TYPE) {
        Coins.recycle(object);
    }
    if (object.objectType === Tokens.TYPE) {
        Tokens.recycle(object);
    }
    if (object.objectType === Cards.TYPE) {
        Cards.recycle(object);
    }
}

async function initializeModel({ scene, sensorListeners, sensorColliders, DEBUG_HIDE_CABINET }) {
    const cabinetModel = await scene.loadModel(MODEL_PATH);
    const mesh = cabinetModel.scene;
    const body = scene.createFixedBody();
    mesh.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            const userData = child.material.userData;
            if (userData.collider || userData.sensor) {
                const name = child.material.name;
                const index = child.geometry.index;
                let collider;
                if (userData.sensor) {
                    child.geometry.computeBoundingBox();
                    const bbox = child.geometry.boundingBox;
                    const worldMatrix = child.matrixWorld;
                    worldMatrix.decompose(child.position, child.quaternion, child.scale);
                    const width = bbox.max.x - bbox.min.x;
                    const height = SENSOR_HEIGHT;
                    const depth = bbox.max.z - bbox.min.z;
                    const minX = bbox.min.x;
                    const minZ = bbox.min.z;
                    collider = scene.createCuboidCollider({
                        width: width,
                        height: height,
                        depth: depth,
                        sensor: true,
                        position: [minX + width / 2, bbox.min.y - height / 2, minZ + depth / 2],
                        userData: {
                            objectType: name,
                            onIntersect: sensorListeners[name]
                        }
                    }, body);
                } else {
                    const position = child.geometry.attributes.position;
                    const vertices = [];
                    const indices = [];
                    for (let indexVertex = 0; indexVertex < index.count; indexVertex++) {
                        vertices.push(position.getX(indexVertex), position.getY(indexVertex), position.getZ(indexVertex));
                        indices.push(index.getX(indexVertex));
                    }
                    collider = scene.createTrimeshCollider({
                        vertices: new Float32Array(vertices),
                        indices: new Uint16Array(indices),
                        friction: userData.friction,
                        restitution: RESTITUTION,
                        sensor: userData.sensor,
                        userData: userData.sensor ? {
                            objectType: name,
                            onIntersect: sensorListeners[name]
                        } : undefined
                    }, body);
                }
                collider.setFrictionCombineRule(1);
                if (userData.sensor) {
                    sensorColliders.set(name, collider);
                }
            }
        }
    });
    if (!DEBUG_HIDE_CABINET) {
        scene.addObject(mesh);
    }
    return mesh;
}