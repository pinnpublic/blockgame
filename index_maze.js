// 캔버스 및 UI 요소 가져오기
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const turnCountSpan = document.getElementById('turn-count');
const gameOverDiv = document.getElementById('game-over');
const finalTurnSpan = document.getElementById('final-turn');
const restartButton = document.getElementById('restart-button');

// --- 게임 설정 ---
const COLS = 21;
const ROWS = 15;
const BLOCK_GAP = 2;
const BLOCK_HEIGHT = 20;
const BALL_RADIUS = 6;
const BALL_SPEED = 10.5;
const ACCELERATION = 1.0005;
const BASE_BALL_COUNT = 20;
const ITEM_CHANCE = 0.15;
const ITEM_BALL_BONUS = 1;
const SHOOT_DELAY_FRAMES = 4;
const MIN_VERTICAL_SPEED = 0.2;
const RECALL_SPEED = 35;
const BLOCK_MOVE_DURATION = 30;
const MAX_BALL_SPEED = 100; // 공의 최대 속도 제한
const SHOOTER_MOVE_DURATION = 25;
const MAZE_ROWS = 20; // ✨ 미로 높이를 20으로 수정

// --- 특수 블록 설정 ---
const SPECIAL_BLOCK_CHANCE = 0.2;

// --- 효과음 설정 ---
const sounds = {};
const soundPoolSize = 10;
const soundCooldowns = {
    hit: 50,
    wall: 75,
};
const soundVolumes = {
    shoot: 0.6,
    hit: 0.4,
    wall: 0.5,
    break: 0.8,
    explosion: 0.05, // 폭발음 볼륨 수정
    multiply: 0.1,  // 증식음 볼륨 수정
    item: 0.9,
    clear: 1.0,
    gameOver: 0.9,
    boost: 0.8,     // 속도 부스트 효과음
    default: 0.7
};
let soundLastPlayed = {};
let soundPoolCounters = {};

// --- 게임 상태 변수 ---
let blockWidth;
let shooterX, shooterY;
let blocks = [];
let balls = [];
let items = [];
let particles = [];
let turn = 1;
let totalBallCount = BASE_BALL_COUNT;
let isShooting = false;
let aimAngle = -Math.PI / 2;
let isGameOver = false;
let isBlocksMoving = false;
let blockMoveProgress = 0;
let nextShooterX = null;
let isClearBonusActive = false;
let ballsToShoot = 0;
let shootCooldown = 0;
let isRecalling = false;
let isShooterMoving = false;
let shooterMoveProgress = 0;
let shooterStartX = 0;
let mazeExitCol = -1;

// =================================================================
// 게임 초기화 및 메인 루프
// =================================================================

function init() {
    canvas.width = 700;
    canvas.height = 750;
    blockWidth = (canvas.width - (COLS + 1) * BLOCK_GAP) / COLS;

    shooterX = canvas.width / 2;
    shooterY = canvas.height - 30;

    turn = 1;
    totalBallCount = BASE_BALL_COUNT;
    blocks = [];
    balls = [];
    items = [];
    particles = [];
    isShooting = false;
    isGameOver = false;
    nextShooterX = null;
    ballsToShoot = 0;
    shootCooldown = 0;
    isRecalling = false;
    isBlocksMoving = false;
    blockMoveProgress = 0;
    isShooterMoving = false;
    shooterMoveProgress = 0;

    turnCountSpan.textContent = turn;
    gameOverDiv.classList.add('hidden');

    generatePattern();
    loadSounds();

    requestAnimationFrame(gameLoop);
}

// 메인 게임 루프
function gameLoop() {
    handleShooting();
    updateBlockMovement();
    updateShooterMovement();
    updateBalls();
    updateItems();
    updateParticles();
    draw();

    if (!isGameOver) {
        requestAnimationFrame(gameLoop);
    }
}

// =================================================================
// 게임 로직 (턴, 블록, 공)
// =================================================================

/**
 * ✨ [수정] 해결 가능한 경로를 보장하는 새로운 미로 생성 함수
 */
