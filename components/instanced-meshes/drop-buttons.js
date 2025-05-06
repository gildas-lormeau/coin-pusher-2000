import { Vector3, Quaternion, Matrix4, Euler, InstancedMesh, PointLight } from "three";

const MAX_INSTANCES = 8;
const INITIAL_SCALE = new Vector3(1, 1, 1);
const BUTTON_PRESS_DEPTH = -0.005;
const BUTTON_RELEASE_DELAY = 75;
const LIGHT_INTENSITY = .5;
const LIGHT_COLOR = 0xffaa00;
const LIGHT_DISTANCE = 0.03;
const LIGHT_DECAY = .1;
const LIGHT_POSITION_Y = 0.00725;
const MODEL_PATH = "./../assets/drop-button.glb";
const TYPES = 2;
const COLORS = [
    { color: 0xffffff, background: 0xff0000 }
];
const MAX_COLORS = COLORS.length;

export default class {

    static MAX_INSTANCES = MAX_INSTANCES;
    static TYPES = TYPES;
    static COLORS = MAX_COLORS;

    static #meshes;
    static #instances;
    static #bulbLights = [];
    static #interactiveObjects = [];

    static async initialize({ scene }) {
        const { materials, geometries } = await initializeModel({ scene });
        this.#meshes = initializeInstancedMeshes({
            scene,
            interactiveObjects: this.#interactiveObjects,
            materials,
            geometries,
            onClick: ({ color, type, instanceId }) => {
                const instance = this.#instances[color][type].find(instance => instance.index === instanceId);
                if (!instance.isPressing) {
                    instance.isPressing = true;
                }
                instance.onPress();
            }
        });
        this.#instances = [];
        createInstances({ scene, instances: this.#instances, bulbLights: this.#bulbLights });
    }

    static update(time) {
        const matrix = new Matrix4();
        const position = new Vector3();
        const rotation = new Quaternion();
        const scale = new Vector3();

        this.#interactiveObjects.forEach(object => {
            const { color, type } = object.userData;
            const instances = this.#instances[color][type];
            for (const instance of instances) {
                if (instance.isPressing) {
                    if (instance.pressStartTime === undefined) {
                        instance.pressStartTime = time;
                        object.getMatrixAt(instance.index, matrix);
                        matrix.decompose(position, rotation, scale);
                        instance.initialPosition = position.clone();
                        instance.initialRotation = rotation.clone();
                    } else {
                        const bulbLight = this.#bulbLights[color][type][instance.index];
                        const elapsedTime = time - instance.pressStartTime;
                        if (elapsedTime < BUTTON_RELEASE_DELAY) {
                            const offsetY = new Vector3(0, BUTTON_PRESS_DEPTH, 0);
                            const interpolationFactor = elapsedTime / BUTTON_RELEASE_DELAY;
                            bulbLight.intensity = interpolationFactor * LIGHT_INTENSITY;
                            const offset = offsetY.multiplyScalar(interpolationFactor);
                            offset.applyQuaternion(instance.initialRotation);
                            const newPosition = instance.initialPosition.clone().add(offset);
                            instance.buttonPosition.copy(newPosition);
                        } else {
                            bulbLight.intensity = LIGHT_INTENSITY;
                            instance.isPressing = false;
                            instance.pressStartTime = undefined;
                            instance.buttonPosition.copy(instance.initialPosition);
                        }
                    }
                }
            }
        });

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

    static addButton({ type, color, position, rotation, onPress }) {
        const instance = this.#instances[color][type].find(instance => !instance.used);
        instance.used = true;
        instance.initialPosition = position;
        instance.initialRotation = rotation;
        instance.onPress = onPress;
        const bulbLight = this.#bulbLights[color][type][instance.index];
        bulbLight.visible = true;
        initializePosition({ instance, position, rotation, bulbLight });
        return instance;
    }

    static get interactiveObjects() {
        return this.#interactiveObjects;
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
    const meshes = model.scene.children;
    const materials = [];
    const geometries = [];
    for (let color = 0; color < MAX_COLORS; color++) {
        const mesh = meshes[0];
        const colorMaterial = mesh.children[1].material.clone();
        colorMaterial.color.setHex(COLORS[color].color);
        const backgroundMaterial = mesh.children[2].material.clone();
        backgroundMaterial.color.setHex(COLORS[color].background);
        const defaultMesh = meshes[1];
        const backgroundMaterialDefault = defaultMesh.children[1].material.clone();
        backgroundMaterialDefault.color.setHex(COLORS[color].background);
        materials.push([
            [mesh.children[0].material, colorMaterial, backgroundMaterial],
            [mesh.children[0].material, backgroundMaterialDefault]
        ]);
        geometries.push([
            [mesh.children[0].geometry, mesh.children[1].geometry, mesh.children[2].geometry],
            [defaultMesh.children[0].geometry, defaultMesh.children[1].geometry]
        ]);
    }
    return {
        materials,
        geometries
    };
}

