import { Vector3 } from "three";
import Buttons from "./instanced-meshes/buttons.js";

const BUTTONS_POSITION = [0, 0.16125, 1.25];
const BUTTONS_ROTATION = [2 * Math.PI + Math.PI / 10, 0, 0];
const START_BUTTON_POSITION = [.85, .2, .785];
const START_BUTTON_ROTATION = [Math.PI / 2, 0, 0];
const BUTTONS_POSITION_X = [-.2, 0, .2];
const ALT_BUTTONS_POSITION_X = [-.65, -.45, .45, .65];

export default class {

    #dropButtons = [];
    #startButton;
    #holdButton;
    #aButton;
    #bButton;
    #shootButton;
    #onPressDropButton;
    #onPressShootButton;
    #onPressStartButton;
    #onPressHoldButton;
    #onPressAButton;
    #onPressBButton;

    constructor({ onPressDropButton, onPressShootButton, onPressStartButton, onPressHoldButton, onPressAButton, onPressBButton }) {
        this.#onPressDropButton = onPressDropButton;
        this.#onPressShootButton = onPressShootButton;
        this.#onPressStartButton = onPressStartButton;
        this.#onPressHoldButton = onPressHoldButton;
        this.#onPressAButton = onPressAButton;
        this.#onPressBButton = onPressBButton;
    }

    async initialize() {
        for (let indexButton = 0; indexButton < BUTTONS_POSITION_X.length; indexButton++) {
            this.#dropButtons[indexButton] = Buttons.addButton({
                type: 0,
                color: 0,
                position: new Vector3(BUTTONS_POSITION_X[indexButton], BUTTONS_POSITION[1], BUTTONS_POSITION[2]),
                rotation: new Vector3().fromArray(BUTTONS_ROTATION)
            });
            Buttons.enable(this.#dropButtons[indexButton], false);
        }
        this.#shootButton = Buttons.addButton({
            type: 5,
            color: 1,
            position: new Vector3(ALT_BUTTONS_POSITION_X[0], BUTTONS_POSITION[1], BUTTONS_POSITION[2]),
            rotation: new Vector3().fromArray(BUTTONS_ROTATION)
        });
        Buttons.enable(this.#shootButton, false);
        this.#holdButton = Buttons.addButton({
            type: 2,
            color: 1,
            position: new Vector3(ALT_BUTTONS_POSITION_X[1], BUTTONS_POSITION[1], BUTTONS_POSITION[2]),
            rotation: new Vector3().fromArray(BUTTONS_ROTATION)
        });
        Buttons.enable(this.#holdButton, false);
        this.#aButton = Buttons.addButton({
            type: 3,
            color: 2,
            position: new Vector3(ALT_BUTTONS_POSITION_X[2], BUTTONS_POSITION[1], BUTTONS_POSITION[2]),
            rotation: new Vector3().fromArray(BUTTONS_ROTATION)
        });
        Buttons.enable(this.#aButton, false);
        this.#bButton = Buttons.addButton({
            type: 4,
            color: 2,
            position: new Vector3(ALT_BUTTONS_POSITION_X[3], BUTTONS_POSITION[1], BUTTONS_POSITION[2]),
            rotation: new Vector3().fromArray(BUTTONS_ROTATION)
        });
        Buttons.enable(this.#bButton, false);
        this.#startButton = Buttons.addButton({
            type: 1,
            color: 0,
            position: new Vector3(START_BUTTON_POSITION[0], START_BUTTON_POSITION[1], START_BUTTON_POSITION[2]),
            rotation: new Vector3().fromArray(START_BUTTON_ROTATION)
        });
        Buttons.enable(this.#startButton, true);
        Buttons.onPress = instance => {
            if (instance === this.#startButton) {
                this.#onPressStartButton();
            } else if (this.#dropButtons.includes(instance)) {
                const index = this.#dropButtons.indexOf(instance);
                this.#onPressDropButton(index);
            } else if (instance === this.#shootButton) {
                this.#onPressShootButton();
            } else if (instance === this.#holdButton) {
                this.#onPressHoldButton();
            } else if (instance === this.#aButton) {
                this.#onPressAButton();
            } else if (instance === this.#bButton) {
                this.#onPressBButton();
            }
        };
        Buttons.blink(this.#startButton, true);
    }

    update() {
        // do nothing
    }

    refresh() {
        // do nothing
    }

    setDropButtonsOn() {
        for (const button of this.#dropButtons) {
            Buttons.on(button);
        }
    }

    disableStartButton() {
        Buttons.enable(this.#startButton, false);
        for (const button of this.#dropButtons) {
            Buttons.enable(button, true);
        }
    }

    enableActionButton() {
        Buttons.enable(this.#shootButton, true);
    }

    disableActionButton() {
        Buttons.enable(this.#shootButton, false);
    }


    get interactiveObjects() {
        return Buttons.interactiveObjects;
    }
}