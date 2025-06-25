import { Application, Assets, Container, Sprite } from 'pixi.js';
import { waitForMRAID } from './mraid_helper.js';
import gsap from 'gsap';

import '../style.css';

import backgroundImage from '../assets/images/background.jpg';
import diamondImage from '../assets/images/diamond.png';
import fireImage from '../assets/images/fire.png';
import grassImage from '../assets/images/grass.png';
import waterImage from '../assets/images/water.png';
import windImage from '../assets/images/wind.png';

const GRID_SIZE = 6;
const TILE_SIZE = 80;
const FALL_ANIMATION_DURATION_IN_SECONDS = 0.3;

const TILES_CONFIG = [
    { type: 'diamond', texture: diamondImage },
    { type: 'fire', texture: fireImage },
    { type: 'grass', texture: grassImage },
    { type: 'water', texture: waterImage },
    { type: 'wind', texture: windImage },
];

let app, grid, gridContainer, draggingTile, originTile = null;

waitForMRAID(async () => {
    app = new Application();

    await app.init({
        backgroundColor: 0x1099bb,
        width: window.innerWidth,
        height: window.innerHeight
    });

    await loadResources();

    const gameContainer = document.getElementById('gameContainer');
    gameContainer.appendChild(app.canvas);

    const background = Sprite.from(backgroundImage);
    background.setSize(window.innerWidth, window.innerHeight);
    app.stage.addChild(background);

    gridContainer = new Container();
    app.stage.addChild(gridContainer);

    initGrid();
    checkAndCollapse();
});

async function loadResources() {
    await Assets.load(backgroundImage)

    for (const tileType of TILES_CONFIG) {
        tileType.texture = await Assets.load(tileType.texture);
    }
}

function initGrid() {
    grid = [];

    for (let row = 0; row < GRID_SIZE; row++) {
        grid[row] = [];
        for (let col = 0; col < GRID_SIZE; col++) {
            const tile = createTile(row, col);

            grid[row][col] = tile;
            gridContainer.addChild(tile);
        }
    }

    const totalWidth = GRID_SIZE * TILE_SIZE;
    const totalHeight = GRID_SIZE * TILE_SIZE;

    gridContainer.x = (window.innerWidth - totalWidth) / 2;
    gridContainer.y = (window.innerHeight - totalHeight) / 2;
}

function checkAndCollapse() {
    const matches = checkMatches();
    if (matches.length === 0) {
        return;
    }

    destroyMatches(matches);
    setTimeout(collapseTiles, FALL_ANIMATION_DURATION_IN_SECONDS * 1000);
}

function isAnimationInProgress() {
    return gsap.globalTimeline.getChildren().length > 0;
}

function createTile(row, col) {
    const tileConfig = TILES_CONFIG[Math.floor(Math.random() * TILES_CONFIG.length)];
    const tile = new Sprite(tileConfig.texture);

    tile.type = tileConfig.type;
    tile.row = row;
    tile.col = col;

    tile.setSize(TILE_SIZE, TILE_SIZE);
    tile.position.set(col * TILE_SIZE, row * TILE_SIZE);

    tile.interactive = true;
    tile.buttonMode = true;

    tile.on("pointerdown", (e) => {
        if (isAnimationInProgress()) {
            return;
        }

        draggingTile = tile;
        originTile = { row: tile.row, col: tile.col };

        tile.alpha = 0.5;
    });

    tile.on("pointerup", () => {
        if (!draggingTile || isAnimationInProgress()) {
            return;
        }

        draggingTile.alpha = 1;
        draggingTile = null;
    });

    tile.on("pointerupoutside", () => {
        if (!draggingTile || isAnimationInProgress()) {
            return;
        }

        draggingTile.alpha = 1;
        draggingTile = null;
    });

    tile.on("pointermove", (e) => {
        if (!draggingTile || isAnimationInProgress()) {
            return;
        }

        const pos = e.getLocalPosition(gridContainer);
        const dx = pos.x - (originTile.col * TILE_SIZE + TILE_SIZE / 2);
        const dy = pos.y - (originTile.row * TILE_SIZE + TILE_SIZE / 2);

        const distance = Math.sqrt(dx * dx + dy * dy);
        const threshold = 60;

        if (distance > threshold) {
            const swapRow = originTile.row + (Math.abs(dy) > Math.abs(dx) ? Math.sign(dy) : 0);
            const swapCol = originTile.col + (Math.abs(dx) > Math.abs(dy) ? Math.sign(dx) : 0);

            if (
                swapRow >= 0 && swapRow < GRID_SIZE &&
                swapCol >= 0 && swapCol < GRID_SIZE &&
                (swapRow !== originTile.row || swapCol !== originTile.col)
            ) {
                swapTiles(originTile.row, originTile.col, swapRow, swapCol);
                draggingTile.alpha = 1;
                draggingTile = null;
            }
        }
    });

    return tile;
}

