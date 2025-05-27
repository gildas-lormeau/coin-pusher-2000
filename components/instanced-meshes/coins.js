import { Vector3, Quaternion, Matrix4, Euler, InstancedMesh } from "three";

const TYPE = "coin";
const MAX_INSTANCES = 1024;
const RADIUS = 0.03;
const DEPTH = 0.006;
const INIIAL_POSITION_DELTA_X = .025;
const INITIAL_POSITION_MIN_DELTA_X = 0.001;
const INITIAL_POSITIONS_X = [-0.1125, 0, 0.1125];
const INITIAL_POSITION = [0, .9, -0.32 + DEPTH / 2];
const INITIAL_HIDDEN_POSITION = [0, 0, 0];
const INITIAL_HIDDEN_ROTATION = [0, 0, 0, 1];
const INITIAL_HIDDEN_LINEAR_VELOCITY = new Vector3(0, 0, 0);
const INITIAL_HIDDEN_ANGULAR_VELOCITY = new Vector3(0, 0, 0);
const INITIAL_SCALE = new Vector3(1, 1, 1);
const EULER_ROTATION = new Euler(Math.PI / 2, 0, 0);
const SOFT_CCD_PREDICTION = 0.1;
const ADDITIONAL_SOLVER_ITERATIONS = 1;
const ANGULAR_DAMPING = 0.5;
const LINEAR_DAMPING = 0.5;
const FRICTION = 0.2;
const RESTITUTION = 0;
const DENSITY = 1;
const MODEL_PATH = "./../assets/coin.glb";
const SPAWN_TIME_DELTA = 60;
const RENDERING_LINEAR_THRESHOLD = .005 ** 2;

export default class {

    static TYPE = TYPE;
    static MAX_INSTANCES = MAX_INSTANCES;
    static RADIUS = RADIUS;
    static DEPTH = DEPTH;

    static #scene;
    static #meshes = [];
    static #instances = [];
    static #spawnedCoins = [];
    static #lastSpawnTime = 0;

    static async initialize({ scene }) {
        this.#scene = scene;
        const { materials, geometries } = await initializeModel({ scene });
        this.#meshes = initializeInstancedMeshes({ scene, materials, geometries });
        this.#instances = [];
        createInstances({ scene, instances: this.#instances });
    }

    static getCoin({ index }) {
        return this.#instances[index];
    }

    static update(time) {
        if (this.#spawnedCoins.length && time !== undefined) {
            if (time - this.#lastSpawnTime >= SPAWN_TIME_DELTA) {
                const { slot } = this.#spawnedCoins.shift();
                const instance = this.#instances.find(instance => !instance.used);
                instance.used = true;
                initializePosition({ instance, slot });
                instance.body.setEnabled(true);
                this.#lastSpawnTime = time;
            }
        }
        for (const instance of this.#instances) {
            if (instance.used) {
                if (instance.pendingImpulse && instance.body.mass() > 0) {
                    instance.body.applyImpulse(instance.pendingImpulse, true);
                    instance.pendingImpulse = null;
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

    static get coinCount() {
        return this.#instances.filter(instance => instance.used).length;
    }

    static save() {
        return this.#instances.map(instance => {
            return {
                position: instance.position.toArray(),
                rotation: instance.rotation.toArray(),
                used: instance.used,
                bodyHandle: this.#instances[instance.index].body.handle
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
                body
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
        friction: FRICTION,
        restitution: RESTITUTION,
        density: DENSITY
    }, body);
    const instance = {
        objectType: TYPE,
        index,
        position: new Vector3(),
        rotation: new Quaternion(),
        body,
        matrix: new Matrix4(),
        used: false
    };
    instances.push(instance);
    return instance;
}

function initializePosition({ instance, hidden, position, rotation, slot = 1 }) {
    if (hidden) {
        instance.position.fromArray(INITIAL_HIDDEN_POSITION);
        instance.rotation.fromArray(INITIAL_HIDDEN_ROTATION);
        instance.body.setLinvel(INITIAL_HIDDEN_LINEAR_VELOCITY);
        instance.body.setAngvel(INITIAL_HIDDEN_ANGULAR_VELOCITY);
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
    const linearVelocity = instance.body.linvel();
    const angularVelocity = instance.body.angvel();
    const linearSpeed =
        linearVelocity.x * linearVelocity.x +
        linearVelocity.y * linearVelocity.y +
        linearVelocity.z * linearVelocity.z;
    const angularSpeed =
        angularVelocity.x * angularVelocity.x +
        angularVelocity.y * angularVelocity.y +
        angularVelocity.z * angularVelocity.z;
    if (linearSpeed > RENDERING_LINEAR_THRESHOLD||
        forceRefresh) {
        instance.position.copy(instance.body.translation());
        instance.rotation.copy(instance.body.rotation());
        instance.matrix.compose(instance.position, instance.rotation, INITIAL_SCALE);
        meshes.forEach(mesh => {
            mesh.setMatrixAt(instance.index, instance.matrix)
            mesh.instanceMatrix.needsUpdate = true;
        });
    } else if (!instance.body.isSleeping() && linearSpeed > 0) {
        instance.body.sleep();
    }
}