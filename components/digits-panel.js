import { BoxGeometry, Mesh, Group, MeshStandardMaterial, Vector3 } from "three";
import Digits from "./instanced-meshes/digits.js";

const FPS = 1 / 10;
const BORDER_WIDTH = 0.015;
const TYPES = 10;

export default class {
    constructor({ scene, position, rotation, scale, digitsCount, color }) {
        this.#scene = scene;
        this.#digitsCount = digitsCount;
        this.#color = color;
        this.#position = position;
        this.#rotation = rotation;
        this.#scale = scale || [1, 1, 1];
    }

    #scene;
    #digitsCount;
    #color;
    #position;
    #rotation;
    #scale;
    #digits = [];
    #lastTime = 0;

    async initialize() {
        for (let indexDigit = 0; indexDigit < this.#digitsCount; indexDigit++) {
            this.#digits[indexDigit] = [];
            for (let type = 0; type < TYPES; type++) {
                const positionX = this.#position[0] + indexDigit * Digits.WIDTH * this.#scale[0];
                const positionY = this.#position[1];
                const positionZ = this.#position[2];
                this.#digits[indexDigit][type] = Digits.addDigit({
                    type,
                    color: this.#color,
                    position: new Vector3(positionX, positionY, positionZ),
                    rotation: new Vector3(Math.PI / 2 + this.#rotation[0], this.#rotation[1], this.#rotation[2]),
                    scale: new Vector3(
                        this.#scale[0],
                        this.#scale[2],
                        this.#scale[1]
                    )
                });
            }
        }
        this.#addBorders();
    }

    #addBorders() {
        const bordersGroup = new Group();
        const panelWidth = this.#digitsCount * Digits.WIDTH;
        const borderMaterial = new MeshStandardMaterial({
            color: Digits.getBackgroundColor(this.#color),
            roughness: 0.5,
            metalness: 0
        });
        const topBorderMesh = new Mesh(
            new BoxGeometry((panelWidth + 2 * BORDER_WIDTH) * this.#scale[0], BORDER_WIDTH * this.#scale[1], Digits.DEPTH * this.#scale[2]),
            borderMaterial
        );
        topBorderMesh.position.set(
            (panelWidth / 2 - Digits.WIDTH / 2) * this.#scale[0],
            (Digits.HEIGHT / 2 + BORDER_WIDTH / 2) * this.#scale[1],
            0
        );
        const bottomBorderMesh = new Mesh(
            new BoxGeometry((panelWidth + 2 * BORDER_WIDTH) * this.#scale[0], BORDER_WIDTH * this.#scale[1], Digits.DEPTH * this.#scale[2]),
            borderMaterial
        );
        bottomBorderMesh.position.set(
            (panelWidth / 2 - Digits.WIDTH / 2) * this.#scale[0],
            (-Digits.HEIGHT / 2 - BORDER_WIDTH / 2) * this.#scale[1],
            0
        );
        const leftBorderMesh = new Mesh(
            new BoxGeometry(BORDER_WIDTH * this.#scale[0], (Digits.HEIGHT + 2 * BORDER_WIDTH) * this.#scale[1], Digits.DEPTH * this.#scale[2]),
            borderMaterial
        );
        leftBorderMesh.position.set(
            (-BORDER_WIDTH / 2 - Digits.WIDTH / 2) * this.#scale[0],
            0,
            0
        );
        const rightBorderMesh = new Mesh(
            new BoxGeometry(BORDER_WIDTH * this.#scale[0], (Digits.HEIGHT + 2 * BORDER_WIDTH) * this.#scale[1], Digits.DEPTH * this.#scale[2]),
            borderMaterial
        );
        rightBorderMesh.position.set(
            (panelWidth + BORDER_WIDTH / 2 - Digits.WIDTH / 2) * this.#scale[0],
            0,
            0
        );
        bordersGroup.add(topBorderMesh);
        bordersGroup.add(bottomBorderMesh);
        bordersGroup.add(leftBorderMesh);
        bordersGroup.add(rightBorderMesh);
        this.#scene.addObject(bordersGroup);
        bordersGroup.position.fromArray(this.#position);
        bordersGroup.rotation.fromArray([this.#rotation[0], this.#rotation[1], this.#rotation[2]]);
    }

    set(value) {
        const digits = String(Math.max(0, value)).padStart(this.#digitsCount, "0").split("");
        for (let indexDigit = 0; indexDigit < this.#digitsCount; indexDigit++) {
            for (let type = 0; type < 10; type++) {
                const child = this.#digits[indexDigit][type];
                Digits.setVisible(child, type == digits[indexDigit]);
            }
        }
    }

    update(time) {
        if (time - this.#lastTime > FPS * 1000) {
            Digits.update();
            this.#lastTime = time;
        }
    }
}