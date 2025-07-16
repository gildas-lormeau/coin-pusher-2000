import Wall from "./wall.js";
import ControlPanel from "./control-panel.js";
import Pusher from "./pusher.js";
import Coins from "./instanced-meshes/coins.js";
import Tokens from "./instanced-meshes/tokens.js";
import Cards from "./instanced-meshes/cards.js";
import Ingots from "./instanced-meshes/ingots.js";
import Buttons from "./instanced-meshes/buttons.js";
import Digits from "./instanced-meshes/digits.js";
import CollisionsDetector from "./collisions-detector.js";
import ScoreBoard from "./scoreboard.js";
import SensorGate from "./sensor-gate.js";
import ReelsBox from "./reels-box.js";
import Excavator from "./excavator.js";
import Tower from "./tower.js";
import CoinRoller from "./coin-roller.js";
import Stacker from "./stacker.js";
import MiniStacker from "./mini-stacker.js";
import Sweepers from "./sweepers.js";
import Screen from "./screen.js";
import CardReader from "./card-reader.js";
import TokenSlot from "./token-slot.js";
import Runs from "./runs.js";

const MIN_POSITION_Y_OBJECTS = -1;
const MODEL_PATH = "./assets/cabinet.glb";
const SENSOR_HEIGHT = 0.2;
const CABINET_COLLISION_GROUP = 0x10001000;

export default class {

    DEBUG_AUTOPLAY = false;
    DEBUG_HIDE_CABINET = false;

    constructor({ scene }) {
        this.#scene = scene;
    }

