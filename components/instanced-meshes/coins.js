import { Vector3, Quaternion, Matrix4, Euler, InstancedMesh } from "three";

const TYPE = "coin";
const MAX_INSTANCES = 1280;
const RADIUS = 0.03;
const DEPTH = 0.007;
const INIIAL_POSITION_DELTA_X = .025;
const INITIAL_POSITION_MIN_DELTA_X = 0.001;
const INITIAL_POSITIONS_X = [-0.1125, 0, 0.1125];
const INITIAL_POSITION = [0, .9, -0.32 + DEPTH / 2];
const INITIAL_HIDDEN_POSITION = [0, 0, 0];
const INITIAL_HIDDEN_ROTATION = [0, 0, 0, 1];
const INITIAL_HIDDEN_LINEAR_VELOCITY = new Vector3(0, 0, 0);
const INITIAL_HIDDEN_ANGULAR_VELOCITY = new Vector3(0, 0, 0);
const INITIAL_SCALE = new Vector3(0, 0, 0);
const DEFAULT_SCALE = new Vector3(1, 1, 1);
const EULER_ROTATION = new Euler(Math.PI / 2, 0, 0);
const SOFT_CCD_PREDICTION = 0.1;
const ADDITIONAL_SOLVER_ITERATIONS = 1;
const ANGULAR_DAMPING = 0.5;
const LINEAR_DAMPING = 0.5;
const RESTITUTION = 0;
const MODEL_PATH = "./../assets/coin.glb";
const SPAWN_TIME_DURATION = 8;
const SLEEP_LINEAR_MAX_SPEED = 0.001;
const TEMP_EULER = new Euler(0, 0, 0, "XYZ");
const MAX_ANGLE_FLAT = Math.PI / 4;
const ANGVEL_HISTORY_LENGTH = 10;
const ANGVEL_HISTORY_MIN_LENGTH = 6;
const ANGVEL_MAX_AMPLITUDE = Math.PI / 360;
const MIN_OSCILLATIONS = 2;
const MIN_SLEEP_CANDIDATE_FRAMES = 5;

let friction = 0.2;
let density = 1;

export default class {

    static TYPE = TYPE;
    static MAX_INSTANCES = MAX_INSTANCES;
    static RADIUS = RADIUS;
    static DEPTH = DEPTH;

    static #scene;
    static #meshes = [];
    static #instances = [];
    static #spawnedCoins = [];
    static #frameLastSpawn = 0;
    static #onSpawnedCoin;

