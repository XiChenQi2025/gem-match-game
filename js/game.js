/**
 * 宝石对对碰游戏核心逻辑 - 互动启动版
 * 1. 手动选择幸运色
 * 2. 九宫格初始为蒙版
 * 3. 点击抽奖后揭开蒙版并开始游戏
 */

const GemMatchGame = {
    config: {
        gemColors: 10,
        gridSize: 3,
        maxGridCells: 9,
        initBoxes: 999,
        colors: ['红色', '橙色', '黄色', '绿色', '青色', '蓝色', '紫色', '粉色', '棕色', '白色'],
        colorHex: ['#FF0000', '#FFA500', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#800080', '#FFC0CB', '#8B4513', '#FFFFFF']
    },
    
    state: {
        grid: [],
        luckyColor: null,          // 改为null，等待玩家选择
        touchCount: 0,          // 【保留】累计碰数（用于内部计算和存档）
        currentGain: 0,         // 【新增】本次操作获得的碰数（用于显示）
        spareGems: 0,
        remainingBoxes: 10,
        totalGemsCollected: 0,
        checkedForLucky: [],
        gameRound: 0,
        initialTouchCount: 0,
        hasGameStarted: false,     // 新增：标记游戏是否已开始（蒙版是否揭开）
        isColorSelected: false     // 新增：标记幸运色是否已选择
    },
    
    elements: {},
    
    init() {
        this.addGameLog('游戏初始化...', 'action');
        
        // 获取DOM元素
        this.elements = {
            gridContainer: document.getElementById('game-grid'),
            wishColorDot: document.getElementById('wish-color-dot'),
            wishColorName: document.getElementById('wish-color-name'),
            touchCount: document.getElementById('touch-count'),
            spareGems: document.getElementById('spare-gems'),
            remainingBoxes: document.getElementById('remaining-boxes'),
            singleDrawBtn: document.getElementById('single-draw'),
            tenDrawBtn: document.getElementById('ten-draw'),
            resetBtn: document.getElementById('reset-game'),
            previewContainer: document.getElementById('preview-container'),
            confirmBatchBtn: document.getElementById('confirm-batch'),
            gameLog: document.getElementById('game-log'),
            clearLogBtn: document.getElementById('clear-log'),
            colorOptions: document.getElementById('color-options'),
            selectedColorBox: document.getElementById('selected-color-box'),
            selectedColorName: document.getElementById('selected-color-name'),
            modal: document.getElementById('message-modal'),
            modalTitle: document.getElementById('modal-title'),
            modalText: document.getElementById('modal-text'),
            modalClose: document.getElementById('modal-close')
        };
        
        // 初始化九宫格（蒙版状态）
        this._initGrid();
        
        // 生成幸运色选择器
        this._renderColorOptions();
        
        // 绑定事件
        this._bindEvents();
        
        // 加载保存的游戏（如果有）
        this._loadGame();
        
        // 更新UI
        this._updateUI();
        
        this.addGameLog('请先选择幸运色，然后点击抽奖开始游戏！', 'welcome');
    },
    
    addGameLog(text, type = 'action') {
        if (!this.elements.gameLog) return;
        
        const logContainer = this.elements.gameLog;
        const now = new Date();
        const timeStr = `[${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}]`;
        
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-${type}`;
        logEntry.innerHTML = `<span class="log-time">${timeStr}</span><span class="log-text">${text}</span>`;
        
        logContainer.appendChild(logEntry);
        logContainer.scrollTop = logContainer.scrollHeight;
    },
    
    // 初始化九宫格（空状态 + 蒙版）
    _initGrid() {
        this.state.grid = [];
        this.state.checkedForLucky = [];
        
        for (let row = 0; row < this.config.gridSize; row++) {
            this.state.grid[row] = [];
            this.state.checkedForLucky[row] = [];
            for (let col = 0; col < this.config.gridSize; col++) {
                this.state.grid[row][col] = 0; // 0表示空位
                this.state.checkedForLucky[row][col] = false;
            }
        }
        this._renderGrid(); // 初始渲染为蒙版
    },
    
    // 渲染九宫格（根据游戏状态决定是否显示蒙版）
    _renderGrid() {
        const gridContainer = this.elements.gridContainer;
        if (!gridContainer) return;
        
        gridContainer.innerHTML = '';
        
        for (let row = 0; row < this.config.gridSize; row++) {
            for (let col = 0; col < this.config.gridSize; col++) {
                const cell = document.createElement('div');
                cell.className = 'grid-cell';
                
                // 如果游戏未开始，添加蒙版样式
                if (!this.state.hasGameStarted) {
                    cell.classList.add('masked');
                }
                
                cell.dataset.row = row;
                cell.dataset.col = col;
                
                const gemColor = this.state.grid[row][col];
                // 仅当游戏已开始且格子有宝石时才显示
                if (gemColor > 0 && this.state.hasGameStarted) {
                    cell.classList.add('filled');
                    const gemImg = document.createElement('img');
                    gemImg.className = 'gem-img';
                    gemImg.src = `assets/gems/${gemColor}.png`;
                    gemImg.alt = `宝石${gemColor}`;
                    gemImg.title = this.config.colors[gemColor-1];
                    
                    if (gemColor === this.state.luckyColor) {
                        cell.classList.add('lucky');
                        gemImg.style.filter = 'drop-shadow(0 0 6px gold) brightness(1.2)';
                    }
                    cell.appendChild(gemImg);
                }
                
                gridContainer.appendChild(cell);
            }
        }
    },
    
    // 生成幸运色选择器UI
    _renderColorOptions() {
        const container = this.elements.colorOptions;
        if (!container) return;
        
        container.innerHTML = '';
        
        for (let i = 0; i < this.config.gemColors; i++) {
            const colorIndex = i + 1;
            const colorOption = document.createElement('div');
            colorOption.className = 'color-option';
            if (this.state.luckyColor === colorIndex) {
                colorOption.classList.add('selected');
            }
            colorOption.dataset.color = colorIndex;
            colorOption.style.backgroundColor = this.config.colorHex[i];
            colorOption.title = this.config.colors[i];
            
            colorOption.addEventListener('click', () => {
                this._selectLuckyColor(colorIndex);
            });
            
            container.appendChild(colorOption);
        }
    },
    
    // 选择幸运色
    _selectLuckyColor(colorIndex) {
        this.state.luckyColor = colorIndex;
        this.state.isColorSelected = true;
        
        // 更新选择器UI
        document.querySelectorAll('.color-option').forEach(opt => {
            opt.classList.remove('selected');
            if (parseInt(opt.dataset.color) === colorIndex) {
                opt.classList.add('selected');
            }
        });
        
        // 更新显示
        this.elements.selectedColorBox.style.backgroundColor = this.config.colorHex[colorIndex - 1];
        this.elements.selectedColorBox.style.boxShadow = `0 0 10px ${this.config.colorHex[colorIndex - 1]}`;
        this.elements.selectedColorName.textContent = this.config.colors[colorIndex - 1];
        
        // 更新顶部状态栏
        this._updateWishColorDisplay();
        
        // 更新按钮状态
        this._updateUI();
        
        this.addGameLog(`已选择幸运色：${this.config.colors[colorIndex - 1]}`, 'lucky');
    },
    
    _updateWishColorDisplay() {
        if (!this.state.luckyColor) return;
        const colorIndex = this.state.luckyColor - 1;
        this.elements.wishColorDot.style.backgroundColor = this.config.colorHex[colorIndex];
        this.elements.wishColorDot.style.boxShadow = `0 0 10px ${this.config.colorHex[colorIndex]}`;
        this.elements.wishColorName.textContent = this.config.colors[colorIndex];
    },
    
    _bindEvents() {
        // 单抽按钮
        this.elements.singleDrawBtn.addEventListener('click', () => {
            if (!this._checkGameStartConditions()) return;
            if (this.state.remainingBoxes >= 1) {
                this.state.remainingBoxes -= 1;
                this._performSingleDraw();
            } else {
                this.addGameLog('盲盒不足，无法单抽！', 'error');
                this._showModal('盲盒不足', '剩余盲盒不足，请重置游戏');
            }
            this._updateUI();
        });
        
        // 十连抽按钮
        this.elements.tenDrawBtn.addEventListener('click', () => {
            if (!this._checkGameStartConditions()) return;
            if (this.state.remainingBoxes >= 10) {
                this.state.remainingBoxes -= 10;
                this._performTenDraw();
            } else {
                this.addGameLog(`盲盒不足，需要10个，当前只有${this.state.remainingBoxes}个`, 'error');
                this._showModal('盲盒不足', `剩余盲盒不足10个，当前只有${this.state.remainingBoxes}个`);
            }
            this._updateUI();
        });
        
        this.elements.resetBtn.addEventListener('click', () => {
            this._showModal('重置确认', '确定要重置游戏吗？所有进度将丢失！', true);
        });
        
        this.elements.confirmBatchBtn.addEventListener('click', () => {
            this._confirmBatchDraw();
        });
        
        if (this.elements.clearLogBtn) {
            this.elements.clearLogBtn.addEventListener('click', () => {
                this.elements.gameLog.innerHTML = '<div class="log-entry log-welcome"><span class="log-time">[日志已清空]</span><span class="log-text">游戏日志已清空</span></div>';
                this.addGameLog('日志已清空，游戏继续', 'action');
            });
        }
        
        this.elements.modalClose.addEventListener('click', () => {
            this.elements.modal.style.display = 'none';
        });
        
        window.addEventListener('click', (event) => {
            if (event.target === this.elements.modal) {
                this.elements.modal.style.display = 'none';
            }
        });
    },
    
    // 检查游戏开始条件（是否选了幸运色，是否已开始）
    _checkGameStartConditions() {
        if (!this.state.isColorSelected) {
            this.addGameLog('请先选择幸运色！', 'error');
            this._showModal('未选择幸运色', '请先在上方选择本次游戏的幸运色');
            return false;
        }
        
        // 如果是第一次抽奖（游戏未开始），需要揭开蒙版并填充初始宝石
        if (!this.state.hasGameStarted) {
            this.state.hasGameStarted = true;
            this._fillGridWithRandomGems(); // 填充初始宝石
            this.addGameLog('游戏开始！九宫格已填充宝石。', 'action');
            this._renderGrid(); // 重新渲染，移除蒙版
        }
        return true;
    },
    
    _fillGridWithRandomGems() {
        for (let row = 0; row < this.config.gridSize; row++) {
            for (let col = 0; col < this.config.gridSize; col++) {
                if (this.state.grid[row][col] === 0) {
                    this.state.grid[row][col] = this._getRandomGemColor();
                }
            }
        }
    },
    
    _getRandomGemColor() {
        return Math.floor(Math.random() * this.config.gemColors) + 1;
    },
    
    _showModal(title, text, isConfirm = false) {
        this.elements.modalTitle.textContent = title;
        this.elements.modalText.innerHTML = text;
        
        if (isConfirm) {
            const oldBtn = this.elements.modalClose;
            const newBtn = oldBtn.cloneNode(true);
            oldBtn.parentNode.replaceChild(newBtn, oldBtn);
            this.elements.modalClose = newBtn;
            
            this.elements.modalClose.textContent = '确认重置';
            this.elements.modalClose.onclick = () => {
                this._resetGame();
                this.elements.modal.style.display = 'none';
            };
            
            if (!document.getElementById('modal-cancel')) {
                const cancelBtn = document.createElement('button');
                cancelBtn.id = 'modal-cancel';
                cancelBtn.className = 'modal-close';
                cancelBtn.textContent = '取消';
                cancelBtn.style.marginRight = '10px';
                cancelBtn.style.background = 'linear-gradient(to right, #6b7280, #4b5563)';
                cancelBtn.onclick = () => {
                    this.elements.modal.style.display = 'none';
                };
                this.elements.modalClose.parentNode.insertBefore(cancelBtn, this.elements.modalClose);
            }
        } else {
            this.elements.modalClose.textContent = '知道了';
            this.elements.modalClose.onclick = () => {
                this.elements.modal.style.display = 'none';
            };
        }
        
        this.elements.modal.style.display = 'flex';
    },
    
    // 执行单抽
    _performSingleDraw() {
       this.addGameLog('--- 执行单抽 ---', 'action');
       // 1. 记录开始前的累计碰数
       const touchBefore = this.state.touchCount;
       const initialSpareGems = this.state.spareGems;
       // 2. 执行游戏循环
       this._runGameCycle();
       // 3. 计算本次获得的碰数并更新状态
       this.state.currentGain = this.state.touchCount - touchBefore; // 计算差值
       const spareGemsGained = this.state.spareGems - initialSpareGems;
       // 4. 记录日志（日志可以同时展示累计和本次获得）
       this.addGameLog(`单抽完成！本次获得碰数：${this.state.currentGain}`, 'action');
       this.addGameLog(`累计碰数：${this.state.touchCount}， 本次获得备用宝石：${spareGemsGained}`, 'action');
       this._saveGame();
   }
    
    // 执行十连抽
    _performTenDraw() {
        this.addGameLog('执行十连抽...', 'action');
        
        const previewContainer = this.elements.previewContainer;
        previewContainer.innerHTML = '';
        
        const batchGems = [];
        for (let i = 0; i < 10; i++) {
            const gemColor = this._getRandomGemColor();
            batchGems.push(gemColor);
            
            const gemImg = document.createElement('img');
            gemImg.className = 'preview-gem';
            gemImg.src = `assets/gems/${gemColor}.png`;
            gemImg.alt = `宝石${gemColor}`;
            gemImg.title = this.config.colors[gemColor-1];
            previewContainer.appendChild(gemImg);
        }
        
        this._tempBatchGems = batchGems;
        this.elements.confirmBatchBtn.disabled = false;
        
        this.addGameLog('已生成10个宝石预览，请点击"确认并开始游戏"', 'action');
    },
    
    async _confirmBatchDraw() {
        if (!this._tempBatchGems || this._tempBatchGems.length !== 10) {
            this.addGameLog('十连抽数据异常，请重新尝试', 'error');
            return;
        }
        
        this.addGameLog('开始十连抽游戏循环...', 'action');
       // 1. 记录十连开始前的累计碰数
       const touchBefore = this.state.touchCount;
       const initialSpareGems = this.state.spareGems;
        
        // 十连抽不改变幸运色，使用当前选择的
        this.addGameLog(`使用当前幸运色：${this.config.colors[this.state.luckyColor - 1]}`, 'lucky');
        
        // 清空九宫格并填充新的随机宝石（开始十连时重置）
        this._initGrid();
        this._fillGridWithRandomGems();
        this._renderGrid();
        
        for (let i = 0; i < 10; i++) {
            this.state.gameRound++;
            this.addGameLog(`--- 第 ${this.state.gameRound} 轮开始 ---`, 'action');
            
            this._resetLuckyCheck();
            this._runGameCycle();
            await this._delay(100);
        }
        
        // 2. 十轮循环结束后，计算总获得
        this.state.currentGain = this.state.touchCount - touchBefore; // 计算十连总差值
        const spareGemsGained = this.state.spareGems - initialSpareGems;
        // 3. 更新日志显示
        this.addGameLog('════ 十连抽完成 ════', 'action');
        this.addGameLog(`本次十连总获得碰数：${this.state.currentGain}`, 'action');
        this.addGameLog(`十轮总获得备用宝石：${spareGemsGained}`, 'action');
        this.addGameLog(`当前总碰数：${this.state.touchCount}`, 'action');
        this.addGameLog(`当前备用宝石：${this.state.spareGems}`, 'action');
        
        this.elements.previewContainer.innerHTML = '<p class="hint">点击"十连抽"查看结果</p>';
        this.elements.confirmBatchBtn.disabled = true;
        delete this._tempBatchGems;
        
        this._saveGame();
    },
    
    _runGameCycle() {
        this._step1_checkLuckyColor();
        this._step2_checkFullHouse();
        this._step3_checkThreeInARow();
        this._step4_checkPairs();
        this._step5_supplementGems();
        
        this._renderGrid();
        this._updateUI();
    },
    
    _step1_checkLuckyColor() {
        let luckyCount = 0;
        
        for (let row = 0; row < this.config.gridSize; row++) {
            for (let col = 0; col < this.config.gridSize; col++) {
                const gemColor = this.state.grid[row][col];
                if (gemColor > 0 && gemColor === this.state.luckyColor && !this.state.checkedForLucky[row][col]) {
                    luckyCount++;
                    this.state.checkedForLucky[row][col] = true;
                }
            }
        }
        
        if (luckyCount > 0) {
            this.state.touchCount += luckyCount;
            this.state.spareGems += luckyCount;
            this.addGameLog(`发现 ${luckyCount} 个幸运色宝石，碰数 +${luckyCount}，备用宝石 +${luckyCount}`, 'lucky');
        }
    },
    
    _step2_checkFullHouse() {
        const colorSet = new Set();
        const gemPositions = [];
        
        for (let row = 0; row < this.config.gridSize; row++) {
            for (let col = 0; col < this.config.gridSize; col++) {
                const gemColor = this.state.grid[row][col];
                if (gemColor > 0) {
                    colorSet.add(gemColor);
                    gemPositions.push({row, col, color: gemColor});
                }
            }
        }
        
        if (colorSet.size === 9) {
            this.addGameLog('🎉 触发全家福！集齐9种不同颜色宝石', 'fullhouse');
            this.addGameLog('碰数 +10，备用宝石 +10', 'fullhouse');
            
            this.state.touchCount += 10;
            this.state.spareGems += 10;
            
            gemPositions.forEach(pos => {
                this.state.grid[pos.row][pos.col] = 0;
                this.state.checkedForLucky[pos.row][pos.col] = false;
            });
        }
    },
    
    _step3_checkThreeInARow() {
        const matches = [];
        
        // 检查行、列、对角线（代码与之前相同，为节省篇幅省略详细重复逻辑）
        for (let row = 0; row < this.config.gridSize; row++) {
            const color1 = this.state.grid[row][0];
            const color2 = this.state.grid[row][1];
            const color3 = this.state.grid[row][2];
            if (color1 > 0 && color1 === color2 && color2 === color3) {
                matches.push({positions: [[row, 0], [row, 1], [row, 2]]});
            }
        }
        for (let col = 0; col < this.config.gridSize; col++) {
            const color1 = this.state.grid[0][col];
            const color2 = this.state.grid[1][col];
            const color3 = this.state.grid[2][col];
            if (color1 > 0 && color1 === color2 && color2 === color3) {
                matches.push({positions: [[0, col], [1, col], [2, col]]});
            }
        }
        const diag1Color1 = this.state.grid[0][0];
        const diag1Color2 = this.state.grid[1][1];
        const diag1Color3 = this.state.grid[2][2];
        if (diag1Color1 > 0 && diag1Color1 === diag1Color2 && diag1Color2 === diag1Color3) {
            matches.push({positions: [[0, 0], [1, 1], [2, 2]]});
        }
        const diag2Color1 = this.state.grid[0][2];
        const diag2Color2 = this.state.grid[1][1];
        const diag2Color3 = this.state.grid[2][0];
        if (diag2Color1 > 0 && diag2Color1 === diag2Color2 && diag2Color2 === diag2Color3) {
            matches.push({positions: [[0, 2], [1, 1], [2, 0]]});
        }
        
        if (matches.length > 0) {
            const positionsToRemove = new Set();
            matches.forEach(match => {
                match.positions.forEach(pos => {
                    positionsToRemove.add(`${pos[0]},${pos[1]}`);
                });
            });
            
            const totalBonus = matches.length * 5;
            this.state.touchCount += totalBonus;
            this.state.spareGems += totalBonus;
            
            positionsToRemove.forEach(posStr => {
                const [row, col] = posStr.split(',').map(Number);
                this.state.grid[row][col] = 0;
                this.state.checkedForLucky[row][col] = false;
            });
            
            this.addGameLog(`🎯 发现 ${matches.length} 个三连消除`, 'three');
            this.addGameLog(`碰数 +${totalBonus}，备用宝石 +${totalBonus}`, 'three');
        }
    },
    
    _step4_checkPairs() {
        const colorMap = {};
        
        for (let row = 0; row < this.config.gridSize; row++) {
            for (let col = 0; col < this.config.gridSize; col++) {
                const gemColor = this.state.grid[row][col];
                if (gemColor > 0) {
                    if (!colorMap[gemColor]) colorMap[gemColor] = [];
                    colorMap[gemColor].push({row, col});
                }
            }
        }
        
        let pairCount = 0;
        const positionsToRemove = [];
        
        Object.keys(colorMap).forEach(color => {
            const positions = colorMap[color];
            const pairs = Math.floor(positions.length / 2);
            if (pairs > 0) {
                pairCount += pairs;
                for (let i = 0; i < pairs * 2; i++) {
                    if (i < positions.length) positionsToRemove.push(positions[i]);
                }
            }
        });
        
        if (pairCount > 0) {
            this.state.touchCount += pairCount;
            this.state.spareGems += pairCount;
            
            positionsToRemove.forEach(pos => {
                this.state.grid[pos.row][pos.col] = 0;
                this.state.checkedForLucky[pos.row][pos.col] = false;
            });
            
            this.addGameLog(`✨ 发现 ${pairCount} 个对子消除`, 'pair');
            this.addGameLog(`碰数 +${pairCount}，备用宝石 +${pairCount}`, 'pair');
        }
    },
    
    _step5_supplementGems() {
        let gemsSupplemented = 0;
        
        for (let row = 0; row < this.config.gridSize; row++) {
            for (let col = 0; col < this.config.gridSize; col++) {
                if (this.state.spareGems <= 0) break;
                if (this.state.grid[row][col] === 0) {
                    this.state.grid[row][col] = this._getRandomGemColor();
                    this.state.checkedForLucky[row][col] = false;
                    this.state.spareGems--;
                    gemsSupplemented++;
                }
            }
            if (this.state.spareGems <= 0) break;
        }
        
        if (gemsSupplemented > 0) {
            this.addGameLog(`🔄 补充了 ${gemsSupplemented} 个宝石`, 'supplement');
            this.addGameLog(`剩余备用宝石：${this.state.spareGems}`, 'supplement');
        }
        
        if (this.state.spareGems === 0) {
            this.addGameLog('本轮游戏循环结束（备用宝石为0）', 'action');
        }
    },
    
    _resetLuckyCheck() {
        for (let row = 0; row < this.config.gridSize; row++) {
            for (let col = 0; col < this.config.gridSize; col++) {
                this.state.checkedForLucky[row][col] = false;
            }
        }
    },
    
    _resetGame() {
        this.addGameLog('正在重置游戏...', 'action');
        
        this.state = {
            grid: [],
            luckyColor: null,
            touchCount: 0,
            currentGain: 0,
            spareGems: 0,
            remainingBoxes: this.config.initBoxes,
            totalGemsCollected: 0,
            checkedForLucky: [],
            gameRound: 0,
            initialTouchCount: 0,
            hasGameStarted: false,
            isColorSelected: false
        };
        
        this._initGrid();
        this._renderColorOptions();
        this._updateUI();
        
        this.elements.selectedColorBox.style.backgroundColor = '';
        this.elements.selectedColorBox.style.boxShadow = '';
        this.elements.selectedColorName.textContent = '请在上方选择';
        this.elements.previewContainer.innerHTML = '<p class="hint">点击"十连抽"查看结果</p>';
        this.elements.confirmBatchBtn.disabled = true;
        
        localStorage.removeItem('gemMatchGame');
        
        this.addGameLog('游戏已重置，请重新选择幸运色开始新游戏！', 'action');
    },
    
    _updateUI() {
        if (this.elements.touchCount) this.elements.touchCount.textContent = this.state.currentGain;
        if (this.elements.spareGems) this.elements.spareGems.textContent = this.state.spareGems;
        if (this.elements.remainingBoxes) this.elements.remainingBoxes.textContent = this.state.remainingBoxes;
        
        // 更新按钮状态：如果未选择幸运色，禁用抽奖按钮
        const isActionDisabled = !this.state.isColorSelected;
        this.elements.singleDrawBtn.disabled = isActionDisabled || this.state.remainingBoxes < 1;
        this.elements.tenDrawBtn.disabled = isActionDisabled || this.state.remainingBoxes < 10;
        
        // 添加视觉提示类
        if (isActionDisabled) {
            this.elements.singleDrawBtn.classList.add('disabled-by-state');
            this.elements.tenDrawBtn.classList.add('disabled-by-state');
        } else {
            this.elements.singleDrawBtn.classList.remove('disabled-by-state');
            this.elements.tenDrawBtn.classList.remove('disabled-by-state');
        }
        
        this._updateWishColorDisplay();
    },
    
    _saveGame() {
        const saveData = {
            grid: this.state.grid,
            luckyColor: this.state.luckyColor,
            touchCount: this.state.touchCount,
            spareGems: this.state.spareGems,
            remainingBoxes: this.state.remainingBoxes,
            totalGemsCollected: this.state.totalGemsCollected,
            gameRound: this.state.gameRound,
            hasGameStarted: this.state.hasGameStarted,
            isColorSelected: this.state.isColorSelected
        };
        
        try {
            localStorage.setItem('gemMatchGame', JSON.stringify(saveData));
        } catch (e) {
            this.addGameLog('保存游戏失败：' + e.message, 'error');
        }
    },
    
    _loadGame() {
        try {
            const saved = localStorage.getItem('gemMatchGame');
            if (saved) {
                const saveData = JSON.parse(saved);
                
                this.state.grid = saveData.grid || this.state.grid;
                this.state.luckyColor = saveData.luckyColor || null;
                this.state.touchCount = saveData.touchCount || 0;
                this.state.spareGems = saveData.spareGems || 0;
                this.state.remainingBoxes = saveData.remainingBoxes || this.config.initBoxes;
                this.state.totalGemsCollected = saveData.totalGemsCollected || 0;
                this.state.gameRound = saveData.gameRound || 0;
                this.state.hasGameStarted = saveData.hasGameStarted || false;
                this.state.isColorSelected = saveData.isColorSelected || false;
                
                // 如果存档中有幸运色，更新选择器
                if (this.state.luckyColor) {
                    this._renderColorOptions(); // 重新渲染以确保选中状态
                    this.elements.selectedColorBox.style.backgroundColor = this.config.colorHex[this.state.luckyColor - 1];
                    this.elements.selectedColorBox.style.boxShadow = `0 0 10px ${this.config.colorHex[this.state.luckyColor - 1]}`;
                    this.elements.selectedColorName.textContent = this.config.colors[this.state.luckyColor - 1];
                }
                
                this._renderGrid();
                this._updateWishColorDisplay();
                
                if (this.state.hasGameStarted) {
                    this.addGameLog('已加载游戏进度', 'action');
                }
            }
        } catch (e) {
            this.addGameLog('加载游戏失败，开始新游戏', 'error');
        }
    },
    
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};

document.addEventListener('DOMContentLoaded', () => {
    GemMatchGame.init();
});
