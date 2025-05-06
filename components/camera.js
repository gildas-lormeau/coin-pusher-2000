import { PerspectiveCamera } from "three";

const POSITION = [0, 2, 4.95];
const FOV = 20;
const ASPECT = innerWidth / innerHeight;
const NEAR = 0.1;
const FAR = 1000;
const LOOK_AT = [0, 0.5, 0];

export default class {

    constructor() {
        const camera = new PerspectiveCamera(FOV, ASPECT, NEAR, FAR);
        camera.position.set(...POSITION);
        camera.lookAt(...LOOK_AT);
        return camera;
    }

}