    static async initialize({ scene, onSpawnedCoin }) {
        this.#scene = scene;
        this.#onSpawnedCoin = onSpawnedCoin;
        const { materials, geometries } = await initializeModel({ scene });
        this.#meshes = initializeInstancedMeshes({ scene, materials, geometries });
        this.#instances = [];
        createInstances({ scene, instances: this.#instances });
    }

    static getCoin({ index }) {
        return this.#instances[index];
    }

    static update() {
        if (this.#spawnedCoins.length) {
            this.#frameLastSpawn++;
            if (this.#frameLastSpawn >= SPAWN_TIME_DURATION) {
                const { slot } = this.#spawnedCoins.shift();
                const instance = this.#instances.find(instance => !instance.used);
                instance.used = true;
                initializePosition({ instance, slot });
                instance.body.setEnabled(true);
                this.#onSpawnedCoin(instance);
                this.#frameLastSpawn = 0;
            }
        }
        for (const instance of this.#instances) {
            if (instance.used) {
                const linearVelocity = instance.body.linvel();
                instance.linearSpeed =
                    linearVelocity.x * linearVelocity.x +
                    linearVelocity.y * linearVelocity.y +
                    linearVelocity.z * linearVelocity.z;
                const isSleeping = instance.body.isSleeping();
                if (instance.angularVelocityHistory.length > ANGVEL_HISTORY_LENGTH) {
                    instance.angularVelocityHistory.shift();
                }
                if (instance.pendingImpulse && instance.body.mass() > 0) {
                    instance.body.applyImpulse(instance.pendingImpulse, true);
                    instance.pendingImpulse = null;
                } else if (isSleeping) {
                    instance.sleepCandidateFrames = 0;
                } else if (!isSleeping) {
                    const angularVelocity = instance.body.angvel();
                    instance.angularVelocityHistory.push([angularVelocity.x, angularVelocity.z]);
                    const angularVelocityAbsX = Math.abs(angularVelocity.x);
                    const angularVelocityAbsZ = Math.abs(angularVelocity.z);
                    if (
                        instance.linearSpeed && instance.linearSpeed < SLEEP_LINEAR_MAX_SPEED &&
                        angularVelocityAbsX < ANGVEL_MAX_AMPLITUDE &&
                        angularVelocityAbsZ < ANGVEL_MAX_AMPLITUDE &&
                        isFlat(instance) &&
                        isOscillating(instance.angularVelocityHistory)
                    ) {
                        instance.sleepCandidateFrames++;
                        if (instance.sleepCandidateFrames > MIN_SLEEP_CANDIDATE_FRAMES) {
                            instance.body.sleep();
                            instance.sleepCandidateFrames = 0;
                        }
                    } else {
                        instance.sleepCandidateFrames = 0;
                    }
                }
                update({
                    instance,
                    meshes: this.#meshes
                });
            }
        }
    }

    static dropCoin({ slot }) {
        this.#spawnedCoins.push({ slot });
    }

    static dropCoins({ count }) {
        let lastSlot;
        for (let i = 0; i < count; i++) {
            let slot;
            do {
                slot = Math.floor(Math.random() * 3);
            } while (slot === lastSlot);
            lastSlot = slot;
            this.#spawnedCoins.push({ slot });
        }
    }

    static depositCoin({ position, rotation = new Vector3(0, 0, 0), impulse }) {
        const instance = this.#instances.find(instance => !instance.used);
        instance.used = true;
        initializePosition({ instance, position, rotation });
        instance.body.setEnabled(true);
        if (impulse) {
            instance.pendingImpulse = impulse.clone();
        }
        return instance;
    }

    static depositCoins({ position, count }) {
        position.x = -0.3;
        for (let indexCoin = 0; indexCoin < count; indexCoin++) {
            const instance = this.#instances.find(instance => !instance.used);
            instance.used = true;
            position.x += RADIUS * 2;
            if (position.x > 0.3) {
                position.x = -0.3;
                position.z -= RADIUS * 2;
            }
            const rotation = new Vector3(0, 0, 0);
            initializePosition({ instance, position, rotation });
            instance.body.setEnabled(true);
        }
    }

    static recycle(instance) {
        instance.used = false;
        instance.linearSpeed = 0;
        instance.angularVelocityHistory = [];
        instance.sleepCandidateFrames = 0;
        instance.body.setEnabled(false);
        initializePosition({ instance, hidden: true });
        update({
            instance,
            meshes: this.#meshes,
            forceRefresh: true
        });
    }

    static get dynamicBodies() {
        return this.#instances.filter(instance => instance.used).map(instance => ({ object: instance, objects: this, body: instance.body }));
    }

    static get usedCoins() {
        return this.#instances.filter(instance => instance.used).length;
    }

    static save() {
        return this.#instances.map(instance => {
            return {
                position: instance.position.toArray(),
                rotation: instance.rotation.toArray(),
                used: instance.used,
                bodyHandle: this.#instances[instance.index].body.handle,
                linearSpeed: instance.linearSpeed,
                angularVelocityHistory: instance.angularVelocityHistory,
                sleepCandidateFrames: instance.sleepCandidateFrames,
                pendingImpulse: instance.pendingImpulse ? instance.pendingImpulse.toArray() : null
            };
        });
    }

    static load(coins) {
        coins.forEach((instance, indexInstance) => {
            const body = this.#scene.worldBodies.get(instance.bodyHandle);
            this.#instances[indexInstance] = {
                ...this.#instances[indexInstance],
                position: new Vector3().fromArray(instance.position),
                rotation: new Quaternion().fromArray(instance.rotation),
                used: instance.used,
                body,
                linearSpeed: instance.linearSpeed,
                angularVelocityHistory: instance.angularVelocityHistory,
                sleepCandidateFrames: instance.sleepCandidateFrames,
                pendingImpulse: instance.pendingImpulse ? new Vector3().fromArray(instance.pendingImpulse) : null,
            };
            for (let indexCollider = 0; indexCollider < body.numColliders(); indexCollider++) {
                const collider = body.collider(indexCollider);
                collider.userData = {
                    objectType: TYPE,
                    index: indexInstance
                };
            }
            update({
                instance: this.#instances[indexInstance],
                meshes: this.#meshes,
                forceRefresh: true
            });
        });
    }

    static enableCcd(instance, enabled) {
        if (instance && instance.body) {
            instance.body.enableCcd(enabled);
        }
    }

    static get friction() {
        return friction;
    }

    static set friction(value) {
        friction = value;
        this.#instances.forEach(instance => {
            instance.body.collider(0).setFriction(value);
        });
    }

    static get density() {
        return density;
    }

    static set density(value) {
        density = value;
        this.#instances.forEach(instance => {
            instance.body.collider(0).setDensity(value);
        });
    }
}

async function initializeModel({ scene }) {
    const model = await scene.loadModel(MODEL_PATH);
    model.scene.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
    const mesh = model.scene.children[0];
    const baseColorMaterial = mesh.children[0].material;
    const colorMaterial = mesh.children[1].material;
    const baseColorGeometry = mesh.children[0].geometry;
    const colorGeometry = mesh.children[1].geometry;
    colorMaterial.metalness = .35;
    baseColorMaterial.metalness = .2;
    return {
        materials: [baseColorMaterial, colorMaterial],
        geometries: [baseColorGeometry, colorGeometry]
    };
}