    #scene;
    #cabinet = {
        state: {
            score: 0,
            points: 0,
            coins: 0
        }
    };
    #sensorColliders;
    #sensorListeners = {
        "left-trap": userData => this.recycleObject(userData),
        "right-trap": userData => this.recycleObject(userData),
        "gutter": (userData) => {
            this.recycleObject(userData);
            if (this.#runs.started) {
                if (userData.objectType === Coins.TYPE) {
                    this.#cabinet.state.score++;
                    this.#cabinet.state.points++;
                    this.#cabinet.state.coins++;
                }
                if (userData.objectType === Tokens.TYPE) {
                    this.#tokenSlot.readToken(this.getToken(userData));
                }
                if (userData.objectType === Cards.TYPE) {
                    this.#cardReader.readCard(this.getCard(userData));
                }
            }
        }
    };
    #floorAccessRules = new Map();
    #controlPanel;
    #pusher;
    #scoreboard;
    #sensorGate;
    #collisionsDetector;
    #reelsBox;
    #excavator;
    #leftTower;
    #rightTower;
    #coinRoller;
    #stacker;
    #leftStacker;
    #rightStacker;
    #sweepers;
    #screen;
    #cardReader;
    #tokenSlot;
    #runs;
    #parts;

    async initialize() {
        const scene = this.#scene;
        const { parts } = await initializeModel({
            scene,
            DEBUG_HIDE_CABINET: this.DEBUG_HIDE_CABINET
        });
        this.#parts = parts;
        const { sensorColliders } = initializeColliders({
            scene,
            sensorListeners: this.#sensorListeners,
            parts
        });
        this.#sensorColliders = sensorColliders;
        const wall = new Wall({ scene });
        this.#controlPanel = new ControlPanel({
            onPressDropButton: slot => {
                if (this.#cabinet.state.coins) {
                    Coins.dropCoin({ slot });
                    this.#cabinet.state.coins--;
                }
            },
            onPressActionButton: () => {
                this.#coinRoller.triggerCoin();
            },
            onPressStartButton: () => {
                this.#controlPanel.disableStartButton();
                this.#runs.start();
            }
        });
        this.#pusher = new Pusher({
            scene,
            onDeliverBonus: ({ reward, position }) => {
                Coins.depositCoins({ position, count: reward.coinCount });
                Tokens.depositTokens({ position, count: reward.tokenCount });
                Cards.depositCards({ position, count: reward.cardCount });
                Ingots.depositIngots({ position, count: reward.ingotCount });
            }
        });
        this.#scoreboard = new ScoreBoard({
            scene,
            cabinet: this,
            state: this.#cabinet.state
        });
        this.#collisionsDetector = new CollisionsDetector({ scene, cabinet: this });
        this.#sensorGate = new SensorGate({
            scene,
            onFallenCoin: instance => Coins.enableCcd(instance, false),
            onBonusWon: () => {
                const random = Math.random();
                if (this.DEBUG_AUTOPLAY) {
                    this.#pusher.deliverBonus({ coinCount: 10, cardCount: Math.random() < 0.5 ? 1 : 0, tokenCount: Math.random() < 0.5 ? 1 : 0, ingotCount: Math.random() < 0.5 ? 1 : 0 });
                } else {
                    if (random < .14) {
                        this.#reelsBox.spinReels();
                    } else if (random < .28) {
                        this.#excavator.pick();
                    } else if (random < .43) {
                        this.#controlPanel.enableActionButton();
                        this.#coinRoller.shootCoin();
                    } else if (random < .57) {
                        this.#leftTower.shootCoins();
                        this.#rightTower.shootCoins();
                    } else if (random < .71) {
                        this.#leftStacker.deliver({ levels: 30 });
                        this.#rightStacker.deliver({ levels: 30 });
                    } else if (random < .86) {
                        this.#sweepers.sweepFloor({ level: 5 });
                    } else {
                        this.#stacker.deliver({ stacks: 7, levels: 15 });
                    }
                }
            }
        });
        this.#reelsBox = new ReelsBox({
            scene,
            onBonusWon: (reels) => {
                this.#pusher.deliverBonus({
                    coinCount: Math.floor(5 * Math.random()) + 10,
                    cardCount: Math.random() < 0.5 ? 1 : 0,
                    tokenCount: Math.random() < 0.5 ? 1 : 0,
                    ingotCount: Math.random() < 0.25 ? 1 : 0
                });
            }
        });
        this.#excavator = new Excavator({
            scene,
            cabinet: this,
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
                        type: Math.floor(Math.random() * (Tokens.TYPES - 1)),
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
            }
        });
        this.#leftTower = new Tower({
            scene,
            cabinet: this,
            offsetX: -.25,
            oscillationDirection: 1,
            onShootCoin: ({ position, impulse }) => Coins.depositCoin({ position, impulse })
        });
        this.#rightTower = new Tower({
            scene,
            cabinet: this,
            offsetX: .25,
            oscillationDirection: -1,
            onShootCoin: ({ position, impulse }) => Coins.depositCoin({ position, impulse })
        });
        this.#coinRoller = new CoinRoller({
            scene,
            cabinet: this,
            onInitializeCoin: ({ position, rotation }) => Coins.depositCoin({ position, rotation }),
            onGameLost: () => this.#controlPanel.disableActionButton(),
            onBonusWon: bonus => {
                Coins.dropCoins({ count: Math.pow(bonus + 1, 2) * 5 });
                this.#controlPanel.disableActionButton();
            }
        });
        this.#stacker = new Stacker({
            scene,
            cabinet: this,
            onInitializeCoin: ({ position, rotation, impulse }) => Coins.depositCoin({ position, rotation, impulse }),
        });
        this.#leftStacker = new MiniStacker({
            scene,
            cabinet: this,
            onInitializeCoin: ({ position, rotation, impulse }) => Coins.depositCoin({ position, rotation, impulse }),
            offsetX: -0.4
        });
        this.#rightStacker = new MiniStacker({
            scene,
            cabinet: this,
            onInitializeCoin: ({ position, rotation, impulse }) => Coins.depositCoin({ position, rotation, impulse }),
            offsetX: 0.4
        });
        this.#sweepers = new Sweepers({
            scene,
            cabinet: this
        });
        this.#screen = new Screen({ scene });
        this.#cardReader = new CardReader({
            scene,
            cabinet: this,
            onRetrieveCard: ({ type, position, rotation }) => Cards.depositCard({ type, position, rotation }),
            onReadCard: card => {
                if (this.#runs.started) {
                    this.#cabinet.state.score += 50;
                    this.#cabinet.state.points += 50;
                }
            }
        });
        this.#tokenSlot = new TokenSlot({
            scene,
            cabinet: this,
            onRetrieveToken: ({ type, position, rotation }) => Tokens.depositToken({ type, position, rotation }),
            onReadToken: token => {
                if (this.#runs.started) {
                    this.#cabinet.state.score += 20;
                    this.#cabinet.state.points += 20;
                }
            }
        });
        this.#runs = new Runs({
            state: this.#cabinet.state,
            screen: this.#screen
        });
        this.#floorAccessRules.set(this.#leftStacker, new Set([this.#sweepers]));
        this.#floorAccessRules.set(this.#rightStacker, new Set([this.#sweepers]));
        this.#floorAccessRules.set(this.#stacker, new Set([this.#sweepers, this.#excavator]));
        this.#floorAccessRules.set(this.#sweepers, null);
        this.#floorAccessRules.set(this.#excavator, new Set([this.#sweepers, this.#stacker]));
        this.#floorAccessRules.set(this.#leftTower, new Set([this.#sweepers]));
        this.#floorAccessRules.set(this.#rightTower, new Set([this.#sweepers]));
        await Promise.all([
            Cards.initialize({ scene }),
            Coins.initialize({
                scene,
                onSpawnedCoin: instance => Coins.enableCcd(instance, true)
            }),
            Tokens.initialize({ scene }),
            Buttons.initialize({ scene }),
            Digits.initialize({ scene }),
            Ingots.initialize({ scene })
        ]);
        await Promise.all([
            wall.initialize(),
            this.#controlPanel.initialize(),
            this.#pusher.initialize(),
            this.#scoreboard.initialize(),
            this.#sensorGate.initialize(),
            this.#reelsBox.initialize(),
            this.#excavator.initialize(),
            this.#leftTower.initialize(),
            this.#rightTower.initialize(),
            this.#coinRoller.initialize(),
            this.#stacker.initialize(),
            this.#leftStacker.initialize(),
            this.#rightStacker.initialize(),
            this.#sweepers.initialize(),
            this.#screen.initialize(),
            this.#cardReader.initialize(),
            this.#tokenSlot.initialize(),
            this.#runs.initialize()
        ]);
        await this.#collisionsDetector.initialize();
    }

    update(time) {
        Cards.update();
        Coins.update();
        Tokens.update();
        Buttons.update();
        Digits.update();
        Ingots.update();
        this.#pusher.update();
        this.#collisionsDetector.update();
        this.#scoreboard.update();
        this.#controlPanel.update();
        this.#sensorGate.update();
        this.#reelsBox.update();
        this.#sweepers.update();
        this.#excavator.update();
        this.#leftTower.update();
        this.#rightTower.update();
        this.#coinRoller.update();
        this.#stacker.update();
        this.#leftStacker.update();
        this.#rightStacker.update();
        this.#screen.update();
        this.#cardReader.update();
        this.#tokenSlot.update();
        this.#runs.update(time);
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

    refresh() {
        Cards.refresh();
        Coins.refresh();
        Tokens.refresh();
        Buttons.refresh();
        Digits.refresh();
        Ingots.refresh();
        this.#pusher.refresh();
        this.#controlPanel.refresh();
        this.#scoreboard.refresh();
        this.#sensorGate.refresh();
        this.#reelsBox.refresh();
        this.#sweepers.refresh();
        this.#excavator.refresh();
        this.#leftTower.refresh();
        this.#rightTower.refresh();
        this.#coinRoller.refresh();
        this.#stacker.refresh();
        this.#leftStacker.refresh();
        this.#rightStacker.refresh();
        this.#screen.refresh();
        this.#cardReader.refresh();
        this.#tokenSlot.refresh();
        this.#runs.refresh();
    }

    sensorColliders() {
        return [
            ...this.#sensorColliders.values(),
            ...this.#excavator.sensorColliders(),
            ...this.#sensorGate.sensorColliders(),
            ...this.#coinRoller.sensorColliders(),
        ];
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

    get coinsInPlay() {
        return Coins.usedCoins;
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
        const data = {};
        data.cards = Cards.save();
        data.coins = Coins.save();
        data.tokens = Tokens.save();
        data.buttons = Buttons.save();
        data.ingots = Ingots.save();
        Object.assign(data, {
            state: this.#cabinet.state,
            sensorCollidersHandles,
            pusher: this.#pusher.save(),
            sensorGate: this.#sensorGate.save(),
            reelsBox: this.#reelsBox.save(),
            excavator: this.#excavator.save(),
            leftTower: this.#leftTower.save(),
            rightTower: this.#rightTower.save(),
            coinRoller: this.#coinRoller.save(),
            stacker: this.#stacker.save(),
            leftStacker: this.#leftStacker.save(),
            rightStacker: this.#rightStacker.save(),
            sweepers: this.#sweepers.save(),
            cardReader: this.#cardReader.save(),
            tokenSlot: this.#tokenSlot.save(),
            runs: this.#runs.save(),
            scene: await this.#scene.save()
        });
        return data;
    }

    async load(cabinet) {
        await this.#scene.load(cabinet.scene);
        Cards.load(cabinet.cards);
        Coins.load(cabinet.coins);
        Tokens.load(cabinet.tokens);
        Buttons.load(cabinet.buttons);
        Ingots.load(cabinet.ingots);
        this.#sensorColliders = new Map();
        this.#parts.forEach(partData => {
            partData.meshes.forEach(({ data }) => {
                data.traverse((child) => {
                    if (child.isMesh) {
                        const userData = child.material.userData;
                        const objectType = child.material.name;
                        if (userData.sensor) {
                            const colliderHandle = cabinet.sensorCollidersHandles[objectType];
                            const collider = this.#scene.worldColliders.get(colliderHandle);
                            collider.userData = {
                                objectType,
                                onIntersect: this.#sensorListeners[objectType]
                            };
                            this.#sensorColliders.set(objectType, collider);
                        }
                    }
                });
            });
        });
        this.#cabinet.state.score = cabinet.state.score;
        this.#cabinet.state.points = cabinet.state.points;
        this.#cabinet.state.coins = cabinet.state.coins;
        this.#pusher.load(cabinet.pusher);
        this.#sensorGate.load(cabinet.sensorGate);
        this.#reelsBox.load(cabinet.reelsBox);
        this.#excavator.load(cabinet.excavator);
        this.#leftTower.load(cabinet.leftTower);
        this.#rightTower.load(cabinet.rightTower);
        this.#coinRoller.load(cabinet.coinRoller);
        this.#stacker.load(cabinet.stacker);
        this.#leftStacker.load(cabinet.leftStacker);
        this.#rightStacker.load(cabinet.rightStacker);
        this.#sweepers.load(cabinet.sweepers);
        this.#cardReader.load(cabinet.cardReader);
        this.#tokenSlot.load(cabinet.tokenSlot);
        this.#runs.load(cabinet.runs);
        this.#collisionsDetector.initialize();
    }

    getObject(userData) {
        if (userData.objectType === Coins.TYPE) {
            return this.getCoin(userData);
        } else if (userData.objectType === Tokens.TYPE) {
            return this.getToken(userData);
        } else if (userData.objectType === Cards.TYPE) {
            return this.getCard(userData);
        } else if (userData.objectType === Ingots.TYPE) {
            return this.getIngot(userData);
        }
    }

    getCoin({ index }) {
        return Coins.getCoin({ index });
    }

    getToken({ index, type }) {
        return Tokens.getToken({ index, type });
    }

    getCard({ index, type }) {
        return Cards.getCard({ index, type });
    }

    getIngot({ index }) {
        return Ingots.getIngot({ index });
    }

    recycleObject(userData) {
        const object = this.getObject(userData);
        if (object) {
            if (object.objectType === Coins.TYPE) {
                Coins.recycle(object);
            }
            if (object.objectType === Tokens.TYPE) {
                Tokens.recycle(object);
            }
            if (object.objectType === Cards.TYPE) {
                Cards.recycle(object);
            }
            if (object.objectType === Ingots.TYPE) {
                Ingots.recycle(object);
            }
        }
    }

    canActivate(caller) {
        const info = this.#floorAccessRules.get(caller);
        if (info) {
            const excludedParts = Array.from(info).filter(part => part !== caller);
            return !excludedParts.find(part => part.active);
        } else {
            const otherParts = Array.from(this.#floorAccessRules.keys()).filter(part => part !== caller);
            return !otherParts.find(part => part.active);
        }
    }

    #autoplay() {
        if (this.#pusher.phase > 2 && this.#pusher.phase < 2.05 && this.#pusher.phase > this.lastPhase) {
            Coins.dropCoins({ count: 10 });
        }
        this.lastPhase = this.#pusher.phase;
    }
}

