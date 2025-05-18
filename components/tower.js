import { Quaternion, Vector3 } from "three";

const MODEL_PATH = "./../assets/tower.glb";
const RESTITUTION = 0;
const BASE_PART_NAME = "base";
const STAND_PART_NAME = "stand";
const TURRET_PART_NAME = "turret";
const INIT_POSITION_PART_NAME = "init-position";
const POSITION_UP_Y = 0.1;
const POSITION_DOWN_Y = 0;
const ANGLE_IDLE = 0;
const ANGLE_AMPLITUDE = Math.PI / 4;
const DELTA_POSITION_STEP = 0.002;
const DELAY_SHOOT = 200;
const IMPULSE_STRENGTH = 0.00005;
const IMPULSE_DIRECTION = new Vector3(0, 0, -1);
const Y_AXIS = new Vector3(0, 1, 0);

const TOWER_STATES = {
    IDLE: Symbol.for("tower-idle"),
    ACTIVATING: Symbol.for("tower-activating"),
    SHOOTING_COINS: Symbol.for("tower-shooting-coins"),
    SHOOTING_COIN: Symbol.for("tower-shooting-coin"),
    MOVING_DOWN: Symbol.for("tower-moving-down")
};

export default class {

    #scene;
    #initPosition;
    #onShootCoin;
    #tower = {
        state: TOWER_STATES.IDLE,
        pendingShots: 0,
        parts: new Map(),
        position: POSITION_DOWN_Y,
        angle: ANGLE_IDLE,
        oscillationCount: 0,
        timeActive: -1,
        timeLastShot: -1
    };

    constructor({ scene, onShootCoin }) {
        this.#scene = scene;
        this.#onShootCoin = onShootCoin;
    }

    async initialize() {
        const scene = this.#scene;
        const { parts, initPosition } = await initializeModel({ scene });
        initializeColliders({ scene, parts });
        this.#initPosition = initPosition;
        parts.forEach(({ meshes }) => meshes.forEach(({ data }) => this.#scene.addObject(data)));
        Object.assign(this.#tower, { parts });
    }

    update(time) {
        updateTowerState({ tower: this.#tower, time });
        const rotation = new Quaternion().setFromAxisAngle(Y_AXIS, this.#tower.angle);
        if (this.#tower.state === TOWER_STATES.SHOOTING_COIN) {
            const position = this.#initPosition.clone().setY(this.#initPosition.y + POSITION_UP_Y);
            const impulse = IMPULSE_DIRECTION.clone().applyQuaternion(rotation).normalize().multiplyScalar(IMPULSE_STRENGTH);
            this.#onShootCoin({ position, impulse });
        }
        this.#tower.parts.forEach(({ meshes, body }, name) => {
            meshes.forEach(({ data }) => {
                data.position.copy(body.translation());
                data.quaternion.copy(body.rotation());
            });
            if (this.#tower.state !== TOWER_STATES.IDLE) {
                const position = new Vector3();
                if (name === TURRET_PART_NAME) {
                    position.sub(this.#initPosition).applyQuaternion(rotation).add(this.#initPosition).setY(this.#tower.position);
                    body.setNextKinematicTranslation(position);
                    body.setNextKinematicRotation(rotation);
                }
                if (name === STAND_PART_NAME) {
                    position.setY(this.#tower.position);
                    body.setNextKinematicTranslation(position);
                }
            }
        });
    }

    shootCoins() {
        if (this.#tower.state === TOWER_STATES.IDLE) {
            this.#tower.state = TOWER_STATES.ACTIVATING;
        } else {
            this.#tower.pendingShots++;
        }
    }

    save() {
        const parts = {};
        this.#tower.parts.forEach(({ body }, name) => {
            parts[name] = {
                bodyHandle: body.handle
            };
        });
        return {
            state: this.#tower.state.description,
            parts,
            position: this.#tower.position,
            angle: this.#tower.angle,
            oscillationCount: this.#tower.oscillationCount,
            pendingShots: this.#tower.pendingShots,
            timeActive: this.#tower.timeActive,
            timeLastShot: this.#tower.timeLastShot
        };
    }

    load(tower) {
        this.#tower.state = Symbol.for(tower.state);
        this.#tower.oscillationCount = tower.oscillationCount;
        this.#tower.pendingShots = tower.pendingShots;
        this.#tower.timeActive = tower.timeActive;
        this.#tower.timeLastShot = tower.timeLastShot;
        this.#tower.position = tower.position;
        this.#tower.angle = tower.angle;
        this.#tower.parts.forEach((partData, name) => {
            const loadedPart = tower.parts[name];
            if (loadedPart) {
                partData.body = this.#scene.worldBodies.get(loadedPart.bodyHandle);
            }
        });
    }
}

function updateTowerState({ tower, time }) {
    switch (tower.state) {
        case TOWER_STATES.ACTIVATING:
            if (tower.position < POSITION_UP_Y) {
                tower.position += DELTA_POSITION_STEP;
            } else {
                tower.timeActive = time;
                tower.timeLastShot = time;
                tower.position = POSITION_UP_Y;
                tower.state = TOWER_STATES.SHOOTING_COINS;
            }
            break;
        case TOWER_STATES.SHOOTING_COINS:
            if (tower.oscillationCount < 1) {
                const phase = (time - tower.timeActive) * DELTA_POSITION_STEP;
                tower.angle = Math.sin(phase) * ANGLE_AMPLITUDE;
                tower.oscillationCount = Math.floor(phase / (2 * Math.PI));
                if (time - tower.timeLastShot > DELAY_SHOOT) {
                    tower.state = TOWER_STATES.SHOOTING_COIN;
                }
            } else if (tower.pendingShots) {
                tower.pendingShots--;
                tower.timeActive = time;
                tower.oscillationCount = 0;
            } else {
                tower.timeActive = -1;
                tower.oscillationCount = 0;
                tower.angle = ANGLE_IDLE;
                tower.state = TOWER_STATES.MOVING_DOWN;
            }
            break;
        case TOWER_STATES.SHOOTING_COIN:
            tower.timeLastShot = time;
            tower.state = TOWER_STATES.SHOOTING_COINS;
            break;
        case TOWER_STATES.MOVING_DOWN:
            if (tower.position > 0) {
                tower.position -= DELTA_POSITION_STEP;
            } else {
                tower.position = POSITION_DOWN_Y;
                tower.state = TOWER_STATES.IDLE;
            }
            break;
        default:
            break;
    }
}

async function initializeModel({ scene }) {
    const cabinetModel = await scene.loadModel(MODEL_PATH);
    const mesh = cabinetModel.scene;
    const parts = new Map();
    const initPosition = new Vector3();
    mesh.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            const { material, geometry } = child;
            const userData = material.userData;
            if (userData.collider) {
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
        } else if (child.name == INIT_POSITION_PART_NAME) {
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
        partData = {
            meshes: []
        };
        parts.set(name, partData);
    } else {
        partData = parts.get(name);
    }
    return partData;
}

function initializeColliders({ scene, parts }) {
    parts.forEach((partData, name) => {
        const { meshes, friction } = partData;
        const body = partData.body = name === BASE_PART_NAME ? scene.createFixedBody() : scene.createKinematicBody();
        meshes.forEach(meshData => {
            const { vertices, indices } = meshData;
            if (vertices && indices) {
                meshData.collider = scene.createTrimeshCollider({
                    vertices,
                    indices,
                    friction,
                    restitution: RESTITUTION
                }, body);
            }
        });
    });
}