// --- 캔버스 및 UI 요소 가져오기 ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const turnCountSpan = document.getElementById('turn-count');
const gameOverDiv = document.getElementById('game-over');
const finalTurnSpan = document.getElementById('final-turn');
const restartButton = document.getElementById('restart-button');
const bombButton = document.getElementById('bomb-ball-btn');
const bombCountSpan = document.getElementById('bomb-ball-count');
const magmaButton = document.getElementById('magma-ball-btn');
const magmaCountSpan = document.getElementById('magma-ball-count');
const diceButton = document.getElementById('dice-item-btn');
const diceCountSpan = document.getElementById('dice-item-count');


// --- 게임 설정 ---
const LOGICAL_WIDTH = 700;
const LOGICAL_HEIGHT = 750;
const COLS = 25;
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
const MAX_BALL_SPEED = 100;
const SHOOTER_MOVE_DURATION = 25;
const PATTERN_SCALE = 2;

// --- 특수 블록 설정 ---
const SPECIAL_BLOCK_CHANCE = 0.2;

// --- 효과음 설정 ---
const sounds = {};
const soundPoolSize = 10;
const soundCooldowns = { hit: 50, wall: 75 };
const soundVolumes = { shoot: 0.6, hit: 0.4, wall: 0.5, break: 0.1, explosion: 0.03, multiply: 0.1, item: 0.9, clear: 1.0, gameOver: 0.9, boost: 0.8, dice: 0.8, default: 0.7 };
let soundLastPlayed = {};
let soundPoolCounters = {};

// --- 블록 패턴 정의 ---
const patterns = [
    ["00110001100", "01111011110", "11111111111", "11111111111", "01111111110", "00111111100", "00011111000", "00001110000", "00000100000"],
    ["00111111100", "01000000010", "1011001101", "1011001101", "1000000001", "1010000101", "1001111001", "0100000010", "0011111100"],
    ["0000110000", "0001111000", "0011111100", "0111111110", "1111111111", "0111111110", "0011111100", "0001111000", "0000110000"],
    ["011111110", "111111111", "101111101", "111111111", "011111110", "001000100", "001111100"],
    ["00000000111000000", "00000011111110000", "00000111111111100", "00011101111111110", "00111000111111110", "01111111111111110", "11111111111111100", "01111111111111000", "00111111111110000", "00001111111100000", "00000011111000000", "00000001100000000"],
];

// --- 게임 상태 변수 ---
let blockWidth;
let shooterX, shooterY;
let blocks = [], balls = [], items = [], particles = [];
let turn = 1;
let totalBallCount = BASE_BALL_COUNT;
let isShooting = false, isGameOver = false, isBlocksMoving = false, isRecalling = false, isShooterMoving = false, isClearBonusActive = false;
let aimAngle = -Math.PI / 2;
let blockMoveProgress = 0, shooterMoveProgress = 0, ballsToShoot = 0, shootCooldown = 0;
let nextShooterX = null, shooterStartX = 0;
let specialBalls = { bomb: 3, magma: 3, dice: 3 };
let selectedBallType = 'NORMAL';
let diceAnimation = null;
let audioContext = null;


// =================================================================
// 게임 초기화 및 메인 루프
// =================================================================

function resizeCanvas() {
    const gameContainer = document.getElementById('game-container');
    const aspectRatio = LOGICAL_WIDTH / LOGICAL_HEIGHT;
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    let newWidth, newHeight;

    if (screenWidth / screenHeight > aspectRatio) {
        newHeight = screenHeight;
        newWidth = newHeight * aspectRatio;
    } else {
        newWidth = screenWidth;
        newHeight = newWidth / aspectRatio;
    }

    gameContainer.style.width = `${newWidth}px`;
    gameContainer.style.height = `${newHeight}px`;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = newWidth * dpr;
    canvas.height = newHeight * dpr;
}

function init() {
    turn = 1;
    isShooting = false; isGameOver = false; isBlocksMoving = false; isRecalling = false; isShooterMoving = false;
    blocks = []; balls = []; items = []; particles = [];
    nextShooterX = null; ballsToShoot = 0; shootCooldown = 0; blockMoveProgress = 0; shooterMoveProgress = 0;
    selectedBallType = 'NORMAL';
    // ✨ [수정] 테스트용 개수. 나중에 { bomb: 3, magma: 3, dice: 3 } 으로 바꾸세요.
    specialBalls = { bomb: 300, magma: 300, dice: 300 };
    totalBallCount = BASE_BALL_COUNT;

    resizeCanvas();

    blockWidth = (LOGICAL_WIDTH - (COLS + 1) * BLOCK_GAP) / COLS;
    shooterX = LOGICAL_WIDTH / 2;
    shooterY = LOGICAL_HEIGHT - 30;

    turnCountSpan.textContent = turn;
    gameOverDiv.classList.add('hidden');

    // 특수 볼 UI 초기화
    bombCountSpan.textContent = specialBalls.bomb;
    magmaCountSpan.textContent = specialBalls.magma;
    diceCountSpan.textContent = specialBalls.dice; // ✨ [추가]
    bombButton.style.borderColor = '#facc15';
    magmaButton.style.borderColor = '#facc15';
    diceButton.style.borderColor = '#facc15'; // ✨ [추가]

    window.addEventListener('resize', resizeCanvas);

    generatePattern();
    if (Object.keys(sounds).length === 0) {
        loadSounds();
    }

    if (!audioContext) {
        try {
            // AudioContext는 사용자의 상호작용 전까지 'suspended' 상태일 수 있습니다.
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.error("Web Audio API is not supported in this browser");
        }
    }


    requestAnimationFrame(gameLoop);
}

