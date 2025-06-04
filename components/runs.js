const DELAY_WAIT_AFTER_RUN = 5000;
const RUNS = [
    {
        description: "Win 150 points",
        passed: (state, data) => state.score - data.scoreStart >= 150,
        message: (state, data) => "Remaining points: " + (150 - (state.score - data.scoreStart))
    },
    {
        description: "Win 200 points",
        passed: (state, data) => state.score - data.scoreStart >= 200,
        message: (state, data) => "Remaining points: " + (200 - (state.score - data.scoreStart))
    },
    {
        description: "Win 250 points",
        passed: (state, data) => state.score - data.scoreStart >= 250,
        message: (state, data) => "Remaining points: " + (250 - (state.score - data.scoreStart))
    }
];
const RUNS_STATES = {
    IDLE: Symbol.for("runs-idle"),
    STARTING_RUNS: Symbol.for("runs-starting-runs"),
    STARTING_RUN: Symbol.for("runs-starting-run"),
    RUNNING: Symbol.for("runs-running"),
    COMPLETED_RUN: Symbol.for("runs-completed-run")
};

export default class {

    #state;
    #screen;
    #run = {
        state: RUNS_STATES.IDLE,
        step: -1,
        timeRunCompleted: -1
    };


    constructor({ state, screen }) {
        this.#state = state;
        this.#screen = screen;
    }

    initialize() {

    }

    load(run) {
        this.#run.state = Symbol.for(run.state);
        this.#run.data = run.data;
        this.#run.step = run.step;
        this.#run.timeRunCompleted = run.timeRunCompleted;
    }

    save() {
        return {
            state: this.#run.state.description,
            data: this.#run.data,
            step: this.#run.step,
            timeRunCompleted: this.#run.timeRunCompleted
        };
    }

    start() {
        if (this.#run.state === RUNS_STATES.IDLE) {
            this.#run.state = RUNS_STATES.STARTING_RUNS;
        }
    }

    update(time) {
        const currentRun = RUNS[this.#run.step];
        updateRunsState({ run: this.#run, state: this.#state, currentRun, time });
        if (this.#run.state === RUNS_STATES.IDLE) {
            this.#screen.showDemoMode();
        } else {
            if (this.#run.data) {
                if (this.#run.state === RUNS_STATES.STARTING_RUN || this.#run.state === RUNS_STATES.RUNNING) {
                    this.#screen.showRunStart({
                        description: currentRun.description,
                        content: currentRun.message(this.#state, this.#run.data)
                    });
                }
            }
            if (this.#run.state === RUNS_STATES.COMPLETED_RUN) {
                this.#screen.showRunComplete();
            }
        }
    }
}

function updateRunsState({ run, state, currentRun, time }) {
    switch (run.state) {
        case RUNS_STATES.STARTING_RUNS:
            run.step = 0;
            run.state = RUNS_STATES.STARTING_RUN;
            break;
        case RUNS_STATES.STARTING_RUN:
            run.data = {
                scoreStart: state.score
            };
            run.state = RUNS_STATES.RUNNING;
            break;
        case RUNS_STATES.RUNNING:
            if (currentRun.passed(state, run.data)) {
                run.timeRunCompleted = time;
                run.state = RUNS_STATES.COMPLETED_RUN;
            }
            break;
        case RUNS_STATES.COMPLETED_RUN:
            if (time - run.timeRunCompleted > DELAY_WAIT_AFTER_RUN) {
                run.step++;
                run.timeRunCompleted = -1;
                if (run.step < RUNS.length) {
                    run.state = RUNS_STATES.STARTING_RUN;
                } else {
                    run.state = RUNS_STATES.IDLE;
                }
            }
            break;
        default:
            break;
    }
}