function generatePattern() {
    // 새 판이 시작될 때 화면의 모든 공을 제거하여 자동 클리어 버그를 방지합니다.
    blocks = [];
    balls = [];

    isClearBonusActive = false;
    mazeExitCol = -1; // 미로 탈출구 초기화

    // 1. 미로를 위한 그리드를 생성하고 모두 벽(1)으로 채웁니다.
    const grid = Array(MAZE_ROWS).fill(null).map(() => Array(COLS).fill(1));
    const visited = Array(MAZE_ROWS).fill(null).map(() => Array(COLS).fill(false));

    // 2. DFS 알고리즘으로 길을 뚫어 미로를 생성하는 재귀 함수
    function carvePath(x, y) {
        visited[y][x] = true;
        grid[y][x] = 0; // 0은 길이 있는 곳

        const directions = [[0, -1], [0, 1], [-1, 0], [1, 0]];
        directions.sort(() => Math.random() - 0.5); // 방향을 무작위로 섞음

        for (const [dx, dy] of directions) {
            const nx = x + dx * 2;
            const ny = y + dy * 2;

            // ✨ [수정] 미로가 맨 윗줄(r=0)과 맨 아랫줄(r=MAZE_ROWS-1)을 침범하지 않도록 범위를 제한합니다.
            if (nx > 0 && nx < COLS - 1 && ny > 0 && ny < MAZE_ROWS - 1 && !visited[ny][nx]) {
                grid[y + dy][x + dx] = 0; // 중간 벽도 뚫음
                carvePath(nx, ny);
            }
        }
    }

    // 3. 미로 중앙에서부터 길을 파기 시작합니다.
    const startCarveX = Math.floor(COLS / 2);
    const startCarveY = Math.floor(MAZE_ROWS / 2);
    carvePath(startCarveX, startCarveY);

    // 4. 단 하나의 입구와 출구를 보장하여 생성합니다.
    // 입구 생성
    const entranceCol = Math.floor(COLS / 2);
    grid[MAZE_ROWS - 1][entranceCol] = 0; // 맨 아랫줄 중앙에 입구를 뚫습니다.
    // 입구와 미로 본체를 연결합니다.
    for (let r = MAZE_ROWS - 2; r >= startCarveY; r--) {
        if (grid[r][entranceCol] === 0) break; // 이미 길이 있으면 중단
        grid[r][entranceCol] = 0;
    }

    // 출구 생성
    let highestY = MAZE_ROWS;
    let connectX = -1;
    // 미로의 가장 높은 지점을 찾습니다.
    for (let r = 1; r < MAZE_ROWS - 1; r++) {
        for (let c = 1; c < COLS - 1; c++) {
            if (grid[r][c] === 0) {
                if (r < highestY) {
                    highestY = r;
                    connectX = c;
                }
            }
        }
    }
    // 가장 높은 지점에서 천장까지 길을 뚫어 출구를 만듭니다.
    if (connectX !== -1) {
        for (let r = highestY; r >= 0; r--) {
            grid[r][connectX] = 0;
        }
        mazeExitCol = connectX;
    } else { // 비상시
        mazeExitCol = Math.floor(COLS / 2);
        for (let r = 0; r < MAZE_ROWS; r++) {
            grid[r][mazeExitCol] = 0;
        }
    }

    // 5. 생성된 그리드를 실제 게임 블록으로 변환
    const topOffset = 60;
    const baseHue = (turn * 40) % 360;

    for (let r = 0; r < MAZE_ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (grid[r][c] === 1) { // 벽(1)인 곳에만 블록 생성
                const hue = baseHue + (c * 2) - (r * 2);

                let health;
                if (r === 0 || r === MAZE_ROWS - 1) {
                    health = 999; // 맨 윗줄과 맨 아랫줄 블록 체력은 999
                } else {
                    health = Math.floor(Math.random() * 201) + 100; // 기본 체력 100~300
                }

                const block = {
                    x: c * (blockWidth + BLOCK_GAP) + BLOCK_GAP,
                    y: topOffset + r * (BLOCK_HEIGHT + BLOCK_GAP),
                    width: blockWidth,
                    height: BLOCK_HEIGHT,
                    health: health,
                    color: `hsl(${hue}, 80%, 60%)`
                };
                blocks.push(block);
            }
        }
    }
}