function unlockAudio() {
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
}

function endTurn() {
    isShooting = false;
    isRecalling = false;

    // 특수 볼 선택 초기화
    if (selectedBallType !== 'NORMAL') {
        selectedBallType = 'NORMAL';
        bombButton.style.borderColor = '#facc15';
        magmaButton.style.borderColor = '#facc15';
        diceButton.style.borderColor = '#facc15'; // ✨ [추가]
    }

    if (nextShooterX !== null && Math.abs(shooterX - nextShooterX) > 1) {
        isShooterMoving = true;
        shooterMoveProgress = 0;
        shooterStartX = shooterX;
    } else {
        nextShooterX = null;
    }
    items.forEach(item => {
        if (!isClearBonusActive) item.dy *= 3;
    });

    if (blocks.length === 0) {
        // 스테이지 클리어 보너스 지급
        specialBalls.bomb += 2;
        specialBalls.magma += 2;
        specialBalls.dice += 2; // ✨ [추가]
        bombCountSpan.textContent = specialBalls.bomb;
        magmaCountSpan.textContent = specialBalls.magma;
        diceCountSpan.textContent = specialBalls.dice; // ✨ [추가]
        playSound('item');

        turn++;
        turnCountSpan.textContent = turn;
        setTimeout(generatePattern, 1000);
    } else {
        // 다음 턴 진행
        turn++;
        turnCountSpan.textContent = turn;
        moveBlocksDown();
    }
}

function applyDiceEffect() {
    if (blocks.length === 0) return;

    // 1. 모든 블록의 체력 총합 계산
    const totalHealth = blocks.reduce((sum, block) => sum + block.health, 0);

    if (totalHealth === 0) return;

    // 2. 각 블록에 최소 1의 체력을 먼저 할당
    let remainingHealth = totalHealth - blocks.length;
    const newHealths = Array(blocks.length).fill(1);

    // 3. 남은 체력을 무작위로 분배
    if (remainingHealth > 0) {
        for (let i = 0; i < remainingHealth; i++) {
            const randomIndex = Math.floor(Math.random() * blocks.length);
            newHealths[randomIndex]++;
        }
    }

    // ✨ [수정] 애니메이션 시작 함수에 계산된 체력 값을 전달
    showDiceAnimation(newHealths);
}

function gameLoop() {
    const scale = canvas.width / LOGICAL_WIDTH;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    handleShooting();
    updateBlockMovement();
    updateShooterMovement();
    updateBalls();
    updateItems();
    updateParticles();
    updateDiceAnimation(); // ✨ [추가] 주사위 애니메이션 업데이트
    draw();

    if (!isGameOver) requestAnimationFrame(gameLoop);
}

// =================================================================
// 게임 로직 (턴, 블록, 공)
// =================================================================

function generatePattern() {
    blocks = [];
    isClearBonusActive = false;
    const patternIndex = (turn - 1) % patterns.length;
    const pattern = patterns[patternIndex];
    const patternHeight = pattern.length;
    const patternWidth = pattern[0].length;

    // ✨ [핵심 수정] 패턴을 전체 그리드의 중앙에 배치하기 위한 열(Column) 오프셋을 계산합니다.
    const patternGridWidth = patternWidth * PATTERN_SCALE;
    const gridColOffset = Math.floor((COLS - patternGridWidth) / 2);

    // ✨ [핵심 수정] 블록이 생성될 시작 행(Row)을 지정합니다. (예: 3은 4번째 줄부터 시작)
    const START_ROW = 3;

    const baseHue = (turn * 40) % 360;

    for (let r = 0; r < patternHeight; r++) {
        for (let c = 0; c < patternWidth; c++) {
            if (pattern[r][c] === '1') {
                for (let scaleY = 0; scaleY < PATTERN_SCALE; scaleY++) {
                    for (let scaleX = 0; scaleX < PATTERN_SCALE; scaleX++) {
                        const patternC = c * PATTERN_SCALE + scaleX;
                        const patternR = r * PATTERN_SCALE + scaleY;

                        // 전체 그리드에서의 최종 좌표(칸 번호)를 계산합니다.
                        const finalGridC = gridColOffset + patternC;
                        const finalGridR = START_ROW + patternR;

                        const hue = baseHue + (finalGridC * 2) - (finalGridR * 2);

                        // ✨ [핵심 수정] 블록의 x, y 좌표를 오직 그리드에만 맞춰 정확하게 계산합니다.
                        blocks.push({
                            x: BLOCK_GAP + finalGridC * (blockWidth + BLOCK_GAP),
                            y: BLOCK_GAP + finalGridR * (BLOCK_HEIGHT + BLOCK_GAP),
                            width: blockWidth,
                            height: BLOCK_HEIGHT,
                            health: Math.floor(Math.random() * 100) + 1,
                            specialType: 'NONE',
                            color: `hsl(${hue}, 80%, 60%)`
                        });
                    }
                }
            }
        }
    }

    // --- 특수 블록 생성 로직 (이 부분은 기존과 동일합니다) ---
    const totalBlockCountInPattern = blocks.length;
    const specialBlockCount = Math.floor(totalBlockCountInPattern * SPECIAL_BLOCK_CHANCE);
    const pickedIndices = new Set();
    while (pickedIndices.size < specialBlockCount && totalBlockCountInPattern > 0) {
        pickedIndices.add(Math.floor(Math.random() * totalBlockCountInPattern));
    }

    pickedIndices.forEach(index => {
        const block = blocks[index];
        if (Math.random() < 0.5) {
            block.specialType = 'EXPLOSION';
            block.color = `hsl(0, 80%, 60%)`;
            block.health = Math.floor(Math.random() * 10) + 1;
        } else {
            block.specialType = 'MULTIPLIER';
            block.color = `hsl(210, 85%, 60%)`;
            block.health = Math.floor(Math.random() * 5) + 1;
        }
    });
}


