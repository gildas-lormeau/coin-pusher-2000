import { Vector3, Quaternion, Matrix4, Euler, InstancedMesh } from "three";

const TYPE = "coin";
const MAX_INSTANCES = 1024;
const RADIUS = 0.03;
const DEPTH = 0.005;
const INITIAL_POSITION_MIN_DELTA_X = 0.015;
const INITIAL_POSITIONS_X = [-0.1125, 0, 0.1125];
const INITIAL_POSITION = [0, .9, -0.32 + DEPTH / 2];
const INITIAL_HIDDEN_POSITION = [0, 0, 0];
const INITIAL_HIDDEN_ROTATION = [0, 0, 0, 1];
const INITIAL_HIDDEN_LINEAR_VELOCITY = new Vector3(0, 0, 0);
const INITIAL_HIDDEN_ANGULAR_VELOCITY = new Vector3(0, 0, 0);
const INITIAL_SCALE = new Vector3(0, 0, 0);
const DEFAULT_SCALE = new Vector3(1, 1, 1);
const EULER_ROTATION = new Euler(Math.PI / 2, 0, 0);
const SPAWN_IMPULSE = new Vector3(0, -0.000025, 0);
const SOFT_CCD_PREDICTION = Math.max(RADIUS, DEPTH);
const ADDITIONAL_SOLVER_ITERATIONS = 1;
const ANGULAR_DAMPING = 0.5;
const LINEAR_DAMPING = 0.5;
const RESTITUTION = 0;
const MODEL_PATH = "./assets/coin.glb";
const SPAWN_TIME_DURATION = 8;

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

    static async initialize({ scene, onSpawnedCoin, groups }) {
        this.#scene = scene;
        this.#onSpawnedCoin = onSpawnedCoin;
        const { materials, geometries } = await initializeModel({ scene });
        this.#meshes = initializeInstancedMeshes({ scene, materials, geometries });
        this.#instances = [];
        createInstances({ scene, instances: this.#instances, groups });
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
                const randomNumber = Math.random();
                const position = new Vector3(
                    INITIAL_POSITIONS_X[slot] + (randomNumber <= 0.5 ? -INITIAL_POSITION_MIN_DELTA_X : INITIAL_POSITION_MIN_DELTA_X) * Math.random(),
                    INITIAL_POSITION[1],
                    INITIAL_POSITION[2]
                );
                const rotation = EULER_ROTATION.clone();
                rotation.x += Math.random() <= 0.5 ? Math.PI : 0;
                initializePosition({ instance, slot, position, rotation });
                instance.body.setEnabled(true);
                instance.pendingImpulse = SPAWN_IMPULSE;
                this.#onSpawnedCoin(instance);
                this.#frameLastSpawn = 0;
            }
        }
        for (const instance of this.#instances) {
            if (instance.used) {
                if (instance.pendingImpulse && instance.body.mass() > 0) {
                    instance.body.applyImpulse(instance.pendingImpulse, true);
                    instance.pendingImpulse = undefined;
                }
                update({
                    instance,
                    meshes: this.#meshes
                });
            }
        }
    }

    static refresh() {
        this.#meshes.forEach(mesh => mesh.instanceMatrix.needsUpdate = true);
    }

    static getSize() {
        return {
            width: RADIUS * 2,
            height: RADIUS * 2,
            depth: DEPTH
        }
    }

    static deposit({ position, rotation = new Vector3(0, 0, 0), impulse }) {
        const instance = this.#instances.find(instance => !instance.used);
        instance.used = true;
        initializePosition({ instance, position, rotation });
        instance.body.setEnabled(true);
        if (impulse) {
            instance.pendingImpulse = impulse.clone();
        }
        return instance;
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
        instance.body.setEnabled(false);
        initializePosition({ instance, hidden: true });
        update({ instance, meshes: this.#meshes });
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
                pendingImpulse: instance.pendingImpulse ? instance.pendingImpulse.toArray() : undefined
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
                pendingImpulse: instance.pendingImpulse ? new Vector3().fromArray(instance.pendingImpulse) : undefined,
            };
            for (let indexCollider = 0; indexCollider < body.numColliders(); indexCollider++) {
                const collider = body.collider(indexCollider);
                collider.userData = {
                    objectType: TYPE,
                    index: indexInstance
                };
            }
            update({ instance: this.#instances[indexInstance], meshes: this.#meshes });
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

function createInstances({ scene, instances, groups }) {
    for (let indexInstance = instances.length; indexInstance < MAX_INSTANCES; indexInstance++) {
        createInstance({ scene, instances, groups });
    }
}

function createInstance({ scene, instances, groups }) {
    const body = scene.createDynamicBody();
    body.setEnabled(false);
    body.setSoftCcdPrediction(SOFT_CCD_PREDICTION);
    body.setAngularDamping(ANGULAR_DAMPING);
    body.setLinearDamping(LINEAR_DAMPING);
    body.setAdditionalSolverIterations(ADDITIONAL_SOLVER_ITERATIONS);
    const index = instances.length;
    const collider = scene.createCylinderCollider({
        userData: { objectType: TYPE, index },
        radius: RADIUS,
        height: DEPTH,
        friction: friction,
        restitution: RESTITUTION,
        density: density
    }, body);
    collider.setCollisionGroups(groups.OBJECTS << 16 | groups.ALL);
    const instance = {
        objectType: TYPE,
        index,
        position: new Vector3(),
        rotation: new Quaternion(),
        body,
        matrix: new Matrix4(),
        used: false,
        pendingImpulse: undefined
    };
    instances.push(instance);
    return instance;
}

function initializePosition({ instance, hidden, position, rotation }) {
    if (hidden) {
        instance.position.fromArray(INITIAL_HIDDEN_POSITION);
        instance.rotation.fromArray(INITIAL_HIDDEN_ROTATION);
        instance.body.setLinvel(INITIAL_HIDDEN_LINEAR_VELOCITY, false);
        instance.body.setAngvel(INITIAL_HIDDEN_ANGULAR_VELOCITY, false);
    } else {
        if (position) {
            instance.position.copy(position);
        }
        if (rotation) {
            instance.rotation.setFromEuler(new Euler(rotation.x, rotation.y, rotation.z));
        }
    }
    instance.body.setTranslation(instance.position);
    instance.body.setRotation(instance.rotation);
}

function update({ instance, meshes }) {
    instance.position.copy(instance.body.translation());
    instance.rotation.copy(instance.body.rotation());
    instance.matrix.compose(instance.position, instance.rotation, instance.used ? DEFAULT_SCALE : INITIAL_SCALE);
    meshes.forEach(mesh => mesh.setMatrixAt(instance.index, instance.matrix));
}