function moveBlocksDown() {
    isBlocksMoving = true;
    blockMoveProgress = 0;
    blocks.forEach(block => {
        block.startY = block.y;
    });
}

function updateBlockMovement() {
    if (!isBlocksMoving) return;

    blockMoveProgress++;
    const totalMoveAmount = BLOCK_HEIGHT + BLOCK_GAP;
    let t = blockMoveProgress / BLOCK_MOVE_DURATION;
    t = t * (2 - t); // Easing 함수 (ease-out-quad)

    blocks.forEach(block => {
        block.y = block.startY + totalMoveAmount * t;
    });

    if (blockMoveProgress >= BLOCK_MOVE_DURATION) {
        isBlocksMoving = false;
        blocks.forEach(block => {
            block.y = block.startY + totalMoveAmount;
            delete block.startY;
        });
        checkGameOver();
    }
}

/**
 * 슈터를 부드럽게 이동시키는 애니메이션 업데이트 함수
 */
function updateShooterMovement() {
    if (!isShooterMoving) return;

    shooterMoveProgress++;

    const start = shooterStartX;
    const end = nextShooterX;

    // Easing 함수 (ease-out-quad) 적용: 시작은 빠르고 끝은 부드럽게
    let t = shooterMoveProgress / SHOOTER_MOVE_DURATION;
    t = t * (2 - t);

    shooterX = start + (end - start) * t;

    // 애니메이션이 끝나면
    if (shooterMoveProgress >= SHOOTER_MOVE_DURATION) {
        isShooterMoving = false;
        shooterX = nextShooterX; // 오차 보정을 위해 최종 위치로 고정
        nextShooterX = null;    // 타겟 위치 초기화
    }
}

function shoot() {
    if (isShooting || isGameOver || isBlocksMoving || isShooterMoving) return;
    isShooting = true;
    ballsToShoot = totalBallCount;
    totalBallCount = 0;
    shootCooldown = 0;
}

function handleShooting() {
    if (ballsToShoot <= 0 || shootCooldown > 0) {
        if (shootCooldown > 0) shootCooldown--;
        return;
    }
    playSound('shoot');
    const dirX = Math.cos(aimAngle);
    const dirY = Math.sin(aimAngle);
    balls.push({ x: shooterX, y: shooterY, radius: BALL_RADIUS, dx: BALL_SPEED * dirX, dy: BALL_SPEED * dirY, color: 'white' });
    ballsToShoot--;
    shootCooldown = SHOOT_DELAY_FRAMES;
}

function handleSpeedBoost(e) {
    if (!isShooting || isRecalling || isBlocksMoving || balls.length === 0) return;

    const multiplier = parseInt(e.key, 10);
    if (isNaN(multiplier) || multiplier < 2 || multiplier > 5) return;

    playSound('boost');
    balls.forEach(ball => {
        const currentSpeed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
        const newSpeed = currentSpeed * multiplier;

        if (newSpeed > MAX_BALL_SPEED) {
            const factor = MAX_BALL_SPEED / currentSpeed;
            ball.dx *= factor;
            ball.dy *= factor;
        } else {
            ball.dx *= multiplier;
            ball.dy *= multiplier;
        }
    });
}

function recallBalls() {
    if (!isShooting || isRecalling || (ballsToShoot === 0 && balls.length === 0)) return;
    playSound('clear');

    totalBallCount += ballsToShoot;

    isRecalling = true;
    ballsToShoot = 0;
    items.length = 0;
}

