import { Quaternion, Vector3, SpotLight } from "three";

const MODEL_PATH = "./assets/excavator.glb";
const X_AXIS = new Vector3(1, 0, 0);
const Y_AXIS = new Vector3(0, 1, 0);
const BEACON_LIGHT_BULB_NAME = "beacon-light-bulb";
const BEACON_LIGHT_MIRROR_NAME = "beacon-light-mirror";
const PLATFORM = "rotating-platform";
const ARM_PLATFORM = "arm-rotating-platform";
const ARM_JAWS = "arm-jaws";
const DROP_POSITION = "drop-position";
const BEACON_LIGHT_POSITION = "beacon-light-position";
const PIVOT_ARM_PLATFORM = "pivot-arm-rotating-platform";
const PIVOT_PLATFORM = "pivot-rotating-platform";
const PIVOT_ARMS = "pivot-arms";
const JOINT_JAWS = "joint-jaws";
const JOINT_JAW_1 = "joint-jaw-1";
const JOINT_JAW_2 = "joint-jaw-2";
const JOINT_JAW_3 = "joint-jaw-3";
const JOINT_JAW_4 = "joint-jaw-4";
const MOTOR_STIFFNESS = 50000;
const MOTOR_DAMPING = 20000;
const SENSOR_HEIGHT = 0.1;
const BEACON_LIGHT_ANGLE = Math.PI / 3;
const BEACON_LIGHT_DISTANCE = 0.2;
const BEACON_LIGHT_INTENSITY_ON = 1.5;
const BEACON_LIGHT_COLOR = 0xffbfa1;
const BEACON_LIGHT_PENUMBRA = 0.5;
const BEACON_LIGHT_DECAY = 0.1;
const BEACON_LIGHT_INTENSITY_OFF = 0;
const BEACON_LIGHT_BULB_INTENSITY_ON = 10;
const BEACON_LIGHT_OPACITY_OFF = 0.3;
const BEACON_LIGHT_OPACITY_ON = 1;
const BEACON_LIGHT_ROTATION_SPEED = 0.1;
const PLATFORM_ROTATION_SPEED = 0.01;
const PLATFORM_ARM_ROTATION_SPEED = 0.014;
const JAWS_ARM_ROTATION_SPEED = 0.01925;
const JAWS_ARM_ROTATION_SLOW_SPEED = 0.008;

const EXCAVATOR_STATES = {
    IDLE: Symbol.for("excavator-idle"),
    ACTIVATING: Symbol.for("excavator-activating"),
    INITIALIZING_OPENING_JAWS: Symbol.for("excavator-initializing-opening-jaws"),
    OPENING_JAWS: Symbol.for("excavator-opening-jaws"),
    MOVING_DOWN: Symbol.for("excavator-moving-down"),
    INITIALIZING_CLOSING_JAWS: Symbol.for("excavator-initializing-closing-jaws"),
    CLOSING_JAWS: Symbol.for("excavator-closing-jaws"),
    PICKING: Symbol.for("excavator-picking"),
    MOVING_UP: Symbol.for("excavator-moving-up"),
    MOVING_TO_DROP_ZONE: Symbol.for("excavator-moving-to-drop-zone"),
    EXTENDING_ARMS: Symbol.for("excavator-extending-arms"),
    INITIALIZING_DROPPING: Symbol.for("excavator-initializing-dropping"),
    DROPPING: Symbol.for("excavator-dropping"),
    CLOSING_JAWS_AFTER_DROPPING: Symbol.for("excavator-closing-jaws-after-dropping"),
    RETRACTING_ARMS: Symbol.for("excavator-retracting-arms"),
    MOVING_TO_BASE: Symbol.for("excavator-moving-to-base"),
    WAITING_FOR_IDLE: Symbol.for("excavator-waiting-for-idle"),
    INITIALIZING_PREPARING_IDLE: Symbol.for("excavator-initializing-preparing-idle"),
    PREPARING_IDLE: Symbol.for("excavator-preparing-idle")
};

export default class {

