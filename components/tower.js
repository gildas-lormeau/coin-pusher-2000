import { Quaternion, Vector3 } from "three";

const MODEL_PATH = "./../assets/tower.glb";
const STAND_PART_NAME = "stand";
const TURRET_PART_NAME = "turret";
const INIT_POSITION_PART_NAME = "init-position";
const POSITION_UP_Y = 0.1;
const POSITION_DOWN_Y = 0;
const ANGLE_IDLE = 0;
const ANGLE_AMPLITUDE = Math.PI / 6;
const DELTA_POSITION_STEP = 0.002;
const DELAY_SHOOT = 180;
const IMPULSE_STRENGTH = 0.00005;
const IMPULSE_DIRECTION = new Vector3(0, 0, -1);
const Y_AXIS = new Vector3(0, 1, 0);
const CABINET_COLLISION_GROUP = 0x00010001;

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
    #tower = {
        state: TOWER_STATES.IDLE,
        pendingShots: 0,
        parts: null,
        position: POSITION_DOWN_Y,
        angle: ANGLE_IDLE,
        oscillationCount: 0,
        timeActive: -1,
        timeLastShot: -1
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
        const { parts, initPosition } = await initializeModel({ scene, offsetX: this.#offsetX });
        initializeColliders({ scene, parts });
        this.#initPosition = initPosition;
        parts.forEach(({ meshes }) => meshes.forEach(({ data }) => this.#scene.addObject(data)));
        Object.assign(this.#tower, { parts });
        this.#turret = this.#tower.parts.get(TURRET_PART_NAME);
        this.#stand = this.#tower.parts.get(STAND_PART_NAME);
    }

    update(time) {
        updateTowerState({
            tower: this.#tower,
            time,
            oscillationDirection: this.#oscillationDirection,
            canActivate: () => this.#canActivate(this)
        });
        const { state, parts, angle, position } = this.#tower;
        if (state !== TOWER_STATES.IDLE) {
            parts.forEach(({ meshes, body }) => meshes.forEach(({ data }) => {
                data.position.copy(body.translation());
                data.quaternion.copy(body.rotation());
            }));
            const rotation = new Quaternion().setFromAxisAngle(Y_AXIS, angle);
            if (state === TOWER_STATES.SHOOTING_COIN) {
                const position = this.#initPosition.clone().setY(this.#initPosition.y + POSITION_UP_Y);
                const impulse = IMPULSE_DIRECTION.clone().applyQuaternion(rotation).normalize().multiplyScalar(IMPULSE_STRENGTH);
                this.#onShootCoin({ position, impulse });
            }
            this.#turret.body.setNextKinematicTranslation(this.#turretPosition.set(0, 0, 0).sub(this.#initPosition).applyQuaternion(rotation).add(this.#initPosition).setY(position));
            this.#turret.body.setNextKinematicRotation(rotation);
            this.#stand.body.setNextKinematicTranslation(this.#standPosition.setY(position));
            if (this.#tower.nextState) {
                this.#tower.state = this.#tower.nextState;
            }
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
            angle: this.#tower.angle,
            oscillationCount: this.#tower.oscillationCount,
            pendingShots: this.#tower.pendingShots,
            timeActive: this.#tower.timeActive,
            timeLastShot: this.#tower.timeLastShot
        };
    }

    load(tower) {
        this.#tower.state = Symbol.for(tower.state);
        this.#tower.nextState = tower.nextState ? Symbol.for(tower.nextState) : null;
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

    get active() {
        return this.#tower.state !== TOWER_STATES.IDLE && this.#tower.state !== TOWER_STATES.ACTIVATING;
    }
}

function updateTowerState({ tower, time, oscillationDirection, canActivate }) {
    tower.nextState = null;
    switch (tower.state) {
        case TOWER_STATES.ACTIVATING:
            if (canActivate()) {
                if (tower.position < POSITION_UP_Y) {
                    tower.position += DELTA_POSITION_STEP;
                } else {
                    tower.timeActive = time;
                    tower.timeLastShot = time;
                    tower.position = POSITION_UP_Y;
                    tower.nextState = TOWER_STATES.SHOOTING_COINS;
                }
            }
            break;
        case TOWER_STATES.SHOOTING_COINS:
            if (tower.oscillationCount < 1) {
                const phase = (time - tower.timeActive) * DELTA_POSITION_STEP;
                tower.angle = Math.sin(phase) * ANGLE_AMPLITUDE * oscillationDirection;
                tower.oscillationCount = Math.floor(phase / (2 * Math.PI));
                if (time - tower.timeLastShot > DELAY_SHOOT) {
                    tower.nextState = TOWER_STATES.SHOOTING_COIN;
                }
            } else if (tower.pendingShots) {
                tower.pendingShots--;
                tower.timeActive = time;
                tower.oscillationCount = 0;
            } else {
                tower.timeActive = -1;
                tower.oscillationCount = 0;
                tower.angle = ANGLE_IDLE;
                tower.nextState = TOWER_STATES.MOVING_DOWN;
            }
            break;
        case TOWER_STATES.SHOOTING_COIN:
            tower.timeLastShot = time;
            tower.nextState = TOWER_STATES.SHOOTING_COINS;
            break;
        case TOWER_STATES.MOVING_DOWN:
            if (tower.position > 0) {
                tower.position -= DELTA_POSITION_STEP;
            } else {
                tower.position = POSITION_DOWN_Y;
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
        } else if (child.name == INIT_POSITION_PART_NAME) {
            const position = child.position;
            position.x += offsetX;
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
        if (fixed) {
            collider.setCollisionGroups(CABINET_COLLISION_GROUP);
        } else {
            collider.setCollisionGroups((1 << (indexPart % 16)) << 16 | (1 << (indexPart % 16)));
            indexPart++;
        }
    });
}