function moveBlocksDown() {
    isBlocksMoving = true;
    blockMoveProgress = 0;
    blocks.forEach(b => { b.startY = b.y; });
}

function updateBlockMovement() {
    if (!isBlocksMoving) return;
    blockMoveProgress++;
    const totalMoveAmount = BLOCK_HEIGHT + BLOCK_GAP;
    let t = blockMoveProgress / BLOCK_MOVE_DURATION;
    t = t * (2 - t);
    blocks.forEach(b => { b.y = b.startY + totalMoveAmount * t; });
    if (blockMoveProgress >= BLOCK_MOVE_DURATION) {
        isBlocksMoving = false;
        blocks.forEach(b => { b.y = b.startY + totalMoveAmount; delete b.startY; });
        checkGameOver();
    }
}

function updateShooterMovement() {
    if (!isShooterMoving) return;
    shooterMoveProgress++;
    let t = shooterMoveProgress / SHOOTER_MOVE_DURATION;
    t = t * (2 - t);
    shooterX = shooterStartX + (nextShooterX - shooterStartX) * t;
    if (shooterMoveProgress >= SHOOTER_MOVE_DURATION) {
        isShooterMoving = false;
        shooterX = nextShooterX;
        nextShooterX = null;
    }
}

function shoot() {
    if (isShooting || isGameOver || isBlocksMoving || isShooterMoving) return;

    if (selectedBallType === 'BOMB' && specialBalls.bomb > 0) {
        isShooting = true;
        ballsToShoot = 1;
        specialBalls.bomb--;
        bombCountSpan.textContent = specialBalls.bomb;
    } else if (selectedBallType === 'MAGMA' && specialBalls.magma > 0) {
        isShooting = true;
        ballsToShoot = 1;
        specialBalls.magma--;
        magmaCountSpan.textContent = specialBalls.magma;
    } else if (selectedBallType === 'DICE' && specialBalls.dice > 0) {
        // ✨ [추가] 주사위는 즉시 효과 발동, 공은 쏘지 않음
        specialBalls.dice--;
        diceCountSpan.textContent = specialBalls.dice;
        applyDiceEffect();
        // 효과 사용 후 즉시 일반 모드로 전환
        selectSpecialBall('NORMAL');
    } else {
        if (totalBallCount <= 0) return;
        isShooting = true;
        ballsToShoot = totalBallCount;
        totalBallCount = 0;
    }
    shootCooldown = 0;
}

function handleShooting() {
    if (ballsToShoot <= 0) {
        return;
    }
    if (shootCooldown > 0) {
        shootCooldown--;
        return;
    }
    playSound('shoot');
    const dirX = Math.cos(aimAngle);
    const dirY = Math.sin(aimAngle);

    const ballType = selectedBallType !== 'NORMAL' ? selectedBallType : 'NORMAL';

    let ballColor = 'white';
    let ballRadius = BALL_RADIUS;

    if (ballType === 'BOMB') {
        ballColor = '#e11d48';
        ballRadius = BALL_RADIUS * 1.5;
    } else if (ballType === 'MAGMA') {
        ballColor = '#f97316';
        ballRadius = BALL_RADIUS * 1.2;
    }

    balls.push({
        x: shooterX, y: shooterY,
        radius: ballRadius,
        dx: BALL_SPEED * dirX, dy: BALL_SPEED * dirY,
        color: ballColor,
        type: ballType
    });

    ballsToShoot--;
    shootCooldown = SHOOT_DELAY_FRAMES;
}