function updateBalls() {
    if (isRecalling) {
        for (let i = balls.length - 1; i >= 0; i--) {
            const ball = balls[i];
            const targetX = shooterX;
            const targetY = shooterY;
            const dx = targetX - ball.x;
            const dy = targetY - ball.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < RECALL_SPEED) {
                totalBallCount++;
                balls.splice(i, 1);
                continue;
            }
            ball.x += (dx / dist) * RECALL_SPEED;
            ball.y += (dy / dist) * RECALL_SPEED;
        }
        if (balls.length === 0) {
            isRecalling = false;
            endTurn();
        }
        return;
    }

    // 미로 탈출 성공 감지 로직
    const topOffset = 60;
    for (const ball of balls) {
        if (ball.y < topOffset && ball.dy < 0) {
            const ballCol = Math.floor((ball.x - BLOCK_GAP) / (blockWidth + BLOCK_GAP));
            if (ballCol === mazeExitCol) {
                clearAllBlocksWithExplosion();
                return; // 즉시 업데이트 종료
            }
        }
    }

    if (balls.length === 0 && !isShooting) return;

    if (blocks.length === 0 && !isClearBonusActive) {
        isClearBonusActive = true;
        balls.forEach(ball => { ball.dx *= 3; ball.dy *= 3; });
        items.forEach(item => { item.dy *= 3; });
    }

    for (let i = balls.length - 1; i >= 0; i--) {
        const ball = balls[i];
        if (!ball) continue;

        if (isShooting) {
            ball.dx *= ACCELERATION;
            ball.dy *= ACCELERATION;
        }

        let remainingTime = 1.0;
        for (let iter = 0; iter < 8 && remainingTime > 0; iter++) {
            let firstCollision = null;

            // 벽 충돌
            if (ball.dx > 0) {
                const t = (canvas.width - BALL_RADIUS - ball.x) / ball.dx;
                if (t >= 0 && t < remainingTime) firstCollision = { time: t, normal: { x: -1, y: 0 } };
            } else if (ball.dx < 0) {
                const t = (BALL_RADIUS - ball.x) / ball.dx;
                if (t >= 0 && t < remainingTime) firstCollision = { time: t, normal: { x: 1, y: 0 } };
            }
            if (ball.dy > 0) {
                const t = (canvas.height - BALL_RADIUS - ball.y) / ball.dy;
                if (t >= 0 && t < remainingTime && (!firstCollision || t < firstCollision.time)) {
                    firstCollision = { time: t, normal: { x: 0, y: -1 }, isFloor: true };
                }
            } else if (ball.dy < 0) {
                const t = (BALL_RADIUS - ball.y) / ball.dy;
                if (t >= 0 && t < remainingTime && (!firstCollision || t < firstCollision.time)) {
                    firstCollision = { time: t, normal: { x: 0, y: 1 } };
                }
            }

            // 블록 충돌
            for (const block of blocks) {
                const expandedBlock = { x: block.x - BALL_RADIUS, y: block.y - BALL_RADIUS, width: block.width + 2 * BALL_RADIUS, height: block.height + 2 * BALL_RADIUS };
                let t_near_x = (expandedBlock.x - ball.x) / ball.dx;
                let t_far_x = (expandedBlock.x + expandedBlock.width - ball.x) / ball.dx;
                let t_near_y = (expandedBlock.y - ball.y) / ball.dy;
                let t_far_y = (expandedBlock.y + expandedBlock.height - ball.y) / ball.dy;
                if (t_near_x > t_far_x) [t_near_x, t_far_x] = [t_far_x, t_near_x];
                if (t_near_y > t_far_y) [t_near_y, t_far_y] = [t_far_y, t_near_y];
                const t_hit_near = Math.max(t_near_x, t_near_y);
                const t_hit_far = Math.min(t_far_x, t_far_y);
                if (t_hit_near < t_hit_far && t_hit_near >= 0 && t_hit_near < remainingTime) {
                    if (!firstCollision || t_hit_near < firstCollision.time) {
                        firstCollision = { time: t_hit_near, block: block, ball: ball, t_near_x, t_near_y };
                    }
                }
            }

            if (firstCollision) {
                let normal = firstCollision.normal;
                if (firstCollision.block) {
                    const impactX = ball.x + ball.dx * firstCollision.time;
                    const impactY = ball.y + ball.dy * firstCollision.time;
                    const closestX = Math.max(firstCollision.block.x, Math.min(impactX, firstCollision.block.x + firstCollision.block.width));
                    const closestY = Math.max(firstCollision.block.y, Math.min(impactY, firstCollision.block.y + firstCollision.block.height));
                    const distX = impactX - closestX;
                    const distY = impactY - closestY;
                    const distance = Math.sqrt(distX * distX + distY * distY);
                    if (distance > 0.0001) {
                        normal = { x: distX / distance, y: distY / distance };
                    } else {
                        if (firstCollision.t_near_x > firstCollision.t_near_y) {
                            normal = { x: -Math.sign(ball.dx), y: 0 };
                        } else {
                            normal = { x: 0, y: -Math.sign(ball.dy) };
                        }
                    }
                }

                ball.x += ball.dx * firstCollision.time;
                ball.y += ball.dy * firstCollision.time;
                const dot = ball.dx * normal.x + ball.dy * normal.y;
                ball.dx -= 2 * dot * normal.x;
                ball.dy -= 2 * dot * normal.y;

                if (Math.abs(ball.dy) < MIN_VERTICAL_SPEED) {
                    ball.dy = (ball.dy >= 0 ? 1 : -1) * MIN_VERTICAL_SPEED;
                }

                const epsilon = 0.1;
                ball.x += normal.x * epsilon;
                ball.y += normal.y * epsilon;

                if (firstCollision.block) {
                    playSound('hit');
                    firstCollision.block.health--;
                    handleSpecialBlockEffect(firstCollision.block, firstCollision.ball);
                    if (firstCollision.block.health <= 0) {
                        const blockIndex = blocks.indexOf(firstCollision.block);
                        if (blockIndex > -1) handleBlockDestruction(firstCollision.block, blockIndex);
                    }
                } else if (!firstCollision.isFloor) {
                    playSound('wall');
                }

                if (firstCollision.isFloor) {
                    if (nextShooterX === null) {
                        nextShooterX = ball.x;
                        if (nextShooterX < BALL_RADIUS) nextShooterX = BALL_RADIUS;
                        if (nextShooterX > canvas.width - BALL_RADIUS) nextShooterX = canvas.width - BALL_RADIUS;
                    }
                    totalBallCount++;
                    balls.splice(i, 1);
                    break;
                }
                remainingTime -= firstCollision.time;
            } else {
                ball.x += ball.dx * remainingTime;
                ball.y += ball.dy * remainingTime;
                break;
            }
        }
    }

    if (ballsToShoot === 0 && balls.length === 0 && isShooting) {
        endTurn();
    }
}

