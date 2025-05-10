import { Quaternion, Vector3 } from "three";

const MODEL_PATH = "./../assets/excavator.glb";
const POSITION = [.695, 0.29, 0.3];
const ROTATION_Y = -6 * Math.PI / 7;
const RESTITUTION = 0;
const BASE_PART_NAME = "base";
const ROTATING_PLATFORM_PART_NAME = "rotating-platform";
const JOINT_ROTATING_PLATFORM = "joint-rotating-platform";
const JOINT_ARM_ROTATING_PLATFORM = "joint-arm-rotating-platform";
const JOINT_ARMS = "joint-arms";
const JOINT_JAWS = "joint-jaws";
const JOINT_JAW_1 = "joint-jaw-1";
const JOINT_JAW_2 = "joint-jaw-2";
const JOINT_JAW_3 = "joint-jaw-3";
const JOINT_JAW_4 = "joint-jaw-4";

const MOTOR_STIFFNESS = 1000000;
const MOTOR_DAMPING = 100;

const EXCAVATOR_STATES = {
    IDLE: Symbol.for("excavator-idle"),
    MOVING_TO_PICK: Symbol.for("excavator-moving-to-pick"),
    PICKING: Symbol.for("excavator-picking"),
    GETTING_OUT_PICK: Symbol.for("excavator-getting-out-pick"),
    MOVING_TO_DROP: Symbol.for("excavator-moving-to-drop"),
    DROPPING: Symbol.for("excavator-dropping"),
    GETTING_OUT_DROP: Symbol.for("excavator-getting-out-drop"),
    MOVING_TO_IDLE: Symbol.for("excavator-moving-to-idle")
};

export default class {

    #scene;
    #excavator = {
        state: EXCAVATOR_STATES.IDLE,
        position: new Vector3(0, 0, 0),
        rotationY: 0
    };

    constructor({ scene }) {
        this.#scene = scene;
        this.#excavator.position.fromArray(POSITION);
        this.#excavator.rotationY = ROTATION_Y;
    }

    async initialize() {
        const scene = this.#scene;
        const position = this.#excavator.position;
        const rotationY = this.#excavator.rotationY;
        const { parts, joints } = await initializeModel({ scene });
        initializeColliders({ scene, parts, joints, position, rotation: new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), rotationY) });
        parts.forEach(({ body, meshes }) => {
            meshes.forEach(({ data }) => {
                this.#scene.addObject(data);
            });
            body.setEnabled(true);
        });
        Object.assign(this.#excavator, { parts, joints });
        joints.get(JOINT_ROTATING_PLATFORM).joint.configureMotorPosition(0, MOTOR_STIFFNESS, 0);
        joints.get(JOINT_ARM_ROTATING_PLATFORM).joint.configureMotorPosition(0, MOTOR_STIFFNESS, 0);
        joints.get(JOINT_ARMS).joint.configureMotorPosition(0, MOTOR_STIFFNESS, 0);
        joints.get(JOINT_JAWS).joint.configureMotorPosition(0, MOTOR_STIFFNESS, 0);
        joints.get(JOINT_JAW_1).joint.configureMotorPosition(0, MOTOR_STIFFNESS, 0);
        joints.get(JOINT_JAW_2).joint.configureMotorPosition(0, MOTOR_STIFFNESS, 0);
        joints.get(JOINT_JAW_3).joint.configureMotorPosition(0, MOTOR_STIFFNESS, 0);
        joints.get(JOINT_JAW_4).joint.configureMotorPosition(0, MOTOR_STIFFNESS, 0);
    }

    update() {
        updateExcavatorState({ excavator: this.#excavator });
        this.#excavator.parts.forEach(({ meshes, body }) =>
            meshes.forEach(({ data }) => {
                data.position.copy(body.translation());
                data.quaternion.copy(body.rotation());
            })
        );
    }

    get joints() {
        const joints = [];
        this.#excavator.joints.forEach(jointData => {
            const { joint, params } = jointData;
            joints.push({ joint, jointData: params });
        });
        return joints;
    }
}

function updateExcavatorState({ excavator }) {
    // const { joints } = excavator;
    switch (excavator.state) {
        case EXCAVATOR_STATES.IDLE:
            break;
        case EXCAVATOR_STATES.MOVING_TO_PICK:
            break;
        case EXCAVATOR_STATES.PICKING:
            break;
        case EXCAVATOR_STATES.GETTING_OUT_PICK:
            break;
        case EXCAVATOR_STATES.MOVING_TO_DROP:
            break;
        case EXCAVATOR_STATES.DROPPING:
            break;
        case EXCAVATOR_STATES.GETTING_OUT_DROP:
            break;
        case EXCAVATOR_STATES.MOVING_TO_IDLE:
            break;
    }
}

async function initializeModel({ scene }) {
    const cabinetModel = await scene.loadModel(MODEL_PATH);
    const mesh = cabinetModel.scene;
    const parts = new Map();
    const joints = new Map();
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
        }
    });
    return {
        parts,
        joints
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

function initializeColliders({ scene, parts, joints, position, rotation }) {
    parts.forEach((partData, name) => {
        const { meshes, friction } = partData;
        const body = partData.body = name === BASE_PART_NAME ? scene.createFixedBody() : scene.createDynamicBody();
        body.setTranslation(position);
        body.setRotation(rotation);
        body.setEnabled(false);
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
    const rotatingPlatform = parts.get(ROTATING_PLATFORM_PART_NAME);
    rotatingPlatform.body.setEnabledRotations(false, true, false);
    rotatingPlatform.body.setEnabledTranslations(false, false, false);
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