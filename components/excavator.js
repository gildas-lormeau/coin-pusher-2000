import { Quaternion, Vector3 } from "three";

const MODEL_PATH = "./../assets/excavator.glb";
const RESTITUTION = 0;
const BASE_PART_NAME = "base";
const PLATFORM = "rotating-platform";
const DROP_POSITION = "drop-position";
const JOINT_PLATFORM = "joint-rotating-platform";
const JOINT_ARM_PLATFORM = "joint-arm-rotating-platform";
const JOINT_ARMS = "joint-arms";
const JOINT_JAWS = "joint-jaws";
const JOINT_JAW_1 = "joint-jaw-1";
const JOINT_JAW_2 = "joint-jaw-2";
const JOINT_JAW_3 = "joint-jaw-3";
const JOINT_JAW_4 = "joint-jaw-4";
const DELAY_PICK_WAIT = 1000;
const DELAY_DROP_WAIT = 750;
const MOTOR_STIFFNESS = 50000;
const MOTOR_DAMPING = 20000;
const MAX_DELAY_MOVING_UP = 3500;
const MIN_DELAY_MOVING_UP = 1500;
const MIN_POSITION_Y = 0.015;

const EXCAVATOR_STATES = {
    IDLE: Symbol.for("excavator-idle"),
    ACTIVATING: Symbol.for("excavator-activating"),
    OPENING_JAWS: Symbol.for("excavator-opening-jaws"),
    MOVING_DOWN: Symbol.for("excavator-moving-down"),
    CLOSING_JAWS: Symbol.for("excavator-closing-jaws"),
    PICKING: Symbol.for("excavator-picking"),
    MOVING_UP: Symbol.for("excavator-moving-up"),
    MOVING_TO_DROP_ZONE: Symbol.for("excavator-moving-to-drop-zone"),
    EXTENDING_ARMS: Symbol.for("excavator-extending-arms"),
    DROPPING: Symbol.for("excavator-dropping"),
    CLOSING_JAWS_AFTER_DROPPING: Symbol.for("excavator-closing-jaws-after-dropping"),
    RETRACTING_ARMS: Symbol.for("excavator-retracting-arms"),
    MOVING_TO_BASE: Symbol.for("excavator-moving-to-base"),
    PREPARING_IDLE: Symbol.for("excavator-preparing-idle")
};

export default class {

