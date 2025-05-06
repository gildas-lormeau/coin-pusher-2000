import Game from "./components/game.js";

Game.DEBUG_STEP_NO_DELAY = false;
Game.DEBUG_EMPTY_POOL = false;
Game.DEBUG_COLLIDERS = false;
Game.DEBUG_FPS = true;
Game.DEBUG_POLYGONS = false;
Game.DEBUG_CONTROLS = true;
Game.DEBUG_AUTOPLAY = false;

await Game.initialize();
Game.run();