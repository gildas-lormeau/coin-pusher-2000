const RUNS = [
    {
        description: "Win 150 points",
        passed: (state, data) => state.score - data.scoreStart >= 150,
        message: (state, data) => "Remaining points: " + (150 - (state.score - data.scoreStart))
    }
];

export default class {

    #state;
    #screen;
    #run = {
        state: -1
    };


    constructor({ state, screen }) {
        this.#state = state;
        this.#screen = screen;
    }

    initialize() {

    }

    load(run) {
        this.#run.state = run.state;
        this.#run.data = run.data;
    }

    save() {
        return {
            state: this.#run.state,
            data: this.#run.data
        };
    }

    start() {
        if (this.#run.state === -1) {
            this.#run.state = 0;
            this.#run.data = {
                scoreStart: this.#state.score
            };
        }
    }

    update() {
        if (this.#run.state === -1) {
            this.#screen.showDemoMode();
        } else {
            const currentRun = RUNS[this.#run.state];
            if (currentRun.passed(this.#state, this.#run.data)) {
                this.#screen.showRunComplete(this.#run);
                /*
                this.#run.state++;
                this.#run.data = {
                    scoreStart: this.#state.score
                };
                */
            } else {
                this.#screen.showRunStart({
                    description: currentRun.description,
                    content: currentRun.message(this.#state, this.#run.data)
                });
            }
        }
    }
};;;;
