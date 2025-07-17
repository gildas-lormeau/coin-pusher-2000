import { BoxGeometry, MeshStandardMaterial, Mesh, CylinderGeometry } from "three";

const POSITION_WALL = [0, 0.535, -0.3725];
const POSITION_GLASS = [0, 0.6425, -0.305];
const WIDTH_GLASS = 0.6;
const WIDTH_WALL = 0.7;
const HEIGHT_WALL = 0.9;
const HEIGHT_GLASS = 0.7;
const DEPTH_GLASS = 0.0065;
const DEPTH_WALL = 0.1;
const FRICTION = 0;
const RESTITUTION = 0;
const OPACITY = 0.1;
const OBSTACLE_POSITION_Z = -0.31;
const OBSTACLE_START_Y = 0.45;
const OBSTACLE_RADIUS = 0.005;
const OBSTACLE_HEIGHT = 0.05;
const OBSTACLE_SPACING = 0.075;
const OBSTACLE_ROWS = 5;
const OBSTACLE_COLS = 7;
const OBSTACLE_FRICTION = 0;
const OBSTACLE_RESTITUTION = .5;
const BOTTOM_OBSTACLE_FRICTION = 0.75;
const BOTTOM_OBSTACLE_RESTITUTION = 0;
const OBSTACLE_COLOR = "#555";

export default class {
    constructor({ scene }) {
        this.#scene = scene;
    }

    #scene;

    initialize() {
        const glassGeometry = new BoxGeometry(WIDTH_GLASS, HEIGHT_GLASS, DEPTH_GLASS);
        const glassMaterial = new MeshStandardMaterial({
            transparent: true,
            opacity: OPACITY
        });
        const glassMesh = new Mesh(glassGeometry, glassMaterial);
        glassMesh.position.set(...POSITION_GLASS);
        this.#scene.addObject(glassMesh);
        const wallBody = this.#scene.createFixedBody();
        this.#scene.createCuboidCollider({
            width: WIDTH_WALL,
            height: HEIGHT_WALL,
            depth: DEPTH_WALL,
            friction: FRICTION,
            restitution: RESTITUTION,
            position: POSITION_WALL,
        }, wallBody);
        this.#scene.createCuboidCollider({
            width: WIDTH_GLASS,
            height: HEIGHT_GLASS,
            depth: DEPTH_GLASS,
            friction: FRICTION,
            restitution: RESTITUTION,
            position: POSITION_GLASS,
        }, wallBody);
        this.#scene.createCuboidCollider({
            width: .05,
            height: HEIGHT_GLASS,
            depth: DEPTH_WALL,
            friction: FRICTION,
            restitution: RESTITUTION,
            position: [POSITION_GLASS[0] - WIDTH_GLASS / 2 - .025, POSITION_GLASS[1], POSITION_GLASS[2]],
        }, wallBody);
        this.#scene.createCuboidCollider({
            width: .05,
            height: HEIGHT_GLASS,
            depth: DEPTH_WALL,
            friction: FRICTION,
            restitution: RESTITUTION,
            position: [POSITION_GLASS[0] + WIDTH_GLASS / 2 + .025, POSITION_GLASS[1], POSITION_GLASS[2]],
        }, wallBody);
        this.#scene.createCuboidCollider({
            width: WIDTH_WALL,
            height: .05,
            depth: DEPTH_WALL,
            friction: FRICTION,
            restitution: RESTITUTION,
            position: [POSITION_GLASS[0], POSITION_GLASS[1] + HEIGHT_GLASS / 2 + .025, POSITION_GLASS[2]],
        }, wallBody);
        initiliazeWallObstacles({ scene: this.#scene, wallBody });
    }
};

function initiliazeWallObstacles({ scene, wallBody }) {
    const spacing = 0.075;
    const startX = (-OBSTACLE_COLS * OBSTACLE_SPACING / 2) + (OBSTACLE_SPACING / 2);
    for (let col = 0; col < OBSTACLE_COLS; col++) {
        initializeObstacle(startX - OBSTACLE_SPACING / 2, OBSTACLE_START_Y - OBSTACLE_SPACING, col, -1, OBSTACLE_RADIUS / 2, BOTTOM_OBSTACLE_FRICTION, BOTTOM_OBSTACLE_RESTITUTION);
    }
    for (let col = 0; col < OBSTACLE_COLS; col++) {
        initializeObstacle(startX - spacing / 2, OBSTACLE_START_Y - OBSTACLE_SPACING / 2, col, -1, OBSTACLE_RADIUS / 2, BOTTOM_OBSTACLE_FRICTION, BOTTOM_OBSTACLE_RESTITUTION);
    }
    for (let row = 0; row < OBSTACLE_ROWS; row++) {
        for (let col = 0; col < (row % 2 === 0 ? OBSTACLE_COLS : OBSTACLE_COLS - 1); col++) {
            initializeObstacle(startX, OBSTACLE_START_Y, col, row, OBSTACLE_RADIUS, OBSTACLE_FRICTION, OBSTACLE_RESTITUTION);
        }
    }

    function initializeObstacle(startX, startY, col, row, obstacleRadius, friction, restitution) {
        const x = startX + col * OBSTACLE_SPACING + (row % 2 === 0 ? 0 : OBSTACLE_SPACING / 2);
        const y = startY + row * OBSTACLE_SPACING;
        const obstacleGeometry = new CylinderGeometry(obstacleRadius, obstacleRadius, OBSTACLE_HEIGHT, 8);
        const obstacleMaterial = new MeshStandardMaterial({ color: OBSTACLE_COLOR });
        const obstacleMesh = new Mesh(obstacleGeometry, obstacleMaterial);
        obstacleMesh.position.set(x, y, OBSTACLE_POSITION_Z);
        obstacleMesh.rotation.set(Math.PI / 2, Math.PI / 4, 0);
        if (row !== 4 || (col != 0 && col != 6)) {
            scene.addObject(obstacleMesh);
            scene.createCuboidCollider({
                width: obstacleRadius / 8,
                height: OBSTACLE_HEIGHT,
                depth: obstacleRadius / 8,
                friction,
                restitution,
                position: [x, y, OBSTACLE_POSITION_Z],
                rotation: [Math.PI / 2, Math.PI / 4, 0],
            }, wallBody);
        }
    }
}