    #scene;
    #onPick;
    #onRecycleObject;
    #onGetObject;
    #dropPosition;
    #excavator = {
        state: EXCAVATOR_STATES.IDLE,
        pickedObjects: [],
        pendingPicks: 0,
        timePick: -1,
        timeDrop: -1,
        timeMovingUp: -1,
        delayMovingUp: -1
    };

    constructor({ scene, onPick, onGetObject, onRecycleObject }) {
        this.#scene = scene;
        this.#onPick = onPick;
        this.#onGetObject = onGetObject;
        this.#onRecycleObject = onRecycleObject;
    }

    async initialize() {
        const scene = this.#scene;
        const { parts, joints, dropPosition } = await initializeModel({
            scene
        });
        this.#dropPosition = dropPosition;
        initializeColliders({
            scene,
            parts,
            joints,
            onRecycleObject: this.#onRecycleObject
        });
        parts.forEach(({ body, meshes }) => {
            meshes.forEach(({ data }) => this.#scene.addObject(data));
            body.setEnabled(true);
        });
        parts.get(PLATFORM).body.setEnabledRotations(false, false, false);
        Object.assign(this.#excavator, { parts, joints });
        this.#platformArmJoint.joint.configureMotor(0, 1.2, MOTOR_STIFFNESS, MOTOR_DAMPING);
        this.#armsJoint.joint.configureMotor(0, 3.8, MOTOR_STIFFNESS, MOTOR_DAMPING);
        this.#jawsJoint.joint.configureMotor(0, 0, 1, 0);
    }

    update(time) {
        updateExcavatorState({
            excavator: this.#excavator,
            joints: {
                platformJoint: this.#platformJoint,
                platformArmJoint: this.#platformArmJoint,
                armsJoint: this.#armsJoint,
                jaw1Joint: this.#jaw1Joint,
                jaw2Joint: this.#jaw2Joint,
                jaw3Joint: this.#jaw3Joint,
                jaw4Joint: this.#jaw4Joint
            },
            platform: this.#platform,
            dropPosition: this.#dropPosition,
            time,
            onPick: this.#onPick
        });
        const { state, parts, pickedObjects } = this.#excavator;
        parts.forEach(({ meshes, body }) => meshes.forEach(({ data }) => {
            data.position.copy(body.translation());
            data.quaternion.copy(body.rotation());
        }));
        pickedObjects.forEach(object => {
            if (object.used && object.position.y < MIN_POSITION_Y) {
                this.#onRecycleObject(object);
            }
        });
        if (state !== EXCAVATOR_STATES.IDLE) {
            if (state === EXCAVATOR_STATES.PICKING) {
                this.#excavator.pickedObjects = this.#onPick(this.#dropPosition);
            }
            if (state === EXCAVATOR_STATES.MOVING_TO_DROP_ZONE) {
                this.#platform.body.setEnabledRotations(false, true, false);
            }
            if (state === EXCAVATOR_STATES.EXTENDING_ARMS) {
                this.#platform.body.setEnabledRotations(false, false, false);
            }
            if (state === EXCAVATOR_STATES.MOVING_TO_BASE) {
                this.#platform.body.setEnabledRotations(false, true, false);
                this.#excavator.pickedObjects = [];
            }
            if (state === EXCAVATOR_STATES.PREPARING_IDLE) {
                this.#platform.body.setEnabledRotations(false, false, false);
            }
        }
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
        const pickedObjects = this.#excavator.pickedObjects.map(object => ({
            objectType: object.objectType,
            index: object.index,
            type: object.type
        }));
        return {
            state: this.#excavator.state.description,
            pendingPicks: this.#excavator.pendingPicks,
            timePick: this.#excavator.timePick,
            timeDrop: this.#excavator.timeDrop,
            timeMovingUp: this.#excavator.timeMovingUp,
            delayMovingUp: this.#excavator.delayMovingUp,
            joints,
            parts,
            pickedObjects
        };
    }

    load(excavator) {
        this.#excavator.state = Symbol.for(excavator.state);
        this.#excavator.pendingPicks = excavator.pendingPicks;
        this.#excavator.timePick = excavator.timePick;
        this.#excavator.timeDrop = excavator.timeDrop;
        this.#excavator.timeMovingUp = excavator.timeMovingUp;
        this.#excavator.delayMovingUp = excavator.delayMovingUp;
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
        this.#excavator.pickedObjects = excavator.pickedObjects.map(object => this.#onGetObject(object));
    }

    pick() {
        this.#excavator.pendingPicks++;
        if (this.#excavator.state === EXCAVATOR_STATES.IDLE) {
            this.#excavator.state = EXCAVATOR_STATES.ACTIVATING;
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

    get #platformJoint() {
        return this.#excavator.joints.get(JOINT_PLATFORM);
    }

    get #platformArmJoint() {
        return this.#excavator.joints.get(JOINT_ARM_PLATFORM);
    }

    get #armsJoint() {
        return this.#excavator.joints.get(JOINT_ARMS);
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
}

