// --- 캔버스 및 UI 요소 가져오기 ---
let canvas, ctx, turnCountSpan, gameOverDiv, finalTurnSpan, restartButton,
    bombButton, bombCountSpan, magmaButton, magmaCountSpan,
    diceButton, diceCountSpan, startScreenDiv, startButton;

// --- 게임 설정 ---
// --- 게임 설정 ---
const LOGICAL_WIDTH = 672; // ✨ 700에서 672로 수정
const LOGICAL_HEIGHT = 750;
const COLS = 24;           // ✨ 25에서 24로 수정
const ROWS = 15;
const BLOCK_GAP = 2;
const BLOCK_HEIGHT = 20;
const BALL_RADIUS = 6;
const BALL_SPEED = 7.5;

const BASE_BALL_COUNT = 10;
const ITEM_CHANCE = 0.15;
const ITEM_BALL_BONUS = 1;
const SHOOT_DELAY_FRAMES = 4;
const MIN_VERTICAL_SPEED = 0.2;
const RECALL_SPEED = 35;
const BLOCK_MOVE_DURATION = 30;
const MAX_BALL_SPEED = 20;
const SHOOTER_MOVE_DURATION = 25;
const PATTERN_SCALE = 2;

// ▼▼▼ 여기에 새로운 코드를 붙여넣으세요 ▼▼▼
// --- 속도 게이지 설정 ---
const SPEED_BAR_WIDTH = 7;
const SPEED_BAR_HEIGHT = 100;

// --- 특수 블록 설정 ---
const SPECIAL_BLOCK_CHANCE = 0.2;

// --- 효과음 설정 ---
const sounds = {};
const soundPoolSize = 10;
const soundCooldowns = { hit: 50, wall: 75, fire: 100 };
const soundVolumes = { shoot: 0.6, hit: 0.4, wall: 0.5, break: 0.1, explosion: 0.03, multiply: 0.1, item: 0.9, clear: 1.0, gameOver: 0.9, boost: 0.8, dice: 0.8, fire: 0.05, default: 0.7 };
let soundLastPlayed = {};
let soundPoolCounters = {};



// --- 블록 패턴 정의 ---
// ✨ [핵심 수정] 요청하신 모든 규칙(원본 하트, 순서, 크기, 좌우 대칭, 모양)을 적용하여 최종 수정했습니다.
const patterns = [
    // 1. 하트 (Heart) - 원본 유지
    [
        "00010001000",
        "00111011100",
        "01111111110",
        "01111111110",
        "00111111100",
        "00011111000",
        "00001110000",
        "00000100000",
        "00000000000"
    ],
    // 2. 클로버 (Clover) - 수정
    [
        "00000100000",
        "00001110000",
        "00000100000",
        "00101110100",
        "01111111110",
        "00101110100",
        "00000100000",
        "00001110000",
        "00011111000"
    ],
    // 3. 다이아몬드 (Diamond) - 수정
    [
        "00000100000",
        "00001110000",
        "00011111000",
        "00111111100",
        "01111111110",
        "00111111100",
        "00011111000",
        "00001110000",
        "00000100000"
    ],
    // 4. 스페이드 (Spade) - 수정
    [
        "00000100000",
        "00001110000",
        "00011111000",
        "00111111100",
        "01111111110",
        "00011111000",
        "00000100000",
        "00001110000",
        "00011111000"
    ]
];



// --- 게임 상태 변수 ---
let blockWidth;
let shooterX, shooterY;
let blocks = [], balls = [], items = [], particles = [];
let turn = 1;
let stageIndex = 1
let totalBallCount = BASE_BALL_COUNT;
let currentTurnSpeed = BALL_SPEED;
let isShooting = false, isGameOver = false, isBlocksMoving = false, isRecalling = false, isShooterMoving = false, isClearBonusActive = false;
let aimAngle = -Math.PI / 2;
let blockMoveProgress = 0, shooterMoveProgress = 0, ballsToShoot = 0, shootCooldown = 0;
let nextShooterX = null, shooterStartX = 0;
let specialBalls = { bomb: 3, magma: 3, dice: 3 };
let selectedBallType = 'NORMAL';
let diceAnimation = null;
let audioContext = null;
let gridCellColors = [];
let speedIncreaseInterval = null;
let isGameStarted = false; //


// =================================================================
// 게임 초기화 및 메인 루프
// =================================================================

// ✨ [새로 추가] 게임 시작을 담당하는 함수
// in script.js

// ✨ [핵심 교체] 이 함수 전체를 교체해주세요.
function startGame() {
    // 이 로그가 최우선으로 찍히는지 확인합니다.
    console.log('startGame 함수가 호출되었습니다.');

    try {
        isGameStarted = true;
        if (startScreenDiv) startScreenDiv.style.display = 'none';
        if (gameOverDiv) gameOverDiv.classList.add('hidden');

        init(); // 게임 상태 초기화

    } catch (error) {
        console.error("startGame 함수 실행 중 심각한 오류가 발생했습니다:", error);
        // 오류 발생 시, 게임이 멈추지 않도록 안전하게 상태를 되돌립니다.
        isGameStarted = false;
        if (startScreenDiv) startScreenDiv.style.display = 'flex';
    }
}

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