async function initializeModel({ scene, DEBUG_HIDE_CABINET }) {
    const cabinetModel = await scene.loadModel(MODEL_PATH);
    const mesh = cabinetModel.scene;
    const parts = new Map();
    mesh.traverse((child) => {
        if (child.isMesh) {
            const { material, geometry } = child;
            const userData = material.userData;
            const name = userData.name;
            if (userData.collider || userData.sensor) {
                const partData = getPart(parts, name);
                partData.sensor = userData.sensor;
                partData.friction = userData.friction;
                partData.restitution = userData.restitution;
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
            }
        }
    });
    if (!DEBUG_HIDE_CABINET) {
        scene.addObject(mesh);
    }
    return {
        parts
    };
}

function initializeColliders({ scene, parts, sensorListeners }) {
    const sensorColliders = new Map();
    parts.forEach((partData, name) => {
        const { meshes, sensor, friction, restitution } = partData;
        const body = scene.createFixedBody();
        const geometries = [];
        meshes.forEach(meshData => {
            if (sensor) {
                const collider = scene.createCuboidColliderFromBoundingBox({
                    mesh: meshData.data,
                    height: SENSOR_HEIGHT,
                    userData: {
                        objectType: name,
                        onIntersect: sensorListeners[name]
                    },
                    sensor
                }, body);
                sensorColliders.set(name, collider);
            } else if (meshData.geometry) {
                geometries.push(meshData.geometry);
            }
        });
        if (geometries.length > 0) {
            const { vertices, indices } = scene.mergeGeometries(geometries);
            const collider = scene.createTrimeshCollider({
                vertices,
                indices,
                friction,
                restitution
            }, body);
            collider.setCollisionGroups(CABINET_COLLISION_GROUP);
        }
    });
    return {
        sensorColliders
    };
}

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