function updateExcavatorState({ excavator, joints, time }) {
    const { platformJoint, platformArmJoint, armsJoint, jaw1Joint, jaw2Joint, jaw3Joint, jaw4Joint } = joints;
    switch (excavator.state) {
        case EXCAVATOR_STATES.IDLE:
            break;
        case EXCAVATOR_STATES.ACTIVATING:
            jaw1Joint.joint.configureMotor(-.5, -2.5, MOTOR_STIFFNESS, MOTOR_DAMPING);
            jaw2Joint.joint.configureMotor(.5, 2.5, MOTOR_STIFFNESS, MOTOR_DAMPING);
            jaw3Joint.joint.configureMotor(-.5, -2.5, MOTOR_STIFFNESS, MOTOR_DAMPING);
            jaw4Joint.joint.configureMotor(.5, 2.5, MOTOR_STIFFNESS, MOTOR_DAMPING);
            excavator.state = EXCAVATOR_STATES.OPENING_JAWS;
            break;
        case EXCAVATOR_STATES.OPENING_JAWS:
            // console.log("=> opening jaws", getAngle(jaw1Joint), getAngle(jaw2Joint), getAngle(jaw3Joint), getAngle(jaw4Joint));
            if (getAngle(jaw1Joint) < -.5 && getAngle(jaw2Joint) > .5 && getAngle(jaw3Joint) < -.5 && getAngle(jaw4Joint) > .5) {
                excavator.timePick = time;
                platformArmJoint.joint.configureMotor(-.7, 1.2, MOTOR_STIFFNESS, MOTOR_DAMPING);
                armsJoint.joint.configureMotor(.5, 2.3, MOTOR_STIFFNESS, MOTOR_DAMPING);
                excavator.state = EXCAVATOR_STATES.MOVING_DOWN;
            }
            break;
        case EXCAVATOR_STATES.MOVING_DOWN:
            // console.log("=> moving down", getAngle(platformArmJoint), getAngle(armsJoint));
            if (getAngle(platformArmJoint) < -.7 && getAngle(armsJoint) > .5 && time - excavator.timePick > DELAY_PICK_WAIT) {
                excavator.timePick = -1;
                jaw1Joint.joint.configureMotor(0, 2.5, MOTOR_STIFFNESS, MOTOR_DAMPING);
                jaw2Joint.joint.configureMotor(0, -2.5, MOTOR_STIFFNESS, MOTOR_DAMPING);
                jaw3Joint.joint.configureMotor(0, 2.5, MOTOR_STIFFNESS, MOTOR_DAMPING);
                jaw4Joint.joint.configureMotor(0, -2.5, MOTOR_STIFFNESS, MOTOR_DAMPING);
                excavator.state = EXCAVATOR_STATES.CLOSING_JAWS;
            }
            break;
        case EXCAVATOR_STATES.CLOSING_JAWS:
            // console.log("=> closing jaws", getAngle(jaw1Joint), getAngle(jaw2Joint), getAngle(jaw3Joint), getAngle(jaw4Joint));
            if (getAngle(jaw1Joint) > -.01 && getAngle(jaw2Joint) < .01 && getAngle(jaw3Joint) > -.01 && getAngle(jaw4Joint) < .01) {
                excavator.state = EXCAVATOR_STATES.PICKING;
            }
            break;
        case EXCAVATOR_STATES.PICKING:
            // console.log("=> picking", getAngle(jaw1Joint), getAngle(jaw2Joint), getAngle(jaw3Joint), getAngle(jaw4Joint));
            platformArmJoint.joint.configureMotor(.5, 1, MOTOR_STIFFNESS, MOTOR_DAMPING);
            armsJoint.joint.configureMotor(-.2, 4, MOTOR_STIFFNESS, MOTOR_DAMPING);
            excavator.state = EXCAVATOR_STATES.MOVING_UP;
            excavator.timeMovingUp = time;
            break;
        case EXCAVATOR_STATES.MOVING_UP:
            // console.log("=> moving up", getAngle(platformArmJoint), getAngle(armsJoint));
            if (getAngle(platformArmJoint) > .5) {
                platformJoint.joint.configureMotor(-2, -3, MOTOR_STIFFNESS, MOTOR_STIFFNESS);
                excavator.state = EXCAVATOR_STATES.MOVING_TO_DROP_ZONE;
                excavator.delayMovingUp = time - excavator.timeMovingUp;
                excavator.timeMovingUp = -1;
            }
            break;
        case EXCAVATOR_STATES.MOVING_TO_DROP_ZONE:
            // console.log("=> moving to drop zone", getAngle(platformJoint), excavator.delayMovingUp);
            if (getAngle(platformJoint) < -2) {
                const additionalPlatformVelocity = Math.min(Math.max(excavator.delayMovingUp - MIN_DELAY_MOVING_UP, 0) / (MAX_DELAY_MOVING_UP - MIN_DELAY_MOVING_UP), 1) * .5;
                platformArmJoint.joint.configureMotor(-.3, 1 + additionalPlatformVelocity, MOTOR_STIFFNESS, MOTOR_DAMPING);
                const additionalArmsVelocity = Math.min(Math.max(excavator.delayMovingUp - MIN_DELAY_MOVING_UP, 0) / (MAX_DELAY_MOVING_UP - MIN_DELAY_MOVING_UP), 1) * 3;
                excavator.delayMovingUp = -1;
                armsJoint.joint.configureMotor(.9, 8 + additionalArmsVelocity, MOTOR_STIFFNESS, MOTOR_DAMPING);
                excavator.state = EXCAVATOR_STATES.EXTENDING_ARMS;
            }
            break;
        case EXCAVATOR_STATES.EXTENDING_ARMS:
            // console.log("=> extending arms", getAngle(armsJoint));
            if (getAngle(armsJoint) > .8) {
                excavator.timeDrop = time;
                jaw1Joint.joint.configureMotor(-.5, -2.5, MOTOR_STIFFNESS, MOTOR_DAMPING);
                jaw2Joint.joint.configureMotor(.5, 2.5, MOTOR_STIFFNESS, MOTOR_DAMPING);
                jaw3Joint.joint.configureMotor(-.5, -2.5, MOTOR_STIFFNESS, MOTOR_DAMPING);
                jaw4Joint.joint.configureMotor(.5, 2.5, MOTOR_STIFFNESS, MOTOR_DAMPING);
                excavator.state = EXCAVATOR_STATES.DROPPING;
            }
            break;
        case EXCAVATOR_STATES.DROPPING:
            // console.log("=> dropping", getAngle(jaw1Joint), getAngle(jaw2Joint), getAngle(jaw3Joint), getAngle(jaw4Joint));
            if (getAngle(jaw1Joint) < -.5 && getAngle(jaw2Joint) > .5 && getAngle(jaw3Joint) < -.5 && getAngle(jaw4Joint) > .5 && time - excavator.timeDrop > DELAY_DROP_WAIT) {
                excavator.timeDrop = -1;
                jaw1Joint.joint.configureMotor(0, 2.5, MOTOR_STIFFNESS, MOTOR_DAMPING);
                jaw2Joint.joint.configureMotor(0, -2.5, MOTOR_STIFFNESS, MOTOR_DAMPING);
                jaw3Joint.joint.configureMotor(0, 2.5, MOTOR_STIFFNESS, MOTOR_DAMPING);
                jaw4Joint.joint.configureMotor(0, -2.5, MOTOR_STIFFNESS, MOTOR_DAMPING);
                excavator.state = EXCAVATOR_STATES.CLOSING_JAWS_AFTER_DROPPING;
            }
            break;
        case EXCAVATOR_STATES.CLOSING_JAWS_AFTER_DROPPING:
            // console.log("=> closing jaws", getAngle(jaw1Joint), getAngle(jaw2Joint), getAngle(jaw3Joint), getAngle(jaw4Joint));
            if (getAngle(jaw1Joint) > -.01 && getAngle(jaw2Joint) < .01 && getAngle(jaw3Joint) > -.01 && getAngle(jaw4Joint) < .01) {
                platformArmJoint.joint.configureMotor(.5, .7, MOTOR_STIFFNESS, MOTOR_DAMPING);
                armsJoint.joint.configureMotor(-.3, 3.45, MOTOR_STIFFNESS, MOTOR_DAMPING);
                excavator.state = EXCAVATOR_STATES.RETRACTING_ARMS;
            }
            break;
        case EXCAVATOR_STATES.RETRACTING_ARMS:
            // console.log("=> retracting arms", getAngle(platformArmJoint), getAngle(armsJoint));
            if (getAngle(platformArmJoint) > .4 && getAngle(armsJoint) < .5) {
                platformJoint.joint.configureMotor(0, -.3, MOTOR_STIFFNESS, MOTOR_STIFFNESS);
                excavator.state = EXCAVATOR_STATES.MOVING_TO_BASE;
            }
            break;
        case EXCAVATOR_STATES.MOVING_TO_BASE:
            // console.log("=> moving to base", getAngle(platformJoint));
            if (getAngle(platformJoint) > -.01) {
                platformArmJoint.joint.configureMotor(0, 1.2, MOTOR_STIFFNESS, MOTOR_DAMPING);
                armsJoint.joint.configureMotor(0, 3.7, MOTOR_STIFFNESS, MOTOR_DAMPING);
                excavator.state = EXCAVATOR_STATES.PREPARING_IDLE;
                excavator.pendingPicks--;
            }
            break;
        case EXCAVATOR_STATES.PREPARING_IDLE:
            // console.log("=> preparing idle", getAngle(platformArmJoint), getAngle(armsJoint));
            if (getAngle(platformArmJoint) < .1 && getAngle(armsJoint) > -.1) {
                if (excavator.pendingPicks > 0) {
                    excavator.state = EXCAVATOR_STATES.ACTIVATING;
                } else {
                    excavator.state = EXCAVATOR_STATES.IDLE;
                }
            }
            break;
        default:
    }
}

