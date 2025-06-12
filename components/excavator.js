import { Quaternion, Vector3, SpotLight } from "three";
const MODEL_PATH = "./../assets/excavator.glb";
const Y_AXIS = new Vector3(0, 1, 0);
const RESTITUTION = 0;
const BASE_PART_NAME = "base";
const TRAP_PART_NAME = "trap-excavator";
const BEACON_LIGHT_BULB_NAME = "beacon-light-bulb";
const BEACON_LIGHT_MIRROR_NAME = "beacon-light-mirror";
const BEACON_LIGHT_BASE_NAME = "beacon-light-base";
const PLATFORM = "rotating-platform";
const DROP_POSITION = "drop-position";
const BEACON_LIGHT_POSITION = "beacon-light-position";
const JOINT_PLATFORM = "joint-rotating-platform";
const JOINT_ARM_PLATFORM = "joint-arm-rotating-platform";
const JOINT_ARMS = "joint-arms";
const JOINT_JAWS = "joint-jaws";
const JOINT_JAW_1 = "joint-jaw-1";
const JOINT_JAW_2 = "joint-jaw-2";
const JOINT_JAW_3 = "joint-jaw-3";
const JOINT_JAW_4 = "joint-jaw-4";
const DELAY_PICK_WAIT = 1000;
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
const BEACON_LIGHT_BULB_SPEED = 0.06;

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
    #beaconLight;
    #beaconLightPosition;
    #trapSensor;
    #excavator = {
        state: EXCAVATOR_STATES.IDLE,
        pendingPicks: 0,
        timePick: -1,
        beaconLightAngle: 0
    };

    constructor({ scene, onPick, onGetObject, onRecycleObject }) {
        this.#scene = scene;
        this.#onPick = onPick;
        this.#onGetObject = onGetObject;
        this.#onRecycleObject = onRecycleObject;
    }

    async initialize() {
        const scene = this.#scene;
        const {
            parts,
            joints,
            dropPosition,
            beaconLightPosition
        } = await initializeModel({ scene });
        this.#dropPosition = dropPosition;
        this.#beaconLightPosition = beaconLightPosition;
        const { trapSensor } = initializeColliders({
            scene,
            parts,
            joints,
            trapSensor: this.#trapSensor,
            onRecycleObject: userData => {
                const object = this.#onGetObject(userData);
                if (object) {
                    this.#onRecycleObject(userData);
                }
            }
        });
        this.#trapSensor = trapSensor;
        parts.forEach(({ body, meshes }) => {
            meshes.forEach(({ data }) => this.#scene.addObject(data));
            body.setEnabled(true);
        });
        parts.get(PLATFORM).body.setEnabledRotations(false, false, false);
        Object.assign(this.#excavator, { parts, joints });
        this.#platformArmJoint.joint.configureMotor(0, 1, MOTOR_STIFFNESS, MOTOR_DAMPING);
        this.#armsJoint.joint.configureMotor(0, 3.7, MOTOR_STIFFNESS, MOTOR_DAMPING);
        this.#jawsJoint.joint.configureMotor(0, 0, 1, 0);
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
        const { state, parts } = this.#excavator;
        parts.forEach(({ meshes, body }) => meshes.forEach(({ data }) => {
            data.position.copy(body.translation());
            data.quaternion.copy(body.rotation());
        }));
        const lightBulbMaterial = this.#beaconLightBulb.meshes[0].data.material;
        if (state !== EXCAVATOR_STATES.IDLE) {
            if (state === EXCAVATOR_STATES.PICKING) {
                this.#onPick(this.#dropPosition);
            } if (state === EXCAVATOR_STATES.MOVING_TO_DROP_ZONE) {
                this.#platform.body.setEnabledRotations(false, true, false);
            }
            if (state === EXCAVATOR_STATES.EXTENDING_ARMS) {
                this.#platform.body.setEnabledRotations(false, false, false);
            }
            if (state === EXCAVATOR_STATES.MOVING_TO_BASE) {
                this.#platform.body.setEnabledRotations(false, true, false);
            }
            if (state === EXCAVATOR_STATES.CLOSING_JAWS_AFTER_DROPPING) {
                this.#platform.body.setEnabledRotations(false, false, false);
            }
            lightBulbMaterial.emissiveIntensity = BEACON_LIGHT_BULB_INTENSITY_ON;
            lightBulbMaterial.opacity = BEACON_LIGHT_OPACITY_ON;
            this.#beaconLight.intensity = BEACON_LIGHT_INTENSITY_ON;
            const beaconLightRotation = new Quaternion().setFromAxisAngle(Y_AXIS, this.#excavator.beaconLightAngle);
            this.#beaconLightMirror.body.setNextKinematicTranslation(new Vector3(0, 0, 0)
                .sub(this.#beaconLightPosition)
                .applyQuaternion(beaconLightRotation)
                .add(this.#beaconLightPosition));
            this.#beaconLightMirror.body.setNextKinematicRotation(beaconLightRotation);
            this.#beaconLight.target.position.set(
                this.#beaconLight.position.x + Math.sin(this.#excavator.beaconLightAngle),
                this.#beaconLight.position.y,
                this.#beaconLight.position.z + Math.cos(this.#excavator.beaconLightAngle)
            );
        } else {
            lightBulbMaterial.emissiveIntensity = BEACON_LIGHT_INTENSITY_OFF;
            lightBulbMaterial.opacity = BEACON_LIGHT_OPACITY_OFF;
            this.#beaconLight.intensity = BEACON_LIGHT_INTENSITY_OFF;
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
        return {
            state: this.#excavator.state.description,
            pendingPicks: this.#excavator.pendingPicks,
            timePick: this.#excavator.timePick,
            beaconLightAngle: this.#excavator.beaconLightAngle,
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
                                onIntersect: this.#onRecycleObject
                            };
                            this.#trapSensor = collider;
                        }
                    }
                });
            });
        });
        this.#excavator.state = Symbol.for(excavator.state);
        this.#excavator.pendingPicks = excavator.pendingPicks;
        this.#excavator.timePick = excavator.timePick;
        this.#excavator.beaconLightAngle = excavator.beaconLightAngle;
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

    get #beaconLightBulb() {
        return this.#excavator.parts.get(BEACON_LIGHT_BULB_NAME);
    }

    get #beaconLightMirror() {
        return this.#excavator.parts.get(BEACON_LIGHT_MIRROR_NAME);
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
                platformArmJoint.joint.configureMotor(-.7, 1, MOTOR_STIFFNESS, MOTOR_DAMPING);
                armsJoint.joint.configureMotor(.5, 3, MOTOR_STIFFNESS, MOTOR_DAMPING);
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
            break;
        case EXCAVATOR_STATES.MOVING_UP:
            // console.log("=> moving up", getAngle(platformArmJoint), getAngle(armsJoint));
            if (getAngle(platformArmJoint) > .5) {
                platformJoint.joint.configureMotor(-2, -3, MOTOR_STIFFNESS, MOTOR_STIFFNESS);
                excavator.state = EXCAVATOR_STATES.MOVING_TO_DROP_ZONE;
            }
            break;
        case EXCAVATOR_STATES.MOVING_TO_DROP_ZONE:
            // console.log("=> moving to drop zone", getAngle(platformJoint));
            if (getAngle(platformJoint) < -2) {
                platformArmJoint.joint.configureMotor(-.3, 1, MOTOR_STIFFNESS, MOTOR_DAMPING);
                armsJoint.joint.configureMotor(.9, 8, MOTOR_STIFFNESS, MOTOR_DAMPING);
                excavator.state = EXCAVATOR_STATES.EXTENDING_ARMS;
            }
            break;
        case EXCAVATOR_STATES.EXTENDING_ARMS:
            // console.log("=> extending arms", getAngle(armsJoint));
            if (getAngle(armsJoint) > .8) {
                jaw1Joint.joint.configureMotor(-.5, -2.5, MOTOR_STIFFNESS, MOTOR_DAMPING);
                jaw2Joint.joint.configureMotor(.5, 2.5, MOTOR_STIFFNESS, MOTOR_DAMPING);
                jaw3Joint.joint.configureMotor(-.5, -2.5, MOTOR_STIFFNESS, MOTOR_DAMPING);
                jaw4Joint.joint.configureMotor(.5, 2.5, MOTOR_STIFFNESS, MOTOR_DAMPING);
                excavator.state = EXCAVATOR_STATES.DROPPING;
            }
            break;
        case EXCAVATOR_STATES.DROPPING:
            // console.log("=> closing jaws", getAngle(jaw1Joint), getAngle(jaw2Joint), getAngle(jaw3Joint), getAngle(jaw4Joint));
            if (getAngle(jaw1Joint) < -.5 && getAngle(jaw2Joint) > .5 && getAngle(jaw3Joint) < -.5 && getAngle(jaw4Joint) > .5) {
                platformArmJoint.joint.configureMotor(.5, .7, MOTOR_STIFFNESS, MOTOR_DAMPING);
                armsJoint.joint.configureMotor(-.3, 3.45, MOTOR_STIFFNESS, MOTOR_DAMPING);
                excavator.state = EXCAVATOR_STATES.RETRACTING_ARMS;
            }
            break;
        case EXCAVATOR_STATES.RETRACTING_ARMS:
            // console.log("=> retracting arms", getAngle(platformArmJoint), getAngle(armsJoint));
            if (getAngle(platformArmJoint) > .4 && getAngle(armsJoint) < .5) {
                platformJoint.joint.configureMotor(0, -.7, MOTOR_STIFFNESS, MOTOR_STIFFNESS);
                excavator.state = EXCAVATOR_STATES.MOVING_TO_BASE;
            }
            break;
        case EXCAVATOR_STATES.MOVING_TO_BASE:
            // console.log("=> moving to base", getAngle(platformJoint));
            if (getAngle(platformJoint) > -.01) {
                platformArmJoint.joint.configureMotor(0, 1, MOTOR_STIFFNESS, MOTOR_DAMPING);
                armsJoint.joint.configureMotor(0, 3.7, MOTOR_STIFFNESS, MOTOR_DAMPING);
                excavator.state = EXCAVATOR_STATES.CLOSING_JAWS_AFTER_DROPPING;
                excavator.pendingPicks--;
            }
            break;
        case EXCAVATOR_STATES.CLOSING_JAWS_AFTER_DROPPING:
            // console.log("=> dropping", getAngle(platformArmJoint), getAngle(armsJoint));
            if (getAngle(platformArmJoint) < .1 && getAngle(armsJoint) > -.1) {
                if (excavator.pendingPicks > 0) {
                    excavator.state = EXCAVATOR_STATES.OPENING_JAWS;
                } else if (excavator.beaconLightAngle > 0 && excavator.beaconLightAngle < BEACON_LIGHT_BULB_SPEED) {
                    excavator.beaconLightAngle = 0;
                    jaw1Joint.joint.configureMotor(0, 2.5, MOTOR_STIFFNESS, MOTOR_DAMPING);
                    jaw2Joint.joint.configureMotor(0, -2.5, MOTOR_STIFFNESS, MOTOR_DAMPING);
                    jaw3Joint.joint.configureMotor(0, 2.5, MOTOR_STIFFNESS, MOTOR_DAMPING);
                    jaw4Joint.joint.configureMotor(0, -2.5, MOTOR_STIFFNESS, MOTOR_DAMPING);
                    excavator.state = EXCAVATOR_STATES.PREPARING_IDLE;
                }
            }
            break;
        case EXCAVATOR_STATES.PREPARING_IDLE:
            // console.log("=> preparing idle", getAngle(jaw1Joint), getAngle(jaw2Joint), getAngle(jaw3Joint), getAngle(jaw4Joint));
            if (getAngle(jaw1Joint) > -.01 && getAngle(jaw2Joint) < .01 && getAngle(jaw3Joint) > -.01 && getAngle(jaw4Joint) < .01) {
                excavator.state = EXCAVATOR_STATES.IDLE;
            }
            break;
        default:
    }
    if (excavator.state !== EXCAVATOR_STATES.IDLE && excavator.state !== EXCAVATOR_STATES.PREPARING_IDLE) {
        excavator.beaconLightAngle = (excavator.beaconLightAngle + BEACON_LIGHT_BULB_SPEED) % (2 * Math.PI);
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
    const beaconLightPosition = new Vector3();
    mesh.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            const { material, geometry } = child;
            const userData = material.userData;
            const name = userData.name;
            if (userData.collider || userData.sensor) {
                const index = geometry.index;
                const position = geometry.attributes.position;
                const vertices = [];
                const indices = [];
                for (let indexVertex = 0; indexVertex < index.count; indexVertex++) {
                    vertices.push(position.getX(indexVertex), position.getY(indexVertex), position.getZ(indexVertex));
                    indices.push(index.getX(indexVertex));
                }
                const partData = getPart(parts, name);
                partData.meshes.push({
                    data: child,
                    sensor: userData.sensor,
                    vertices,
                    indices
                });
            } else if (name !== BEACON_LIGHT_BULB_NAME) {
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
        } else if (child.name === BEACON_LIGHT_POSITION) {
            beaconLightPosition.copy(child.position);
        }
    });
    return {
        parts,
        joints,
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

function initializeColliders({ scene, parts, joints, onRecycleObject }) {
    let trapSensor;
    parts.forEach((partData, name) => {
        const { meshes, friction } = partData;
        const body = partData.body =
            name === BASE_PART_NAME || name === TRAP_PART_NAME || name === BEACON_LIGHT_BASE_NAME ?
                scene.createFixedBody() :
                name === BEACON_LIGHT_MIRROR_NAME ?
                    scene.createKinematicBody() :
                    scene.createDynamicBody();
        body.setEnabled(false);
        meshes.forEach(meshData => {
            if (meshData.sensor) {
                const child = meshData.data;
                child.geometry.computeBoundingBox();
                const bbox = child.geometry.boundingBox;
                const worldMatrix = child.matrixWorld;
                worldMatrix.decompose(child.position, child.quaternion, child.scale);
                const width = bbox.max.x - bbox.min.x;
                const height = SENSOR_HEIGHT;
                const depth = bbox.max.z - bbox.min.z;
                const minX = bbox.min.x;
                const minZ = bbox.min.z;
                const collider = scene.createCuboidCollider({
                    width: width,
                    height: height,
                    depth: depth,
                    sensor: true,
                    position: [minX + width / 2, bbox.min.y - height / 2, minZ + depth / 2],
                    userData: {
                        objectType: name,
                        onIntersect: userData => onRecycleObject(userData)
                    }
                }, body);
                trapSensor = collider;
            } else if (meshData.vertices) {
                const { vertices, indices } = meshData;
                scene.createTrimeshCollider({
                    vertices,
                    indices,
                    friction,
                    restitution: RESTITUTION
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
    return { trapSensor };
}