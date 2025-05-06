import Game from "./components/game.js";

Game.DEBUG_MAX_SPEED = false;
Game.DEBUG_EMPTY_POOL = false;
Game.DEBUG_COLLIDERS = false;
Game.DEBUG_FPS = true;
Game.DEBUG_POLYGONS = false;
Game.DEBUG_CONTROLS = true;
Game.DEBUG_AUTOPLAY = false;
Game.DEBUG_HIDE_CABINET = false;

await Game.initialize();
Game.run();