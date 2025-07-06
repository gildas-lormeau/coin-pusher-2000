import { Quaternion, Vector3 } from "three";

const MODEL_PATH = "./assets/tower.glb";
const STAND_PART_NAME = "stand";
const TURRET_PART_NAME = "turret";
const INIT_POSITION_PART_NAME = "init-position";
const POSITION_UP_Y = 0.1;
const POSITION_DOWN_Y = 0;
const ANGLE_AMPLITUDE = Math.PI / 7;
const TRANSLATION_SPEED = 0.002;
const ROTATION_SPEED = 0.02;
const SHOOT_DURATION = 10;
const IMPULSE_STRENGTH = 0.00005;
const IMPULSE_DIRECTION = new Vector3(0, 0, -1);
const Y_AXIS = new Vector3(0, 1, 0);
const EMISSIVE_COLOR = 0x00ff00;
const EMISSIVE_INTENSITY_MIN = 0;
const EMISSIVE_INTENSITY_MAX = 2;

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
    #offsetX;
    #oscillationDirection;
    #canActivate;
    #onShootCoin;
    #turret;
    #turretPosition = new Vector3();
    #stand;
    #standPosition = new Vector3();
    #lightMaterial;
    #tower = {
        state: TOWER_STATES.IDLE,
        pendingShots: 0,
        parts: null,
        position: POSITION_DOWN_Y,
        oscillationCount: 0,
        phase: 0,
        frameLastShot: -1,
        lightOn: false
    };

    constructor({ scene, canActivate, onShootCoin, offsetX = 0, oscillationDirection = -1 }) {
        this.#scene = scene;
        this.#canActivate = canActivate;
        this.#onShootCoin = onShootCoin;
        this.#offsetX = offsetX;
        this.#oscillationDirection = oscillationDirection;
    }

    async initialize() {
        const scene = this.#scene;
        const { parts, initPosition, lightMaterial } = await initializeModel({ scene, offsetX: this.#offsetX });
        initializeColliders({ scene, parts });
        this.#initPosition = initPosition;
        this.#lightMaterial = lightMaterial;
        parts.forEach(({ meshes }) => meshes.forEach(({ data }) => this.#scene.addObject(data)));
        Object.assign(this.#tower, { parts });
        this.#turret = this.#tower.parts.get(TURRET_PART_NAME);
        this.#stand = this.#tower.parts.get(STAND_PART_NAME);
    }

    update() {
        if (this.#tower.nextState) {
            this.#tower.state = this.#tower.nextState;
            this.#tower.nextState = null;
        }
        updateTowerState({
            tower: this.#tower,
            canActivate: () => this.#canActivate(this)
        });
        const { state, phase, position } = this.#tower;
        if (state !== TOWER_STATES.IDLE) {
            const rotation = new Quaternion().setFromAxisAngle(Y_AXIS, Math.sin(phase) * ANGLE_AMPLITUDE * this.#oscillationDirection);
            if (state === TOWER_STATES.SHOOTING_COIN) {
                const position = this.#initPosition.clone().setY(this.#initPosition.y + POSITION_UP_Y);
                const impulse = IMPULSE_DIRECTION.clone().applyQuaternion(rotation).normalize().multiplyScalar(IMPULSE_STRENGTH);
                this.#onShootCoin({ position, impulse });
            }
            this.#turret.body.setNextKinematicTranslation(this.#turretPosition.set(0, 0, 0).sub(this.#initPosition).applyQuaternion(rotation).add(this.#initPosition).setY(position));
            this.#turret.body.setNextKinematicRotation(rotation);
            this.#stand.body.setNextKinematicTranslation(this.#standPosition.setY(position));
        }
    }

    refresh() {
        const { state, parts, lightOn } = this.#tower;
        if (state !== TOWER_STATES.IDLE) {
            parts.forEach(({ meshes, body }) => meshes.forEach(({ data }) => {
                data.position.copy(body.translation());
                data.quaternion.copy(body.rotation());
            }));
            this.#lightMaterial.emissiveIntensity = lightOn ? EMISSIVE_INTENSITY_MAX : EMISSIVE_INTENSITY_MIN;
        }
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
            nextState: this.#tower.nextState ? this.#tower.nextState.description : null,
            parts,
            position: this.#tower.position,
            oscillationCount: this.#tower.oscillationCount,
            pendingShots: this.#tower.pendingShots,
            phase: this.#tower.phase,
            frameLastShot: this.#tower.frameLastShot,
            lightOn: this.#tower.lightOn
        };
    }

    load(tower) {
        this.#tower.state = Symbol.for(tower.state);
        this.#tower.nextState = tower.nextState ? Symbol.for(tower.nextState) : null;
        this.#tower.oscillationCount = tower.oscillationCount;
        this.#tower.pendingShots = tower.pendingShots;
        this.#tower.phase = tower.phase;
        this.#tower.frameLastShot = tower.frameLastShot;
        this.#tower.lightOn = tower.lightOn;
        this.#tower.position = tower.position;
        this.#tower.parts.forEach((partData, name) => {
            const loadedPart = tower.parts[name];
            if (loadedPart) {
                partData.body = this.#scene.worldBodies.get(loadedPart.bodyHandle);
            }
        });
    }

    get active() {
        return this.#tower.state !== TOWER_STATES.IDLE && this.#tower.state !== TOWER_STATES.ACTIVATING;
    }
}

function updateTowerState({ tower, canActivate }) {
    switch (tower.state) {
        case TOWER_STATES.ACTIVATING:
            if (canActivate()) {
                tower.phase = 0;
                if (tower.position < POSITION_UP_Y) {
                    tower.position += TRANSLATION_SPEED;
                } else {
                    tower.frameLastShot = 0;
                    tower.position = POSITION_UP_Y;
                    tower.state = tower.nextState = TOWER_STATES.SHOOTING_COINS;
                }
            }
            break;
        case TOWER_STATES.SHOOTING_COINS:
            if (tower.oscillationCount < 1) {
                tower.phase += ROTATION_SPEED;
                tower.oscillationCount = Math.floor(tower.phase / (2 * Math.PI));
                tower.frameLastShot++;
                if (tower.frameLastShot > SHOOT_DURATION / 5) {
                    tower.lightOn = false;
                }
                if (tower.frameLastShot > SHOOT_DURATION) {
                    tower.nextState = TOWER_STATES.SHOOTING_COIN;
                }
            } else if (tower.pendingShots) {
                tower.pendingShots--;
                tower.phase += ROTATION_SPEED;
                tower.oscillationCount = 0;
            } else {
                tower.phase = 0;
                tower.oscillationCount = 0;
                tower.nextState = TOWER_STATES.MOVING_DOWN;
            }
            break;
        case TOWER_STATES.SHOOTING_COIN:
            tower.frameLastShot = 0;
            tower.lightOn = true;
            tower.nextState = TOWER_STATES.SHOOTING_COINS;
            break;
        case TOWER_STATES.MOVING_DOWN:
            if (tower.position > 0) {
                tower.position -= TRANSLATION_SPEED;
            } else {
                tower.position = POSITION_DOWN_Y;
                tower.frameLastShot = -1;
                tower.nextState = TOWER_STATES.IDLE;
            }
            break;
        default:
            break;
    }
}

async function initializeModel({ scene, offsetX }) {
    const model = await scene.loadModel(MODEL_PATH);
    const mesh = model.scene;
    const parts = new Map();
    const initPosition = new Vector3();
    let lightMaterial;
    mesh.traverse((child) => {
        if (child.isMesh) {
            const { material, geometry } = child;
            for (let indexVertex = 0; indexVertex < geometry.index.count; indexVertex++) {
                const position = geometry.attributes.position;
                position.setX(indexVertex, position.getX(indexVertex) + offsetX);
            }
            const userData = material.userData;
            if (userData.collider) {
                const name = userData.name;
                const index = geometry.index;
                const position = geometry.attributes.position;
                const vertices = [];
                const indices = [];
                for (let indexVertex = 0; indexVertex < position.count; indexVertex++) {
                    vertices.push(position.getX(indexVertex), position.getY(indexVertex), position.getZ(indexVertex));
                }
                for (let indexVertex = 0; indexVertex < index.count; indexVertex++) {
                    indices.push(index.getX(indexVertex));
                }
                const partData = getPart(parts, name);
                partData.friction = userData.friction;
                partData.restitution = userData.restitution;
                partData.fixed = userData.fixed;
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
            if (userData.light) {
                lightMaterial = child.material;
                lightMaterial.emissive.setHex(EMISSIVE_COLOR);
            }
        } else if (child.name == INIT_POSITION_PART_NAME) {
            const position = child.position;
            position.x += offsetX;
            initPosition.copy(child.position);
        }
    });
    return {
        parts,
        lightMaterial,
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
    let indexPart = 0;
    parts.forEach((partData, name) => {
        const { meshes, friction, restitution, fixed } = partData;
        const body = partData.body = fixed ? scene.createFixedBody() : scene.createKinematicBody();
        const vertices = [];
        const indices = [];
        let offsetIndex = 0;
        meshes.forEach(meshData => {
            if (meshData.vertices) {
                vertices.push(...meshData.vertices);
                indices.push(...meshData.indices.map(index => index + offsetIndex));
                offsetIndex += Math.max(...meshData.indices) + 1;
            }
        });
        const collider = scene.createTrimeshCollider({
            vertices,
            indices,
            friction,
            restitution
        }, body);
        collider.setCollisionGroups((1 << (indexPart % 16)) << 16 | (1 << (indexPart % 16)));
        indexPart++;
    });
}