function unlockAudio() {
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
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

// ▼▼▼ 여기에 새로운 함수를 붙여넣으세요 ▼▼▼
function getCurrentDamageMultiplier() {
    // 속도 범위를 0 ~ 1 사이의 비율로 변환
    const speedRatio = (currentTurnSpeed - BALL_SPEED) / (MAX_BALL_SPEED - BALL_SPEED);

    if (currentTurnSpeed >= MAX_BALL_SPEED) {
        return 3; // 최고 속도 도달 시 x3
    }
    if (speedRatio >= 0.5) {
        return 2; // 속도가 50%를 넘으면 x2
    }
    return 1; // 평소에는 x1
}

// =================================================================
// 게임 로직 (턴, 블록, 공)
// =================================================================

function init() {
    turn = 1;
    stageIndex = 1;
    isShooting = false; isGameOver = false; isBlocksMoving = false; isRecalling = false; isShooterMoving = false;
    blocks = []; balls = []; items = []; particles = [];
    nextShooterX = null; ballsToShoot = 0; shootCooldown = 0; blockMoveProgress = 0; shooterMoveProgress = 0;
    selectedBallType = 'NORMAL';
    specialBalls = { bomb: 5, magma: 3, dice: 5 };
    totalBallCount = BASE_BALL_COUNT;
    currentTurnSpeed = BALL_SPEED;

    // ✨ [핵심 수정] 기존의 속도 증가 타이머가 있다면 제거합니다.
    if (speedIncreaseInterval) {
        clearInterval(speedIncreaseInterval);
    }

    // ✨ [핵심 수정] 5초마다 속도를 0.1씩 올리는 새로운 타이머를 설정합니다.
    speedIncreaseInterval = setInterval(() => {
        // 공을 쏘는 중이고, 게임오버가 아닐 때만 속도를 올립니다.
        if (isShooting && !isRecalling && !isGameOver) {
            if (currentTurnSpeed < MAX_BALL_SPEED) {
                const oldSpeed = currentTurnSpeed;
                currentTurnSpeed += 0.05;
                if (currentTurnSpeed > MAX_BALL_SPEED) {
                    currentTurnSpeed = MAX_BALL_SPEED;
                }

                // 현재 날아가는 모든 공의 속도를 즉시 업데이트합니다.
                if (oldSpeed > 0) { // 0으로 나누는 것을 방지
                    const speedFactor = currentTurnSpeed / oldSpeed;
                    balls.forEach(ball => {
                        ball.dx *= speedFactor;
                        ball.dy *= speedFactor;
                    });
                }

                // 콘솔에 현재 속도를 출력합니다.
                console.log(`속도 증가! 현재 속도: ${currentTurnSpeed.toFixed(2)}`);
            }
        }
    }, 500);

    resizeCanvas();

    blockWidth = (LOGICAL_WIDTH - (COLS + 1) * BLOCK_GAP) / COLS;
    shooterX = LOGICAL_WIDTH / 2;
    shooterY = LOGICAL_HEIGHT - 30;

    turnCountSpan.textContent = turn;
    gameOverDiv.classList.add('hidden');

    // 특수 볼 UI 초기화
    bombCountSpan.textContent = specialBalls.bomb;
    magmaCountSpan.textContent = specialBalls.magma;
    diceCountSpan.textContent = specialBalls.dice;
    bombButton.style.borderColor = '#facc15';
    magmaButton.style.borderColor = '#facc15';
    diceButton.style.borderColor = '#facc15';

    // ✨ [리팩토링] 이벤트 리스너 중복 등록을 방지하기 위해 이 코드를 DOMContentLoaded로 이동시켰습니다.
    // window.addEventListener('resize', resizeCanvas);

    generatePattern();
    if (Object.keys(sounds).length === 0) {
        loadSounds();
    }

    if (!audioContext) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.error("Web Audio API is not supported in this browser");
        }
    }
    generateGridBackground();
    //requestAnimationFrame(gameLoop);
    if (isGameStarted) {
        gameLoop();
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
        diceButton.style.borderColor = '#facc15';
    }

    // 슈터 이동 로직
    if (nextShooterX !== null && Math.abs(shooterX - nextShooterX) > 1) {
        isShooterMoving = true;
        shooterMoveProgress = 0;
        shooterStartX = shooterX;
    } else {
        nextShooterX = null;
    }

    // 아이템 속도 증가 로직
    items.forEach(item => {
        if (!isClearBonusActive) item.dy *= 3;
    });

    // 화면에 표시되는 턴은 항상 증가
    turn++;
    turnCountSpan.textContent = turn;

    // ▼▼▼ 여기가 스테이지를 넘기는 핵심 로직입니다 ▼▼▼
    if (blocks.length === 0) {
        // 스테이지 클리어 시
        stageIndex++; // 스테이지 인덱스를 여기서만 증가시켜 다음 패턴을 준비합니다.

        // 다음 스테이지 시작 시, 공의 개수와 속도를 기본값으로 초기화합니다.
        totalBallCount = BASE_BALL_COUNT;
        currentTurnSpeed = BALL_SPEED;

        // 보너스 지급
        specialBalls.bomb += 2;
        specialBalls.magma += 1;
        specialBalls.dice += 2;
        bombCountSpan.textContent = specialBalls.bomb;
        magmaCountSpan.textContent = specialBalls.magma;
        diceCountSpan.textContent = specialBalls.dice;
        playSound('item');

        // 1초 후 다음 패턴 생성
        setTimeout(generatePattern, 1000);
    } else {
        // 스테이지를 클리어하지 못했을 때 (블록이 남아있을 때)
        // ✨ [핵심 수정] 턴마다 속도를 올리던 기존 로직을 완전히 제거합니다.
        moveBlocksDown(); // 여기서는 stageIndex를 건드리지 않고 블록만 내립니다.
    }
}