function endTurn() {
    isShooting = false;
    isRecalling = false;

    if (nextShooterX !== null && Math.abs(shooterX - nextShooterX) > 1) {
        isShooterMoving = true;
        shooterMoveProgress = 0;
        shooterStartX = shooterX;
    } else {
        nextShooterX = null;
    }

    items.forEach(item => {
        if (!isClearBonusActive) {
            item.dy *= 3;
        }
    });

    if (blocks.length === 0) {
        turn++;
        turnCountSpan.textContent = turn;
        setTimeout(generatePattern, 1000);
    } else {
        turn++;
        turnCountSpan.textContent = turn;
        moveBlocksDown();
    }
}

function checkGameOver() {
    const gameOverLine = shooterY - (BLOCK_HEIGHT / 2);
    for (const block of blocks) {
        if (block.y + BLOCK_HEIGHT > gameOverLine) {
            gameOver();
            return;
        }
    }
}

function gameOver() {
    playSound('gameOver');
    isGameOver = true;
    finalTurnSpan.textContent = turn;
    gameOverDiv.classList.remove('hidden');
}

// =================================================================
// 블록, 아이템, 파티클 효과
// =================================================================

function handleBlockDestruction(block, index) {
    if (Math.random() < ITEM_CHANCE) {
        createItem(block.x + block.width / 2, block.y + block.height / 2);
    }
    blocks.splice(index, 1);

    if (blocks.length === 0) {
        playSound('clear');
    } else {
        playSound('break');
    }
}

function handleSpecialBlockEffect(block, hitBall) {
    switch (block.specialType) {
        case 'MULTIPLIER':
            playSound('multiply');
            if (balls.length < 250) {
                const randomAngle = Math.random() * Math.PI - Math.PI;
                const newDx = Math.cos(randomAngle) * BALL_SPEED;
                const newDy = Math.sin(randomAngle) * BALL_SPEED;
                balls.push({ x: hitBall.x, y: hitBall.y, radius: BALL_RADIUS, dx: newDx, dy: newDy, color: 'white' });
            }
            break;
        case 'EXPLOSION':
            explode(block);
            break;
    }
}