function swapTiles(row1, col1, row2, col2, isRevert = false) {
    const tile1 = grid[row1][col1];
    const tile2 = grid[row2][col2];

    gsap.to(tile1, {
        x: tile2.x,
        y: tile2.y,
        duration: FALL_ANIMATION_DURATION_IN_SECONDS,
        ease: "power2.out"
    });
    gsap.to(tile2, {
        x: tile1.x,
        y: tile1.y,
        duration: FALL_ANIMATION_DURATION_IN_SECONDS,
        ease: "power2.out"
    });

    [tile1.row, tile2.row] = [tile2.row, tile1.row];
    [tile1.col, tile2.col] = [tile2.col, tile1.col];
    [grid[row1][col1], grid[row2][col2]] = [tile2, tile1];

    setTimeout(() => {
        const matches = checkMatches();
        if (matches.length > 0) {
            destroyMatches(matches);
            setTimeout(() => {
                collapseTiles();
            }, FALL_ANIMATION_DURATION_IN_SECONDS * 1000);
        } else {
            if (!isRevert) {
                swapTiles(row2, col2, row1, col1, true);
            }
        }

    }, FALL_ANIMATION_DURATION_IN_SECONDS * 1000);
}

function checkMatches() {
    const matches = [];

    for (let row = 0; row < GRID_SIZE; row++) {
        let match = [];

        for (let col = 0; col < GRID_SIZE; col++) {
            const curr = grid[row][col];

            if (match.length === 0 || curr?.type === match[0]?.type) {
                match.push(curr);
            } else {
                if (match.length >= 3) matches.push([...match]);
                match = [curr];
            }
        }
        if (match.length >= 3) {
            matches.push([...match]);
        }
    }

    for (let col = 0; col < GRID_SIZE; col++) {
        let match = [];

        for (let row = 0; row < GRID_SIZE; row++) {
            const curr = grid[row][col];

            if (match.length === 0 || curr?.type === match[0]?.type) {
                match.push(curr);
            } else {
                if (match.length >= 3) matches.push([...match]);
                match = [curr];
            }
        }

        if (match.length >= 3) {
            matches.push([...match]);
        }
    }

    return matches;
}

function destroyMatches(matches) {
    for (const match of matches) {
        for (const tile of match) {
            if (tile !== null) {
                gsap.killTweensOf(tile);
                tile.destroy();

                grid[tile.row][tile.col] = null;
            }
        }
    }
}

function collapseTiles() {
    for (let col = 0; col < GRID_SIZE; col++) {
        let emptySpots = 0;
        for (let row = GRID_SIZE - 1; row >= 0; row--) {
            if (grid[row][col] === null) {
                emptySpots++;
            } else if (emptySpots > 0) {
                const tile = grid[row][col];
                grid[row + emptySpots][col] = tile;
                tile.row = row + emptySpots;
                tile.y = tile.row * TILE_SIZE;
                grid[row][col] = null;
            }
        }

        for (let i = 0; i < emptySpots; i++) {
            const newTile = createTile(i, col);
            newTile.y = -((emptySpots - i) * TILE_SIZE);

            gridContainer.addChild(newTile);
            grid[i][col] = newTile;

            gsap.to(newTile, {
                y: i * TILE_SIZE,
                duration: FALL_ANIMATION_DURATION_IN_SECONDS,
                ease: "bounce.out",
                onComplete: checkAndCollapse
            });
        }
    }
}