function generatePattern() {
    blocks = [];
    isClearBonusActive = false;
    const patternIndex = (stageIndex - 1) % patterns.length;
    const pattern = patterns[patternIndex];
    const patternHeight = pattern.length;
    const patternWidth = pattern[0].length;

    const patternGridWidth = patternWidth * PATTERN_SCALE;
    const gridColOffset = Math.floor((COLS - patternGridWidth) / 2);

    const START_ROW = 3;

    // --- 스테이지별 테마 설정 ---
    const stageThemeIndex = (stageIndex - 1) % 4;
    let baseHue = 0;
    let isGrayscale = false;

    switch (stageThemeIndex) {
        case 0: // 1판 (하트): 빨간색 계열
            baseHue = 0;
            break;
        case 1: // ✨ [핵심 수정] 2판 (클로버): 보라색 계열로 변경
            baseHue = 280; // HSL 색상 모델에서 280은 보라색에 해당합니다.
            break;
        case 2: // 3판 (다이아): 노란 계열
            baseHue = 55;
            break;
        case 3: // 4판 (스페이드): 녹색(연두색) 계열
            isGrayscale = false;
            baseHue = 100;
            break;
        default:
            baseHue = 0;
            break;
    }

    // --- 일반 블록 생성 ---
    for (let r = 0; r < patternHeight; r++) {
        for (let c = 0; c < patternWidth; c++) {
            if (pattern[r][c] === '1') {
                for (let scaleY = 0; scaleY < PATTERN_SCALE; scaleY++) {
                    for (let scaleX = 0; scaleX < PATTERN_SCALE; scaleX++) {
                        const patternC = c * PATTERN_SCALE + scaleX;
                        const patternR = r * PATTERN_SCALE + scaleY;
                        const finalGridC = gridColOffset + patternC;
                        const finalGridR = START_ROW + patternR;

                        // 스페이드 스테이지를 포함한 모든 스테이지가 HSL 색상 모델을 사용합니다.
                        const hue = (baseHue + (finalGridC * 2) - (finalGridR * 2) + 360) % 360;
                        const blockColor = `hsl(${hue}, 80%, 60%)`;

                        // ✨ [핵심 수정] 블록 체력 생성 로직을 요청에 맞게 변경합니다.
                        let blockHealth;
                        if (Math.random() < 0.8) {
                            // 80% 확률: 20 ~ 50 사이의 체력
                            blockHealth = Math.floor(Math.random() * (50 - 20 + 1)) + 20;
                        } else {
                            // 20% 확률: 50 ~ 99 사이의 체력
                            blockHealth = Math.floor(Math.random() * (99 - 50 + 1)) + 50;
                        }

                        blocks.push({
                            x: BLOCK_GAP + finalGridC * (blockWidth + BLOCK_GAP),
                            y: BLOCK_GAP + finalGridR * (BLOCK_HEIGHT + BLOCK_GAP),
                            width: blockWidth,
                            height: BLOCK_HEIGHT,
                            health: blockHealth, // 수정된 체력 적용
                            specialType: 'NONE',
                            color: blockColor
                        });
                    }
                }
            }
        }
    }

    // --- 특수 블록 생성 및 색상 재지정 ---
    const totalBlockCountInPattern = blocks.length;
    const specialBlockCount = Math.floor(totalBlockCountInPattern * SPECIAL_BLOCK_CHANCE);
    const pickedIndices = new Set();
    while (pickedIndices.size < specialBlockCount && totalBlockCountInPattern > 0) {
        pickedIndices.add(Math.floor(Math.random() * totalBlockCountInPattern));
    }

    // ✨ [핵심 수정] 특수 블록의 색상을 요청하신 색상으로 변경합니다.
    pickedIndices.forEach(index => {
        const block = blocks[index];
        const isExplosion = Math.random() < 0.5;

        if (isExplosion) {
            block.specialType = 'EXPLOSION';
            block.health = Math.floor(Math.random() * 10) + 1;
            // 폭발 블록(*)은 '완전한 빨간색'으로 유지
            block.color = `hsl(0, 100%, 50%)`;
        } else {
            block.specialType = 'MULTIPLIER';
            block.health = Math.floor(Math.random() * 5) + 1;
            // 증식 블록(x)은 부드러운 '파스텔 톤 파란색'으로 변경
            block.color = `hsl(210, 80%, 75%)`;
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
    const isGrayscaleStage = (stageIndex - 1) % 4 === 3;
    let ballColor = 'white';
    let ballRadius = BALL_RADIUS;

    if (ballType === 'BOMB') {
        ballColor = isGrayscaleStage ? '#f5f5f5' : '#e11d48';
        ballRadius = BALL_RADIUS * 1.5;
    } else if (ballType === 'MAGMA') {
        ballColor = isGrayscaleStage ? '#a3a3a3' : '#f97316';
        ballRadius = BALL_RADIUS * 1.2;
    }

    balls.push({
        x: shooterX, y: shooterY,
        radius: ballRadius,
        // ✨ [핵심 수정] 고정된 BALL_SPEED 대신, 누적된 currentTurnSpeed를 사용합니다.
        dx: currentTurnSpeed * dirX, dy: currentTurnSpeed * dirY,
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

    const isGrayscaleStage = (stageIndex - 1) % 4 === 3;

    for (let i = balls.length - 1; i >= 0; i--) {
        const ball = balls[i];
        if (!ball) continue;

        if (ball.type === 'MAGMA') {
            ball.x += ball.dx;
            ball.y += ball.dy;

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

            for (let j = blocks.length - 1; j >= 0; j--) {
                const block = blocks[j];
                if (ball.x + ball.radius > block.x && ball.x - ball.radius < block.x + block.width &&
                    ball.y + ball.radius > block.y && ball.y - ball.radius < block.y + block.height) {

                    const blockCenterX = block.x + block.width / 2;
                    const blockCenterY = block.y + block.height / 2;
                    for (let k = 0; k < 8; k++) {
                        const angle = Math.random() * Math.PI * 2;
                        const speed = Math.random() * 3 + 1;

                        let particleColor;
                        if (isGrayscaleStage) {
                            const grayValue = Math.floor(128 + Math.random() * 128);
                            particleColor = `rgb(${grayValue}, ${grayValue}, ${grayValue})`;
                        } else {
                            particleColor = `hsl(${Math.random() * 30 + 15}, 100%, ${Math.random() * 40 + 50}%)`;
                        }

                        particles.push({
                            x: blockCenterX, y: blockCenterY,
                            dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed - 2,
                            radius: Math.random() * 2.5 + 1, life: 30 + Math.random() * 20,
                            color: particleColor
                        });
                    }

                    playSound('fire');
                    handleBlockDestruction(block, j, false);
                }
            }
            continue;
        }

        // --- 여기부터는 기존의 일반 공/폭탄 공 충돌 로직 ---
        let remainingTime = 1.0;
        for (let iter = 0; iter < 8 && remainingTime > 0; iter++) {
            let firstCollision = null;

            // 벽 충돌
            if (ball.dx > 0) { const t = (LOGICAL_WIDTH - ball.radius - ball.x) / ball.dx; if (t >= 0 && t < remainingTime) firstCollision = { time: t, normal: { x: -1, y: 0 } }; }
            else if (ball.dx < 0) { const t = (ball.radius - ball.x) / ball.dx; if (t >= 0 && t < remainingTime) firstCollision = { time: t, normal: { x: 1, y: 0 } }; }
            if (ball.dy > 0) { const t = (LOGICAL_HEIGHT - ball.radius - ball.y) / ball.dy; if (t >= 0 && t < remainingTime && (!firstCollision || t < firstCollision.time)) firstCollision = { time: t, normal: { x: 0, y: -1 }, isFloor: true }; }
            else if (ball.dy < 0) { const t = (ball.radius - ball.y) / ball.dy; if (t >= 0 && t < remainingTime && (!firstCollision || t < firstCollision.time)) firstCollision = { time: t, normal: { x: 0, y: 1 } }; }

            // 블록 충돌
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
                    const block = firstCollision.block;
                    const ballIndex = balls.indexOf(ball);

                    if (ball.type === 'BOMB') {
                        const radius = 2.5 * (blockWidth + BLOCK_GAP);
                        const damage = 100;
                        const particleCount = 60;
                        explode(block, radius, damage, particleCount, isGrayscaleStage);
                        if (ballIndex > -1) balls.splice(ballIndex, 1);
                        break;
                    }

                    // ✨ [핵심 수정] 현재 속도에 따른 데미지 배율을 가져옵니다.
                    const damageMultiplier = getCurrentDamageMultiplier();

                    if (block.specialType === 'EXPLOSION') {
                        block.health -= damageMultiplier; // 배율 적용
                        handleSpecialBlockEffect(block, ball, isGrayscaleStage);
                        if (block.health <= 0) {
                            handleBlockDestruction(block, blocks.indexOf(block), false);
                        }
                    } else {
                        playSound('hit');
                        block.health -= damageMultiplier; // 배율 적용
                        handleSpecialBlockEffect(block, ball, isGrayscaleStage);
                        if (block.health <= 0) {
                            handleBlockDestruction(block, blocks.indexOf(block));
                        }
                    }

                } else if (!firstCollision.isFloor) {
                    playSound('wall');
                }

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


function checkGameOver() {
    const gameOverLine = shooterY - (BLOCK_HEIGHT / 2);
    for (const block of blocks) {
        if (block.y + BLOCK_HEIGHT > gameOverLine) {
            gameOver();
            return;
        }
    }
}

// in script.js

function gameOver() {
    playSound('gameOver');
    isGameOver = true;
    isGameStarted = false;
    finalTurnSpan.textContent = turn;
    gameOverDiv.classList.remove('hidden');
    // startScreenDiv.style.display = 'flex'; // ✨ [핵심] 이 줄을 삭제하거나 주석 처리합니다.

    if (speedIncreaseInterval) {
        clearInterval(speedIncreaseInterval);
        speedIncreaseInterval = null;
    }
}

// =================================================================
// 블록, 아이템, 파티클 효과
// =================================================================

function handleBlockDestruction(block, index, playSoundEffect = true) {
    if (Math.random() < ITEM_CHANCE) {
        createItem(block.x + block.width / 2, block.y + block.height / 2);
    }
    blocks.splice(index, 1);

    // 마지막 블록이 파괴되었는지 확인합니다.
    if (blocks.length === 0) {
        // 아직 회수 절차가 시작되지 않았다면(중복 호출 방지),
        // 즉시 모든 공을 회수하는 함수를 호출합니다.
        if (!isRecalling) {
            recallBalls();
        }
    } else {
        // ✨ [핵심 수정] 사운드 재생이 활성화된 경우, 블록 타입에 관계없이 파괴 효과음을 재생합니다.
        if (playSoundEffect) {
            playSound('break');
        }
    }
}


function applyExplosionDamage(block, blockIndex, damage, suppressMultiplySound = false) {
    const healthBeforeDamage = block.health;
    if (healthBeforeDamage <= 0) return; // 이미 파괴된 블록이면 무시

    block.health -= damage;

    if (block.health <= 0) { // 블록이 이번 데미지로 파괴되었다면
        // ✨ 만약 'x블록'이었다면, 파괴되기 전의 체력만큼 공 개수를 더해줍니다.
        if (block.specialType === 'MULTIPLIER') {
            totalBallCount += healthBeforeDamage;
            // ✨ [핵심 수정] 폭발로 인한 파괴 시에는 사운드를 재생하지 않습니다.
            if (!suppressMultiplySound) {
                playSound('multiply');
            }
        }
        handleBlockDestruction(block, blockIndex, false);
    }
}


function handleSpecialBlockEffect(block, hitBall, isGrayscaleStage = false) {
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
            // ✨ [리팩토링] 중복 로직을 createExplosion 헬퍼 함수로 대체했습니다.
            // 기존에는 여기에 폭발 효과와 파티클 생성을 위한 코드가 직접 작성되어 있었습니다.
            const explosionRadius = 2 * (blockWidth + BLOCK_GAP);
            const centerX = block.x + block.width / 2;
            const centerY = block.y + block.height / 2;
            createExplosion(centerX, centerY, explosionRadius, 1, 20, isGrayscaleStage);
            break;
    }
}


function explode(hitBlock, explosionRadius, explosionDamage, particleCount, isGrayscaleStage = false) {
    // ✨ [리팩토링] 중복 로직을 createExplosion 헬퍼 함수로 대체했습니다.
    // 기존에는 이 함수 내에 폭발 데미지 계산과 파티클 생성 로직이 모두 포함되어 있었습니다.
    const centerX = hitBlock.x + hitBlock.width / 2;
    const centerY = hitBlock.y + hitBlock.height / 2;
    createExplosion(centerX, centerY, explosionRadius, explosionDamage, particleCount, isGrayscaleStage);
}




// ✨ [리팩토링] 중복된 폭발 로직을 통합하기 위해 새로 만든 헬퍼 함수입니다.
// 이 함수는 지정된 위치에 폭발 효과를 생성하고, 주변 블록에 데미지를 주며, 파티클을 생성하는 공통된 역할을 수행합니다.
function createExplosion(centerX, centerY, radius, damage, particleCount, isGrayscaleStage) {
    playSound('explosion');

    // 주변 블록에 데미지 적용
    for (let i = blocks.length - 1; i >= 0; i--) {
        const otherBlock = blocks[i];
        const otherCenterX = otherBlock.x + otherBlock.width / 2;
        const otherCenterY = otherBlock.y + otherBlock.height / 2;
        const dist = Math.sqrt((centerX - otherCenterX) ** 2 + (centerY - otherCenterY) ** 2);
        if (dist < radius) {
            // 사운드 중복 재생을 막기 위해 suppressMultiplySound 플래그(true)를 전달합니다.
            applyExplosionDamage(otherBlock, i, damage, true);
        }
    }

    // 파티클 생성
    for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 8 + 2; // 파티클 속도를 적절히 조절
        const particleColor = isGrayscaleStage
            ? `hsl(0, 0%, ${Math.random() * 50 + 50}%)`
            : `hsl(${Math.random() * 60}, 100%, ${Math.random() * 50 + 50}%)`;

        particles.push({
            x: centerX, y: centerY,
            dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed,
            radius: Math.random() * 4 + 2, life: 45,
            color: particleColor
        });
    }
}

function createItem(x, y) {
    // playSound('item'); // 사운드 재생 로직을 제거합니다.
    items.push({ x, y, dy: 2, radius: BALL_RADIUS });
    // totalBallCount += ITEM_BALL_BONUS; // 공 개수 증가 로직을 제거합니다.
}


function updateItems() {
    // forEach는 배열을 순회하며 요소를 제거할 때 문제를 일으킬 수 있으므로, 역방향 for 루프로 변경합니다.
    for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        item.y += item.dy;

        // 아이템이 바닥에 닿았을 때
        if (item.y > LOGICAL_HEIGHT) {
            totalBallCount += ITEM_BALL_BONUS; // ✨ 여기서 공 개수를 증가시킵니다.
            playSound('item');                 // ✨ 여기서 아이템 획득 사운드를 재생합니다.
            items.splice(i, 1);                // 아이템을 배열에서 제거합니다.
        }
    }
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
        dice: 'sounds/dice.mp3',
        fire: 'sounds/fire.mp3'
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
    // 배경 그라데이션
    const bgGradient = ctx.createLinearGradient(0, 0, 0, LOGICAL_HEIGHT);
    bgGradient.addColorStop(0, '#2c3e50');
    bgGradient.addColorStop(1, '#1a2533');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    // ✨ 원래의 배경 격자 그리기 함수를 호출합니다. (이 부분은 건드리지 않았습니다)
    drawGrid(ctx);

    // 스테이지 테마 확인
    const isGrayscaleStage = (stageIndex - 1) % 4 === 3;

    // 하단 바
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, LOGICAL_HEIGHT - 10, LOGICAL_WIDTH, 10);

    // 조준선
    if (!isGameOver) {
        drawAimLine();
    }

    // 각종 요소 그리기
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

    // ✨ [핵심 수정] 아이템을 일반 하얀 공 모양으로 그리고, 텍스트를 공 위로 옮깁니다.
    items.forEach(item => {
        // 1. 발사되는 일반 공과 똑같은 하얀색 공을 그립니다.
        drawGlossyBall(item.x, item.y, item.radius, 'white');

        // 2. 공의 바깥쪽 위에 "+1" 텍스트를 그립니다.
        ctx.font = 'bold 10px sans-serif';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom'; // 기준선을 아래로 맞춰 위치 잡기 편하게 설정
        ctx.fillText('+1', item.x, item.y - item.radius - 2); // 공의 상단에서 2px 위에 텍스트를 배치
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
        ctx.strokeStyle = isGrayscaleStage ? '#bbbbbb' : '#4ade80';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.closePath();
    }

    // ✨ [핵심 수정] 일반 공(Normal Ball)을 포함하여 모든 발사체 색상을 스테이지 테마에 맞게 수정합니다.
    let shooterColor;
    if (isGrayscaleStage) {
        // 흑백 스테이지: 모든 공을 무채색으로
        switch (selectedBallType) {
            case 'BOMB':  shooterColor = '#f5f5f5'; break;
            case 'MAGMA': shooterColor = '#a3a3a3'; break;
            case 'DICE':  shooterColor = '#bbbbbb'; break;
            default:      shooterColor = '#dddddd'; // 일반 공(NORMAL)을 위한 무채색
        }
    } else {
        // 컬러 스테이지: 기존 색상
        switch (selectedBallType) {
            case 'BOMB':  shooterColor = '#e11d48'; break;
            case 'MAGMA': shooterColor = '#f97316'; break;
            case 'DICE':  shooterColor = '#3b82f6'; break;
            default:      shooterColor = '#4ade80'; // 일반 공(NORMAL)을 위한 녹색
        }
    }
    drawGlossyBall(shooterX, shooterY, BALL_RADIUS, shooterColor);

    // 공 개수 표시
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

    // ✨ [핵심 수정] 볼 속도 게이지를 그립니다.
    drawSpeedBar();
}


// ✨ [새로 추가] 각 격자 칸의 색상을 미리 계산하는 함수
function generateGridBackground() {
    gridCellColors = [];
    const baseHue = 220; // 기본 색상 (푸른 계열)
    const baseSaturation = 30; // 기본 채도
    const baseLightness = 22; // ✨ 기본 밝기를 이전보다 높여서 어둡지 않게

    const numHorizontalLines = Math.ceil(LOGICAL_HEIGHT / (BLOCK_HEIGHT + BLOCK_GAP));

    for (let r = 0; r <= numHorizontalLines; r++) {
        const row = [];
        for (let c = 0; c < COLS; c++) {
            // 채도와 밝기를 약간씩 무작위로 변경하여 깊이감을 줍니다.
            const randomSaturation = baseSaturation + (Math.random() - 0.5) * 15;
            const randomLightness = baseLightness + (Math.random() - 0.5) * 6;
            row.push(`hsl(${baseHue}, ${randomSaturation}%, ${randomLightness}%)`);
        }
        gridCellColors.push(row);
    }
}

// ✨ [핵심 교체] 타일 배경과 네온 라인을 함께 그리는 새로운 격자 함수
function drawGrid(ctx) {
    const totalColWidth = blockWidth + BLOCK_GAP;
    const totalRowHeight = BLOCK_HEIGHT + BLOCK_GAP;

    // 1. 미리 계산된 색상으로 각 격자 칸(타일)을 그립니다.
    gridCellColors.forEach((row, r) => {
        row.forEach((color, c) => {
            // 블록이 그려질 위치와 동일한 곳에 타일을 그립니다.
            const x = BLOCK_GAP + c * totalColWidth;
            const y = BLOCK_GAP + r * totalRowHeight;
            ctx.fillStyle = color;
            ctx.fillRect(x, y, blockWidth, BLOCK_HEIGHT);
        });
    });

    // 2. 타일 위에 선명하게 보이는 네온 라인을 긋습니다.
    ctx.save();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)'; // 선 색상
    ctx.lineWidth = 1;
    ctx.shadowColor = 'rgba(173, 216, 230, 0.2)'; // 빛나는 색상 (옅은 하늘색)
    ctx.shadowBlur = 5; // 빛 번짐 정도

    ctx.beginPath();
    // 세로선
    for (let i = 0; i <= COLS; i++) {
        const x = BLOCK_GAP / 2 + i * totalColWidth;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, LOGICAL_HEIGHT);
    }
    // 가로선
    const numHorizontalLines = Math.ceil(LOGICAL_HEIGHT / totalRowHeight);
    for (let i = 0; i <= numHorizontalLines; i++) {
        const y = BLOCK_GAP / 2 + i * totalRowHeight;
        ctx.moveTo(0, y);
        ctx.lineTo(LOGICAL_WIDTH, y);
    }
    ctx.stroke();
    ctx.restore();
}


function drawAimLine() {
    // 발사대가 움직이는 중(isShooterMoving)이거나, 공을 쏘는 중(isShooting)에는 조준선을 그리지 않습니다.
    if (isShooting || isShooterMoving) return;

    // ✨ [핵심 수정] 현재 스테이지가 흑백인지 확인
    const isGrayscaleStage = (stageIndex - 1) % 4 === 3;

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

    // ✨ [핵심 수정] 스페이드 스테이지에서는 조준선 색상도 무채색으로 변경
    let color = 'rgba(255, 255, 255, 0.8)';
    if (selectedBallType === 'BOMB') {
        color = isGrayscaleStage ? 'rgba(220, 220, 220, 0.8)' : 'rgba(225, 29, 72, 0.8)';
    } else if (selectedBallType === 'MAGMA') {
        color = isGrayscaleStage ? 'rgba(180, 180, 180, 0.8)' : 'rgba(249, 115, 22, 0.8)';
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
    // ✨ [핵심 수정] 모든 스테이지의 그라데이션을 더 어둡고 진하게 만들어 깊이감을 더합니다.
    // 채도를 높이고(60% -> 70%), 밝기를 낮춰서(40% -> 35%) 더 강한 대비를 줍니다.
    gradient.addColorStop(1, `hsl(${hslColor[0]}, 70%, 35%)`);

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
            let text = block.specialType === 'MULTIPLIER' ? `x${block.health}` : block.health;
            text = block.specialType === 'EXPLOSION' ? `*${block.health}` : text;
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


// ▼▼▼ 여기에 새로운 drawSpeedBar 함수를 붙여넣으세요 ▼▼▼
function drawSpeedBar() {
    // 1. 게이지 바 위치 계산
    const barX = LOGICAL_WIDTH - SPEED_BAR_WIDTH - 20;
    const barY = LOGICAL_HEIGHT - SPEED_BAR_HEIGHT - 40;

    // 2. 그라데이션 배경 그리기
    const gradient = ctx.createLinearGradient(barX, barY + SPEED_BAR_HEIGHT, barX, barY);
    gradient.addColorStop(0, 'hsl(210, 80%, 75%)'); // 하단: 파스텔 톤 파란색
    gradient.addColorStop(1, 'red');   // 상단: 빨간색
    ctx.fillStyle = gradient;
    ctx.fillRect(barX, barY, SPEED_BAR_WIDTH, SPEED_BAR_HEIGHT);

    // 3. 현재 속도 비율 계산
    const minSpeedForMapping = BALL_SPEED;
    const maxSpeedForMapping = MAX_BALL_SPEED;
    let speedRatio = (currentTurnSpeed - minSpeedForMapping) / (maxSpeedForMapping - minSpeedForMapping);
    speedRatio = Math.max(0, Math.min(1, speedRatio));

    // 4. 현재 속도를 나타내는 띠 위치 계산
    const indicatorHeight = 3;
    const indicatorY = (barY + SPEED_BAR_HEIGHT) - (speedRatio * SPEED_BAR_HEIGHT) - (indicatorHeight / 2);

    // 5. 속도 띠 그리기
    ctx.fillStyle = 'white';
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 4;
    ctx.fillRect(barX - 2, indicatorY, SPEED_BAR_WIDTH + 4, indicatorHeight);
    ctx.shadowBlur = 0;

    // 6. 게이지 바 테두리 그리기
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, SPEED_BAR_WIDTH, SPEED_BAR_HEIGHT);

    // 7. 데미지 배율을 공 아이콘으로, 세로로 그립니다.
    const damageMultiplier = getCurrentDamageMultiplier();
    const indicatorBallRadius = BALL_RADIUS * 0.6; // 실제 공의 60% 크기
    const centerX = barX + SPEED_BAR_WIDTH / 2;
    const ballSpacing = indicatorBallRadius * 2.5; // 공 사이의 수직 간격
    const bottomBallY = barY - indicatorBallRadius - 5; // 가장 아래쪽 공의 Y 위치
    const ballColor = 'white';

    for (let i = 0; i < damageMultiplier; i++) {
        const ballY = bottomBallY - (i * ballSpacing);
        drawGlossyBall(centerX, ballY, indicatorBallRadius, ballColor);
    }

    // 8. ✨ [핵심 수정] 공 아이콘 맨 위에 폭발 아이콘을 항상 그립니다.
    // 가장 위에 있는 공의 Y 좌표를 계산합니다.
    const topBallY = bottomBallY - ((damageMultiplier - 1) * ballSpacing);
    // 폭발 아이콘을 가장 위쪽 공보다 더 위에 위치시킵니다.
    const explosionIconY = topBallY - indicatorBallRadius - 5;

    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom'; // 아이콘 위치를 잡기 쉽도록 기준선을 아래로 설정
    ctx.fillStyle = 'white';
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 4;
    ctx.fillText('💥', centerX, explosionIconY);
    ctx.shadowBlur = 0; // 그림자 초기화
}

// =================================================================
// 이벤트 리스너
// =================================================================



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

    // ✨ [핵심 수정] 스테이지 테마에 따라 버튼 색상을 다르게 설정
    const isGrayscaleStage = (stageIndex - 1) % 4 === 3;
    const unselectedColor = isGrayscaleStage ? '#666666' : '#facc15';
    const isCurrentlySelected = selectedBallType === type;

    // 먼저 모든 버튼의 활성화 효과를 초기화
    bombButton.style.borderColor = unselectedColor;
    magmaButton.style.borderColor = unselectedColor;
    diceButton.style.borderColor = unselectedColor;

    if (isCurrentlySelected || type === 'NORMAL') {
        // 같은 버튼을 다시 누르거나 'NORMAL'로 강제 전환 시 선택 해제
        selectedBallType = 'NORMAL';
    } else {
        // 다른 버튼을 누르면 해당 타입으로 선택
        if (type === 'BOMB' && specialBalls.bomb > 0) {
            selectedBallType = 'BOMB';
            bombButton.style.borderColor = isGrayscaleStage ? '#ffffff' : '#4ade80';
        } else if (type === 'MAGMA' && specialBalls.magma > 0) {
            selectedBallType = 'MAGMA';
            magmaButton.style.borderColor = isGrayscaleStage ? '#cccccc' : '#f97316';
        } else if (type === 'DICE' && specialBalls.dice > 0) {
            selectedBallType = 'DICE';
            diceButton.style.borderColor = isGrayscaleStage ? '#999999' : '#3b82f6';
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


// in script.js

// ✨ [핵심 교체] 파일 맨 아래의 이 블록 전체를 교체해주세요.
document.addEventListener('DOMContentLoaded', () => {
    // 1. HTML 요소들을 여기서 찾아서 변수에 할당합니다.
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    turnCountSpan = document.getElementById('turn-count');
    gameOverDiv = document.getElementById('game-over');
    finalTurnSpan = document.getElementById('final-turn');
    restartButton = document.getElementById('restart-button');
    bombButton = document.getElementById('bomb-ball-btn');
    bombCountSpan = document.getElementById('bomb-ball-count');
    magmaButton = document.getElementById('magma-ball-btn');
    magmaCountSpan = document.getElementById('magma-ball-count');
    diceButton = document.getElementById('dice-item-btn');
    diceCountSpan = document.getElementById('dice-item-count');
    startScreenDiv = document.getElementById('start-screen');
    startButton = document.getElementById('start-button');

    // 2. ✨ [핵심 수정] 게임에 필요한 모든 UI 요소를 철저하게 검증합니다.
    const elementsToVerify = {
        canvas, ctx, turnCountSpan, gameOverDiv, finalTurnSpan, restartButton,
        bombButton, bombCountSpan, magmaButton, magmaCountSpan,
        diceButton, diceCountSpan, startScreenDiv, startButton
    };

    for (const key in elementsToVerify) {
        if (!elementsToVerify[key]) {
            // 어떤 요소가 문제인지 정확히 알려주고, 더 이상 진행하지 않습니다.
            console.error(`[치명적 오류] UI 요소 '${key}'를 찾을 수 없습니다. HTML의 id를 다시 확인해주세요.`);
            alert(`[치명적 오류] UI 요소 '${key}'를 찾을 수 없습니다. HTML의 id를 다시 확인해주세요.`);
            return;
        }
    }

    // 3. 모든 요소가 준비된 것이 확인되었으므로, 이제 이벤트를 연결합니다.
    canvas.addEventListener('mousemove', handleAim);
    canvas.addEventListener('click', handleShootTrigger);
    canvas.addEventListener('dblclick', recallBalls);
    window.addEventListener('keydown', handleSpeedBoost);
    // ✨ [리팩토링] resize 이벤트 리스너를 이곳으로 이동하여 중복 등록을 방지합니다.
    window.addEventListener('resize', resizeCanvas);

    restartButton.addEventListener('click', startGame);
    startButton.addEventListener('click', startGame);


    bombButton.addEventListener('click', (e) => {
        unlockAudio();
        e.stopPropagation();
        selectSpecialBall('BOMB');
    });

    magmaButton.addEventListener('click', (e) => {
        unlockAudio();
        e.stopPropagation();
        selectSpecialBall('MAGMA');
    });

    diceButton.addEventListener('click', (e) => {
        unlockAudio();
        e.stopPropagation();
        selectSpecialBall('DICE');
    });

});