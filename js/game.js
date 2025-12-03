/**
 * 宝石对对碰游戏核心逻辑 - 最终完整版
 * 整合所有优化功能：
 * 1. 手动选择幸运色
 * 2. 九宫格初始蒙版，点击抽奖后揭开
 * 3. 正确的循环消除逻辑（消除→补充→再判断）
 * 4. 延长动画和延迟时间
 * 5. 宝石消除与填充动画
 * 6. 全家福/三连/对子全局文字提示
 * 7. 盲盒数量999个
 * 8. 状态栏显示"本次获得"碰数
 * 9. 实时游戏日志
 * 宝石对对碰游戏 - 优化稳定版
 * 核心保证：每次抽奖都执行完整的"消除-补充-再消除"循环，直到棋盘稳定
 */

const GemMatchGame = {
    config: {
        gemColors: 10,
        gridSize: 3,
        colors: ['红色', '橙色', '黄色', '绿色', '青色', '蓝色', '紫色', '粉色', '棕色', '白色'],
        colorHex: ['#FF0000', '#FFA500', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#800080', '#FFC0CB', '#8B4513', '#FFFFFF']
    },
    
    state: {
        grid: [],
        luckyColor: null,
        currentGain: 0,            // 本次抽奖累计碰数
        spareGems: 0,             // 备用宝石（内部使用）
        checkedForLucky: [],
        hasGameStarted: false,
        isColorSelected: false
    },
    
    elements: {},
    
    init() {
        this.addGameLog('游戏初始化完成', 'action');
        
        this.elements = {
            gridContainer: document.getElementById('game-grid'),
            wishColorDot: document.getElementById('wish-color-dot'),
            wishColorName: document.getElementById('wish-color-name'),
            touchCount: document.getElementById('touch-count'),
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
            modal: document.getElementById('message-modal')
        };
        
        this._initGrid();
        this._renderColorOptions();
        this._bindEvents();
        this._loadGame();
        this._updateUI();
        
        this.addGameLog('请选择幸运色，然后点击抽奖开始游戏！', 'welcome');
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
    
    showGlobalNotification(text, type = '') {
        const oldNotification = document.querySelector('.global-notification');
        if (oldNotification) oldNotification.remove();
        
        const notification = document.createElement('div');
        notification.className = `global-notification ${type ? 'notification-' + type : ''}`;
        notification.textContent = text;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) notification.parentNode.removeChild(notification);
        }, 3800);
    },
    
    // 初始化九宫格
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
    
    // 渲染九宫格
    _renderGrid() {
        const gridContainer = this.elements.gridContainer;
        if (!gridContainer) return;
        
        gridContainer.innerHTML = '';
        
        for (let row = 0; row < this.config.gridSize; row++) {
            for (let col = 0; col < this.config.gridSize; col++) {
                const cell = document.createElement('div');
                cell.className = 'grid-cell';
                
                if (!this.state.hasGameStarted) cell.classList.add('masked');
                cell.dataset.row = row;
                cell.dataset.col = col;
                
                const gemColor = this.state.grid[row][col];
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
    
    // ==================== 核心修改：重构游戏循环逻辑 ====================
    
    /**
     * 执行单次抽奖的完整过程
     * 逻辑：幸运色判断 → [消除→补充]循环 → 直到棋盘稳定
     */
    async _performSingleDraw() {
        // 重置状态开始新抽奖
        this.state.currentGain = 0;
        this.state.spareGems = 0;
        this._resetCheckedStatus();
        this._fillGridWithRandomGems();
        this._renderGrid();
        setTimeout(() => this._triggerGemAppearAnimation(), 50);
        
        this.addGameLog('--- 开始单抽 ---', 'action');
        
        // 1. 幸运色判断（仅一次）
        await this._stepLuckyColor();
        await this._delay(200);
        
        // 2. 主消除循环
        let loopCount = 0;
        const MAX_LOOPS = 50; // 安全上限
        
        do {
            loopCount++;
            let madeElimination = false;
            
            // 全家福检查（优先级最高）
            if (await this._stepFullHouse()) {
                madeElimination = true;
                await this._delay(500);
            }
            
            // 三连检查（全家福未发生时）
            if (!madeElimination && await this._stepThreeInRow()) {
                madeElimination = true;
                await this._delay(400);
            }
            
            // 对子检查（前两者均未发生）
            if (!madeElimination && await this._stepPairs()) {
                madeElimination = true;
                await this._delay(400);
            }
            
            // 补充宝石（如果发生了消除或有备用宝石）
            if (madeElimination || this.state.spareGems > 0) {
                await this._stepSupplementGems();
                await this._delay(500);
            }
            
            // 更新UI
            this._updateUI();
            
            // 循环继续条件：发生了消除 或 (有备用宝石且棋盘有空位)
            // 同时检查棋盘是否还有潜在消除可能
        } while (this._shouldLoopContinue(loopCount, MAX_LOOPS));
        
        if (loopCount >= MAX_LOOPS) {
            this.addGameLog('安全限制：达到最大循环次数', 'error');
        }
        
        this.addGameLog(`单抽完成！本次获得碰数：${this.state.currentGain}`, 'action');
        this._saveGame();
    },
    
    /**
     * 判断是否应该继续循环
     * 继续条件：
     * 1. 发生了消除 或
     * 2. 有备用宝石且棋盘有空位 或
     * 3. 棋盘仍有可消除的组合（即使备用宝石为0）
     */
    _shouldLoopContinue(loopCount, maxLoops) {
        if (loopCount >= maxLoops) return false;
        
        // 条件1：棋盘是否有空位且还有备用宝石
        const hasEmptyCells = this._hasEmptyCells();
        const hasSpareGems = this.state.spareGems > 0;
        if (hasEmptyCells && hasSpareGems) return true;
        
        // 条件2：棋盘是否还有可消除的组合
        // 这里检查所有可能的消除（包括刚刚补充的宝石）
        return this._checkAnyPossibleMatch();
    },
    
    /**
     * 检查当前棋盘是否存在任何可能的消除
     * 包括：三连（横竖斜）和潜在对子（但需要至少2个）
     */
    _checkAnyPossibleMatch() {
        const grid = this.state.grid;
        const size = this.config.gridSize;

        const colorSet = new Set();
        
        //检查全家福
        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                const gemColor = grid[row][col];
                if (gemColor > 0) {
                    colorSet.add(gemColor);
                    if (colorSet.size === 9) {
                    return true;
                    }
                }
            }
        }
        
        // 检查行三连
        for (let row = 0; row < size; row++) {
            if (grid[row][0] > 0 && grid[row][0] === grid[row][1] && grid[row][1] === grid[row][2]) {
                return true;
            }
        }
        
        // 检查列三连
        for (let col = 0; col < size; col++) {
            if (grid[0][col] > 0 && grid[0][col] === grid[1][col] && grid[1][col] === grid[2][col]) {
                return true;
            }
        }
        
        // 检查对角线
        if (grid[0][0] > 0 && grid[0][0] === grid[1][1] && grid[1][1] === grid[2][2]) {
            return true;
        }
        if (grid[0][2] > 0 && grid[0][2] === grid[1][1] && grid[1][1] === grid[2][0]) {
            return true;
        }
        
        // 检查对子（至少有两个相同颜色）
        const colorCount = {};
        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                const color = grid[row][col];
                if (color > 0) {
                    colorCount[color] = (colorCount[color] || 0) + 1;
                    if (colorCount[color] >= 2) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    },
    
    // ==================== 游戏步骤实现 ====================
    
    async _stepLuckyColor() {
        let luckyCount = 0;
        const gemForLucky = [];
        for (let row = 0; row < this.config.gridSize; row++) {
            for (let col = 0; col < this.config.gridSize; col++) {
                const gemColor = this.state.grid[row][col];
                if (gemColor > 0 && gemColor === this.state.luckyColor && this.state.checkedForLucky[row][col]) {
                    luckyCount++;
                    this.state.checkedForLucky[row][col] = true;
                    if (gemColor > 0) {
                    gemForLucky.push({row, col});
                    }
                }
            }
        }
        
        if (luckyCount > 0) {
            this.state.currentGain += luckyCount;
            this.state.spareGems += luckyCount;
            this.addGameLog(`发现 ${luckyCount} 个幸运色宝石，碰数 +${luckyCount}，备用宝石 +${luckyCount}`, 'lucky');
            await this._removeGemsWithAnimation(gemForLucky);
            return true;
        }
        return false;
    },
    
    async _stepFullHouse() {
        const colorSet = new Set();
        const gemPositions = [];
        
        for (let row = 0; row < this.config.gridSize; row++) {
            for (let col = 0; col < this.config.gridSize; col++) {
                const gemColor = this.state.grid[row][col];
                if (gemColor > 0) {
                    colorSet.add(gemColor);
                    gemPositions.push({row, col});
                }
            }
        }
        
        if (colorSet.size === 9) {
            this.state.currentGain += 10;
            this.state.spareGems += 10;
            
            this.addGameLog('🎉 触发全家福！+10碰数', 'fullhouse');
            this.showGlobalNotification('🎉 全家福！ +10碰数', 'fullhouse');
            
            await this._removeGemsWithAnimation(gemPositions);
            return true;
        }
        return false;
    },
    
    async _stepThreeInRow() {
        const matches = [];
        const grid = this.state.grid;
        
        // 检查行
        for (let row = 0; row < 3; row++) {
            if (grid[row][0] > 0 && grid[row][0] === grid[row][1] && grid[row][1] === grid[row][2]) {
                matches.push([[row,0], [row,1], [row,2]]);
            }
        }
        
        // 检查列
        for (let col = 0; col < 3; col++) {
            if (grid[0][col] > 0 && grid[0][col] === grid[1][col] && grid[1][col] === grid[2][col]) {
                matches.push([[0,col], [1,col], [2,col]]);
            }
        }
        
        // 检查对角线
        if (grid[0][0] > 0 && grid[0][0] === grid[1][1] && grid[1][1] === grid[2][2]) {
            matches.push([[0,0], [1,1], [2,2]]);
        }
        if (grid[0][2] > 0 && grid[0][2] === grid[1][1] && grid[1][1] === grid[2][0]) {
            matches.push([[0,2], [1,1], [2,0]]);
        }
        
        if (matches.length > 0) {
            const totalBonus = matches.length * 5;
            this.state.currentGain += totalBonus;
            this.state.spareGems += totalBonus;
            
            // 收集所有需要移除的位置（去重）
            const positionsToRemove = new Set();
            matches.flat().forEach(pos => positionsToRemove.add(`${pos[0]},${pos[1]}`));
            
            const gemsToRemove = Array.from(positionsToRemove).map(posStr => {
                const [row, col] = posStr.split(',').map(Number);
                return {row, col};
            });
            
            await this._removeGemsWithAnimation(gemsToRemove);
            
            this.addGameLog(`🎯 发现 ${matches.length} 个三连消除，碰数 +${totalBonus}`, 'three');
            this.showGlobalNotification(`🎯 ${matches.length}个三连！ +${totalBonus}碰数`, 'three');
            return true;
        }
        return false;
    },
    
    async _stepPairs() {
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
        
        Object.values(colorMap).forEach(positions => {
            const pairs = Math.floor(positions.length / 2);
            if (pairs > 0) {
                pairCount += pairs;
                for (let i = 0; i < pairs * 2; i++) {
                    positionsToRemove.push(positions[i]);
                }
            }
        });
        
        if (pairCount > 0) {
            this.state.currentGain += pairCount;
            this.state.spareGems += pairCount;
            
            await this._removeGemsWithAnimation(positionsToRemove);
            
            this.addGameLog(`✨ 发现 ${pairCount} 个对子消除，碰数 +${pairCount}`, 'pair');
            this.showGlobalNotification(`✨ ${pairCount}个对子！ +${pairCount}碰数`, 'pair');
            return true;
        }
        return false;
    },
    
    async _stepSupplementGems() {
        if (!this._hasEmptyCells()) return;
        
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
            this.addGameLog(`🔄 补充了 ${gemsSupplemented} 个宝石，剩余备用宝石：${this.state.spareGems}`, 'supplement');
            this._renderGrid();
            setTimeout(() => this._triggerGemAppearAnimation(), 50);
        }
    },
    
    // ==================== 辅助函数 ====================
    
    _resetCheckedStatus() {
        for (let row = 0; row < this.config.gridSize; row++) {
            for (let col = 0; col < this.config.gridSize; col++) {
                this.state.checkedForLucky[row][col] = false;
            }
        }
    },
    
    _fillGridWithRandomGems() {
        for (let row = 0; row < this.config.gridSize; row++) {
            for (let col = 0; col < this.config.gridSize; col++) {
                this.state.grid[row][col] = this._getRandomGemColor();
            }
        }
    },
    
    _getRandomGemColor() {
        return Math.floor(Math.random() * this.config.gemColors) + 1;
    },
    
    _hasEmptyCells() {
        for (let row = 0; row < this.config.gridSize; row++) {
            for (let col = 0; col < this.config.gridSize; col++) {
                if (this.state.grid[row][col] === 0) return true;
            }
        }
        return false;
    },
    
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
                    }, 600);
                } else {
                    this.state.grid[pos.row][pos.col] = 0;
                    this.state.checkedForLucky[pos.row][pos.col] = false;
                    resolve();
                }
            });
        });
        
        await Promise.all(promises);
        this._renderGrid();
    },
    
    _triggerGemAppearAnimation() {
        const allGemImgs = document.querySelectorAll('.grid-cell.filled .gem-img');
        allGemImgs.forEach(img => {
            img.classList.remove('gem-appearing');
            void img.offsetWidth;
            img.classList.add('gem-appearing');
        });
    },
    
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },
    
    // ==================== UI相关函数 ====================
    
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
    
    _selectLuckyColor(colorIndex) {
        this.state.luckyColor = colorIndex;
        this.state.isColorSelected = true;
        
        document.querySelectorAll('.color-option').forEach(opt => {
            opt.classList.remove('selected');
            if (parseInt(opt.dataset.color) === colorIndex) opt.classList.add('selected');
        });
        
        this.elements.selectedColorBox.style.backgroundColor = this.config.colorHex[colorIndex - 1];
        this.elements.selectedColorBox.style.boxShadow = `0 0 10px ${this.config.colorHex[colorIndex - 1]}`;
        this.elements.selectedColorName.textContent = this.config.colors[colorIndex - 1];
        
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
            this._performSingleDraw();
        });
        
        // 十连抽简化：实际执行10次单抽
        this.elements.tenDrawBtn.addEventListener('click', async () => {
            if (!this._checkGameStartConditions()) return;
            
            this.addGameLog('开始十连抽...', 'action');
            let totalGain = 0;
            
            for (let i = 0; i < 10; i++) {
                // 保存当前碰数
                const currentBefore = this.state.currentGain;
                
                // 执行一次单抽
                await this._performSingleDraw();
                
                // 计算这次单抽的获得
                const thisDrawGain = this.state.currentGain - currentBefore;
                totalGain += thisDrawGain;
                
                this.addGameLog(`十连抽第${i+1}次完成，获得${thisDrawGain}碰数`, 'action');
                
                // 短暂延迟，让玩家能看到每次结果
                if (i < 9) await this._delay(300);
            }
            
            // 更新最终显示
            this.state.currentGain = totalGain;
            this._updateUI();
            this.addGameLog(`════ 十连抽完成，总获得：${totalGain}碰数 ════`, 'action');
            this._saveGame();
        });
        
        this.elements.resetBtn.addEventListener('click', () => this._resetGame());
        
        if (this.elements.clearLogBtn) {
            this.elements.clearLogBtn.addEventListener('click', () => {
                this.elements.gameLog.innerHTML = '';
                this.addGameLog('日志已清空', 'action');
            });
        }
    },
    
    _checkGameStartConditions() {
        if (!this.state.isColorSelected) {
            this.addGameLog('请先选择幸运色！', 'error');
            return false;
        }
        
        if (!this.state.hasGameStarted) {
            this.state.hasGameStarted = true;
            this.addGameLog('游戏开始！', 'action');
        }
        return true;
    },
    
    _updateUI() {
        if (this.elements.touchCount) {
            this.elements.touchCount.textContent = this.state.currentGain;
        }
        
        const isActionDisabled = !this.state.isColorSelected;
        this.elements.singleDrawBtn.disabled = isActionDisabled;
        this.elements.tenDrawBtn.disabled = isActionDisabled;
        
        this._updateWishColorDisplay();
    },
    
    _resetGame() {
        this.state = {
            grid: [],
            luckyColor: null,
            currentGain: 0,
            spareGems: 0,
            checkedForLucky: [],
            hasGameStarted: false,
            isColorSelected: false
        };
        
        this._initGrid();
        this._renderColorOptions();
        this._updateUI();
        
        this.elements.selectedColorBox.style.backgroundColor = '';
        this.elements.selectedColorBox.style.boxShadow = '';
        this.elements.selectedColorName.textContent = '请在上方选择';
        
        localStorage.removeItem('gemMatchGame');
        this.addGameLog('游戏已重置，请重新选择幸运色', 'action');
    },
    
    _saveGame() {
        const saveData = {
            luckyColor: this.state.luckyColor,
            currentGain: this.state.currentGain,
            hasGameStarted: this.state.hasGameStarted,
            isColorSelected: this.state.isColorSelected
        };
        
        try {
            localStorage.setItem('gemMatchGame', JSON.stringify(saveData));
        } catch (e) {
            console.error('保存失败:', e);
        }
    },
    
    _loadGame() {
        try {
            const saved = localStorage.getItem('gemMatchGame');
            if (saved) {
                const saveData = JSON.parse(saved);
                
                this.state.luckyColor = saveData.luckyColor || null;
                this.state.currentGain = saveData.currentGain || 0;
                this.state.hasGameStarted = saveData.hasGameStarted || false;
                this.state.isColorSelected = saveData.isColorSelected || false;
                
                if (this.state.luckyColor) {
                    this._renderColorOptions();
                    this.elements.selectedColorBox.style.backgroundColor = 
                        this.config.colorHex[this.state.luckyColor - 1];
                    this.elements.selectedColorBox.style.boxShadow = 
                        `0 0 10px ${this.config.colorHex[this.state.luckyColor - 1]}`;
                    this.elements.selectedColorName.textContent = 
                        this.config.colors[this.state.luckyColor - 1];
                }
                
                this._updateWishColorDisplay();
                this.addGameLog('已加载游戏进度', 'action');
            }
        } catch (e) {
            console.error('加载失败:', e);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    GemMatchGame.init();
});
