import { Vector3, Quaternion, Matrix4, Euler, InstancedMesh } from "three";

const TYPE = "token";
const MAX_INSTANCES = 16;
const RADIUS = 0.0375;
const DEPTH = 0.0075;
const INITIAL_POSITION = [0, .5, .55];
const INITIAL_HIDDEN_POSITION = [0, 0, 0];
const INITIAL_HIDDEN_ROTATION = [0, 0, 0, 1];
const INITIAL_HIDDEN_LINEAR_VELOCITY = new Vector3(0, 0, 0);
const INITIAL_HIDDEN_ANGULAR_VELOCITY = new Vector3(0, 0, 0);
const INITIAL_SCALE = new Vector3(0, 0, 0);
const DEFAULT_SCALE = new Vector3(1, 1, 1);
const EULER_ROTATION = new Euler(0, 0, 0);
const SOFT_CCD_PREDICTION = Math.max(RADIUS, DEPTH);
const ADDITIONAL_SOLVER_ITERATIONS = 0;
const ANGULAR_DAMPING = 0;
const LINEAR_DAMPING = 0;
const FRICTION = 0.3;
const RESTITUTION = 0.2;
const DENSITY = 1;
const MODEL_PATH = "./assets/token.glb";
const COLORS = [
    { color: 0x0000ff, background: 0xffffff },
    { color: 0x008000, background: 0xffffff },
    { color: 0x000000, background: 0xffffff },
    { color: 0xff00ff, background: 0xffffff },
    { color: 0xff0000, background: 0xffffff },
    { color: 0xffffff, background: 0xffffff }
];
const TYPES = COLORS.length;

export default class {

    static TYPE = TYPE;
    static MAX_INSTANCES = MAX_INSTANCES;
    static TYPES = TYPES;

    static #scene;
    static #meshes;
    static #instances;