function explode(block) {
    playSound('explosion');
    const centerX = block.x + block.width / 2;
    const centerY = block.y + block.height / 2;
    const explosionRadius = 2.5 * (blockWidth + BLOCK_GAP);

    for (let i = blocks.length - 1; i >= 0; i--) {
        const otherBlock = blocks[i];
        if (otherBlock === block) continue;
        const otherCenterX = otherBlock.x + otherBlock.width / 2;
        const otherCenterY = otherBlock.y + otherBlock.height / 2;
        const dist = Math.sqrt((centerX - otherCenterX) ** 2 + (centerY - otherCenterY) ** 2);
        if (dist < explosionRadius) {
            otherBlock.health -= 1;
            if (otherBlock.health <= 0) {
                const blockIndex = blocks.indexOf(otherBlock);
                if (blockIndex > -1) {
                    handleBlockDestruction(otherBlock, blockIndex);
                }
            }
        }
    }

    for (let i = 0; i < 30; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 2;
        particles.push({ x: centerX, y: centerY, dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed, radius: Math.random() * 3 + 1, life: 30, color: `hsl(0, 100%, ${Math.random() * 50 + 50}%)` });
    }
}

/**
 * 미로 탈출 성공 시 모든 블록을 연쇄 폭발시키는 함수
 */
function clearAllBlocksWithExplosion() {
    if (blocks.length === 0) return;

    playSound('clear');
    const interval = setInterval(() => {
        const block = blocks.pop();
        if (block) {
            explode(block);
        }
        if (blocks.length === 0) {
            clearInterval(interval);
            setTimeout(() => endTurn(), 500);
        }
    }, 20);
}

function createItem(x, y) {
    playSound('item');
    items.push({ x, y, dy: 2, radius: 10 });
    totalBallCount += ITEM_BALL_BONUS;
}

function updateItems() {
    items.forEach((item, index) => {
        item.y += item.dy;
        if (item.y > canvas.height) {
            items.splice(index, 1);
        }
    });
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.dx;
        p.y += p.dy;
        p.life--;
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

// =================================================================
// 사운드 시스템
// =================================================================

function loadSounds() {
    const soundFiles = {
        shoot: 'sounds/shoot.mp3',
        hit: 'sounds/hit.mp3',
        wall: 'sounds/wall.mp3',
        break: 'sounds/break.mp3',
        explosion: 'sounds/explosion.mp3',
        multiply: 'sounds/multiply.mp3',
        item: 'sounds/item.mp3',
        clear: 'sounds/clear.mp3',
        gameOver: 'sounds/gameOver.mp3',
        boost: 'sounds/boost.mp3'
    };

    for (const name in soundFiles) {
        sounds[name] = [];
        soundLastPlayed[name] = 0;
        soundPoolCounters[name] = 0;
        for (let i = 0; i < soundPoolSize; i++) {
            const audio = new Audio(soundFiles[name]);
            audio.volume = soundVolumes[name] || soundVolumes.default;
            audio.load();
            sounds[name].push(audio);
        }
    }
}

function playSound(name) {
    const now = performance.now();
    const cooldown = soundCooldowns[name] || 0;
    if (now - soundLastPlayed[name] < cooldown) return;
    if (!sounds[name] || sounds[name].length === 0) return;

    soundLastPlayed[name] = now;
    const poolIndex = soundPoolCounters[name];
    const sound = sounds[name][poolIndex];
    sound.currentTime = 0;
    sound.play().catch(e => console.error(`Sound play failed for ${name}:`, e));
    soundPoolCounters[name] = (poolIndex + 1) % soundPoolSize;
}

// =================================
// =================================================================
// 그리기 (Drawing)
// =================================================================

function draw() {
    const bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGradient.addColorStop(0, '#1c2a3e');
    bgGradient.addColorStop(1, '#0f172a');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#334155';
    ctx.fillRect(0, canvas.height - 10, canvas.width, 10);

    if (!isGameOver) {
        drawAimLine();
    }

    blocks.forEach(drawBlock);
    balls.forEach(ball => drawGlossyBall(ball.x, ball.y, ball.radius, '#e2e8f0'));
    items.forEach(item => {
        drawGlossyBall(item.x, item.y, item.radius, '#facc15');
        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('+', item.x, item.y);
    });

    particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
    });

    if (nextShooterX !== null && isShooting) {
        ctx.beginPath();
        ctx.arc(nextShooterX, shooterY, BALL_RADIUS, 0, Math.PI * 2);
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.closePath();
    }

    drawGlossyBall(shooterX, shooterY, BALL_RADIUS, '#4ade80');

    // 공 개수 표시 로직
    let ballCountText;
    if (!isShooting) {
        // 1. 조준 상태일 때: 다음 턴에 쏠 전체 공 개수를 표시
        ballCountText = totalBallCount;
    } else {
        // 2. 발사 중일 때
        if (ballsToShoot > 0) {
            // 2a. 아직 쏠 공이 남아있을 때: 남은 공 개수를 표시 (점점 줄어듦)
            ballCountText = ballsToShoot;
        } else {
            // 2b. 모든 공을 다 쐈을 때: 현재까지 회수된 공 개수를 표시 (점점 늘어남)
            ballCountText = totalBallCount;
        }
    }

    ctx.fillStyle = 'white';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`x${ballCountText}`, shooterX, shooterY - 25);
}

