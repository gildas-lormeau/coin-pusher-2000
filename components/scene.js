import { Quaternion, Vector3, Euler, Scene, Color, WebGLRenderer, PMREMGenerator, DirectionalLight, AmbientLight, SRGBColorSpace, ACESFilmicToneMapping, VSMShadowMap } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";

const BACKGROUND_COLOR = 0x222222;
const NUM_SOLVER_ITERATIONS = 2;
const NUM_ADDITIONAL_FRICTION_ITERATIONS = 1;
const NUM_INTERNAL_PGS_ITERATIONS = 2;
const TIMESTEP = 1 / 60;
const ANTIALIAS = true;
const POWER_PREFERENCE = "high-performance";
const SHADOW_MAP_TYPE = VSMShadowMap;
const GRAVITY_FORCE = new Vector3(0, -9.81, 0);
const EXR_ASSET_PATH = "assets/sunset.exr";
const ENVIRONMENT_INTENSITY = .35;
const TONE_MAPPING_EXPOSURE = 1;
const AMBIANT_LIGHT_COLOR = 0xffffff;
const AMBIANT_LIGHT_INTENSITY = 0.5;
const DIRECTIONAL_LIGHT_COLOR = 0xffffff;
const DIRECTIONAL_LIGHT_INTENSITY = 1.5;
const DIRECTIONAL_LIGHT_POSITION = [-1, 2.5, 1];
const DIRECTIONAL_LIGHT_CAST_SHADOW = true;
const DIRECTIONAL_LIGHT_SHADOW_BIAS = -0.001;
const DIRECTIONAL_LIGHT_SHADOW_NEAR = 0.5;
const DIRECTIONAL_LIGHT_SHADOW_FAR = 50;
const DIRECTIONAL_LIGHT_SHADOW_LEFT = -5;
const DIRECTIONAL_LIGHT_SHADOW_RIGHT = 5;
const DIRECTIONAL_LIGHT_SHADOW_TOP = 5;
const DIRECTIONAL_LIGHT_SHADOW_BOTTOM = -5;
const SHADOW_MAP_SIZE = 1024;

let World, RigidBodyDesc, ColliderDesc, TriMeshFlags, JointData;

export default class {

    static TIMESTEP = TIMESTEP;