    #scene;
    #cabinet;
    #onPick;
    #groups;
    #dropPosition;
    #beaconLight;
    #beaconLightPosition;
    #trapSensor;
    #pivots;
    #platformPosition = new Vector3(0, 0, 0);
    #platformRotationY = new Quaternion(0, 0, 0, 1);
    #platformArmPosition = new Vector3(0, 0, 0);
    #platformArmRotation = new Quaternion(0, 0, 0, 1);
    #platformArmRotationX = new Quaternion(0, 0, 0, 1);
    #jawsArmPosition = new Vector3(0, 0, 0);
    #jawsArmRotation = new Quaternion(0, 0, 0, 1);
    #jawsArmRotationX = new Quaternion(0, 0, 0, 1);
    #beaconLightMirrorPosition = new Vector3(0, 0, 0);
    #beaconLightMirrorRotation = new Quaternion(0, 0, 0, 1);
    #excavator = {
        state: EXCAVATOR_STATES.IDLE,
        pendingPicks: 0,
        beaconLightAngle: 0,
        platformAngle: 0,
        platformArmAngle: 0,
        jawsArmAngle: 0,
        framePicking: -1,
        frameReady: -1,
    };

    constructor({ scene, cabinet, onPick, groups }) {
        this.#scene = scene;
        this.#cabinet = cabinet;
        this.#onPick = onPick;
        this.#groups = groups;
    }

    async initialize() {
        const scene = this.#scene;
        const {
            parts,
            joints,
            pivots,
            dropPosition,
            beaconLightPosition
        } = await initializeModel({ scene });
        this.#dropPosition = dropPosition;
        this.#beaconLightPosition = beaconLightPosition;
        const { trapSensor } = initializeColliders({
            scene,
            cabinet: this.#cabinet,
            parts,
            joints,
            trapSensor: this.#trapSensor,
            groups: this.#groups
        });
        this.#trapSensor = trapSensor;
        this.#pivots = pivots;
        parts.forEach(({ body, meshes }) => {
            meshes.forEach(({ data }) => this.#scene.addObject(data));
            body.setEnabled(true);
        });
        parts.get(PLATFORM).body.setEnabledRotations(false, false, false);
        Object.assign(this.#excavator, { parts, joints });
        this.#jawsJoint.joint.configureMotor(0, 0, 1, 50);
        this.#beaconLight = new SpotLight(
            BEACON_LIGHT_COLOR,
            BEACON_LIGHT_INTENSITY_OFF,
            BEACON_LIGHT_DISTANCE,
            BEACON_LIGHT_ANGLE,
            BEACON_LIGHT_PENUMBRA,
            BEACON_LIGHT_DECAY);
        this.#beaconLight.position.copy(this.#beaconLightPosition);
        this.#scene.addObject(this.#beaconLight);
        this.#scene.addObject(this.#beaconLight.target);
    }

    update() {
        if (this.#excavator.nextState) {
            this.#excavator.state = this.#excavator.nextState;
            this.#excavator.nextState = null;
        }
        updateExcavatorState({
            excavator: this.#excavator,
            canActivate: () => this.#cabinet.canActivate(this)
        });
        const { state } = this.#excavator;
        if (state !== EXCAVATOR_STATES.IDLE) {
            if (state === EXCAVATOR_STATES.PICKING) {
                this.#onPick(this.#dropPosition);
            }
        }
    }

    refresh() {
        const { state, parts } = this.#excavator;
        const lightBulbMaterial = this.#beaconLightBulb.meshes[0].data.material;
        parts.forEach(({ meshes, body }) => meshes.forEach(({ data }) => {
            data.position.copy(body.translation());
            data.quaternion.copy(body.rotation());
        }));
        if (state !== EXCAVATOR_STATES.IDLE) {
            this.#platformRotationY.setFromAxisAngle(Y_AXIS, -this.#excavator.platformAngle);
            this.#platformPosition.set(0, 0, 0)
                .sub(this.#platformPivot)
                .applyQuaternion(this.#platformRotationY)
                .add(this.#platformPivot);
            this.#platformArmRotationX.setFromAxisAngle(X_AXIS, this.#excavator.platformArmAngle);
            this.#platformArmRotation
                .copy(this.#platformRotationY)
                .multiply(this.#platformArmRotationX);
            this.#platformArmPosition.set(0, 0, 0)
                .sub(this.#platformArmPivot)
                .applyQuaternion(this.#platformArmRotation)
                .add(this.#platformArmPivot);
            this.#jawsArmRotationX.setFromAxisAngle(X_AXIS, this.#excavator.jawsArmAngle);
            this.#jawsArmRotation
                .copy(this.#platformArmRotation)
                .multiply(this.#jawsArmRotationX);
            this.#jawsArmPosition.set(0, 0, 0)
                .sub(this.#jawsArmPivot)
                .applyQuaternion(this.#jawsArmRotationX)
                .add(this.#jawsArmPivot)
                .sub(this.#platformArmPivot)
                .applyQuaternion(this.#platformArmRotation)
                .add(this.#platformArmPivot);
            lightBulbMaterial.emissiveIntensity = BEACON_LIGHT_BULB_INTENSITY_ON;
            lightBulbMaterial.opacity = BEACON_LIGHT_OPACITY_ON;
            this.#beaconLight.intensity = BEACON_LIGHT_INTENSITY_ON;
            this.#beaconLightMirrorRotation.setFromAxisAngle(Y_AXIS, this.#excavator.beaconLightAngle);
            this.#beaconLightMirrorPosition.set(0, 0, 0)
                .sub(this.#beaconLightPosition)
                .applyQuaternion(this.#beaconLightMirrorRotation)
                .add(this.#beaconLightPosition);
            this.#platform.body.setNextKinematicTranslation(this.#platformPosition);
            this.#platform.body.setNextKinematicRotation(this.#platformRotationY);
            this.#platformArm.body.setNextKinematicTranslation(this.#platformArmPosition);
            this.#platformArm.body.setNextKinematicRotation(this.#platformArmRotation);
            this.#jawsArm.body.setNextKinematicTranslation(this.#jawsArmPosition);
            this.#jawsArm.body.setNextKinematicRotation(this.#jawsArmRotation);
            this.#beaconLightMirror.body.setNextKinematicTranslation(this.#beaconLightMirrorPosition);
            this.#beaconLightMirror.body.setNextKinematicRotation(this.#beaconLightMirrorRotation);
            this.#beaconLight.target.position.set(
                this.#beaconLight.position.x + Math.sin(this.#excavator.beaconLightAngle),
                this.#beaconLight.position.y,
                this.#beaconLight.position.z + Math.cos(this.#excavator.beaconLightAngle)
            );
            if (this.#excavator.state == EXCAVATOR_STATES.INITIALIZING_OPENING_JAWS ||
                this.#excavator.state == EXCAVATOR_STATES.INITIALIZING_DROPPING
            ) {
                this.#jaw1Joint.joint.configureMotor(-.5, -2.5, MOTOR_STIFFNESS, MOTOR_DAMPING);
                this.#jaw2Joint.joint.configureMotor(.5, 2.5, MOTOR_STIFFNESS, MOTOR_DAMPING);
                this.#jaw3Joint.joint.configureMotor(-.5, -2.5, MOTOR_STIFFNESS, MOTOR_DAMPING);
                this.#jaw4Joint.joint.configureMotor(.5, 2.5, MOTOR_STIFFNESS, MOTOR_DAMPING);
            }
            if (this.#excavator.state == EXCAVATOR_STATES.INITIALIZING_CLOSING_JAWS ||
                this.#excavator.state == EXCAVATOR_STATES.INITIALIZING_PREPARING_IDLE) {
                this.#jaw1Joint.joint.configureMotor(0, 2.5, MOTOR_STIFFNESS, MOTOR_DAMPING);
                this.#jaw2Joint.joint.configureMotor(0, -2.5, MOTOR_STIFFNESS, MOTOR_DAMPING);
                this.#jaw3Joint.joint.configureMotor(0, 2.5, MOTOR_STIFFNESS, MOTOR_DAMPING);
                this.#jaw4Joint.joint.configureMotor(0, -2.5, MOTOR_STIFFNESS, MOTOR_DAMPING);
            }
        } else {
            lightBulbMaterial.emissiveIntensity = BEACON_LIGHT_INTENSITY_OFF;
            lightBulbMaterial.opacity = BEACON_LIGHT_OPACITY_OFF;
            this.#beaconLight.intensity = BEACON_LIGHT_INTENSITY_OFF;
        }
    }

    sensorColliders() {
        return [this.#trapSensor];
    }

    save() {
        const joints = {};
        const parts = {};
        this.#excavator.joints.forEach((jointData, name) => {
            joints[name] = {
                jointHandle: jointData.joint.handle
            };
        });
        this.#excavator.parts.forEach((partData, name) => {
            const { body } = partData;
            parts[name] = {
                bodyHandle: body.handle
            };
        });
        return {
            state: this.#excavator.state.description,
            nextState: this.#excavator.nextState ? this.#excavator.nextState.description : null,
            pendingPicks: this.#excavator.pendingPicks,
            beaconLightAngle: this.#excavator.beaconLightAngle,
            platformAngle: this.#excavator.platformAngle,
            platformArmAngle: this.#excavator.platformArmAngle,
            jawsArmAngle: this.#excavator.jawsArmAngle,
            framePicking: this.#excavator.framePicking,
            frameReady: this.#excavator.frameReady,
            joints,
            parts,
            trapSensorHandle: this.#trapSensor.handle
        };
    }

    load(excavator) {
        this.#excavator.parts.forEach(partData => {
            partData.meshes.forEach(({ data }) => {
                data.traverse((child) => {
                    if (child.isMesh) {
                        const userData = child.material.userData;
                        const objectType = child.material.name;
                        if (userData.sensor) {
                            const colliderHandle = excavator.trapSensorHandle;
                            const collider = this.#scene.worldColliders.get(colliderHandle);
                            collider.userData = {
                                objectType,
                                onIntersect: userData => this.#cabinet.recycleObject(userData)
                            };
                            this.#trapSensor = collider;
                        }
                    }
                });
            });
        });
        this.#excavator.state = Symbol.for(excavator.state);
        this.#excavator.nextState = excavator.nextState ? Symbol.for(excavator.nextState) : null;
        this.#excavator.pendingPicks = excavator.pendingPicks;
        this.#excavator.beaconLightAngle = excavator.beaconLightAngle;
        this.#excavator.platformAngle = excavator.platformAngle;
        this.#excavator.platformArmAngle = excavator.platformArmAngle;
        this.#excavator.jawsArmAngle = excavator.jawsArmAngle;
        this.#excavator.framePicking = excavator.framePicking;
        this.#excavator.frameReady = excavator.frameReady;
        this.#excavator.joints.forEach((jointData, name) => {
            const loadedJoint = excavator.joints[name];
            if (loadedJoint) {
                jointData.joint = this.#scene.worldJoints.get(loadedJoint.jointHandle);
                jointData.params.body1 = jointData.joint.body1();
                jointData.params.body2 = jointData.joint.body2();
            }
        });
        this.#excavator.parts.forEach((partData, name) => {
            const loadedPart = excavator.parts[name];
            if (loadedPart) {
                partData.body = this.#scene.worldBodies.get(loadedPart.bodyHandle);
            }
        });
    }

    get active() {
        return this.#excavator.state !== EXCAVATOR_STATES.IDLE &&
            this.#excavator.state !== EXCAVATOR_STATES.ACTIVATING &&
            this.#excavator.state !== EXCAVATOR_STATES.MOVING_TO_BASE &&
            this.#excavator.state !== EXCAVATOR_STATES.CLOSING_JAWS_AFTER_DROPPING &&
            this.#excavator.state !== EXCAVATOR_STATES.INITIALIZING_PREPARING_IDLE &&
            this.#excavator.state !== EXCAVATOR_STATES.PREPARING_IDLE;
    }

    pick() {
        if (this.#excavator.state === EXCAVATOR_STATES.IDLE) {
            this.#excavator.state = EXCAVATOR_STATES.ACTIVATING;
        } else {
            this.#excavator.pendingPicks++;
        }
    }

    get joints() {
        const joints = [];
        this.#excavator.joints.forEach(jointData => {
            const { joint, params } = jointData;
            joints.push({ joint, jointData: params });
        });
        return joints;
    }

    get #platformPivot() {
        return this.#pivots.get(PIVOT_PLATFORM);
    }

    get #platformArmPivot() {
        return this.#pivots.get(PIVOT_ARM_PLATFORM);
    }

    get #jawsArmPivot() {
        return this.#pivots.get(PIVOT_ARMS);
    }

    get #jawsJoint() {
        return this.#excavator.joints.get(JOINT_JAWS);
    }

    get #jaw1Joint() {
        return this.#excavator.joints.get(JOINT_JAW_1);
    }

    get #jaw2Joint() {
        return this.#excavator.joints.get(JOINT_JAW_2);
    }

    get #jaw3Joint() {
        return this.#excavator.joints.get(JOINT_JAW_3);
    }

    get #jaw4Joint() {
        return this.#excavator.joints.get(JOINT_JAW_4);
    }

    get #platform() {
        return this.#excavator.parts.get(PLATFORM);
    }

    get #platformArm() {
        return this.#excavator.parts.get(ARM_PLATFORM);
    }

    get #jawsArm() {
        return this.#excavator.parts.get(ARM_JAWS);
    }

    get #beaconLightBulb() {
        return this.#excavator.parts.get(BEACON_LIGHT_BULB_NAME);
    }

    get #beaconLightMirror() {
        return this.#excavator.parts.get(BEACON_LIGHT_MIRROR_NAME);
    }
}