function drawAimLine() {
    if (isShooting) return;
    const aimLength = 375;
    const dotCount = 20;
    const dirX = Math.cos(aimAngle);
    const dirY = Math.sin(aimAngle);

    for (let i = 1; i <= dotCount; i++) {
        const x = shooterX + dirX * (i * aimLength / dotCount);
        const y = shooterY + dirY * (i * aimLength / dotCount);
        const radius = 2 * (1 - i / dotCount) + 1;

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${0.7 * (1 - i / dotCount)})`;
        ctx.fill();
    }
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

function drawBlock(block) {
    const gradient = ctx.createLinearGradient(block.x, block.y, block.x, block.y + block.height);
    gradient.addColorStop(0, block.color);
    const hslColor = block.color.match(/\d+/g);
    gradient.addColorStop(1, `hsl(${hslColor[0]}, 60%, 40%)`);
    ctx.fillStyle = gradient;

    drawRoundedRect(ctx, block.x, block.y, block.width, block.height, 5);
    ctx.fill();

    // 특수 블록 아이콘 또는 체력
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const centerX = block.x + block.width / 2;
    const centerY = block.y + block.height / 2;

    switch (block.specialType) {
        case 'EXPLOSION':
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.font = 'bold 11px sans-serif';
            ctx.fillText(block.health, centerX + 1, centerY + 1); // 그림자
            ctx.fillStyle = 'white';
            ctx.fillText(block.health, centerX, centerY);
            break;
        case 'MULTIPLIER':
            const text = `x${block.health}`;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.font = 'bold 11px sans-serif';
            ctx.fillText(text, centerX + 1, centerY + 1); // 그림자
            ctx.fillStyle = 'white';
            ctx.fillText(text, centerX, centerY);
            break;
        default: // 일반 블록은 체력 표시
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.font = 'bold 11px sans-serif';
            ctx.fillText(block.health, centerX + 1, centerY + 1); // 그림자
            ctx.fillStyle = 'white';
            ctx.fillText(block.health, centerX, centerY);
            break;
    }
}

function drawGlossyBall(x, y, radius, color) {
    const gradient = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, radius * 0.1, x, y, radius);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(1, color);
    ctx.fillStyle = gradient;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
}


// =================================================================
// 이벤트 리스너
// =================================================================

canvas.addEventListener('mousemove', (e) => {
    if (isShooting || isGameOver || isBlocksMoving || isShooterMoving) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    aimAngle = Math.atan2(mouseY - shooterY, mouseX - shooterX);
    if (aimAngle > -0.1) {
        aimAngle = mouseX > shooterX ? -0.1 : -Math.PI + 0.1;
    }
});

canvas.addEventListener('click', shoot);
canvas.addEventListener('dblclick', recallBalls);
restartButton.addEventListener('click', init);

// 키보드를 누르면 속도 부스트 함수를 호출합니다.
window.addEventListener('keydown', handleSpeedBoost);

// 게임 시작
init();