    constructor({ containerElement, camera, rapier }) {
        this.#containerElement = containerElement;
        this.#camera = camera;
        ({ World, RigidBodyDesc, ColliderDesc, TriMeshFlags, JointData } = rapier);
        this.#world = new World(GRAVITY_FORCE);
        this.#world.integrationParameters.numSolverIterations = NUM_SOLVER_ITERATIONS;
        this.#world.integrationParameters.numAdditionalFrictionIterations = NUM_ADDITIONAL_FRICTION_ITERATIONS;
        this.#world.integrationParameters.numInternalPgsIterations = NUM_INTERNAL_PGS_ITERATIONS;
        this.#world.integrationParameters.minIslandSize = 32;
        this.#world.integrationParameters.switchToSmallStepsPgsSolver();
        this.#world.timestep = TIMESTEP;
        this.#scene.add(new AmbientLight(AMBIANT_LIGHT_COLOR, AMBIANT_LIGHT_INTENSITY));
        const directionalLight = new DirectionalLight(DIRECTIONAL_LIGHT_COLOR, DIRECTIONAL_LIGHT_INTENSITY);
        directionalLight.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
        directionalLight.position.set(...DIRECTIONAL_LIGHT_POSITION);
        directionalLight.castShadow = DIRECTIONAL_LIGHT_CAST_SHADOW;
        directionalLight.shadow.bias = DIRECTIONAL_LIGHT_SHADOW_BIAS;
        directionalLight.shadow.camera.near = DIRECTIONAL_LIGHT_SHADOW_NEAR;
        directionalLight.shadow.camera.far = DIRECTIONAL_LIGHT_SHADOW_FAR;
        directionalLight.shadow.camera.left = DIRECTIONAL_LIGHT_SHADOW_LEFT;
        directionalLight.shadow.camera.right = DIRECTIONAL_LIGHT_SHADOW_RIGHT;
        directionalLight.shadow.camera.top = DIRECTIONAL_LIGHT_SHADOW_TOP;
        directionalLight.shadow.camera.bottom = DIRECTIONAL_LIGHT_SHADOW_BOTTOM;
        this.#scene.add(directionalLight);
        containerElement.appendChild(this.#renderer.domElement);
    }

    #containerElement;
    #scene = new Scene();
    #css3DScene = new Scene();
    #renderer = new WebGLRenderer({
        antialias: ANTIALIAS,
        powerPreference: POWER_PREFERENCE
    });
    #world;
    #camera = null;

    async initialize(width, height, pixelRatio) {
        const pmremGenerator = new PMREMGenerator(this.#renderer);
        pmremGenerator.compileEquirectangularShader();
        this.#scene.environment = await new Promise((resolve, reject) => new EXRLoader().load(EXR_ASSET_PATH,
            texture => resolve(pmremGenerator.fromEquirectangular(texture).texture), undefined, reject));
        this.#scene.background = new Color(BACKGROUND_COLOR);
        this.#scene.environmentIntensity = ENVIRONMENT_INTENSITY;
        this.#renderer.toneMapping = ACESFilmicToneMapping;
        this.#renderer.toneMappingExposure = TONE_MAPPING_EXPOSURE;
        this.#renderer.outputColorSpace = SRGBColorSpace;
        this.#renderer.setSize(width, height);
        this.#renderer.setPixelRatio(pixelRatio);
        this.#renderer.shadowMap.enabled = true;
        this.#renderer.shadowMap.type = SHADOW_MAP_TYPE;
        this.#containerElement.appendChild(this.#renderer.domElement);
    }

    createFixedBody() {
        const rigidBodyDesc = RigidBodyDesc.fixed();
        return this.#world.createRigidBody(rigidBodyDesc);
    }

    createKinematicBody() {
        const rigidBodyDesc = RigidBodyDesc.kinematicPositionBased();
        return this.#world.createRigidBody(rigidBodyDesc);
    }

    createDynamicBody() {
        const rigidBodyDesc = RigidBodyDesc.dynamic();
        return this.#world.createRigidBody(rigidBodyDesc);
    }

    createCuboidCollider({ width, height, depth, userData, position, rotation, sensor, friction, restitution, density }, body = this.createFixedBody()) {
        const colliderDesc = ColliderDesc.cuboid(width / 2, height / 2, depth / 2);
        if (position !== undefined) {
            colliderDesc.setTranslation(...position);
        }
        if (rotation !== undefined) {
            colliderDesc.setRotation(new Quaternion().setFromEuler(new Euler(...rotation)));
        }
        if (sensor !== undefined) {
            colliderDesc.setSensor(sensor);
        }
        const collider = this.#world.createCollider(colliderDesc, body);
        if (friction !== undefined) {
            collider.setFriction(friction);
        }
        if (restitution !== undefined) {
            collider.setRestitution(restitution);
        }
        if (density !== undefined) {
            collider.setDensity(density);
        }
        if (userData !== undefined) {
            collider.userData = userData;
        }
        return collider;
    }

    createCuboidColliderFromBoundingBox({ mesh, height, userData, rotation, sensor }, body) {
        mesh.geometry.computeBoundingBox();
        const boundingBox = mesh.geometry.boundingBox;
        const worldMatrix = mesh.matrixWorld;
        worldMatrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
        const width = boundingBox.max.x - boundingBox.min.x;
        const depth = boundingBox.max.z - boundingBox.min.z;
        const minX = boundingBox.min.x;
        const minY = boundingBox.min.y;
        const minZ = boundingBox.min.z;
        const collider = this.createCuboidCollider({
            width,
            height,
            depth,
            rotation,
            sensor,
            position: [minX + width / 2, minY - height / 2, minZ + depth / 2],
            userData
        }, body);
        return collider;
    }

    createTrimeshCollider({ vertices, indices, userData, position, rotation, sensor, friction, restitution, density }, body = this.createFixedBody()) {
        const colliderDesc = ColliderDesc.trimesh(vertices, indices, TriMeshFlags.ORIENTED | TriMeshFlags.FIX_INTERNAL_EDGES);
        if (position !== undefined) {
            colliderDesc.setTranslation(...position);
        }
        if (rotation !== undefined) {
            colliderDesc.setRotation(new Quaternion().setFromEuler(new Euler(...rotation)));
        }
        if (sensor !== undefined) {
            colliderDesc.setSensor(sensor);
        }
        const collider = this.#world.createCollider(colliderDesc, body);
        if (friction !== undefined) {
            collider.setFriction(friction);
        }
        if (restitution !== undefined) {
            collider.setRestitution(restitution);
        }
        if (density !== undefined) {
            collider.setDensity(density);
        }
        if (userData !== undefined) {
            collider.userData = userData;
        }
        return collider;
    }

    createCylinderCollider({ radius, height, userData, position, rotation, sensor, friction, restitution, density }, body = this.createFixedBody()) {
        const colliderDesc = ColliderDesc.cylinder(height / 2, radius);
        if (position !== undefined) {
            colliderDesc.setTranslation(...position);
        }
        if (rotation !== undefined) {
            colliderDesc.setRotation(new Quaternion().setFromEuler(new Euler(...rotation)));
        }
        if (sensor !== undefined) {
            colliderDesc.setSensor(sensor);
        }
        const collider = this.#world.createCollider(colliderDesc, body);
        if (friction !== undefined) {
            collider.setFriction(friction);
        }
        if (restitution !== undefined) {
            collider.setRestitution(restitution);
        }
        if (density !== undefined) {
            collider.setDensity(density);
        }
        if (userData !== undefined) {
            collider.userData = userData;
        }
        return collider;
    }

    createConvexHullCollider({ vertices, indices, userData, position, rotation, sensor, friction, restitution, density }, body = this.createFixedBody()) {
        const colliderDesc = ColliderDesc.convexHull(vertices, indices);
        if (position !== undefined) {
            colliderDesc.setTranslation(...position);
        }
        if (rotation !== undefined) {
            colliderDesc.setRotation(new Quaternion().setFromEuler(new Euler(...rotation)));
        }
        if (sensor !== undefined) {
            colliderDesc.setSensor(sensor);
        }
        const collider = this.#world.createCollider(colliderDesc, body);
        if (friction !== undefined) {
            collider.setFriction(friction);
        }
        if (restitution !== undefined) {
            collider.setRestitution(restitution);
        }
        if (density !== undefined) {
            collider.setDensity(density);
        }
        if (userData !== undefined) {
            collider.userData = userData;
        }
        return collider;
    }

    connectBodiesWithRevoluteJoint({ body1, body2, anchor1, anchor2, axis }) {
        const jointData = JointData.revolute(anchor1, anchor2, axis);
        return this.#world.createImpulseJoint(jointData, body1, body2);
    }

    connectBodiesWithFixedJoint({ body1, body2, anchor1, anchor2, frame1, frame2 }) {
        const jointData = JointData.fixed(anchor1, frame1, anchor2, frame2);
        return this.#world.createImpulseJoint(jointData, body1, body2);
    }

    addObject(object) {
        object.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        this.#scene.add(object);
    }

    render() {
        this.#renderer.render(this.#scene, this.#camera);
    }

    step() {
        this.#world.step();
    }

    resize(width, height, pixelRatio) {
        this.#renderer.setSize(width, height);
        this.#renderer.setPixelRatio(pixelRatio);
        if (this.#camera.isPerspectiveCamera) {
            this.#camera.aspect = width / height;
            this.#camera.updateProjectionMatrix();
        }
    }

    set timestep(value) {
        this.#world.timestep = value;
    }

    get timestep() {
        return this.#world.timestep;
    }

    get triangles() {
        return this.#renderer.info.render.triangles;
    }

    get children() {
        return this.#scene.children;
    }

    forEachSensorCollision(sensors, callback) {
        this.#world.forEachCollider(collider => {
            if (sensors.includes(collider)) {
                this.#world.intersectionPairsWith(collider, otherCollider => {
                    if (collider.userData.objectType !== undefined && otherCollider.userData.objectType !== undefined) {
                        callback(collider.userData, otherCollider.userData);
                    }
                });
            }
        });
    }

    forEachCollider(callback) {
        this.#world.forEachCollider(collider => {
            if (collider.isEnabled()) {
                callback(collider);
            }
        });
    }

    loadModel(url) {
        const loader = new GLTFLoader();
        return loader.loadAsync(url);
    }

    async save() {
        return {
            world: await getCompressedBase64String(this.#world.takeSnapshot())
        };
    }

    async load(scene) {
        this.#world = World.restoreSnapshot(await getDecompressedBase64String(scene.world));
    }

    get worldBodies() {
        return this.#world.bodies;
    }

    get worldColliders() {
        return this.#world.colliders;
    }

    get worldJoints() {
        return this.#world.impulseJoints;
    }

    get camera() {
        return this.#camera;
    }

    get containerElement() {
        return this.#containerElement;
    }

    get css3DScene() {
        return this.#css3DScene;
    }

    mergeGeometries(geometries) {
        const geometry = BufferGeometryUtils.mergeGeometries(geometries, false);
        const vertices = [];
        const indices = [];
        const position = geometry.attributes.position;
        for (let i = 0; i < position.count; i++) {
            vertices.push(position.getX(i), position.getY(i), position.getZ(i));
        }
        const index = geometry.index;
        for (let i = 0; i < index.count; i++) {
            indices.push(index.getX(i));
        }
        return { vertices, indices, geometry };
    }
}

async function getCompressedBase64String(uint8Array) {
    const dataStream = new Blob([uint8Array]).stream();
    const compressionStream = new CompressionStream("gzip");
    const compressedBlob = await new Response(dataStream.pipeThrough(compressionStream)).blob();
    const base64String = await new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        fileReader.onloadend = () => resolve(fileReader.result.split(",")[1]);
        fileReader.onerror = () => reject(fileReader.error);
        fileReader.readAsDataURL(compressedBlob);
    });
    return base64String;
}

async function getDecompressedBase64String(base64String) {
    const compressedBlob = await (await fetch(`data:application/gzip;base64,${base64String}`)).blob();
    const decompressedStream = compressedBlob.stream().pipeThrough(new DecompressionStream("gzip"));
    const decompressedArrayBuffer = await new Response(decompressedStream).arrayBuffer();
    return new Uint8Array(decompressedArrayBuffer);
}