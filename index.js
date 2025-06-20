import Game from "./components/game.js";

Game.DEBUG_EMPTY_POOL = 0
Game.DEBUG_AUTOPLAY = 0
Game.DEBUG_COLLIDERS = 0
Game.DEBUG_MAX_SPEED = 0
Game.DEBUG_HIDE_CABINET = 0
Game.DEBUG_POLYGONS = 0
Game.DEBUG_CONTROLS = 1
Game.DEBUG_FPS = 1

await Game.initialize();
Game.run();