function initializeInstancedMeshes({ scene, materials, geometries }) {
    const meshes = [];
    for (let indexMaterial = 0; indexMaterial < materials.length; indexMaterial++) {
        const mesh = new InstancedMesh(geometries[indexMaterial], materials[indexMaterial], MAX_INSTANCES);
        for (let indexInstance = 0; indexInstance < MAX_INSTANCES; indexInstance++) {
            mesh.setMatrixAt(indexInstance, INITIAL_SCALE);
        }
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.addObject(mesh);
        meshes.push(mesh);
    }
    return meshes;
}

function createInstances({ scene, instances }) {
    for (let indexInstance = instances.length; indexInstance < MAX_INSTANCES; indexInstance++) {
        createInstance({ scene, instances });
    }
}

function createInstance({ scene, instances }) {
    const body = scene.createDynamicBody();
    body.setEnabled(false);
    body.setSoftCcdPrediction(SOFT_CCD_PREDICTION);
    body.setAngularDamping(ANGULAR_DAMPING);
    body.setLinearDamping(LINEAR_DAMPING);
    body.setAdditionalSolverIterations(ADDITIONAL_SOLVER_ITERATIONS);
    const index = instances.length;
    scene.createCylinderCollider({
        userData: { objectType: TYPE, index },
        radius: RADIUS,
        height: DEPTH,
        friction: friction,
        restitution: RESTITUTION,
        density: density
    }, body);
    const instance = {
        objectType: TYPE,
        index,
        position: new Vector3(),
        rotation: new Quaternion(),
        body,
        matrix: new Matrix4(),
        used: false,
        pendingImpulse: null,
        angularVelocityHistory: [],
        sleepCandidateFrames: 0
    };
    instances.push(instance);
    return instance;
}

function initializePosition({ instance, hidden, position, rotation, slot = 1 }) {
    if (hidden) {
        instance.position.fromArray(INITIAL_HIDDEN_POSITION);
        instance.rotation.fromArray(INITIAL_HIDDEN_ROTATION);
        instance.body.setLinvel(INITIAL_HIDDEN_LINEAR_VELOCITY, false);
        instance.body.setAngvel(INITIAL_HIDDEN_ANGULAR_VELOCITY, false);
    } else {
        if (position) {
            instance.position.copy(position);
        } else {
            const randomNumber = Math.random();
            instance.position.fromArray([
                INITIAL_POSITIONS_X[slot] + (randomNumber < 0.5 ? -INIIAL_POSITION_DELTA_X : INIIAL_POSITION_DELTA_X) * Math.random() + (randomNumber < 0.5 ? -INITIAL_POSITION_MIN_DELTA_X : INITIAL_POSITION_MIN_DELTA_X),
                INITIAL_POSITION[1],
                INITIAL_POSITION[2]
            ]);
        }
        if (rotation) {
            instance.rotation.setFromEuler(new Euler(rotation.x, rotation.y, rotation.z));
        } else {
            const rotation = EULER_ROTATION.clone();
            rotation.x += Math.random() <= 0.5 ? Math.PI : 0;
            instance.rotation.setFromEuler(rotation);
        }
    }
    instance.body.setTranslation(instance.position);
    instance.body.setRotation(instance.rotation);
}

function update({ instance, meshes, forceRefresh }) {
    instance.position.copy(instance.body.translation());
    instance.rotation.copy(instance.body.rotation());
    instance.matrix.compose(instance.position, instance.rotation, instance.used ? DEFAULT_SCALE : INITIAL_SCALE);
    if (instance.used || forceRefresh) {
        meshes.forEach(mesh => {
            mesh.setMatrixAt(instance.index, instance.matrix);
            mesh.instanceMatrix.needsUpdate = true;
        });
    }
}

function isFlat(instance) {
    const eulerRotation = TEMP_EULER.setFromQuaternion(instance.rotation);
    return (
        Math.abs(eulerRotation.x) < MAX_ANGLE_FLAT ||
        Math.abs(eulerRotation.x - Math.PI) < MAX_ANGLE_FLAT ||
        Math.abs(eulerRotation.x + Math.PI) < MAX_ANGLE_FLAT) && (
            Math.abs(eulerRotation.z) < MAX_ANGLE_FLAT ||
            Math.abs(eulerRotation.z - Math.PI) < MAX_ANGLE_FLAT ||
            Math.abs(eulerRotation.z + Math.PI) < MAX_ANGLE_FLAT
        );
}

function isOscillating(history) {
    return history.length > ANGVEL_HISTORY_MIN_LENGTH &&
        (findOscillation(0, history) || findOscillation(1, history));
}

function findOscillation(axis, history) {
    let lastSign = Math.sign(history[0][axis]);
    let signChanges = 0;
    let min = history[0][axis], max = history[0][axis];
    for (let i = 1; i < history.length; i++) {
        const value = history[i][axis];
        const sign = Math.sign(value);
        if (sign !== 0 && sign !== lastSign) {
            signChanges++;
            lastSign = sign;
        }
        if (value < min) {
            min = value;
        }
        if (value > max) {
            max = value;
        }
    }
    return signChanges >= MIN_OSCILLATIONS && (max - min) < ANGVEL_MAX_AMPLITUDE;
}