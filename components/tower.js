import { Quaternion, Vector3 } from "three";

const MODEL_PATH = "./../assets/tower.glb";
const RESTITUTION = 0;
const BASE_PART_NAME = "base";
const INIT_POSITION_PART_NAME = "init-position";
const POSITION_UP_Y = 0.1;
const POSITION_DOWN_Y = 0;
const DELTA_POSITION_STEP = 0.001;
const DELAY_SHOOT = 200;
const IMPULSE_STRENGTH = 0.0001;
const IMPULSE_DIRECTION = new Vector3(0, 0, -1);
const Y_AXIS = new Vector3(0, 1, 0);

const TOWER_STATES = {
    IDLE: Symbol.for("tower-idle"),
    ACTIVATING: Symbol.for("excavator-activating"),
    SHOOTING: Symbol.for("excavator-shooting"),
    MOVING_DOWN: Symbol.for("excavator-moving-down")
};

export default class {

    #scene;
    #initPosition;
    #onShootCoin;
    #tower = {
        state: TOWER_STATES.IDLE,
        parts: new Map(),
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
        updateTowerState({
            tower: this.#tower,
            initPosition: this.#initPosition,
            onShootCoin: this.#onShootCoin,
            time
        });
        this.#tower.parts.forEach(({ meshes, body, position, rotation, nextKinematicTranslation, nextKinematicRotation }) => {
            position.copy(body.translation());
            rotation.copy(body.rotation());
            meshes.forEach(({ data }) => {
                data.position.copy(position);
                data.quaternion.copy(rotation);
            });
            if (nextKinematicTranslation) {
                body.setNextKinematicTranslation(nextKinematicTranslation);
            }
            if (nextKinematicRotation) {
                body.setNextKinematicRotation(nextKinematicRotation);
            }
        });
    }

    shootCoins() {
        if (this.#tower.state === TOWER_STATES.IDLE) {
            this.#tower.state = TOWER_STATES.ACTIVATING;
        } else {
            this.#tower.oscillationCount--;
        }
    }

    save() {
        const parts = {};
        this.#tower.parts.forEach(({ body, position, rotation, nextKinematicTranslation, nextKinematicRotation }, name) => {
            parts[name] = {
                bodyHandle: body.handle,
                position: position.toArray(),
                rotation: rotation.toArray()
            };
            if (nextKinematicTranslation) {
                parts[name].nextKinematicTranslation = nextKinematicTranslation.toArray();
            }
            if (nextKinematicRotation) {
                parts[name].nextKinematicRotation = nextKinematicRotation.toArray();
            }
        });
        return {
            state: this.#tower.state,
            parts,
            oscillationCount: this.#tower.oscillationCount,
            timeActive: this.#tower.timeActive,
            timeLastShot: this.#tower.timeLastShot
        };
    }

    load(tower) {
        this.#tower.state = tower.state;
        this.#tower.oscillationCount = tower.oscillationCount;
        this.#tower.timeActive = tower.timeActive;
        this.#tower.timeLastShot = tower.timeLastShot;
        this.#tower.parts.forEach((partData, name) => {
            const loadedPart = tower.parts[name];
            if (loadedPart) {
                partData.body = this.#scene.worldBodies.get(loadedPart.bodyHandle);
                partData.position.fromArray(loadedPart.position);
                partData.rotation.fromArray(loadedPart.rotation);
                if (loadedPart.nextKinematicTranslation) {
                    partData.nextKinematicTranslation = new Vector3().fromArray(loadedPart.nextKinematicTranslation);
                }
                if (loadedPart.nextKinematicRotation) {
                    partData.nextKinematicRotation = new Quaternion().fromArray(loadedPart.nextKinematicRotation);
                }
            }
        });
    }
}

function updateTowerState({ tower, initPosition, time, onShootCoin }) {
    const base = tower.parts.get("base");
    const turret = tower.parts.get("turret");
    const dynamicParts = [base, turret];
    switch (tower.state) {
        case TOWER_STATES.IDLE:
            break;
        case TOWER_STATES.ACTIVATING:
            if (turret.position.y < POSITION_UP_Y) {
                dynamicParts.forEach(part => {
                    const position = part.position.clone();
                    position.y += DELTA_POSITION_STEP;
                    part.nextKinematicTranslation = new Vector3(part.position.x, position.y, part.position.z);
                });
            } else {
                tower.timeActive = time;
                tower.timeLastShot = time;
                turret.position.y = POSITION_UP_Y;
                tower.state = TOWER_STATES.SHOOTING;
            }
            break;
        case TOWER_STATES.SHOOTING:
            if (tower.oscillationCount < 1) {
                const phase = (time - tower.timeActive) * DELTA_POSITION_STEP;
                const angle = Math.sin(phase) * Math.PI / 4;
                const rotation = new Quaternion().setFromAxisAngle(Y_AXIS, angle);
                const position = new Vector3().sub(initPosition).applyQuaternion(rotation).add(initPosition);
                position.y = turret.position.y;
                tower.oscillationCount = Math.floor(phase / (2 * Math.PI));
                dynamicParts.forEach(part => {
                    part.nextKinematicTranslation = position;
                    part.nextKinematicRotation = rotation;
                });
                if (time - tower.timeLastShot > DELAY_SHOOT) {
                    tower.timeLastShot = time;
                    const position = initPosition.clone().setY(initPosition.y + turret.position.y);
                    const impulse = IMPULSE_DIRECTION.clone().applyQuaternion(rotation).normalize().multiplyScalar(IMPULSE_STRENGTH);
                    onShootCoin({ position, impulse });
                }
            } else {
                tower.timeActive = -1;
                turret.rotation.set(0, 0, 0, 1);
                tower.state = TOWER_STATES.MOVING_DOWN;
            }
            break;
        case TOWER_STATES.MOVING_DOWN:
            if (turret.position.y > 0) {
                dynamicParts.forEach(part => {
                    const position = part.position.clone();
                    position.y -= DELTA_POSITION_STEP;
                    part.nextKinematicTranslation = new Vector3(part.position.x, position.y, part.position.z);
                    part.nextKinematicRotation = null;
                });
            } else {
                turret.position.y = POSITION_DOWN_Y;
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
            meshes: [],
            position: new Vector3(),
            rotation: new Quaternion()
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