function initializeInstancedMeshes({ scene, materials, geometries, interactiveObjects, onClick }) {
    const meshes = [];
    for (let color = 0; color < MAX_COLORS; color++) {
        const colorMeshes = [];
        for (let type = 0; type < TYPES; type++) {
            const typeMeshes = [];
            for (let indexMaterial = 0; indexMaterial < materials[color][type].length; indexMaterial++) {
                const mesh = new InstancedMesh(geometries[color][type][indexMaterial], materials[color][type][indexMaterial], MAX_INSTANCES);
                mesh.active = indexMaterial > 0;
                mesh.userData = {
                    color,
                    type,
                    onClick: instanceId => onClick({ color, type, instanceId })
                };
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                scene.addObject(mesh);
                typeMeshes.push(mesh);
                interactiveObjects.push(mesh);
            }
            colorMeshes.push(typeMeshes);
        }
        meshes.push(colorMeshes);
    }
    return meshes;
}

function createInstances({ scene, instances, bulbLights }) {
    for (let color = 0; color < MAX_COLORS; color++) {
        instances[color] = [];
        bulbLights[color] = [];
        for (let type = 0; type < TYPES; type++) {
            instances[color][type] = [];
            bulbLights[color][type] = [];
            for (let indexButton = instances[color][type].length; indexButton < MAX_INSTANCES; indexButton++) {
                createInstance({ type, color, instances });
                const bulbLight = new PointLight(LIGHT_COLOR, LIGHT_INTENSITY, LIGHT_DISTANCE, LIGHT_DECAY);
                bulbLight.castShadow = false;
                bulbLights[color][type][indexButton] = bulbLight;
                bulbLight.visible = false;
                scene.addObject(bulbLight);
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
        buttonPosition: new Vector3(),
        rotation: new Quaternion(),
        matrix: new Matrix4(),
        used: false
    };
    instances[color][type].push(instance);
    return instance;
}

function initializePosition({ instance, position, rotation, bulbLight }) {
    instance.position.fromArray([position.x, position.y, position.z]);
    instance.rotation.setFromEuler(new Euler(rotation.x, rotation.y, rotation.z));
    instance.buttonPosition.fromArray([position.x, position.y, position.z]);
    bulbLight.position.fromArray([position.x, position.y + LIGHT_POSITION_Y, position.z,]);
    bulbLight.rotation.set(rotation.x, rotation.y, rotation.z);
}

function update({ instance, meshes }) {
    instance.matrix.compose(instance.position, instance.rotation, INITIAL_SCALE);
    meshes[0].setMatrixAt(instance.index, instance.matrix);
    instance.matrix.compose(instance.buttonPosition, instance.rotation, INITIAL_SCALE);
    for (let indexMesh = 1; indexMesh < meshes.length; indexMesh++) {
        meshes[indexMesh].setMatrixAt(instance.index, instance.matrix);
    }
}