function handleSpeedBoost(e) {
    if (!isShooting || isRecalling || isBlocksMoving || balls.length === 0) return;
    const multiplier = parseInt(e.key, 10);
    if (isNaN(multiplier) || multiplier < 2 || multiplier > 5) return;
    playSound('boost');
    balls.forEach(ball => {
        const currentSpeed = Math.sqrt(ball.dx ** 2 + ball.dy ** 2);
        const newSpeed = currentSpeed * multiplier;
        if (newSpeed > MAX_BALL_SPEED) {
            const factor = MAX_BALL_SPEED / currentSpeed;
            ball.dx *= factor; ball.dy *= factor;
        } else {
            ball.dx *= multiplier; ball.dy *= multiplier;
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
            const dx = shooterX - ball.x, dy = shooterY - ball.y;
            const dist = Math.sqrt(dx ** 2 + dy ** 2);
            if (dist < RECALL_SPEED) {
                totalBallCount++;
                balls.splice(i, 1);
                continue;
            }
            ball.x += (dx / dist) * RECALL_SPEED;
            ball.y += (dy / dist) * RECALL_SPEED;
        }
        if (balls.length === 0) { isRecalling = false; endTurn(); }
        return;
    }

    if (balls.length === 0 && !isShooting) return;

    if (blocks.length === 0 && !isClearBonusActive) {
        isClearBonusActive = true;
        balls.forEach(b => { b.dx *= 3; b.dy *= 3; });
        items.forEach(i => { i.dy *= 3; });
    }

    for (let i = balls.length - 1; i >= 0; i--) {
        const ball = balls[i];
        if (!ball) continue;

        // ✨ [핵심 수정] 마그마 볼을 위한 특별 물리 로직
        if (ball.type === 'MAGMA') {
            ball.x += ball.dx;
            ball.y += ball.dy;

            // 벽 충돌 (튕기기)
            if (ball.x < ball.radius || ball.x > LOGICAL_WIDTH - ball.radius) {
                ball.dx *= -1;
                ball.x = ball.x < ball.radius ? ball.radius : LOGICAL_WIDTH - ball.radius;
                playSound('wall');
            }
            if (ball.y < ball.radius) {
                ball.dy *= -1;
                ball.y = ball.radius;
                playSound('wall');
            }

            // 바닥 충돌 (회수)
            if (ball.y > LOGICAL_HEIGHT - ball.radius) {
                if (nextShooterX === null) {
                    nextShooterX = ball.x;
                    if (nextShooterX < ball.radius) nextShooterX = ball.radius;
                    if (nextShooterX > LOGICAL_WIDTH - ball.radius) nextShooterX = LOGICAL_WIDTH - ball.radius;
                }
                totalBallCount++;
                balls.splice(i, 1);
                continue;
            }

            // 블록 충돌 (관통 및 파괴)
            for (let j = blocks.length - 1; j >= 0; j--) {
                const block = blocks[j];
                if (ball.x + ball.radius > block.x && ball.x - ball.radius < block.x + block.width &&
                    ball.y + ball.radius > block.y && ball.y - ball.radius < block.y + block.height) {

                    // ✨ [추가] 마그마 전용 파티클 효과 생성
                    const blockCenterX = block.x + block.width / 2;
                    const blockCenterY = block.y + block.height / 2;
                    for (let k = 0; k < 8; k++) { // 8개의 불꽃 파티클 생성
                        const angle = Math.random() * Math.PI * 2;
                        const speed = Math.random() * 3 + 1;
                        particles.push({
                            x: blockCenterX,
                            y: blockCenterY,
                            dx: Math.cos(angle) * speed,
                            dy: Math.sin(angle) * speed - 2, // 초기 상승 효과
                            radius: Math.random() * 2.5 + 1,
                            life: 30 + Math.random() * 20,
                            color: `hsl(${Math.random() * 30 + 15}, 100%, ${Math.random() * 40 + 50}%)` // 주황~노랑 계열
                        });
                    }

                    handleBlockDestruction(block, j); // 이 함수 안에서 'break' 효과음 재생
                }
            }
            continue; // 마그마 볼은 아래의 일반 충돌 로직을 건너뜀
        }

        // --- 여기부터는 기존의 일반 공/폭탄 공 충돌 로직 ---
        if (isShooting) { ball.dx *= ACCELERATION; ball.dy *= ACCELERATION; }
        let remainingTime = 1.0;
        for (let iter = 0; iter < 8 && remainingTime > 0; iter++) {
            let firstCollision = null;

            if (ball.dx > 0) { const t = (LOGICAL_WIDTH - ball.radius - ball.x) / ball.dx; if (t >= 0 && t < remainingTime) firstCollision = { time: t, normal: { x: -1, y: 0 } }; }
            else if (ball.dx < 0) { const t = (ball.radius - ball.x) / ball.dx; if (t >= 0 && t < remainingTime) firstCollision = { time: t, normal: { x: 1, y: 0 } }; }
            if (ball.dy > 0) { const t = (LOGICAL_HEIGHT - ball.radius - ball.y) / ball.dy; if (t >= 0 && t < remainingTime && (!firstCollision || t < firstCollision.time)) firstCollision = { time: t, normal: { x: 0, y: -1 }, isFloor: true }; }
            else if (ball.dy < 0) { const t = (ball.radius - ball.y) / ball.dy; if (t >= 0 && t < remainingTime && (!firstCollision || t < firstCollision.time)) firstCollision = { time: t, normal: { x: 0, y: 1 } }; }

            for (const block of blocks) {
                const expandedBlock = { x: block.x - ball.radius, y: block.y - ball.radius, width: block.width + 2 * ball.radius, height: block.height + 2 * ball.radius };
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
                        firstCollision = { time: t_hit_near, block: block, ball: ball };
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
                    const distance = Math.sqrt(distX ** 2 + distY ** 2);
                    if (distance > 0.0001) {
                        normal = { x: distX / distance, y: distY / distance };
                    } else {
                        const overlapX1 = (ball.x + ball.radius) - firstCollision.block.x;
                        const overlapX2 = (firstCollision.block.x + firstCollision.block.width) - (ball.x - ball.radius);
                        const overlapY1 = (ball.y + ball.radius) - firstCollision.block.y;
                        const overlapY2 = (firstCollision.block.y + firstCollision.block.height) - (ball.y - ball.radius);
                        const minOverlapX = Math.min(overlapX1, overlapX2);
                        const minOverlapY = Math.min(overlapY1, overlapY2);
                        if (minOverlapX < minOverlapY) { normal = { x: -Math.sign(ball.dx), y: 0 }; }
                        else { normal = { x: 0, y: -Math.sign(ball.dy) }; }
                    }
                }

                ball.x += ball.dx * firstCollision.time;
                ball.y += ball.dy * firstCollision.time;
                const dot = ball.dx * normal.x + ball.dy * normal.y;
                ball.dx -= 2 * dot * normal.x;
                ball.dy -= 2 * dot * normal.y;

                if (Math.abs(ball.dy) < MIN_VERTICAL_SPEED) { ball.dy = (ball.dy >= 0 ? 1 : -1) * MIN_VERTICAL_SPEED; }

                const epsilon = 0.1;
                ball.x += normal.x * epsilon;
                ball.y += normal.y * epsilon;

                if (firstCollision.block) {
                    playSound('hit');
                    const block = firstCollision.block;
                    const ballIndex = balls.indexOf(ball);

                    if (ball.type === 'BOMB') {
                        const radius = 4.5 * (blockWidth + BLOCK_GAP);
                        const damage = 100;
                        const particleCount = 60;
                        explode(block, radius, damage, particleCount);
                        if (ballIndex > -1) balls.splice(ballIndex, 1);
                        break;
                    }

                    // 일반 볼은 체력을 1 감소시킵니다.
                    block.health--;

                    handleSpecialBlockEffect(block, ball);
                    if (block.health <= 0) {
                        const blockIndex = blocks.indexOf(block);
                        if (blockIndex > -1) handleBlockDestruction(block, blockIndex);
                    }

                } else if (!firstCollision.isFloor) {
                    playSound('wall');
                }

                // 바닥에 닿았을 때
                if (firstCollision.isFloor) {
                    if (nextShooterX === null) {
                        nextShooterX = ball.x;
                        if (nextShooterX < ball.radius) nextShooterX = ball.radius;
                        if (nextShooterX > LOGICAL_WIDTH - ball.radius) nextShooterX = LOGICAL_WIDTH - ball.radius;
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

// =================================================================
// 턴 종료 및 게임 오버
// =================================================================

function endTurn() {
    isShooting = false;
    isRecalling = false;

    // 특수 볼 선택 초기화
    if (selectedBallType !== 'NORMAL') {
        selectedBallType = 'NORMAL';
        bombButton.style.borderColor = '#facc15';
        magmaButton.style.borderColor = '#facc15';
    }

    if (nextShooterX !== null && Math.abs(shooterX - nextShooterX) > 1) {
        isShooterMoving = true;
        shooterMoveProgress = 0;
        shooterStartX = shooterX;
    } else {
        nextShooterX = null;
    }
    items.forEach(item => {
        if (!isClearBonusActive) item.dy *= 3;
    });

    // ✨ [핵심 수정] 스테이지 클리어 여부 확인
    if (blocks.length === 0) {
        // 스테이지 클리어 보너스 지급
        specialBalls.bomb += 2;
        specialBalls.magma += 2;
        bombCountSpan.textContent = specialBalls.bomb;
        magmaCountSpan.textContent = specialBalls.magma;
        playSound('item'); // 보너스 아이템 획득 효과음

        turn++;
        turnCountSpan.textContent = turn;
        setTimeout(generatePattern, 1000); // 다음 스테이지 생성
    } else {
        // 다음 턴 진행
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
                const currentSpeed = Math.sqrt(hitBall.dx ** 2 + hitBall.dy ** 2);
                const randomAngle = Math.random() * Math.PI - Math.PI;
                const newDx = Math.cos(randomAngle) * currentSpeed;
                const newDy = Math.sin(randomAngle) * currentSpeed;
                balls.push({
                    x: hitBall.x, y: hitBall.y, radius: BALL_RADIUS,
                    dx: newDx, dy: newDy,
                    color: 'white', type: 'NORMAL'
                });
            }
            break;
        case 'EXPLOSION':
            playSound('explosion');
            const explosionRadius = 2 * (blockWidth + BLOCK_GAP);
            const centerX = block.x + block.width / 2;
            const centerY = block.y + block.height / 2;

            for (let i = blocks.length - 1; i >= 0; i--) {
                const otherBlock = blocks[i];
                if (otherBlock === block) continue;
                const otherCenterX = otherBlock.x + otherBlock.width / 2;
                const otherCenterY = otherBlock.y + otherBlock.height / 2;
                const dist = Math.sqrt((centerX - otherCenterX) ** 2 + (centerY - otherCenterY) ** 2);
                if (dist < explosionRadius) {
                    otherBlock.health--;
                    if (otherBlock.health <= 0) {
                        handleBlockDestruction(otherBlock, i);
                    }
                }
            }
            for (let i = 0; i < 20; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 4 + 1;
                particles.push({
                    x: centerX, y: centerY,
                    dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed,
                    radius: Math.random() * 2 + 1, life: 25,
                    color: `hsl(0, 100%, ${Math.random() * 40 + 60}%)`
                });
            }
            break;
    }
}

function explode(hitBlock, explosionRadius, explosionDamage, particleCount) {
    playSound('explosion');
    const centerX = hitBlock.x + hitBlock.width / 2;
    const centerY = hitBlock.y + hitBlock.height / 2;

    for (let i = blocks.length - 1; i >= 0; i--) {
        const otherBlock = blocks[i];
        const otherCenterX = otherBlock.x + otherBlock.width / 2;
        const otherCenterY = otherBlock.y + otherBlock.height / 2;
        const dist = Math.sqrt((centerX - otherCenterX) ** 2 + (centerY - otherCenterY) ** 2);
        if (dist < explosionRadius) {
            otherBlock.health -= explosionDamage;
            if (otherBlock.health <= 0) {
                handleBlockDestruction(otherBlock, i);
            }
        }
    }
    for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 8 + 2;
        particles.push({
            x: centerX, y: centerY,
            dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed,
            radius: Math.random() * 4 + 2, life: 45,
            color: `hsl(${Math.random() * 60}, 100%, ${Math.random() * 50 + 50}%)`
        });
    }
}

function createItem(x, y) {
    playSound('item');
    items.push({ x, y, dy: 2, radius: 10 });
    totalBallCount += ITEM_BALL_BONUS;
}

function updateItems() {
    items.forEach((item, index) => {
        item.y += item.dy;
        if (item.y > LOGICAL_HEIGHT) {
            items.splice(index, 1);
        }
    });
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.dx;
        p.y += p.dy;
        p.dy += 0.1; // 중력 효과 추가
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
        boost: 'sounds/boost.mp3',
        dice: 'sounds/dice.mp3' // ✨ dice.mp3 파일 경로 추가
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

function draw() {
    // 1. 배경 그라데이션 그리기
    const bgGradient = ctx.createLinearGradient(0, 0, 0, LOGICAL_HEIGHT);
    bgGradient.addColorStop(0, '#1c2a3e');
    bgGradient.addColorStop(1, '#0f172a');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    // ✨ 2. [핵심 수정] 배경 위에 격자무늬 그리기
    drawGrid(ctx);

    // 3. 나머지 게임 요소들 그리기
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, LOGICAL_HEIGHT - 10, LOGICAL_WIDTH, 10);

    if (!isGameOver) {
        drawAimLine();
    }

    // ✨ [수정] 지난번에 잘못 추가했던 블록 배경 코드는 여기서 삭제되었습니다.

    blocks.forEach(drawBlock);

    drawDiceAnimation();

    balls.forEach(ball => {
        if (ball.type === 'BOMB') {
            ctx.font = `${ball.radius * 2.5}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 4;
            ctx.lineJoin = 'round';
            ctx.strokeText('💣', ball.x, ball.y);
            ctx.fillText('💣', ball.x, ball.y);
        } else {
            drawGlossyBall(ball.x, ball.y, ball.radius, ball.color);
        }
    });

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

    let shooterColor = '#4ade80';
    if (selectedBallType === 'BOMB') {
        shooterColor = '#e11d48';
    } else if (selectedBallType === 'MAGMA') {
        shooterColor = '#f97316';
    } else if (selectedBallType === 'DICE') {
        shooterColor = '#3b82f6';
    }
    drawGlossyBall(shooterX, shooterY, BALL_RADIUS, shooterColor);

    if (selectedBallType === 'NORMAL') {
        let ballCountText;
        if (!isShooting) {
            ballCountText = totalBallCount;
        } else {
            if (ballsToShoot > 0) {
                ballCountText = ballsToShoot;
            } else {
                ballCountText = totalBallCount;
            }
        }

        ctx.fillStyle = 'white';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`x${ballCountText}`, shooterX, shooterY - 25);
    }
}

// ✨ 1. [새로 추가] 모눈종이 배경을 그리는 함수
function drawGrid(ctx) {
    ctx.beginPath();
    // 격자무늬가 너무 튀지 않도록 은은한 회색에 투명도를 줍니다.
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.2)';
    ctx.lineWidth = 1;

    const totalColWidth = blockWidth + BLOCK_GAP;
    const totalRowHeight = BLOCK_HEIGHT + BLOCK_GAP;

    // 세로선 그리기
    for (let i = 0; i <= COLS; i++) {
        const x = BLOCK_GAP / 2 + i * totalColWidth;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, LOGICAL_HEIGHT);
    }

    // 가로선 그리기 (캔버스 전체 높이를 채우도록 계산)
    const numHorizontalLines = Math.ceil(LOGICAL_HEIGHT / totalRowHeight);
    for (let i = 0; i <= numHorizontalLines; i++) {
        const y = BLOCK_GAP / 2 + i * totalRowHeight;
        ctx.moveTo(0, y);
        ctx.lineTo(LOGICAL_WIDTH, y);
    }

    ctx.stroke();
}


function drawAimLine() {
    // 발사대가 움직이는 중(isShooterMoving)이거나, 공을 쏘는 중(isShooting)에는 조준선을 그리지 않습니다.
    if (isShooting || isShooterMoving) return;

    // --- 조준선 설정 ---
    const MAX_LENGTH = 563; // 375 * 1.5, 조준선 길이 1.5배 증가
    const DOT_RADIUS = BALL_RADIUS / 4; // 공의 1/4 크기 (6 / 4 = 1.5)
    const DOT_GAP = 12; // 점 사이의 간격
    const MAX_REFLECTIONS = 3; // 최대 반사 횟수

    // --- 변수 초기화 ---
    let currentX = shooterX;
    let currentY = shooterY;
    let dirX = Math.cos(aimAngle);
    let dirY = Math.sin(aimAngle);
    let remainingLength = MAX_LENGTH;

    // 선택된 볼 타입에 따라 조준선 색상 변경 (선명하게)
    let color = 'rgba(255, 255, 255, 0.8)';
    if (selectedBallType === 'BOMB') {
        color = 'rgba(225, 29, 72, 0.8)';
    } else if (selectedBallType === 'MAGMA') {
        color = 'rgba(249, 115, 22, 0.8)';
    } else if (selectedBallType === 'DICE') {
        color = 'rgba(59, 130, 246, 0.8)';
    }
    ctx.fillStyle = color;

    let distanceToNextDot = DOT_GAP; // 첫 점은 약간 떨어져서 시작

    // 최대 반사 횟수만큼 경로를 계산
    for (let reflection = 0; reflection < MAX_REFLECTIONS && remainingLength > 0.1; reflection++) {
        let firstCollision = { time: Infinity, normal: null };

        // 1. 벽과의 충돌 확인 (공의 반지름 고려)
        if (dirX > 0) { // 오른쪽 벽
            const t = (LOGICAL_WIDTH - BALL_RADIUS - currentX) / dirX;
            if (t > 0.01 && t < firstCollision.time) firstCollision = { time: t, normal: { x: -1, y: 0 } };
        } else if (dirX < 0) { // 왼쪽 벽
            const t = (BALL_RADIUS - currentX) / dirX;
            if (t > 0.01 && t < firstCollision.time) firstCollision = { time: t, normal: { x: 1, y: 0 } };
        }
        if (dirY < 0) { // 위쪽 벽
            const t = (BALL_RADIUS - currentY) / dirY;
            if (t > 0.01 && t < firstCollision.time) firstCollision = { time: t, normal: { x: 0, y: 1 } };
        }
        // 바닥과는 충돌하지 않음

        // 2. 블록과의 충돌 확인 (가장 가까운 블록 찾기)
        for (const block of blocks) {
            // 이미 애니메이션 중인 블록은 충돌 계산에서 제외
            if (block.animation) continue;

            const expandedBlock = { x: block.x - BALL_RADIUS, y: block.y - BALL_RADIUS, width: block.width + 2 * BALL_RADIUS, height: block.height + 2 * BALL_RADIUS };
            let t_near_x = (expandedBlock.x - currentX) / dirX;
            let t_far_x = (expandedBlock.x + expandedBlock.width - currentX) / dirX;
            let t_near_y = (expandedBlock.y - currentY) / dirY;
            let t_far_y = (expandedBlock.y + expandedBlock.height - currentY) / dirY;

            if (t_near_x > t_far_x) [t_near_x, t_far_x] = [t_far_x, t_near_x];
            if (t_near_y > t_far_y) [t_near_y, t_far_y] = [t_far_y, t_near_y];

            const t_hit_near = Math.max(t_near_x, t_near_y);
            const t_hit_far = Math.min(t_far_x, t_far_y);

            if (t_hit_near < t_hit_far && t_hit_near > 0.01 && t_hit_near < firstCollision.time) {
                const impactX = currentX + dirX * t_hit_near;
                const impactY = currentY + dirY * t_hit_near;

                const overlapX1 = (impactX + BALL_RADIUS) - block.x;
                const overlapX2 = (block.x + block.width) - (impactX - BALL_RADIUS);
                const overlapY1 = (impactY + BALL_RADIUS) - block.y;
                const overlapY2 = (block.y + block.height) - (impactY - BALL_RADIUS);

                const minOverlapX = Math.min(overlapX1, overlapX2);
                const minOverlapY = Math.min(overlapY1, overlapY2);

                let normal;
                if (minOverlapX < minOverlapY) {
                    normal = { x: -Math.sign(dirX), y: 0 };
                } else {
                    normal = { x: 0, y: -Math.sign(dirY) };
                }
                firstCollision = { time: t_hit_near, normal: normal };
            }
        }

        // 3. 경로 그리기
        let segmentLength = Math.min(firstCollision.time, remainingLength);
        let numDots = Math.floor((segmentLength - distanceToNextDot) / DOT_GAP) + 1;

        for (let j = 0; j < numDots; j++) {
            const dist = distanceToNextDot + j * DOT_GAP;
            if (dist > segmentLength) break;

            const dotX = currentX + dirX * dist;
            const dotY = currentY + dirY * dist;

            ctx.beginPath();
            ctx.arc(dotX, dotY, DOT_RADIUS, 0, Math.PI * 2);
            ctx.fill();
        }

        distanceToNextDot = (distanceToNextDot + numDots * DOT_GAP) - segmentLength;
        remainingLength -= segmentLength;

        // 4. 충돌 지점으로 이동 및 방향 전환
        if (firstCollision.time < Infinity) {
            currentX += dirX * firstCollision.time;
            currentY += dirY * firstCollision.time;

            const dot = dirX * firstCollision.normal.x + dirY * firstCollision.normal.y;
            dirX -= 2 * dot * firstCollision.normal.x;
            dirY -= 2 * dot * firstCollision.normal.y;
        }
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

    // ✨ [핵심 수정] 주사위 애니메이션 상태에 따라 텍스트 투명도 조절
    let textAlpha = 1.0;
    if (diceAnimation) {
        const progress = 1 - (diceAnimation.life / diceAnimation.maxLife);
        if (diceAnimation.phase === 'rolling') {
            // 숫자가 사라지는 효과 (1 -> 0)
            textAlpha = 1 - progress;
        } else if (diceAnimation.phase === 'revealing') {
            // 숫자가 나타나는 효과 (0 -> 1)
            textAlpha = progress;
        }
    }

    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const centerX = block.x + block.width / 2;
    const centerY = block.y + block.height / 2;

    // 텍스트와 그림자에 모두 투명도 적용
    const mainTextColor = `rgba(255, 255, 255, ${textAlpha * 0.9})`;
    const shadowColor = `rgba(0, 0, 0, ${textAlpha * 0.2})`;

    switch (block.specialType) {
        case 'EXPLOSION':
        case 'MULTIPLIER':
        default:
            const text = block.specialType === 'MULTIPLIER' ? `x${block.health}` : block.health;
            ctx.fillStyle = shadowColor;
            ctx.fillText(text, centerX + 1, centerY + 1);
            ctx.fillStyle = mainTextColor;
            ctx.fillText(text, centerX, centerY);
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

function handleAim(e) {
    if (isShooting || isGameOver || isBlocksMoving || isShooterMoving) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = LOGICAL_WIDTH / rect.width;
    const scaleY = LOGICAL_HEIGHT / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    aimAngle = Math.atan2(mouseY - shooterY, mouseX - shooterX);
    if (aimAngle > -0.1) {
        aimAngle = mouseX > shooterX ? -0.1 : -Math.PI + 0.1;
    }
}

function handleShootTrigger() {
    unlockAudio();
    shoot();
}

// 폭탄/마그마/주사위 볼 '선택' 로직 (상호 배제 및 토글 기능)
function selectSpecialBall(type) {
    if (isShooting) return;

    const isCurrentlySelected = selectedBallType === type;

    // 먼저 모든 버튼의 활성화 효과를 초기화
    bombButton.style.borderColor = '#facc15';
    magmaButton.style.borderColor = '#facc15';
    diceButton.style.borderColor = '#facc15'; // ✨ [추가]

    if (isCurrentlySelected || type === 'NORMAL') {
        // 같은 버튼을 다시 누르거나 'NORMAL'로 강제 전환 시 선택 해제
        selectedBallType = 'NORMAL';
    } else {
        // 다른 버튼을 누르면 해당 타입으로 선택
        if (type === 'BOMB' && specialBalls.bomb > 0) {
            selectedBallType = 'BOMB';
            bombButton.style.borderColor = '#4ade80'; // 폭탄 활성화 색상
        } else if (type === 'MAGMA' && specialBalls.magma > 0) {
            selectedBallType = 'MAGMA';
            magmaButton.style.borderColor = '#f97316'; // 마그마 활성화 색상
        } else if (type === 'DICE' && specialBalls.dice > 0) {
            selectedBallType = 'DICE';
            diceButton.style.borderColor = '#3b82f6'; // ✨ 주사위 활성화 색상 (파란색)
        } else {
            // 사용할 수 없는 아이템이면 선택 안 함
            selectedBallType = 'NORMAL';
        }
    }
}


// ... updateParticles() 함수 바로 아래 ...

// =================================================================
// ✨ [새로 추가] 주사위 애니메이션 효과
// =================================================================
// =================================================================
// ✨ [수정] 주사위 애니메이션 효과
// =================================================================

function showDiceAnimation(newHealths) {
    const duration = 75; // 애니메이션 지속 시간 (프레임 단위, 약 1.25초)
    playSound('dice'); // ✨ [수정] 애니메이션 시작 효과음을 'dice'로 변경
    diceAnimation = {
        phase: 'rolling', // 'rolling' -> 'revealing'
        newHealths: newHealths, // 새로 계산된 체력 값 저장
        x: LOGICAL_WIDTH / 2,
        y: LOGICAL_HEIGHT / 2,
        size: 0,
        angle: 0,
        rotationSpeed: (Math.random() - 0.5) * 0.4,
        alpha: 0,
        life: duration,
        maxLife: duration,
    };
}

function updateDiceAnimation() {
    if (!diceAnimation) return;

    diceAnimation.life--;

    if (diceAnimation.phase === 'rolling') {
        const progress = 1 - (diceAnimation.life / diceAnimation.maxLife);
        diceAnimation.size = Math.sin(progress * Math.PI) * 250;
        diceAnimation.angle += diceAnimation.rotationSpeed;
        diceAnimation.alpha = Math.sin(progress * Math.PI);

        // ✨ [핵심 수정] 주사위 애니메이션이 끝나기 18프레임(약 0.3초) 전에 'revealing' 단계로 미리 전환합니다.
        const transitionEarlyFrames = 18;
        if (diceAnimation.life <= transitionEarlyFrames) {
            // 실제 블록 체력을 새로운 값으로 업데이트
            blocks.forEach((block, index) => {
                block.health = diceAnimation.newHealths[index];
            });

            // 'revealing' 단계로 전환
            diceAnimation.phase = 'revealing';
            const revealDuration = 30; // 원래 숫자 나타나는 시간

            // 전체 애니메이션 길이를 자연스럽게 유지하기 위해, 일찍 시작한 만큼 길이를 늘려줍니다.
            diceAnimation.life = revealDuration + transitionEarlyFrames;
            diceAnimation.maxLife = revealDuration + transitionEarlyFrames;
            playSound('item'); // 숫자 나타나는 효과음
        }
    } else if (diceAnimation.phase === 'revealing') {
        // 'revealing' 단계가 끝나면 애니메이션 완전 종료
        if (diceAnimation.life <= 0) {
            diceAnimation = null;
        }
    }
}

function drawDiceAnimation() {
    // ✨ [수정] 'rolling' 단계일 때만 큰 주사위를 그림
    if (!diceAnimation || diceAnimation.phase !== 'rolling') return;

    ctx.save();
    ctx.translate(diceAnimation.x, diceAnimation.y);
    ctx.rotate(diceAnimation.angle);
    ctx.globalAlpha = diceAnimation.alpha;

    ctx.font = `${diceAnimation.size}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🎲', 0, 0);

    ctx.restore();
}


canvas.addEventListener('mousemove', handleAim);
canvas.addEventListener('click', handleShootTrigger);
canvas.addEventListener('dblclick', recallBalls);
restartButton.addEventListener('click', init);
window.addEventListener('keydown', handleSpeedBoost);

bombButton.addEventListener('click', (e) => {
    unlockAudio(); // ✨ [추가]
    e.stopPropagation(); // 캔버스 클릭 이벤트 전파 방지
    selectSpecialBall('BOMB');
});

magmaButton.addEventListener('click', (e) => {
    unlockAudio(); // ✨ [추가]
    e.stopPropagation(); // 캔버스 클릭 이벤트 전파 방지
    selectSpecialBall('MAGMA');
});

diceButton.addEventListener('click', (e) => {
    unlockAudio(); // ✨ [추가]
    e.stopPropagation(); // 캔버스 클릭 이벤트 전파 방지
    selectSpecialBall('DICE');
});


// 게임 시작
init();