function getAngle(jointData) {
    const axis = jointData.params.axis;
    const rotationBody1 = new Quaternion().copy(jointData.params.body1.rotation());
    const rotationBody2 = new Quaternion().copy(jointData.params.body2.rotation());
    const relativeRotation = rotationBody1.invert().multiply(rotationBody2);
    const axisWorld = axis.clone().normalize();
    return 2 * Math.atan2(
        axisWorld.x * relativeRotation.x + axisWorld.y * relativeRotation.y + axisWorld.z * relativeRotation.z,
        relativeRotation.w
    );
}

async function initializeModel({ scene }) {
    const model = await scene.loadModel(MODEL_PATH);
    const mesh = model.scene;
    const parts = new Map();
    const joints = new Map();
    const dropPosition = new Vector3();
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
        } else if (child.userData.joint) {
            const { userData, position } = child;
            joints.set(child.name, {
                position,
                axis: userData.axis === undefined ? undefined : new Vector3().fromArray(userData.axis),
                pair: [userData["name-1"], userData["name-2"]],
                limits: userData.limits
            });
        } else if (child.name == DROP_POSITION) {
            dropPosition.copy(child.position);
        }
    });
    return {
        parts,
        joints,
        dropPosition
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

function initializeColliders({ scene, parts, joints, onRecycleObject }) {
    parts.forEach((partData, name) => {
        const { meshes, friction } = partData;
        const body = partData.body = name === BASE_PART_NAME ? scene.createFixedBody() : scene.createDynamicBody();
        body.setEnabled(false);
        meshes.forEach(meshData => {
            const { vertices, indices } = meshData;
            if (vertices && indices) {
                meshData.collider = scene.createTrimeshCollider({
                    vertices,
                    indices,
                    friction,
                    restitution: RESTITUTION,
                    userData: {
                        objectType: name,
                        onIntersect: onRecycleObject
                    }
                }, body);
            }
        });
    });
    const platform = parts.get(PLATFORM);
    platform.body.setEnabledRotations(false, true, false);
    platform.body.setEnabledTranslations(false, false, false);
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
            const defaultRotation = new Quaternion();
            Object.assign(jointData.params, { frame1: defaultRotation, frame2: defaultRotation });
            jointData.joint = scene.connectBodiesWithFixedJoint(jointData.params);
        } else {
            Object.assign(jointData.params, { axis });
            jointData.joint = scene.connectBodiesWithRevoluteJoint(jointData.params);
            jointData.joint.setLimits(...limits);
        }
    });
}