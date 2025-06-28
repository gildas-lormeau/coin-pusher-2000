import { Vector3, Quaternion } from "three";

const MODEL_PATH = "./../assets/sweepers.glb";
const LEFT_BASE_PART_NAME = "left-base";
const RIGHT_BASE_PART_NAME = "right-base";
const LEFT_SWEEPER_PART_NAME = "left-sweeper";
const RIGHT_SWEEPER_PART_NAME = "right-sweeper";
const LEFT_DOOR_PART_NAME = "left-door";
const RIGHT_DOOR_PART_NAME = "right-door";
const LEFT_PIVOT_POSITION = "left-pivot-position";
const RIGHT_PIVOT_POSITION = "right-pivot-position";
const LEFT_DOOR_PIVOT_POSITION = "left-door-pivot-position";
const RIGHT_DOOR_PIVOT_POSITION = "right-door-pivot-position";
const Y_AXIS = new Vector3(0, 1, 0);
const Z_AXIS = new Vector3(0, 0, 1);
const SWEEPERS_ROTATION = 26.5 * (Math.PI / 180);
const LEFT_DOOR_INITIAL_ROTATION = new Quaternion().setFromAxisAngle(Y_AXIS, -SWEEPERS_ROTATION);
const RIGHT_DOOR_INITIAL_ROTATION = new Quaternion().setFromAxisAngle(Y_AXIS, SWEEPERS_ROTATION);
const DOORS_ROTATION_SPEED = 0.05;
const BASE_SPEED = 0.002;
const BASE_POSITION = 0.08;
const BASE_TRANSLATION = 0.07;
const BASE_ROTATION_SPEED = 0.01;
const DOORS_OPENED_ANGLE = Math.PI / 2;
const SWEEPING_MAX_ANGLE = Math.PI;
const SWEEPING_AXIS_ANGLE = Math.PI / 2;
const SWEEPING_SPEED = 0.02;
const SWEEPERS_AXIS_ROTATION_SPEED = 0.05;
const SWEEPERS_INITIAL_POSITION = 0;
const SWEEPERS_INITIAL_ROTATION = 0;
const SWEEPERS_INITIAL_TRANSLATION = 0;
const SWEEPERS_INITIAL_SWEEPERS_ROTATION_Z = 0;
const SWEEPERS_INITIAL_SWEEPERS_ROTATION_Y = 0;
const SWEEPERS_INITIAL_DOORS_ROTATION = 0;

const SWEEPERS_STATES = {
    IDLE: Symbol.for("sweepers-idle"),
    ACTIVATING: Symbol.for("sweepers-activating"),
    OPENING_DOORS: Symbol.for("sweepers-opening-doors"),
    MOVING_BASE: Symbol.for("sweepers-moving-base"),
    ROTATING_BASE: Symbol.for("sweepers-rotating-base"),
    TRANSLATING_BASE: Symbol.for("sweepers-translating-base"),
    ROTATING_SWEEPERS: Symbol.for("sweepers-rotating-sweepers"),
    SWEEPING: Symbol.for("sweepers-sweeping"),
    SWEEPING_BACK: Symbol.for("sweepers-sweeping-back"),
    ROTATING_SWEEPERS_BACK: Symbol.for("sweepers-rotating-sweepers-back"),
    TRANSLATING_BASE_BACK: Symbol.for("sweepers-translating-base-back"),
    ROTATING_BASE_BACK: Symbol.for("sweepers-rotating-base-back"),
    MOVING_BASE_BACK: Symbol.for("sweepers-moving-base-back"),
    CLOSING_DOORS: Symbol.for("sweepers-closing-doors")
};

export default class {