    static async initialize({ scene, groups }) {
        this.#scene = scene;
        const { materials, geometries } = await initializeModel({ scene });
        this.#meshes = initializeInstancedMeshes({ scene, materials, geometries });
        this.#instances = [];
        createInstances({ scene, instances: this.#instances, groups });
    }

    static getToken({ type, index }) {
        return this.#instances[type][index];
    }

    static update() {
        for (let type = 0; type < TYPES; type++) {
            for (const instance of this.#instances[type]) {
                if (instance.used) {
                    update({
                        instance,
                        meshes: this.#meshes[type]
                    });
                }
            }
        }
    }

    static refresh() {
        for (let type = 0; type < TYPES; type++) {
            this.#meshes[type].forEach(mesh => mesh.instanceMatrix.needsUpdate = true);
        }
    }

    static getSize() {
        return {
            width: RADIUS * 2,
            height: RADIUS * 2,
            depth: DEPTH
        };
    }

    static deposit({ type, position, rotation }) {
        const instance = this.#instances[type].find(instance => !instance.used);
        instance.used = true;
        initializePosition({ instance, position, rotation });
        instance.body.setEnabled(true);
        update({ instance, meshes: this.#meshes[type] });
        return instance;
    }

    static recycle(instance) {
        instance.used = false;
        instance.body.setEnabled(false);
        initializePosition({ instance, hidden: true });
        update({
            instance,
            meshes: this.#meshes[instance.type]
        });
    }

    static get dynamicBodies() {
        const instances = [];
        for (let type = 0; type < TYPES; type++) {
            for (const instance of this.#instances[type]) {
                if (instance.used) {
                    instances.push({ object: instance, objects: this, body: instance.body });
                }
            }
        }
        return instances;
    }

    static save() {
        return this.#instances.map(type => {
            return type.map(instance => {
                return {
                    position: instance.position.toArray(),
                    rotation: instance.rotation.toArray(),
                    used: instance.used,
                    bodyHandle: this.#instances[instance.type][instance.index].body.handle
                };
            });
        });
    }

    static load(tokens) {
        tokens.forEach((type, indexType) => {
            type.forEach((instance, instanceIndex) => {
                const body = this.#scene.worldBodies.get(instance.bodyHandle);
                const token = this.#instances[indexType][instanceIndex];
                this.#instances[indexType][instanceIndex] = {
                    ...token,
                    position: new Vector3().fromArray(instance.position),
                    rotation: new Quaternion().fromArray(instance.rotation),
                    used: instance.used,
                    body
                };
                for (let indexCollider = 0; indexCollider < body.numColliders(); indexCollider++) {
                    const collider = body.collider(indexCollider);
                    collider.userData = {
                        objectType: TYPE,
                        type: indexType,
                        index: instanceIndex
                    };
                }
                update({
                    instance: this.#instances[indexType][instanceIndex],
                    meshes: this.#meshes[indexType]
                });
            });
        });
    }
}

async function initializeModel({ scene }) {
    const model = await scene.loadModel(MODEL_PATH);
    const meshes = model.scene.children;
    const materials = [];
    const geometries = [];
    for (let type = 0; type < meshes.length; type++) {
        const mesh = meshes[type];
        const colorMaterial = mesh.children[0].material.clone();
        colorMaterial.color.setHex(COLORS[type].color);
        const backgroundMaterial = mesh.children[1].material.clone();
        backgroundMaterial.color.setHex(COLORS[type].background);
        materials.push([colorMaterial, backgroundMaterial]);
        geometries.push([mesh.children[0].geometry, mesh.children[1].geometry]);
    }
    return {
        materials,
        geometries
    };
}

function initializeInstancedMeshes({ scene, materials, geometries }) {
    const meshes = [];
    for (let type = 0; type < TYPES; type++) {
        const typeMeshes = [];
        for (let indexMaterial = 0; indexMaterial < materials[type].length; indexMaterial++) {
            const mesh = new InstancedMesh(geometries[type][indexMaterial], materials[type][indexMaterial], MAX_INSTANCES);
            for (let indexInstance = 0; indexInstance < MAX_INSTANCES; indexInstance++) {
                mesh.setMatrixAt(indexInstance, INITIAL_SCALE);
            }
            scene.addObject(mesh);
            typeMeshes.push(mesh);
        }
        meshes.push(typeMeshes);
    }
    return meshes;
}

function createInstances({ scene, instances, groups }) {
    for (let type = 0; type < TYPES; type++) {
        instances[type] = [];
        for (let indexInstance = instances[type].length; indexInstance < MAX_INSTANCES; indexInstance++) {
            createInstance({ scene, type, instances, groups });
        }
    }
}

function createInstance({ scene, type, instances, groups }) {
    const body = scene.createDynamicBody();
    body.setEnabled(false);
    body.setSoftCcdPrediction(SOFT_CCD_PREDICTION);
    body.setAngularDamping(ANGULAR_DAMPING);
    body.setLinearDamping(LINEAR_DAMPING);
    body.setAdditionalSolverIterations(ADDITIONAL_SOLVER_ITERATIONS);
    const index = instances[type].length;
    const collider = scene.createCylinderCollider({
        userData: { objectType: TYPE, type, index },
        radius: RADIUS,
        height: DEPTH,
        friction: FRICTION,
        restitution: RESTITUTION,
        density: DENSITY
    }, body);
    collider.setCollisionGroups(groups.OBJECTS << 16 | groups.ALL);
    const instance = {
        objectType: TYPE,
        index,
        type,
        position: new Vector3(),
        rotation: new Quaternion(),
        body,
        matrix: new Matrix4(),
        used: false
    };
    instances[type].push(instance);
    return instance;
}

function initializePosition({ instance, hidden, position, rotation, }) {
    if (hidden) {
        instance.position.fromArray(INITIAL_HIDDEN_POSITION);
        instance.rotation.fromArray(INITIAL_HIDDEN_ROTATION);
        instance.body.setLinvel(INITIAL_HIDDEN_LINEAR_VELOCITY, false);
        instance.body.setAngvel(INITIAL_HIDDEN_ANGULAR_VELOCITY, false);
    } else {
        if (position) {
            instance.position.copy(position);
        } else {
            instance.position.fromArray(INITIAL_POSITION);
        }
        if (rotation) {
            instance.rotation.setFromEuler(new Euler(rotation.x, rotation.y, rotation.z));
        } else {
            instance.rotation.setFromEuler(EULER_ROTATION);
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