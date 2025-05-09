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

const RESTITUTION = 0;
const MIN_POSITION_Y_OBJECTS = 0.05;
const MODEL_PATH = "./../assets/cabinet.glb";

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
    #colliders = new Map();
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

    async initialize() {
        const mesh = await initializeModel({
            scene: this.#scene,
            sensorListeners: this.#sensorListeners,
            colliders: this.#colliders,
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
                this.#state.score += 10;
                this.#reelsBox.spinReels();
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
    }

    update(time) {
        this.#collisionsDetector.update();
        this.#scoreboard.update(time);
        this.#pusher.update(time);
        this.#controlPanel.update(time);
        Coins.update(time);
        Tokens.update();
        Cards.update();
        this.#sensorGate.update(time);
        this.#reelsBox.update(time);
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

    get interactiveObjects() {
        return this.#controlPanel.interactiveObjects;
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
        const collidersHandles = {};
        this.#colliders.forEach((collider, key) => collidersHandles[key] = collider.handle);
        return {
            collidersHandles,
            scene: await this.#scene.save(),
            coins: Coins.save(),
            tokens: Tokens.save(),
            cards: Cards.save(),
            pusher: this.#pusher.save(),
            sensorGate: this.#sensorGate.save(),
            reelsBox: this.#reelsBox.save()
        };
    }

    async load(cabinet) {
        await this.#scene.load(cabinet.scene);
        this.#mesh.traverse((child) => {
            if (child.isMesh) {
                const userData = child.material.userData;
                const objectType = child.material.name;
                if (userData.sensor) {
                    const colliderHandle = cabinet.collidersHandles[objectType];
                    const collider = this.#scene.worldColliders.get(colliderHandle);
                    collider.userData = {
                        objectType: objectType,
                        onIntersect: this.#sensorListeners[objectType]
                    };
                    this.#colliders.set(objectType, collider);
                }
            }
        });
        Coins.load(cabinet.coins);
        Tokens.load(cabinet.tokens);
        Cards.load(cabinet.cards);
        await this.#pusher.load(cabinet.pusher);
        this.#sensorGate.load(cabinet.sensorGate);
        this.#reelsBox.load(cabinet.reelsBox);
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
        if (this.#pusher.position.z > -.215 && this.#pusher.position.z < -0.213 && this.#pusher.position.z > this.lastPusherPosition) {
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

async function initializeModel({ scene, sensorListeners, colliders, DEBUG_HIDE_CABINET }) {
    const cabinetModel = await scene.loadModel(MODEL_PATH);
    const mesh = cabinetModel.scene.children[0];
    const body = scene.createFixedBody();
    mesh.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            const userData = child.material.userData;
            if (userData.collider || userData.sensor) {
                const name = child.material.name;
                const index = child.geometry.index;
                const positionAttribute = child.geometry.attributes.position;
                const vertices = [];
                const indices = [];
                for (let indexVertex = 0; indexVertex < index.count; indexVertex += 3) {
                    const vertexA = index.getX(indexVertex);
                    const vertexB = index.getX(indexVertex + 1);
                    const vertexC = index.getX(indexVertex + 2);
                    vertices.push(
                        positionAttribute.getX(vertexA),
                        positionAttribute.getY(vertexA),
                        positionAttribute.getZ(vertexA),
                        positionAttribute.getX(vertexB),
                        positionAttribute.getY(vertexB),
                        positionAttribute.getZ(vertexB),
                        positionAttribute.getX(vertexC),
                        positionAttribute.getY(vertexC),
                        positionAttribute.getZ(vertexC)
                    );
                    indices.push(indexVertex, indexVertex + 1, indexVertex + 2);
                }
                const collider = scene.createTrimeshCollider({
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
                collider.setFrictionCombineRule(1);
                if (userData.sensor) {
                    colliders.set(name, collider);
                }
            }
        }
    });
    if (!DEBUG_HIDE_CABINET) {
        scene.addObject(mesh);
    }
    return mesh;
}