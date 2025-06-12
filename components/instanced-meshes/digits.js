import { Vector3, Quaternion, Matrix4, Euler, InstancedMesh } from "three";

const MAX_INSTANCES = 16;
const WIDTH = 0.04;
const HEIGHT = 0.055;
const DEPTH = 0.002;
const INITIAL_HIDDEN_POSITION = [0, 0, 0];
const INITIAL_HIDDEN_ROTATION = [0, 0, 0, 1];
const INITIAL_SCALE = new Vector3(1, 1, 1);
const MODEL_PATH = "./../assets/digit.glb";
const TYPES = 11;
const COLORS = [
    { color: 0xffffff, background: 0x000000 },
    { color: 0x000000, background: 0xffffff },
    { color: 0x00ff00, background: 0x000000 }
];
const MAX_COLORS = COLORS.length;

export default class {

    static MAX_INSTANCES = MAX_INSTANCES;
    static TYPES = TYPES;
    static COLORS = MAX_COLORS;
    static WIDTH = WIDTH;
    static HEIGHT = HEIGHT;
    static DEPTH = DEPTH;

    static #meshes;
    static #instances;

    static async initialize({ scene }) {
        const { materials, geometries } = await initializeModel({ scene });
        this.#meshes = initializeInstancedMeshes({ scene, materials, geometries });
        this.#instances = [];
        createInstances({ instances: this.#instances });
    }

    static update() {
        for (let color = 0; color < MAX_COLORS; color++) {
            for (let type = 0; type < TYPES; type++) {
                for (const instance of this.#instances[color][type]) {
                    if (instance.used) {
                        update({
                            instance,
                            meshes: this.#meshes[color][type]
                        });
                    }
                }
                this.#meshes[color][type].forEach(mesh => mesh.instanceMatrix.needsUpdate = true);
            }
        }
    }

    static addDigit({ type, color, position, rotation }) {
        const instance = this.#instances[color][type].find(instance => !instance.used);
        instance.used = true;
        instance.initialPosition = position;
        instance.initialRotation = rotation;
        initializePosition({ instance, position, rotation });
        return instance;
    }

    static setVisible(instance, visible) {
        initializePosition({ instance, hidden: !visible, position: instance.initialPosition, rotation: instance.initialRotation });
        update({
            instance,
            meshes: this.#meshes[instance.color][instance.type]
        });
    }

    static getBackgroundColor(colorIndex) {
        return COLORS[colorIndex].background;
    }
}

async function initializeModel({ scene }) {
    const model = await scene.loadModel(MODEL_PATH);
    const meshes = model.scene.children;
    const materials = [];
    const geometries = [];
    for (let color = 0; color < MAX_COLORS; color++) {
        const colorMaterials = [];
        const colorGeometries = [];
        for (let type = 0; type < meshes.length - 1; type++) {
            const mesh = meshes[type];
            const colorMaterial = mesh.children[0].material.clone();
            colorMaterial.color.setHex(COLORS[color].color);
            const baseColorMaterial = mesh.children[1].material.clone();
            baseColorMaterial.color.setHex(COLORS[color].background);
            colorMaterials.push([colorMaterial, baseColorMaterial]);
            colorGeometries.push([mesh.children[0].geometry, mesh.children[1].geometry]);
        }
        const emptyDigitMesh = meshes[meshes.length - 1];
        const baseColorMaterial = emptyDigitMesh.material.clone();
        baseColorMaterial.color.setHex(COLORS[color].background);
        colorMaterials.push([baseColorMaterial]);
        colorGeometries.push([emptyDigitMesh.geometry]);
        materials.push(colorMaterials);
        geometries.push(colorGeometries);
    }
    return {
        materials,
        geometries
    };
}

function initializeInstancedMeshes({ scene, materials, geometries }) {
    const meshes = [];
    for (let color = 0; color < MAX_COLORS; color++) {
        const colorMeshes = [];
        for (let type = 0; type < TYPES; type++) {
            const typeMeshes = [];
            for (let indexMaterial = 0; indexMaterial < materials[color][type].length; indexMaterial++) {
                const mesh = new InstancedMesh(geometries[color][type][indexMaterial], materials[color][type][indexMaterial], MAX_INSTANCES);
                scene.addObject(mesh);
                typeMeshes.push(mesh);
            }
            colorMeshes.push(typeMeshes);
        }
        meshes.push(colorMeshes);
    }
    return meshes;
}

function createInstances({ instances }) {
    for (let color = 0; color < MAX_COLORS; color++) {
        instances[color] = [];
        for (let type = 0; type < TYPES; type++) {
            instances[color][type] = [];
            for (let indexDigit = instances[color][type].length; indexDigit < MAX_INSTANCES; indexDigit++) {
                createInstance({ type, color, instances });
            }
        }
    }
}

function createInstance({ type, color, instances }) {
    const index = instances[color][type].length;
    const instance = {
        index,
        type,
        color,
        position: new Vector3(),
        rotation: new Quaternion(),
        matrix: new Matrix4(),
        used: false
    };
    instances[color][type].push(instance);
    return instance;
}

function initializePosition({ instance, hidden, position, rotation }) {
    if (hidden) {
        instance.position.fromArray(INITIAL_HIDDEN_POSITION);
        instance.rotation.fromArray(INITIAL_HIDDEN_ROTATION);
    } else {
        instance.position.fromArray([position.x, position.y, position.z]);
        instance.rotation.setFromEuler(new Euler(rotation.x, rotation.y, rotation.z));
    }
}

function update({ instance, meshes }) {
    instance.matrix.compose(instance.position, instance.rotation, INITIAL_SCALE);
    meshes.forEach(mesh => mesh.setMatrixAt(instance.index, instance.matrix));
}