import { Vector3, Quaternion, Matrix4, Euler, InstancedMesh, PointLight } from "three";

const MAX_INSTANCES = 3;
const INITIAL_SCALE = new Vector3(0, 0, 0);
const DEFAULT_SCALE = new Vector3(1, 1, 1);
const BUTTON_PRESS_DEPTH = -0.005;
const BUTTON_RELEASE_DURATION = 10;
const BLINK_DURATION = 50;
const LIGHT_INTENSITY_ON = 35;
const LIGHT_INTENSITY_OFF = 1;
const LIGHT_COLOR = 0xffaa00;
const LIGHT_DISTANCE = 0.03;
const LIGHT_DECAY = .1;
const LIGHT_POSITION_Y = 0.00725;
const MODEL_PATH = "./../assets/buttons.glb";
const TYPES = 3;
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
                if (instance.enabled) {
                    this.onPress(instance);
                }
            }
        });
        this.#instances = [];
        createInstances({ scene, instances: this.#instances, bulbLights: this.#bulbLights });
    }

    static update() {
        const matrix = new Matrix4();
        const position = new Vector3();
        const rotation = new Quaternion();
        const scale = new Vector3();

        this.#interactiveObjects.forEach(object => {
            const { color, type } = object.userData;
            const instances = this.#instances[color][type];
            for (const instance of instances) {
                if (instance.isPressing) {
                    if (instance.framePressStart === -1) {
                        instance.framePressStart = 0;
                        object.getMatrixAt(instance.index, matrix);
                        matrix.decompose(position, rotation, scale);
                    } else {
                        const bulbLight = this.#bulbLights[color][type][instance.index];
                        instance.framePressStart++;
                        if (instance.framePressStart < BUTTON_RELEASE_DURATION) {
                            const offsetY = new Vector3(0, BUTTON_PRESS_DEPTH, 0);
                            const interpolationFactor = instance.framePressStart / BUTTON_RELEASE_DURATION;
                            const offset = offsetY.multiplyScalar(interpolationFactor);
                            offset.applyQuaternion(instance.initialRotation);
                            const newPosition = instance.initialPosition.clone().add(offset);
                            instance.buttonPosition.copy(newPosition);
                            if (instance.enabled) {
                                bulbLight.intensity = interpolationFactor * LIGHT_INTENSITY_ON;
                            }
                        } else {
                            bulbLight.intensity = LIGHT_INTENSITY_OFF;
                            instance.isPressing = false;
                            instance.framePressStart = -1;
                            instance.buttonPosition.copy(instance.initialPosition);
                        }
                    }
                }
                if (instance.isBlinking) {
                    if (instance.frameBlinkStart === -1) {
                        instance.frameBlinkStart = 0;
                    } else {
                        instance.frameBlinkStart++;
                        if (instance.frameBlinkStart >= BLINK_DURATION) {
                            const bulbLight = this.#bulbLights[color][type][instance.index];
                            instance.frameBlinkStart = 0;
                            instance.blinkingOn = !instance.blinkingOn;
                            if (instance.blinkingOn) {
                                bulbLight.intensity = LIGHT_INTENSITY_ON;
                            } else {
                                bulbLight.intensity = LIGHT_INTENSITY_OFF;
                            }
                        }
                    }
                    if (!instance.blinkingOn && !instance.enabled) {
                        instance.isBlinking = false;
                        instance.frameBlinkStart = undefined;
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

    static load(buttons) {
        buttons.forEach((colorButtons, color) => {
            colorButtons.forEach((typeButtons, type) => {
                typeButtons.forEach((button, indexButton) => {
                    const instance = this.#instances[color][type][indexButton];
                    instance.used = true;
                    instance.enabled = button.enabled;
                    instance.isPressing = button.isPressing;
                    instance.isBlinking = button.isBlinking;
                    instance.frameBlinkStart = button.frameBlinkStart;
                    instance.blinkingOn = button.blinkingOn;
                    instance.framePressStart = button.framePressStart;
                    instance.buttonPosition.fromArray(button.position);
                });
            });
        });
    }

    static save() {
        return this.#instances.map(colorInstances => {
            return colorInstances.map(typeInstances => {
                return typeInstances.map(instance => {
                    return {
                        enabled: instance.enabled,
                        isPressing: instance.isPressing,
                        isBlinking: instance.isBlinking,
                        frameBlinkStart: instance.frameBlinkStart,
                        blinkingOn: instance.blinkingOn,
                        framePressStart: instance.framePressStart,
                        position: instance.buttonPosition.toArray()
                    };
                });
            });
        });
    }

    static addButton({ type, color, position, rotation }) {
        const instance = this.#instances[color][type].find(instance => !instance.used);
        instance.used = true;
        instance.enabled = true;
        const bulbLight = this.#bulbLights[color][type][instance.index];
        bulbLight.visible = true;
        bulbLight.intensity = LIGHT_INTENSITY_OFF;
        initializePosition({ instance, position, rotation, bulbLight });
        return instance;
    }

    static enable({ type, color, index }, enabled) {
        const instance = this.#instances[color][type].find(instance => instance.index === index);
        instance.enabled = enabled;
    }

    static blink({ type, color, index }, active) {
        const instance = this.#instances[color][type].find(instance => instance.index === index);
        instance.isBlinking = active;
    }

    static get interactiveObjects() {
        return this.#interactiveObjects;
    }
}

async function initializeModel({ scene }) {
    const model = await scene.loadModel(MODEL_PATH);
    const meshes = model.scene.children;
    const materials = [];
    const geometries = [];
    for (let color = 0; color < MAX_COLORS; color++) {
        const dropButtonMesh = meshes[0];
        const dropButtonColorMaterial = dropButtonMesh.children[1].material.clone();
        dropButtonColorMaterial.color.setHex(COLORS[color].color);
        const dropButtonBackgroundMaterial = dropButtonMesh.children[2].material.clone();
        dropButtonBackgroundMaterial.color.setHex(COLORS[color].background);
        const startButtonMesh = meshes[2];
        const startButtonColorMaterial = startButtonMesh.children[0].material.clone();
        startButtonColorMaterial.color.setHex(COLORS[color].color);
        const startButtonBackgroundMaterial = startButtonMesh.children[1].material.clone();
        startButtonBackgroundMaterial.color.setHex(COLORS[color].background);
        const defaultMesh = meshes[1];
        const defaultButtonBackgroundMaterial = defaultMesh.children[1].material.clone();
        defaultButtonBackgroundMaterial.color.setHex(COLORS[color].background);
        materials.push([
            [dropButtonMesh.children[0].material, dropButtonColorMaterial, dropButtonBackgroundMaterial],
            [startButtonMesh.children[0].material, startButtonColorMaterial, startButtonBackgroundMaterial],
            [defaultMesh.children[0].material, defaultButtonBackgroundMaterial]
        ]);
        geometries.push([
            [dropButtonMesh.children[0].geometry, dropButtonMesh.children[1].geometry, dropButtonMesh.children[2].geometry],
            [startButtonMesh.children[0].geometry, startButtonMesh.children[1].geometry, startButtonMesh.children[2].geometry],
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
                for (let indexInstance = 0; indexInstance < MAX_INSTANCES; indexInstance++) {
                    mesh.setMatrixAt(indexInstance, INITIAL_SCALE);
                }
                mesh.active = indexMaterial > 0;
                mesh.userData = {
                    color,
                    type,
                    onClick: instanceId => onClick({ color, type, instanceId })
                };
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
                const bulbLight = new PointLight(LIGHT_COLOR, LIGHT_INTENSITY_ON, LIGHT_DISTANCE, LIGHT_DECAY);
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
        initialPosition: new Vector3(),
        initialRotation: new Quaternion(),
        matrix: new Matrix4(),
        used: false,
        enabled: false,
        isPressing: false,
        isBlinking: false,
        frameBlinkStart: -1,
        blinkingOn: false,
        framePressStart: -1
    };
    instances[color][type].push(instance);
    return instance;
}

function initializePosition({ instance, position, rotation, bulbLight }) {
    instance.position.fromArray([position.x, position.y, position.z]);
    instance.rotation.setFromEuler(new Euler(rotation.x, rotation.y, rotation.z));
    instance.initialPosition.fromArray([position.x, position.y, position.z]);
    instance.initialRotation.setFromEuler(new Euler(rotation.x, rotation.y, rotation.z));
    instance.buttonPosition.fromArray([position.x, position.y, position.z]);
    bulbLight.position.fromArray([position.x, position.y + LIGHT_POSITION_Y, position.z,]);
    bulbLight.rotation.set(rotation.x, rotation.y, rotation.z);
}

function update({ instance, meshes }) {
    instance.matrix.compose(instance.position, instance.rotation, instance.used ? DEFAULT_SCALE : INITIAL_SCALE);
    meshes[0].setMatrixAt(instance.index, instance.matrix);
    instance.matrix.compose(instance.buttonPosition, instance.rotation, instance.used ? DEFAULT_SCALE : INITIAL_SCALE);
    for (let indexMesh = 1; indexMesh < meshes.length; indexMesh++) {
        meshes[indexMesh].setMatrixAt(instance.index, instance.matrix);
    }
}