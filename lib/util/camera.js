import { PerspectiveCamera } from "three";

const POSITION = [0, 2, 4.95];
const FOV = 20;
const NEAR = 0.01;
const FAR = 100;
const LOOK_AT = [0, 0.5, 0];

export default class {

    constructor(aspectRatio) {
        const camera = new PerspectiveCamera(FOV, aspectRatio, NEAR, FAR);
        camera.position.set(...POSITION);
        camera.lookAt(...LOOK_AT);
        return camera;
    }

}