function updateExcavatorState({ excavator, canActivate }) {
    switch (excavator.state) {
        case EXCAVATOR_STATES.IDLE:
            break;
        case EXCAVATOR_STATES.ACTIVATING:
            if (canActivate()) {
                excavator.state = excavator.nextState = EXCAVATOR_STATES.INITIALIZING_OPENING_JAWS;
            }
            break;
        case EXCAVATOR_STATES.INITIALIZING_OPENING_JAWS:
            excavator.nextState = EXCAVATOR_STATES.OPENING_JAWS;
            break;
        case EXCAVATOR_STATES.OPENING_JAWS:
            excavator.nextState = EXCAVATOR_STATES.MOVING_DOWN;
            break;
        case EXCAVATOR_STATES.MOVING_DOWN:
            excavator.platformArmAngle -= PLATFORM_ARM_ROTATION_SPEED;
            excavator.jawsArmAngle += JAWS_ARM_ROTATION_SLOW_SPEED;
            if (excavator.platformArmAngle < -.7) {
                excavator.platformArmAngle = -.7;
            }
            if (excavator.jawsArmAngle > .4) {
                excavator.jawsArmAngle = .4;
            }
            if (excavator.platformArmAngle == -.7 && excavator.jawsArmAngle == .4) {
                excavator.nextState = EXCAVATOR_STATES.INITIALIZING_CLOSING_JAWS;
            }
            break;
        case EXCAVATOR_STATES.INITIALIZING_CLOSING_JAWS:
            excavator.framePicking = 0;
            excavator.nextState = EXCAVATOR_STATES.CLOSING_JAWS;
            break;
        case EXCAVATOR_STATES.CLOSING_JAWS:
            excavator.framePicking++;
            if (excavator.framePicking > 30) {
                excavator.framePicking = -1;
                excavator.nextState = EXCAVATOR_STATES.PICKING;
            }
            break;
        case EXCAVATOR_STATES.PICKING:
            excavator.nextState = EXCAVATOR_STATES.MOVING_UP;
            break;
        case EXCAVATOR_STATES.MOVING_UP:
            excavator.platformArmAngle += PLATFORM_ARM_ROTATION_SPEED;
            excavator.jawsArmAngle -= JAWS_ARM_ROTATION_SLOW_SPEED;
            if (excavator.platformArmAngle > .5) {
                excavator.platformArmAngle = 0.5;
            }
            if (excavator.jawsArmAngle < -.2) {
                excavator.jawsArmAngle = -.2;
            }
            if (excavator.platformArmAngle == 0.5 && excavator.jawsArmAngle == -.2) {
                excavator.nextState = EXCAVATOR_STATES.MOVING_TO_DROP_ZONE;
            }
            break;
        case EXCAVATOR_STATES.MOVING_TO_DROP_ZONE:
            excavator.platformAngle -= PLATFORM_ROTATION_SPEED;
            if (excavator.platformAngle < -2) {
                excavator.platformAngle = -2;
                excavator.nextState = EXCAVATOR_STATES.EXTENDING_ARMS;
            }
            break;
        case EXCAVATOR_STATES.EXTENDING_ARMS:
            excavator.platformArmAngle -= PLATFORM_ARM_ROTATION_SPEED;
            excavator.jawsArmAngle += JAWS_ARM_ROTATION_SPEED;
            if (excavator.platformArmAngle < -.3) {
                excavator.platformArmAngle = -.3;
            }
            if (excavator.jawsArmAngle > .9) {
                excavator.jawsArmAngle = .9;
            }
            if (excavator.platformArmAngle == -.3 && excavator.jawsArmAngle == .9) {
                excavator.nextState = EXCAVATOR_STATES.INITIALIZING_DROPPING;

            }
            break;
        case EXCAVATOR_STATES.INITIALIZING_DROPPING:
            excavator.nextState = EXCAVATOR_STATES.DROPPING;
            break;
        case EXCAVATOR_STATES.DROPPING:
            excavator.nextState = EXCAVATOR_STATES.RETRACTING_ARMS;
            break;
        case EXCAVATOR_STATES.RETRACTING_ARMS:
            excavator.platformArmAngle += PLATFORM_ARM_ROTATION_SPEED;
            excavator.jawsArmAngle -= JAWS_ARM_ROTATION_SPEED;
            if (excavator.platformArmAngle > 0.5) {
                excavator.platformArmAngle = 0.5;
            }
            if (excavator.jawsArmAngle < -.2) {
                excavator.jawsArmAngle = -.2;
            }
            if (excavator.platformArmAngle == 0.5 && excavator.jawsArmAngle == -.2) {
                excavator.nextState = EXCAVATOR_STATES.MOVING_TO_BASE;
            }
            break;
        case EXCAVATOR_STATES.MOVING_TO_BASE:
            excavator.platformAngle += PLATFORM_ROTATION_SPEED;
            if (excavator.platformAngle > 0) {
                excavator.platformAngle = 0;
                excavator.nextState = EXCAVATOR_STATES.CLOSING_JAWS_AFTER_DROPPING;
            }
            break;
        case EXCAVATOR_STATES.CLOSING_JAWS_AFTER_DROPPING:
            excavator.platformArmAngle -= PLATFORM_ARM_ROTATION_SPEED;
            excavator.jawsArmAngle += JAWS_ARM_ROTATION_SPEED;
            if (excavator.platformArmAngle < 0) {
                excavator.platformArmAngle = 0;
            }
            if (excavator.jawsArmAngle > 0) {
                excavator.jawsArmAngle = 0;
            }
            if (excavator.platformArmAngle == 0 && excavator.jawsArmAngle == 0) {
                excavator.frameReady = 0;
                excavator.nextState = EXCAVATOR_STATES.WAITING_FOR_IDLE;
            }
            break;
        case EXCAVATOR_STATES.WAITING_FOR_IDLE:
            if (excavator.frameReady > -1) {
                excavator.frameReady++;
            }
            if (excavator.frameReady > 90 || excavator.frameReady === -1) {
                excavator.frameReady = -1;
                if (excavator.pendingPicks > 0) {
                    excavator.pendingPicks--;
                    excavator.nextState = EXCAVATOR_STATES.ACTIVATING;
                } else if (excavator.beaconLightAngle > 0 && excavator.beaconLightAngle < BEACON_LIGHT_ROTATION_SPEED) {
                    excavator.beaconLightAngle = 0;
                    excavator.nextState = EXCAVATOR_STATES.INITIALIZING_PREPARING_IDLE;
                }
            }
            break;
        case EXCAVATOR_STATES.INITIALIZING_PREPARING_IDLE:
            excavator.nextState = EXCAVATOR_STATES.PREPARING_IDLE;
            break;
        case EXCAVATOR_STATES.PREPARING_IDLE:
            if (excavator.pendingPicks > 0) {
                excavator.pendingPicks--;
                excavator.nextState = EXCAVATOR_STATES.ACTIVATING;
            } else {
                excavator.nextState = EXCAVATOR_STATES.IDLE;
            }
            break;
        default:
    }
    if (excavator.state !== EXCAVATOR_STATES.IDLE && excavator.state !== EXCAVATOR_STATES.PREPARING_IDLE) {
        excavator.beaconLightAngle = (excavator.beaconLightAngle + BEACON_LIGHT_ROTATION_SPEED) % (2 * Math.PI);
    }
}