    #scene;
    #canActivate;
    #leftPivotPosition;
    #rightPivotPosition;
    #leftDoorPivotPosition;
    #rightDoorPivotPosition;
    #leftBase;
    #rightBase;
    #leftDoor;
    #rightDoor;
    #leftSweeper;
    #rightSweeper;
    #leftBasePosition = new Vector3();
    #rightBasePosition = new Vector3();
    #leftBaseRotation = new Quaternion();
    #rightBaseRotation = new Quaternion();
    #leftBaseTranslation = new Vector3();
    #rightBaseTranslation = new Vector3();
    #leftSweeperPosition = new Vector3();
    #rightSweeperPosition = new Vector3();
    #leftSweeperRotation = new Quaternion();
    #leftSweeperRotationY = new Quaternion();
    #leftSweeperRotationZ = new Quaternion();
    #rightSweeperRotation = new Quaternion();
    #rightSweeperRotationY = new Quaternion();
    #rightSweeperRotationZ = new Quaternion();
    #leftDoorRotationAxis = new Vector3();
    #rightDoorRotationAxis = new Vector3();
    #leftDoorPosition = new Vector3();
    #rightDoorPosition = new Vector3();
    #leftDoorRotation = new Quaternion();
    #rightDoorRotation = new Quaternion();
    #sweepers = {
        parts: null,
        state: SWEEPERS_STATES.IDLE,
        position: SWEEPERS_INITIAL_POSITION,
        rotation: SWEEPERS_INITIAL_ROTATION,
        translation: SWEEPERS_INITIAL_TRANSLATION,
        sweepersRotationZ: SWEEPERS_INITIAL_SWEEPERS_ROTATION_Z,
        sweepersRotationY: SWEEPERS_INITIAL_SWEEPERS_ROTATION_Y,
        doorsRotation: SWEEPERS_INITIAL_DOORS_ROTATION,
        pendingSweeps: 0,
        nextState: null
    };

    constructor({ scene, canActivate }) {
        this.#scene = scene;
        this.#canActivate = canActivate;
    }

    async initialize() {
        const scene = this.#scene;
        const {
            parts,
            leftPivotPosition,
            rightPivotPosition,
            leftDoorPivotPosition,
            rightDoorPivotPosition
        } = await initializeModel({ scene });
        this.#leftPivotPosition = leftPivotPosition;
        this.#rightPivotPosition = rightPivotPosition;
        this.#leftDoorPivotPosition = leftDoorPivotPosition;
        this.#rightDoorPivotPosition = rightDoorPivotPosition;
        initializeColliders({
            scene,
            parts
        });
        parts.forEach(({ body, meshes }) => {
            meshes.forEach(({ data }) => this.#scene.addObject(data));
            body.setEnabled(true);
        });
        Object.assign(this.#sweepers, { parts });
        this.#leftBase = parts.get(LEFT_BASE_PART_NAME);
        this.#rightBase = parts.get(RIGHT_BASE_PART_NAME);
        this.#leftSweeper = parts.get(LEFT_SWEEPER_PART_NAME);
        this.#rightSweeper = parts.get(RIGHT_SWEEPER_PART_NAME);
        this.#leftDoor = parts.get(LEFT_DOOR_PART_NAME);
        this.#rightDoor = parts.get(RIGHT_DOOR_PART_NAME);
    }

    update() {
        updateSweepersState({ sweepers: this.#sweepers, canActivate: () => this.#canActivate(this) });
        const { parts, state } = this.#sweepers;
        if (state !== SWEEPERS_STATES.IDLE) {
            parts.forEach(({ meshes, body }) => {
                meshes.forEach(({ data }) => {
                    data.position.copy(body.translation());
                    data.quaternion.copy(body.rotation());
                });
            });
            this.#leftBasePosition.set(this.#sweepers.position, 0, 0);
            this.#rightBasePosition.set(-this.#sweepers.position, 0, 0);
            this.#leftBaseRotation.setFromAxisAngle(Y_AXIS, -this.#sweepers.rotation);
            this.#rightBaseRotation.setFromAxisAngle(Y_AXIS, this.#sweepers.rotation);
            this.#leftSweeperRotationY.setFromAxisAngle(Y_AXIS, -this.#sweepers.sweepersRotationY);
            this.#leftSweeperRotationZ.setFromAxisAngle(Z_AXIS, this.#sweepers.sweepersRotationZ);
            this.#rightSweeperRotationY.setFromAxisAngle(Y_AXIS, this.#sweepers.sweepersRotationY);
            this.#rightSweeperRotationZ.setFromAxisAngle(Z_AXIS, -this.#sweepers.sweepersRotationZ);
            this.#leftSweeperRotation.setFromAxisAngle(Y_AXIS, -this.#sweepers.rotation)
                .multiply(this.#leftSweeperRotationY)
                .multiply(this.#leftSweeperRotationZ);
            this.#rightSweeperRotation.setFromAxisAngle(Y_AXIS, this.#sweepers.rotation)
                .multiply(this.#rightSweeperRotationY)
                .multiply(this.#rightSweeperRotationZ);
            this.#leftBaseTranslation.set(this.#sweepers.translation, 0, 0)
                .applyQuaternion(this.#leftBaseRotation);
            this.#rightBaseTranslation.set(-this.#sweepers.translation, 0, 0)
                .applyQuaternion(this.#rightBaseRotation);
            this.#leftSweeperPosition.copy(this.#leftBasePosition)
                .sub(this.#leftPivotPosition)
                .applyQuaternion(this.#leftSweeperRotation)
                .add(this.#leftPivotPosition)
                .add(this.#leftBaseTranslation);
            this.#rightSweeperPosition.copy(this.#rightBasePosition)
                .sub(this.#rightPivotPosition)
                .applyQuaternion(this.#rightSweeperRotation)
                .add(this.#rightPivotPosition)
                .add(this.#rightBaseTranslation);
            this.#leftBasePosition
                .sub(this.#leftPivotPosition)
                .applyQuaternion(this.#leftBaseRotation)
                .add(this.#leftPivotPosition)
                .add(this.#leftBaseTranslation);
            this.#rightBasePosition
                .sub(this.#rightPivotPosition)
                .applyQuaternion(this.#rightBaseRotation)
                .add(this.#rightPivotPosition)
                .add(this.#rightBaseTranslation);
            this.#leftDoorRotationAxis.copy(Z_AXIS)
                .applyQuaternion(LEFT_DOOR_INITIAL_ROTATION);
            this.#leftDoorRotation.setFromAxisAngle(this.#leftDoorRotationAxis, this.#sweepers.doorsRotation);
            this.#leftDoorPosition.set(0, 0, 0)
                .sub(this.#leftDoorPivotPosition)
                .applyQuaternion(this.#leftDoorRotation)
                .add(this.#leftDoorPivotPosition);
            this.#rightDoorRotationAxis.copy(Z_AXIS)
                .applyQuaternion(RIGHT_DOOR_INITIAL_ROTATION);
            this.#rightDoorRotation.setFromAxisAngle(this.#rightDoorRotationAxis, -this.#sweepers.doorsRotation);
            this.#rightDoorPosition.set(0, 0, 0)
                .sub(this.#rightDoorPivotPosition)
                .applyQuaternion(this.#rightDoorRotation)
                .add(this.#rightDoorPivotPosition);
            this.#leftBase.body.setNextKinematicTranslation(this.#leftBasePosition);
            this.#rightBase.body.setNextKinematicTranslation(this.#rightBasePosition);
            this.#leftSweeper.body.setNextKinematicTranslation(this.#leftSweeperPosition);
            this.#rightSweeper.body.setNextKinematicTranslation(this.#rightSweeperPosition);
            this.#leftDoor.body.setNextKinematicTranslation(this.#leftDoorPosition);
            this.#rightDoor.body.setNextKinematicTranslation(this.#rightDoorPosition);
            this.#leftBase.body.setNextKinematicRotation(this.#leftBaseRotation);
            this.#rightBase.body.setNextKinematicRotation(this.#rightBaseRotation);
            this.#leftSweeper.body.setNextKinematicRotation(this.#leftSweeperRotation);
            this.#rightSweeper.body.setNextKinematicRotation(this.#rightSweeperRotation);
            this.#leftDoor.body.setNextKinematicRotation(this.#leftDoorRotation);
            this.#rightDoor.body.setNextKinematicRotation(this.#rightDoorRotation);
        }
        if (this.#sweepers.nextState) {
            this.#sweepers.state = this.#sweepers.nextState;
        }
    }

    sweepFloor() {
        if (this.#sweepers.state === SWEEPERS_STATES.IDLE) {
            this.#sweepers.state = SWEEPERS_STATES.ACTIVATING;
        } else {
            this.#sweepers.pendingSweeps++;
        }
    }

    save() {
        const parts = {};
        this.#sweepers.parts.forEach(({ body }, name) => {
            parts[name] = {
                bodyHandle: body.handle
            };
        });
        return {
            state: this.#sweepers.state.description,
            nextState: this.#sweepers.nextState ? this.#sweepers.nextState.description : null,
            parts,
            position: this.#sweepers.position,
            rotation: this.#sweepers.rotation,
            translation: this.#sweepers.translation,
            sweepersRotationZ: this.#sweepers.sweepersRotationZ,
            sweepersRotationY: this.#sweepers.sweepersRotationY,
            doorsRotation: this.#sweepers.doorsRotation,
            pendingSweeps: this.#sweepers.pendingSweeps,
        };
    }

    load(sweepers) {
        this.#sweepers.state = Symbol.for(sweepers.state);
        this.#sweepers.nextState = sweepers.nextState ? Symbol.for(sweepers.nextState) : null;
        this.#sweepers.position = sweepers.position;
        this.#sweepers.rotation = sweepers.rotation;
        this.#sweepers.translation = sweepers.translation;
        this.#sweepers.sweepersRotationZ = sweepers.sweepersRotationZ;
        this.#sweepers.sweepersRotationY = sweepers.sweepersRotationY;
        this.#sweepers.doorsRotation = sweepers.doorsRotation;
        this.#sweepers.pendingSweeps = sweepers.pendingSweeps;
        this.#sweepers.parts.forEach((partData, name) => {
            const loadedPart = sweepers.parts[name];
            if (loadedPart) {
                partData.body = this.#scene.worldBodies.get(loadedPart.bodyHandle);
            }
        });
    }

    get active() {
        return this.#sweepers.state !== SWEEPERS_STATES.IDLE && this.#sweepers.state !== SWEEPERS_STATES.ACTIVATING;
    }
}

function updateSweepersState({ sweepers, canActivate }) {
    sweepers.nextState = null;
    switch (sweepers.state) {
        case SWEEPERS_STATES.IDLE:
            break;
        case SWEEPERS_STATES.ACTIVATING:
            if (canActivate()) {
                sweepers.nextState = SWEEPERS_STATES.OPENING_DOORS;
            }
            break;
        case SWEEPERS_STATES.OPENING_DOORS:
            sweepers.doorsRotation += DOORS_ROTATION_SPEED;
            if (sweepers.doorsRotation > DOORS_OPENED_ANGLE) {
                sweepers.doorsRotation = DOORS_OPENED_ANGLE;
                sweepers.nextState = SWEEPERS_STATES.MOVING_BASE;
            }
            break;
        case SWEEPERS_STATES.MOVING_BASE:
            sweepers.position += BASE_SPEED;
            if (sweepers.position > BASE_POSITION) {
                sweepers.position = BASE_POSITION;
                sweepers.nextState = SWEEPERS_STATES.ROTATING_BASE;
            }
            break;
        case SWEEPERS_STATES.ROTATING_BASE:
            sweepers.rotation += BASE_ROTATION_SPEED;
            if (sweepers.rotation > SWEEPERS_ROTATION) {
                sweepers.rotation = SWEEPERS_ROTATION;
                sweepers.nextState = SWEEPERS_STATES.TRANSLATING_BASE;
            }
            break;
        case SWEEPERS_STATES.TRANSLATING_BASE:
            sweepers.translation += BASE_SPEED;
            if (sweepers.translation > BASE_TRANSLATION) {
                sweepers.translation = BASE_TRANSLATION;
                sweepers.nextState = SWEEPERS_STATES.ROTATING_SWEEPERS;
            }
            break;
        case SWEEPERS_STATES.ROTATING_SWEEPERS:
            sweepers.sweepersRotationZ += SWEEPERS_AXIS_ROTATION_SPEED;
            if (sweepers.sweepersRotationZ > SWEEPING_AXIS_ANGLE) {
                sweepers.sweepersRotationZ = SWEEPING_AXIS_ANGLE;
                sweepers.nextState = SWEEPERS_STATES.SWEEPING;
            }
            break;
        case SWEEPERS_STATES.SWEEPING:
            sweepers.sweepersRotationY += SWEEPING_SPEED;
            if (sweepers.sweepersRotationY > SWEEPING_MAX_ANGLE) {
                sweepers.sweepersRotationY = SWEEPING_MAX_ANGLE;
                sweepers.nextState = SWEEPERS_STATES.ROTATING_SWEEPERS_BACK;
            }
            break;
        case SWEEPERS_STATES.ROTATING_SWEEPERS_BACK:
            sweepers.sweepersRotationZ -= SWEEPERS_AXIS_ROTATION_SPEED;
            if (sweepers.sweepersRotationZ < 0) {
                sweepers.sweepersRotationZ = 0;
                sweepers.nextState = SWEEPERS_STATES.SWEEPING_BACK;
            }
            break;
        case SWEEPERS_STATES.SWEEPING_BACK:
            sweepers.sweepersRotationY -= SWEEPING_SPEED * 1.5;
            if (sweepers.sweepersRotationY < SWEEPERS_INITIAL_SWEEPERS_ROTATION_Y) {
                sweepers.sweepersRotationY = SWEEPERS_INITIAL_SWEEPERS_ROTATION_Y;
                if (sweepers.pendingSweeps > 0) {
                    sweepers.pendingSweeps--;
                    sweepers.nextState = SWEEPERS_STATES.OPENING_DOORS;
                } else {
                    sweepers.nextState = SWEEPERS_STATES.TRANSLATING_BASE_BACK;
                }
            }
            break;
        case SWEEPERS_STATES.TRANSLATING_BASE_BACK:
            sweepers.translation -= BASE_SPEED;
            if (sweepers.translation < SWEEPERS_INITIAL_TRANSLATION) {
                sweepers.translation = SWEEPERS_INITIAL_TRANSLATION;
                sweepers.nextState = SWEEPERS_STATES.ROTATING_BASE_BACK;
            }
            break;
        case SWEEPERS_STATES.ROTATING_BASE_BACK:
            sweepers.rotation -= BASE_ROTATION_SPEED;
            if (sweepers.rotation < SWEEPERS_INITIAL_ROTATION) {
                sweepers.rotation = SWEEPERS_INITIAL_ROTATION;
                sweepers.nextState = SWEEPERS_STATES.MOVING_BASE_BACK;
            }
            break;
        case SWEEPERS_STATES.MOVING_BASE_BACK:
            sweepers.position -= BASE_SPEED;
            if (sweepers.position < SWEEPERS_INITIAL_POSITION) {
                sweepers.position = SWEEPERS_INITIAL_POSITION;
                sweepers.nextState = SWEEPERS_STATES.CLOSING_DOORS;
            }
            break;
        case SWEEPERS_STATES.CLOSING_DOORS:
            sweepers.doorsRotation -= DOORS_ROTATION_SPEED;
            if (sweepers.doorsRotation < SWEEPERS_INITIAL_DOORS_ROTATION) {
                sweepers.doorsRotation = SWEEPERS_INITIAL_DOORS_ROTATION;
                sweepers.nextState = SWEEPERS_STATES.IDLE;
            }
            break;
        default:
            break;
    }
}

async function initializeModel({ scene }) {
    const model = await scene.loadModel(MODEL_PATH);
    const mesh = model.scene;
    const parts = new Map();
    const leftPivotPosition = new Vector3();
    const rightPivotPosition = new Vector3();
    const leftDoorPivotPosition = new Vector3();
    const rightDoorPivotPosition = new Vector3();
    mesh.traverse((child) => {
        if (child.isMesh) {
            const { material, geometry } = child;
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
                partData.kinematic = userData.kinematic;
                partData.cuboid = userData.cuboid;
                partData.meshes.push({
                    data: child,
                    vertices,
                    indices
                });
            } else {
                const partData = getPart(parts, child.name);
                partData.meshes.push({
                    data: child
                });
            }
        } else if (child.name == LEFT_PIVOT_POSITION) {
            leftPivotPosition.copy(child.position);
        } else if (child.name == RIGHT_PIVOT_POSITION) {
            rightPivotPosition.copy(child.position);
        } else if (child.name == LEFT_DOOR_PIVOT_POSITION) {
            leftDoorPivotPosition.copy(child.position);
        } else if (child.name == RIGHT_DOOR_PIVOT_POSITION) {
            rightDoorPivotPosition.copy(child.position);
        }
    });
    return {
        parts,
        leftPivotPosition,
        rightPivotPosition,
        leftDoorPivotPosition,
        rightDoorPivotPosition
    };
};

function getPart(parts, name) {
    let partData;
    if (!parts.has(name)) {
        partData = { meshes: [], colliders: [] };
        parts.set(name, partData);
    } else {
        partData = parts.get(name);
    }
    return partData;
}

function initializeColliders({ scene, parts }) {
    let indexPart = 0;
    parts.forEach(partData => {
        const { meshes, friction, restitution, kinematic, cuboid } = partData;
        const body = partData.body = kinematic ? scene.createKinematicBody() : scene.createFixedBody();
        body.setEnabled(false);
        if (cuboid) {
            const boundingBox = meshes[0].data.geometry.boundingBox;
            const position = new Vector3().addVectors(boundingBox.min, boundingBox.max).multiplyScalar(0.5).toArray();
            const colliderSize = new Vector3(boundingBox.max.x - boundingBox.min.x, boundingBox.max.y - boundingBox.min.y, boundingBox.max.z - boundingBox.min.z);
            let collider;
            if (cuboid) {
                collider = scene.createCuboidCollider({
                    position,
                    width: colliderSize.x,
                    height: colliderSize.y,
                    depth: colliderSize.z,
                    friction,
                    restitution,
                }, body);
            }
            collider.setCollisionGroups((1 << (indexPart % 16)) << 16 | (1 << (indexPart % 16)));
            indexPart++;
        } else {
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
            if (vertices.length > 0) {
                const collider = scene.createTrimeshCollider({
                    vertices,
                    indices,
                    friction,
                    restitution
                }, body);
                collider.setCollisionGroups((1 << (indexPart % 16)) << 16 | (1 << (indexPart % 16)));
                indexPart++;
            }
        }
    });
}