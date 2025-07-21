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
    },
    {
        description: "Win 300 points",
        passed: (state, data) => state.score - data.scoreStart >= 300,
        message: (state, data) => "Remaining points: " + (300 - (state.score - data.scoreStart))
    },
    {
        description: "Win 350 points",
        passed: (state, data) => state.score - data.scoreStart >= 350,
        message: (state, data) => "Remaining points: " + (350 - (state.score - data.scoreStart))
    },
    {
        description: "Win 400 points",
        passed: (state, data) => state.score - data.scoreStart >= 400,
        message: (state, data) => "Remaining points: " + (400 - (state.score - data.scoreStart))
    }
];
const RUNS_STATES = {
    IDLE: Symbol.for("runs-idle"),
    STARTING_RUNS: Symbol.for("runs-starting-runs"),
    STARTING_RUN: Symbol.for("runs-starting-run"),
    RUNNING: Symbol.for("runs-running"),
    COMPLETING_RUN: Symbol.for("runs-completing-run"),
    FINISHING_GAME: Symbol.for("runs-finishing-game")
};

export default class {

    #state;
    #screen;
    #onFinishedGame;
    #onStartedGame;
    #run = {
        state: RUNS_STATES.IDLE,
        nextState: null,
        step: -1,
        timeRunCompleted: -1
    };


    constructor({ state, screen, onStartedGame, onFinishedGame }) {
        this.#state = state;
        this.#screen = screen;
        this.#onFinishedGame = onFinishedGame;
        this.#onStartedGame = onStartedGame;
    }

    initialize() {

    }

    load(run) {
        this.#run.state = Symbol.for(run.state);
        this.#run.nextState = run.nextState ? Symbol.for(run.nextState) : null;
        this.#run.data = run.data;
        this.#run.step = run.step;
        this.#run.timeRunCompleted = run.timeRunCompleted;
    }

    save() {
        return {
            state: this.#run.state.description,
            nextState: this.#run.nextState ? this.#run.nextState.description : null,
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
        if (this.#run.state !== RUNS_STATES.IDLE) {
            const currentRun = RUNS[this.#run.step];
            updateRunsState({ run: this.#run, state: this.#state, currentRun, time });
        }
        if (this.#run.state === RUNS_STATES.STARTING_RUNS) {
            this.#onStartedGame();
        }
        if (this.#run.state === RUNS_STATES.FINISHING_GAME) {
            this.#onFinishedGame();
        }
        if (this.#run.nextState) {
            this.#run.state = this.#run.nextState;
        }
    }

    refresh() {
        if (this.#run.state === RUNS_STATES.IDLE) {
            this.#screen.showDemoMode();
        } else {
            const currentRun = RUNS[this.#run.step];
            if (this.#run.data) {
                if (this.#run.state === RUNS_STATES.STARTING_RUN || this.#run.state === RUNS_STATES.RUNNING) {
                    this.#screen.showRunStart({
                        description: currentRun.description,
                        content: currentRun.message(this.#state, this.#run.data)
                    });
                }
            }
            if (this.#run.state === RUNS_STATES.COMPLETING_RUN) {
                this.#screen.showRunComplete();
            }
        }
    }

    get started() {
        return this.#run.state !== RUNS_STATES.IDLE && this.#run.state !== RUNS_STATES.STARTING_RUNS;
    }
}

function updateRunsState({ run, state, currentRun, time }) {
    run.nextState = null;
    switch (run.state) {
        case RUNS_STATES.STARTING_RUNS:
            run.step = 0;
            run.nextState = RUNS_STATES.STARTING_RUN;
            break;
        case RUNS_STATES.STARTING_RUN:
            run.data = {
                scoreStart: state.score
            };
            run.nextState = RUNS_STATES.RUNNING;
            break;
        case RUNS_STATES.RUNNING:
            if (currentRun.passed(state, run.data)) {
                run.timeRunCompleted = time;
                run.nextState = RUNS_STATES.COMPLETING_RUN;
            }
            break;
        case RUNS_STATES.COMPLETING_RUN:
            if (time - run.timeRunCompleted > DELAY_WAIT_AFTER_RUN) {
                run.step++;
                run.timeRunCompleted = -1;
                if (run.step < RUNS.length) {
                    run.nextState = RUNS_STATES.STARTING_RUN;
                } else {
                    run.nextState = RUNS_STATES.FINISHING_GAME;
                }
            }
            break;
        case RUNS_STATES.FINISHING_GAME:
            run.nextState = RUNS_STATES.IDLE;
            break;
        default:
            break;
    }
}
