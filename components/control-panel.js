import { Vector3 } from "three";
import DropButtons from "./instanced-meshes/drop-buttons.js";

const BUTTONS_POSITION = [0, 0.16125, 1.25];
const BUTTONS_ROTATION = [2 * Math.PI + Math.PI / 10, 0, 0];
const BUTTONS_POSITION_X = [-0.2, 0, 0.2, 0.4];

export default class {
    constructor({ onPressDropButton, onPressBonusButton }) {
        this.#onPressDropButton = onPressDropButton;
        this.#onPressBonusButton = onPressBonusButton;
    }

    #onPressDropButton;
    #onPressBonusButton;

    async initialize() {
        for (let indexButton = 0; indexButton < BUTTONS_POSITION_X.length - 1; indexButton++) {
            DropButtons.addButton({
                type: 0,
                color: 0,
                position: new Vector3(BUTTONS_POSITION_X[indexButton], BUTTONS_POSITION[1], BUTTONS_POSITION[2]),
                rotation: new Vector3().fromArray(BUTTONS_ROTATION),
                onPress: () => this.#onPressDropButton(indexButton)
            });
        }
        DropButtons.addButton({
            type: 1,
            color: 0,
            position: new Vector3(BUTTONS_POSITION_X[3], BUTTONS_POSITION[1], BUTTONS_POSITION[2]),
            rotation: new Vector3().fromArray(BUTTONS_ROTATION),
            onPress: () => this.#onPressBonusButton()
        });
    }

    update(time) {
        DropButtons.update(time);
    }

    get interactiveObjects() {
        return DropButtons.interactiveObjects;
    }
}