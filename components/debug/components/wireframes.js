import { Vector3, LineSegments, Mesh, LineBasicMaterial, BoxGeometry, CylinderGeometry, EdgesGeometry, BufferGeometry, SphereGeometry, Float32BufferAttribute, Uint32BufferAttribute, MeshBasicMaterial, Line } from "three";
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { VertexNormalsHelper } from "three/examples/jsm/helpers/VertexNormalsHelper";

export default class {
    constructor({ scene, joints = [] }) {
        this.#scene = scene;
        this.#joints = joints;
    }

    #scene;
    #joints;
    #collidersData = new Map();
    #jointsData = new WeakMap();
    #bodiesColors = new WeakMap();

    initialize() {
        this.#scene.forEachCollider(collider => {
            let color = this.#bodiesColors.get(collider.parent());
            if (!color) {
                color = Math.round(0xffffff * Math.random());
                this.#bodiesColors.set(collider.parent(), color);
            }
            const debugMaterial = new LineBasicMaterial({ color });
            const shape = collider.shapeType();
            const position = collider.translation();
            const rotation = collider.rotation();
            let geometry;
            if (shape === 0) {
                const radius = collider.radius();
                geometry = new SphereGeometry(radius, 8, 8);
            } else if (shape === 1) {
                const halfExtents = collider.halfExtents();
                geometry = new BoxGeometry(halfExtents.x * 2, halfExtents.y * 2, halfExtents.z * 2);
            } else if (shape === 6) {
                const vertices = collider.vertices();
                const indices = collider.indices();
                geometry = new BufferGeometry();
                geometry.setIndex(new Uint32BufferAttribute(indices, 1));
                geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
            } else if (shape === 10) {
                const radius = collider.radius();
                const height = collider.halfHeight() * 2;
                geometry = new CylinderGeometry(radius, radius, height, 6);
            } else if (shape === 12) {
                const halfExtents = collider.halfExtents();
                geometry = new RoundedBoxGeometry(halfExtents.x * 2, halfExtents.y * 2, halfExtents.z * 2, 1, collider.roundRadius());
            } else {
                console.warn("Unsupported collider shape:", shape);
            }
            if (geometry) {
                geometry.computeVertexNormals();
                const wireframe = new LineSegments(new EdgesGeometry(geometry), debugMaterial);
                wireframe.position.set(position.x, position.y, position.z);
                wireframe.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
                wireframe.material.depthTest = false;
                wireframe.material.transparent = true;
                wireframe.material.opacity = .5;
                this.#scene.addObject(wireframe);
                const normalMesh = new Mesh(geometry);
                normalMesh.position.copy(position);
                normalMesh.quaternion.copy(rotation);
                const normalsHelper = new VertexNormalsHelper(normalMesh, 0.025);
                normalsHelper.material.transparent = true;
                normalsHelper.material.opacity = .25;
                this.#scene.addObject(normalsHelper);
                this.#collidersData.set(collider, { wireframe, normalsHelper, normalMesh });
            }
        });
        this.#joints.forEach(({ joint, jointData }) => {
            const sphereGeo = new SphereGeometry(0.0005, 4, 4);
            const body1 = joint.body1();
            const body2 = joint.body2();
            const sphereMatBody1 = new MeshBasicMaterial({ color: this.#bodiesColors.get(body1), depthTest: false });
            const sphereMatBody2 = new MeshBasicMaterial({ color: this.#bodiesColors.get(body2), depthTest: false });
            const anchor1Mesh = new Mesh(sphereGeo, sphereMatBody1);
            const anchor2Mesh = new Mesh(sphereGeo, sphereMatBody2);
            const worldAnchor1 = localToWorld(joint.body1(), joint.anchor1());
            const worldAnchor2 = localToWorld(joint.body2(), joint.anchor2());
            anchor1Mesh.position.copy(worldAnchor1);
            anchor2Mesh.position.copy(worldAnchor2);
            this.#scene.addObject(anchor1Mesh);
            this.#scene.addObject(anchor2Mesh);
            if (jointData.axis !== undefined) {
                const startPoint = localToWorld(joint.body1(), joint.anchor1());
                const worldAxis = jointData.axis.clone().applyQuaternion(joint.body1().rotation());
                const endPoint = startPoint.clone().add(worldAxis.multiplyScalar(0.02));
                const axisGeometry = new BufferGeometry().setFromPoints([startPoint, endPoint]);
                const axisMaterial = new LineBasicMaterial({ color: 0xffff00, depthTest: false });
                const axisLine = new Line(axisGeometry, axisMaterial);
                this.#scene.addObject(axisLine);
            }
            const debuData = {
                anchor1Mesh,
                anchor2Mesh,
                axisLine: jointData.axisLine,
                axis: jointData.axis,
            };
            this.#jointsData.set(joint, debuData);
        });
    }

    update() {
        this.#scene.forEachCollider((collider) => {
            const debugData = this.#collidersData.get(collider);
            if (debugData) {
                const { wireframe, normalsHelper, normalMesh } = debugData;
                const position = collider.translation();
                const rotation = collider.rotation();
                wireframe.position.set(position.x, position.y, position.z);
                wireframe.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
                const isSleeping = collider.parent().isSleeping();
                normalMesh.position.set(position.x, position.y, position.z);
                normalMesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
                const color = isSleeping ? 0x000000 : this.#bodiesColors.get(collider.parent());
                normalsHelper.material.color.setHex(color);
                normalsHelper.update();
            }
        });
        this.#joints.forEach(({ joint }) => {
            const { anchor1Mesh, anchor2Mesh, axisLine, axis } = this.#jointsData.get(joint);
            const worldAnchor1 = localToWorld(joint.body1(), joint.anchor1());
            const worldAnchor2 = localToWorld(joint.body2(), joint.anchor2());
            anchor1Mesh.position.copy(worldAnchor1);
            anchor2Mesh.position.copy(worldAnchor2);
            if (axisLine) {
                const center = localToWorld(joint.body1(), joint.anchor1());
                const worldAxis = axis.clone().applyQuaternion(joint.body1().rotation());
                const halfLength = 0.01;
                const startPoint = center.clone().add(worldAxis.clone().multiplyScalar(-halfLength));
                const endPoint = center.clone().add(worldAxis.clone().multiplyScalar(halfLength));
                axisLine.geometry.setFromPoints([startPoint, endPoint]);
            }
        });
    }
}

function localToWorld(body, localAnchor) {
    const worldPoint = new Vector3().copy(body.translation());
    worldPoint.add(new Vector3().copy(localAnchor).applyQuaternion(body.rotation()));
    return worldPoint;
}