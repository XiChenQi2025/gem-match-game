/**
 * 宝石对对碰游戏核心逻辑 - 完整功能版
 * 功能包含：
 * 1. 手动选择幸运色
 * 2. 九宫格初始蒙版，点击抽奖后揭开
 * 3. 宝石消除与填充动画
 * 4. 全家福/三连/对子全局文字提示
 * 5. 盲盒数量999个
 * 6. 状态栏显示"本次获得"碰数
 * 7. 实时游戏日志
 */

const GemMatchGame = {
    // 游戏配置
    config: {
        gemColors: 10,
        gridSize: 3,
        maxGridCells: 9,
        initBoxes: 999,           // 盲盒数量改为999
        colors: ['红色', '橙色', '黄色', '绿色', '青色', '蓝色', '紫色', '粉色', '棕色', '白色'],
        colorHex: ['#FF0000', '#FFA500', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#800080', '#FFC0CB', '#8B4513', '#FFFFFF']
    },
    
    // 游戏状态
    state: {
        grid: [],
        luckyColor: null,          // 幸运色，等待玩家选择
        touchCount: 0,             // 累计碰数（内部计算用）
        currentGain: 0,            // 本次获得碰数（用于状态栏显示）
        spareGems: 0,              // 备用宝石数量
        remainingBoxes: 999,       // 剩余盲盒
        totalGemsCollected: 0,
        checkedForLucky: [],
        gameRound: 0,
        initialTouchCount: 0,
        hasGameStarted: false,     // 游戏是否已开始（蒙版是否揭开）
        isColorSelected: false     // 幸运色是否已选择
    },
    
    // DOM元素引用
    elements: {},
    
    // 初始化游戏
    init() {
        this.addGameLog('游戏初始化...', 'action');
        
        // 获取DOM元素
        this.elements = {
            gridContainer: document.getElementById('game-grid'),
            wishColorDot: document.getElementById('wish-color-dot'),
            wishColorName: document.getElementById('wish-color-name'),
            touchCount: document.getElementById('touch-count'),      // 现在显示currentGain
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
        
        // 加载保存的游戏
        this._loadGame();
        
        // 更新UI
        this._updateUI();
        
        this.addGameLog('请先选择幸运色，然后点击抽奖开始游戏！', 'welcome');
    },
    
    /**
     * 向游戏日志区添加一条记录
     */
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
    
    /**
     * 在屏幕中央显示全局提示文字
     */
    showGlobalNotification(text, type = '') {
        // 防止重复创建，先移除可能存在的旧提示
        const oldNotification = document.querySelector('.global-notification');
        if (oldNotification) oldNotification.remove();
        
        const notification = document.createElement('div');
        notification.className = `global-notification ${type ? 'notification-' + type : ''}`;
        notification.textContent = text;
        
        document.body.appendChild(notification);
        
        // 动画结束后自动移除元素
        setTimeout(() => {
            if (notification.parentNode) notification.parentNode.removeChild(notification);
        }, 2500);
    },
    
    // 初始化九宫格（空状态 + 蒙版）
    _initGrid() {
        this.state.grid = [];
        this.state.checkedForLucky = [];
        
        for (let row = 0; row < this.config.gridSize; row++) {
            this.state.grid[row] = [];
            this.state.checkedForLucky[row] = [];
            for (let col = 0; col < this.config.gridSize; col++) {
                this.state.grid[row][col] = 0;
                this.state.checkedForLucky[row][col] = false;
            }
        }
        this._renderGrid();
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
            if (this.state.luckyColor === colorIndex) colorOption.classList.add('selected');
            colorOption.dataset.color = colorIndex;
            colorOption.style.backgroundColor = this.config.colorHex[i];
            colorOption.title = this.config.colors[i];
            
            colorOption.addEventListener('click', () => this._selectLuckyColor(colorIndex));
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
            if (parseInt(opt.dataset.color) === colorIndex) opt.classList.add('selected');
        });
        
        // 更新显示
        this.elements.selectedColorBox.style.backgroundColor = this.config.colorHex[colorIndex - 1];
        this.elements.selectedColorBox.style.boxShadow = `0 0 10px ${this.config.colorHex[colorIndex - 1]}`;
        this.elements.selectedColorName.textContent = this.config.colors[colorIndex - 1];
        
        // 更新顶部状态栏
        this._updateWishColorDisplay();
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
        
        this.elements.resetBtn.addEventListener('click', () => this._showModal('重置确认', '确定要重置游戏吗？所有进度将丢失！', true));
        this.elements.confirmBatchBtn.addEventListener('click', () => this._confirmBatchDraw());
        
        if (this.elements.clearLogBtn) {
            this.elements.clearLogBtn.addEventListener('click', () => {
                this.elements.gameLog.innerHTML = '<div class="log-entry log-welcome"><span class="log-time">[日志已清空]</span><span class="log-text">游戏日志已清空</span></div>';
                this.addGameLog('日志已清空，游戏继续', 'action');
            });
        }
        
        this.elements.modalClose.addEventListener('click', () => this.elements.modal.style.display = 'none');
        window.addEventListener('click', (event) => {
            if (event.target === this.elements.modal) this.elements.modal.style.display = 'none';
        });
    },
    
    // 检查游戏开始条件
    _checkGameStartConditions() {
        if (!this.state.isColorSelected) {
            this.addGameLog('请先选择幸运色！', 'error');
            this._showModal('未选择幸运色', '请先在上方选择本次游戏的幸运色');
            return false;
        }
        
        // 第一次抽奖：揭开蒙版并填充初始宝石
        if (!this.state.hasGameStarted) {
            this.state.hasGameStarted = true;
            this._fillGridWithRandomGems();
            this.addGameLog('游戏开始！九宫格已填充宝石。', 'action');
            // 为所有新出现的宝石添加出现动画
            setTimeout(() => this._triggerGemAppearAnimation(), 50);
            this._renderGrid();
        }
        return true;
    },
    
    // 为所有宝石触发出现动画
    _triggerGemAppearAnimation() {
        const allGemImgs = document.querySelectorAll('.grid-cell.filled .gem-img');
        allGemImgs.forEach(img => {
            img.classList.remove('gem-appearing');
            void img.offsetWidth; // 触发重排
            img.classList.add('gem-appearing');
        });
    },
    
    // 用随机宝石填充九宫格
    _fillGridWithRandomGems() {
        for (let row = 0; row < this.config.gridSize; row++) {
            for (let col = 0; col < this.config.gridSize; col++) {
                if (this.state.grid[row][col] === 0) {
                    this.state.grid[row][col] = this._getRandomGemColor();
                }
            }
        }
    },
    // 检查九宫格中是否有空单元格
    _hasEmptyCells() {
        for (let row = 0; row < this.config.gridSize; row++) {
            for (let col = 0; col < this.config.gridSize; col++) {
                if (this.state.grid[row][col] === 0) {
                    return true; // 有空位
                }
            }
        }
        return false; // 没有空位
    }
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
                cancelBtn.onclick = () => this.elements.modal.style.display = 'none';
                this.elements.modalClose.parentNode.insertBefore(cancelBtn, this.elements.modalClose);
            }
        } else {
            this.elements.modalClose.textContent = '知道了';
            this.elements.modalClose.onclick = () => this.elements.modal.style.display = 'none';
        }
        
        this.elements.modal.style.display = 'flex';
    },
    
    // 执行单抽
    _performSingleDraw() {
        this.addGameLog('--- 执行单抽 ---', 'action');
        
        const touchBefore = this.state.touchCount;
        const initialSpareGems = this.state.spareGems;
        
        // 执行游戏循环
        this._runGameCycle();
        
        // 计算本次获得碰数
        this.state.currentGain = this.state.touchCount - touchBefore;
        const spareGemsGained = this.state.spareGems - initialSpareGems;
        
        this.addGameLog(`单抽完成！本次获得碰数：${this.state.currentGain}`, 'action');
        this.addGameLog(`累计碰数：${this.state.touchCount}，本次获得备用宝石：${spareGemsGained}`, 'action');
        
        this._saveGame();
    },
    
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
        
        const touchBefore = this.state.touchCount;
        const initialSpareGems = this.state.spareGems;
        
        this.addGameLog(`使用当前幸运色：${this.config.colors[this.state.luckyColor - 1]}`, 'lucky');
        
        // 清空并重新填充九宫格
        this._initGrid();
        this._fillGridWithRandomGems();
        this._renderGrid();
        setTimeout(() => this._triggerGemAppearAnimation(), 50);
        
        for (let i = 0; i < 10; i++) {
            this.state.gameRound++;
            this.addGameLog(`--- 第 ${this.state.gameRound} 轮开始 ---`, 'action');
            this._resetLuckyCheck();
            await this._runGameCycle();
        }
        
        // 计算十连总获得
        this.state.currentGain = this.state.touchCount - touchBefore;
        const spareGemsGained = this.state.spareGems - initialSpareGems;
        
        this.addGameLog('════ 十连抽完成 ════', 'action');
        this.addGameLog(`本次十连总获得碰数：${this.state.currentGain}`, 'action');
        this.addGameLog(`本次十连总获得备用宝石：${spareGemsGained}`, 'action');
        this.addGameLog(`累计碰数：${this.state.touchCount}，累计备用宝石：${this.state.spareGems}`, 'action');
        
        this.elements.previewContainer.innerHTML = '<p class="hint">点击"十连抽"查看结果</p>';
        this.elements.confirmBatchBtn.disabled = true;
        delete this._tempBatchGems;
        this._saveGame();
    },
    
    // 执行完整的游戏循环（带动画延迟）
    async _runGameCycle() {
        // 第1步: 判断幸运色 (只执行一次)
        await this._step1_checkLuckyColor();
        await this._delay(100);
        
        // 第2-5步: 进入“消除-补充”循环
        let eliminationOccurred;
        let loopCount = 0;
        const MAX_LOOPS = 30; // 安全措施，防止无限循环
        
        do {
            loopCount++;
            eliminationOccurred = false;
            this.addGameLog(`>> 开始第 ${loopCount} 轮消除判断`, 'action');
            
            // 第2步: 判断全家福
            if (await this._step2_checkFullHouse()) {
                eliminationOccurred = true;
                await this._delay(300); // 给动画时间
            }
            
            // 第3步: 判断三连 (仅在全家福未发生后判断，因为全家福会清空棋盘)
            if (!eliminationOccurred && await this._step3_checkThreeInARow()) {
                eliminationOccurred = true;
                await this._delay(300);
            }
            
            // 第4步: 判断对子 (仅在前两者都未发生后判断)
            if (!eliminationOccurred && await this._step4_checkPairs()) {
                eliminationOccurred = true;
                await this._delay(300);
            }
            
            // 第5步: 如果有消除发生，或者有备用宝石，就补充
            if ((eliminationOccurred || this.state.spareGems > 0) && this._hasEmptyCells()) {
                await this._step5_supplementGems();
                await this._delay(300); // 给填充动画时间
            }
            
            // 更新UI显示当前状态
            this._updateUI();
            
            // 循环继续的条件：发生了消除 或 (有备用宝石且棋盘有空位)
        } while ((eliminationOccurred || (this.state.spareGems > 0 && this._hasEmptyCells())) && loopCount < MAX_LOOPS);
        
        if (loopCount >= MAX_LOOPS) {
            this.addGameLog('安全限制：达到最大循环次数', 'error');
        }
        
        this.addGameLog('游戏循环结束', 'action');
    }
    
    async _step1_checkLuckyColor() {
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
    
    async _step2_checkFullHouse() {
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
            this.showGlobalNotification('🎉 全家福！ +10碰数', 'fullhouse');
            
            this.state.touchCount += 10;
            this.state.spareGems += 10;
            
            // 播放消除动画后移除宝石
            await this._removeGemsWithAnimation(gemPositions);
            return true;
        }
        return false;
    },
    
    async _step3_checkThreeInARow() {
        const matches = [];
        
        // 检查行
        for (let row = 0; row < this.config.gridSize; row++) {
            const color1 = this.state.grid[row][0];
            const color2 = this.state.grid[row][1];
            const color3 = this.state.grid[row][2];
            if (color1 > 0 && color1 === color2 && color2 === color3) {
                matches.push({positions: [[row, 0], [row, 1], [row, 2]]});
            }
        }
        
        // 检查列
        for (let col = 0; col < this.config.gridSize; col++) {
            const color1 = this.state.grid[0][col];
            const color2 = this.state.grid[1][col];
            const color3 = this.state.grid[2][col];
            if (color1 > 0 && color1 === color2 && color2 === color3) {
                matches.push({positions: [[0, col], [1, col], [2, col]]});
            }
        }
        
        // 检查对角线
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
            matches.forEach(match => match.positions.forEach(pos => positionsToRemove.add(`${pos[0]},${pos[1]}`)));
            
            const totalBonus = matches.length * 5;
            this.state.touchCount += totalBonus;
            this.state.spareGems += totalBonus;
            
            // 准备移除位置数据
            const gemsToRemove = Array.from(positionsToRemove).map(posStr => {
                const [row, col] = posStr.split(',').map(Number);
                return {row, col};
            });
            
            // 播放消除动画后移除宝石
            await this._removeGemsWithAnimation(gemsToRemove);
            
            this.addGameLog(`🎯 发现 ${matches.length} 个三连消除`, 'three');
            this.addGameLog(`碰数 +${totalBonus}，备用宝石 +${totalBonus}`, 'three');
            this.showGlobalNotification(`🎯 ${matches.length}个三连！ +${totalBonus}碰数`, 'three');
            return true;
        }
        return false;
    },
    
    async _step4_checkPairs() {
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
            
            // 播放消除动画后移除宝石
            await this._removeGemsWithAnimation(positionsToRemove);
            
            this.addGameLog(`✨ 发现 ${pairCount} 个对子消除`, 'pair');
            this.addGameLog(`碰数 +${pairCount}，备用宝石 +${pairCount}`, 'pair');
            this.showGlobalNotification(`✨ ${pairCount}个对子！ +${pairCount}碰数`, 'pair');
            return true;
        }
        return false;
    },
    
    // 辅助函数：播放宝石消除动画后从状态中移除
    async _removeGemsWithAnimation(gemPositions) {
        const promises = gemPositions.map(pos => {
            return new Promise(resolve => {
                const cell = document.querySelector(`.grid-cell[data-row="${pos.row}"][data-col="${pos.col}"]`);
                const gemImg = cell?.querySelector('.gem-img');
                
                if (gemImg) {
                    gemImg.classList.add('gem-removing');
                    setTimeout(() => {
                        this.state.grid[pos.row][pos.col] = 0;
                        this.state.checkedForLucky[pos.row][pos.col] = false;
                        resolve();
                    }, 350);
                } else {
                    this.state.grid[pos.row][pos.col] = 0;
                    this.state.checkedForLucky[pos.row][pos.col] = false;
                    resolve();
                }
            });
        });
        
        await Promise.all(promises);
        this._renderGrid(); // 更新UI显示
    },
    
    async _step5_supplementGems() {
        // 如果没有空位，直接返回
        if (!this._hasEmptyCells()) {
            return 0; // 返回0表示没有补充宝石
        }
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
            this._renderGrid();
            // 触发新宝石的出现动画
            setTimeout(() => this._triggerGemAppearAnimation(), 50);
        }
        
        if (this.state.spareGems === 0) {
            this.addGameLog('本轮游戏循环结束（备用宝石为0）', 'action');
        }
        return gemsSupplemented;
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
        // 状态栏显示"本次获得碰数"(currentGain)
        if (this.elements.touchCount) this.elements.touchCount.textContent = this.state.currentGain;
        if (this.elements.spareGems) this.elements.spareGems.textContent = this.state.spareGems;
        if (this.elements.remainingBoxes) this.elements.remainingBoxes.textContent = this.state.remainingBoxes;
        
        // 按钮状态：如果未选择幸运色，禁用抽奖按钮
        const isActionDisabled = !this.state.isColorSelected;
        this.elements.singleDrawBtn.disabled = isActionDisabled || this.state.remainingBoxes < 1;
        this.elements.tenDrawBtn.disabled = isActionDisabled || this.state.remainingBoxes < 10;
        
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
            currentGain: this.state.currentGain,
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
                this.state.currentGain = saveData.currentGain || 0;
                this.state.spareGems = saveData.spareGems || 0;
                this.state.remainingBoxes = saveData.remainingBoxes || this.config.initBoxes;
                this.state.totalGemsCollected = saveData.totalGemsCollected || 0;
                this.state.gameRound = saveData.gameRound || 0;
                this.state.hasGameStarted = saveData.hasGameStarted || false;
                this.state.isColorSelected = saveData.isColorSelected || false;
                
                if (this.state.luckyColor) {
                    this._renderColorOptions();
                    this.elements.selectedColorBox.style.backgroundColor = this.config.colorHex[this.state.luckyColor - 1];
                    this.elements.selectedColorBox.style.boxShadow = `0 0 10px ${this.config.colorHex[this.state.luckyColor - 1]}`;
                    this.elements.selectedColorName.textContent = this.config.colors[this.state.luckyColor - 1];
                }
                
                this._renderGrid();
                this._updateWishColorDisplay();
                
                if (this.state.hasGameStarted) this.addGameLog('已加载游戏进度', 'action');
            }
        } catch (e) {
            this.addGameLog('加载游戏失败，开始新游戏', 'error');
        }
    },
    
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};

// 页面加载完成后初始化游戏
document.addEventListener('DOMContentLoaded', () => {
    GemMatchGame.init();
});
