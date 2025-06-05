import { Vector3 } from "three";
import Buttons from "./instanced-meshes/buttons.js";

const BUTTONS_POSITION = [0, 0.16125, 1.25];
const BUTTONS_ROTATION = [2 * Math.PI + Math.PI / 10, 0, 0];
const BUTTONS_POSITION_X = [-0.2, 0, 0.2];
const ALT_BUTTONS_POSITION_X = [-0.4, 0.4];

export default class {

    #onPressDropButton;
    #onPressActionButton;
    #onPressStartButton;

    constructor({ onPressDropButton, onPressActionButton, onPressStartButton }) {
        this.#onPressDropButton = onPressDropButton;
        this.#onPressActionButton = onPressActionButton;
        this.#onPressStartButton = onPressStartButton;
    }

    async initialize() {
        for (let indexButton = 0; indexButton < BUTTONS_POSITION_X.length; indexButton++) {
            Buttons.addButton({
                type: 0,
                color: 0,
                position: new Vector3(BUTTONS_POSITION_X[indexButton], BUTTONS_POSITION[1], BUTTONS_POSITION[2]),
                rotation: new Vector3().fromArray(BUTTONS_ROTATION),
                onPress: () => this.#onPressDropButton(indexButton)
            });
        }
        Buttons.addButton({
            type: 2,
            color: 0,
            position: new Vector3(ALT_BUTTONS_POSITION_X[0], BUTTONS_POSITION[1], BUTTONS_POSITION[2]),
            rotation: new Vector3().fromArray(BUTTONS_ROTATION),
            onPress: () => this.#onPressActionButton()
        });
        Buttons.addButton({
            type: 1,
            color: 0,
            position: new Vector3(ALT_BUTTONS_POSITION_X[1], BUTTONS_POSITION[1], BUTTONS_POSITION[2]),
            rotation: new Vector3().fromArray(BUTTONS_ROTATION),
            onPress: () => this.#onPressStartButton()
        });
    }

    update(time) {
        // do nothing
    }

    get interactiveObjects() {
        return Buttons.interactiveObjects;
    }
}