async function initializeModel({ scene }) {
    const model = await scene.loadModel(MODEL_PATH);
    const mesh = model.scene;
    const parts = new Map();
    const joints = new Map();
    const pivots = new Map();
    const dropPosition = new Vector3();
    const beaconLightPosition = new Vector3();
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
                partData.fixed = userData.fixed;
                partData.kinematic = userData.kinematic;
                partData.cylinder = userData.cylinder;
                partData.cuboid = userData.cuboid;
                partData.contactSkin = userData.contactSkin;
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
                partData.light = userData.light;
            }
        } else if (child.userData.joint) {
            const { userData, position } = child;
            joints.set(child.name, {
                position,
                axis: userData.axis === undefined ? undefined : new Vector3().fromArray(userData.axis),
                pair: [userData["name-1"], userData["name-2"]],
                limits: userData.limits
            });
        } else if (child.userData.pivot) {
            const { position } = child;
            pivots.set(child.name, position);
        } else if (child.name == DROP_POSITION) {
            dropPosition.copy(child.position);
        } else if (child.name === BEACON_LIGHT_POSITION) {
            beaconLightPosition.copy(child.position);
        }
    });
    return {
        parts,
        joints,
        pivots,
        dropPosition,
        beaconLightPosition
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

function initializeColliders({ scene, cabinet, parts, joints, groups }) {
    let trapSensor;
    parts.forEach((partData, name) => {
        const { meshes, sensor, friction, restitution, fixed, cylinder, cuboid, kinematic, light, contactSkin } = partData;
        const body = partData.body = fixed ? scene.createFixedBody() : kinematic ? scene.createKinematicBody() : scene.createDynamicBody();
        body.setEnabled(false);
        if (cylinder || cuboid) {
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
            } else if (cylinder) {
                collider = scene.createCylinderCollider({
                    position,
                    radius: colliderSize.x / 2,
                    height: colliderSize.y,
                    friction,
                    restitution
                }, body);
            }
            collider.setContactSkin(contactSkin);
            collider.setCollisionGroups(groups.EXCAVATOR | groups.OBJECTS);
        } else {
            const geometries = [];
            meshes.forEach(meshData => {
                if (!light) {
                    if (sensor) {
                        trapSensor = scene.createCuboidColliderFromBoundingBox({
                            mesh: meshData.data,
                            height: SENSOR_HEIGHT,
                            userData: {
                                objectType: name,
                                onIntersect: userData => cabinet.recycleObject(userData)
                            },
                            sensor
                        }, body);
                    } else if (meshData.geometry) {
                        geometries.push(meshData.geometry);
                    }
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
                collider.setContactSkin(contactSkin);
                collider.setCollisionGroups(groups.EXCAVATOR | groups.OBJECTS);
            }
        }
    });
    const defaultRotation = new Quaternion();
    joints.forEach(jointData => {
        const { position, axis, pair, limits } = jointData;
        jointData.params = {
            body1: parts.get(pair[0]).body,
            body2: parts.get(pair[1]).body,
            anchor1: position,
            anchor2: position,
            axis: axis
        };
        if (axis === undefined) {
            Object.assign(jointData.params, { frame1: defaultRotation, frame2: defaultRotation });
            jointData.joint = scene.connectBodiesWithFixedJoint(jointData.params);
        } else {
            Object.assign(jointData.params, { axis });
            jointData.joint = scene.connectBodiesWithRevoluteJoint(jointData.params);
            jointData.joint.setLimits(...limits);
        }
    });
    return { trapSensor };
}