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
 * 宝石对对碰游戏 - 简化重构版
 * 修改内容：
 * 1. 移除备用宝石在状态栏的显示（仅内部逻辑使用）
 * 2. 移除所有盲盒逻辑，实现无限次抽奖
 * 3. 重构碰数计算为"本次抽奖累计碰数"
 * 4. 每次抽奖都重置九宫格状态，确保完整循环
 */

const GemMatchGame = {
    // 游戏配置
    config: {
        gemColors: 10,
        gridSize: 3,
        maxGridCells: 9,
        colors: ['红色', '橙色', '黄色', '绿色', '青色', '蓝色', '紫色', '粉色', '棕色', '白色'],
        colorHex: ['#FF0000', '#FFA500', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#800080', '#FFC0CB', '#8B4513', '#FFFFFF']
    },
    
    // 游戏状态
    state: {
        grid: [],
        luckyColor: null,
        currentGain: 0,            // 本次抽奖累计碰数（状态栏显示）
        spareGems: 0,             // 备用宝石（仅内部计算使用）
        checkedForLucky: [],
        gameRound: 0,
        hasGameStarted: false,
        isColorSelected: false,
        lastDrawGain: 0           // 记录上次抽奖的获得，用于日志
    },
    
    // DOM元素引用
    elements: {},
    
    // 初始化游戏
    init() {
        this.addGameLog('游戏初始化完成', 'action');
        
        // 获取DOM元素（简化了状态栏元素）
        this.elements = {
            gridContainer: document.getElementById('game-grid'),
            wishColorDot: document.getElementById('wish-color-dot'),
            wishColorName: document.getElementById('wish-color-name'),
            touchCount: document.getElementById('touch-count'),      // 显示本次抽奖累计碰数
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
        
        this.addGameLog('请选择幸运色，然后点击抽奖开始游戏！', 'welcome');
    },
    
    // 向游戏日志区添加记录
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
    
    // 显示全局提示文字
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
                
                if (!this.state.hasGameStarted) {
                    cell.classList.add('masked');
                }
                
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
    
    // 生成幸运色选择器
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
        // 单抽按钮 - 移除盲盒数量检查
        this.elements.singleDrawBtn.addEventListener('click', () => {
            if (!this._checkGameStartConditions()) return;
            this._performSingleDraw();
        });
        
        // 十连抽按钮 - 移除盲盒数量检查
        this.elements.tenDrawBtn.addEventListener('click', () => {
            if (!this._checkGameStartConditions()) return;
            this._performTenDraw();
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
        
        if (!this.state.hasGameStarted) {
            this.state.hasGameStarted = true;
            this._fillGridWithRandomGems();
            this.addGameLog('游戏开始！九宫格已填充宝石。', 'action');
            setTimeout(() => this._triggerGemAppearAnimation(), 50);
            this._renderGrid();
        }
        return true;
    },
    
    // 触发宝石出现动画
    _triggerGemAppearAnimation() {
        const allGemImgs = document.querySelectorAll('.grid-cell.filled .gem-img');
        allGemImgs.forEach(img => {
            img.classList.remove('gem-appearing');
            void img.offsetWidth;
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
    
    // ============= 核心修改：执行单抽（重置逻辑）=============
    async _performSingleDraw() {
        // 重置本次抽奖累计碰数
        this.state.currentGain = 0;
        this.state.spareGems = 0; // 重置备用宝石
        this.addGameLog('--- 开始单抽 ---', 'action');
        
        // 重置九宫格状态（每次抽奖都从完整九宫格开始）
        this._resetGridForNewDraw();
        
        // 执行一次完整的游戏循环
        await this._runFullGameCycle();
        
        // 记录上次抽奖获得（用于日志）
        this.state.lastDrawGain = this.state.currentGain;
        this.addGameLog(`单抽完成！本次获得碰数：${this.state.currentGain}`, 'action');
        
        this._saveGame();
    },
    
    // ============= 核心修改：重置九宫格为新抽奖 =============
    _resetGridForNewDraw() {
        // 重置内部状态
        this.state.checkedForLucky = [];
        for (let row = 0; row < this.config.gridSize; row++) {
            this.state.checkedForLucky[row] = [];
            for (let col = 0; col < this.config.gridSize; col++) {
                this.state.checkedForLucky[row][col] = false;
            }
        }
        
        // 确保九宫格是满的
        this._fillGridWithRandomGems();
        this._renderGrid();
        setTimeout(() => this._triggerGemAppearAnimation(), 50);
    },
    
    // ============= 执行十连抽 =============
    _performTenDraw() {
        this.addGameLog('准备十连抽...', 'action');
        
        const previewContainer = this.elements.previewContainer;
        previewContainer.innerHTML = '';
        
        // 生成预览宝石（仅视觉效果）
        for (let i = 0; i < 10; i++) {
            const gemColor = this._getRandomGemColor();
            const gemImg = document.createElement('img');
            gemImg.className = 'preview-gem';
            gemImg.src = `assets/gems/${gemColor}.png`;
            gemImg.alt = `宝石${gemColor}`;
            gemImg.title = this.config.colors[gemColor-1];
            previewContainer.appendChild(gemImg);
        }
        
        this.elements.confirmBatchBtn.disabled = false;
        this.addGameLog('已生成10个宝石预览，点击"确认并开始游戏"开始十连抽', 'action');
    },
    
    // ============= 确认十连抽 =============
    async _confirmBatchDraw() {
        this.addGameLog('开始十连抽游戏...', 'action');
        
        // 重置本次十连累计碰数
        this.state.currentGain = 0;
        let tenDrawTotal = 0;
        
        for (let i = 0; i < 10; i++) {
            this.state.gameRound++;
            this.addGameLog(`--- 十连抽第 ${i + 1} 次 ---`, 'action');
            
            // 重置状态开始新的一次抽奖
            this.state.spareGems = 0;
            this._resetGridForNewDraw();
            
            // 执行完整游戏循环
            await this._runFullGameCycle();
            
            tenDrawTotal += this.state.currentGain;
            this.addGameLog(`第 ${i + 1} 次获得：${this.state.currentGain} 碰数`, 'action');
            
            // 重置当前碰数为0，准备下一次循环（累计在tenDrawTotal中）
            this.state.currentGain = 0;
            
            await this._delay(200); // 每次抽奖间的小延迟
        }
        
        // 更新本次十连总获得
        this.state.currentGain = tenDrawTotal;
        this.state.lastDrawGain = tenDrawTotal;
        
        this.addGameLog('════ 十连抽完成 ════', 'action');
        this.addGameLog(`本次十连抽总获得碰数：${tenDrawTotal}`, 'action');
        
        this.elements.previewContainer.innerHTML = '<p class="hint">点击"十连抽"查看结果</p>';
        this.elements.confirmBatchBtn.disabled = true;
        
        this._saveGame();
    },
    
    // ============= 核心修改：完整游戏循环 =============
    async _runFullGameCycle() {
        let loopCount = 0;
        const MAX_LOOPS = 30; // 安全限制
        
        do {
            loopCount++;
            this.state.spareGems = 0; // 每轮开始重置备用宝石
            
            // 步骤1: 判断幸运色
            const luckyGain = await this._step1_checkLuckyColor();
            if (luckyGain > 0) {
                this.state.currentGain += luckyGain; // 累计到本次抽奖
            }
            await this._delay(200);
            
            // 步骤2-4: 消除循环
            let eliminationOccurred = false;
            
            // 全家福
            const fullHouseGain = await this._step2_checkFullHouse();
            if (fullHouseGain > 0) {
                this.state.currentGain += fullHouseGain;
                eliminationOccurred = true;
                await this._delay(500);
            }
            
            // 三连
            if (!eliminationOccurred) {
                const threeGain = await this._step3_checkThreeInARow();
                if (threeGain > 0) {
                    this.state.currentGain += threeGain;
                    eliminationOccurred = true;
                    await this._delay(400);
                }
            }
            
            // 对子
            if (!eliminationOccurred) {
                const pairGain = await this._step4_checkPairs();
                if (pairGain > 0) {
                    this.state.currentGain += pairGain;
                    eliminationOccurred = true;
                    await this._delay(400);
                }
            }
            
            // 步骤5: 补充宝石
            if (eliminationOccurred && this._hasEmptyCells()) {
                await this._step5_supplementGems();
                await this._delay(500);
            }
            
            // 更新UI显示当前累计碰数
            this._updateUI();
            
        } while (this._shouldContinueLoop(loopCount, MAX_LOOPS));
        
        if (loopCount >= MAX_LOOPS) {
            this.addGameLog('安全限制：达到最大循环次数', 'error');
        }
    },
    
    // 判断是否应该继续循环
    _shouldContinueLoop(loopCount, maxLoops) {
        if (loopCount >= maxLoops) return false;
        
        // 如果有备用宝石且棋盘有空位，继续循环
        if (this.state.spareGems > 0 && this._hasEmptyCells()) return true;
        
        // 检查是否还有可消除的宝石
        return this._hasPotentialMatches();
    },
    
    // 检查是否有潜在的可消除组合
    _hasPotentialMatches() {
        // 简化检查：如果棋盘不满，就不检查
        if (this._hasEmptyCells()) return false;
        
        // 检查三连
        for (let row = 0; row < this.config.gridSize; row++) {
            if (this.state.grid[row][0] > 0 && 
                this.state.grid[row][0] === this.state.grid[row][1] && 
                this.state.grid[row][1] === this.state.grid[row][2]) {
                return true;
            }
        }
        // 检查列和对角线...
        // 为简化，这里只检查行，实际可以添加更多检查
        
        return false;
    },
    
    // 检查九宫格中是否有空单元格
    _hasEmptyCells() {
        for (let row = 0; row < this.config.gridSize; row++) {
            for (let col = 0; col < this.config.gridSize; col++) {
                if (this.state.grid[row][col] === 0) return true;
            }
        }
        return false;
    },
    
    // ============= 修改后的各个步骤（返回获得数值）=============
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
            this.state.spareGems += luckyCount;
            this.addGameLog(`发现 ${luckyCount} 个幸运色宝石，备用宝石 +${luckyCount}`, 'lucky');
            return luckyCount; // 返回获得的碰数
        }
        return 0;
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
            this.showGlobalNotification('🎉 全家福！ +10碰数', 'fullhouse');
            
            this.state.spareGems += 10;
            
            await this._removeGemsWithAnimation(gemPositions);
            return 10; // 全家福固定+10碰数
        }
        return 0;
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
            this.state.spareGems += totalBonus;
            
            const gemsToRemove = Array.from(positionsToRemove).map(posStr => {
                const [row, col] = posStr.split(',').map(Number);
                return {row, col};
            });
            
            await this._removeGemsWithAnimation(gemsToRemove);
            
            this.addGameLog(`🎯 发现 ${matches.length} 个三连消除`, 'three');
            this.showGlobalNotification(`🎯 ${matches.length}个三连！ +${totalBonus}碰数`, 'three');
            return totalBonus;
        }
        return 0;
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
            this.state.spareGems += pairCount;
            
            await this._removeGemsWithAnimation(positionsToRemove);
            
            this.addGameLog(`✨ 发现 ${pairCount} 个对子消除`, 'pair');
            this.showGlobalNotification(`✨ ${pairCount}个对子！ +${pairCount}碰数`, 'pair');
            return pairCount;
        }
        return 0;
    },
    
    async _step5_supplementGems() {
        if (!this._hasEmptyCells()) return 0;
        
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
            this._renderGrid();
            setTimeout(() => this._triggerGemAppearAnimation(), 50);
        }
        
        return gemsSupplemented;
    },
    
    // 播放宝石消除动画
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
    
    _resetGame() {
        this.addGameLog('正在重置游戏...', 'action');
        
        this.state = {
            grid: [],
            luckyColor: null,
            currentGain: 0,
            spareGems: 0,
            checkedForLucky: [],
            gameRound: 0,
            hasGameStarted: false,
            isColorSelected: false,
            lastDrawGain: 0
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
        // 只显示幸运色和本次抽奖累计碰数
        if (this.elements.touchCount) {
            this.elements.touchCount.textContent = this.state.currentGain;
        }
        
        // 按钮状态：如果未选择幸运色，禁用抽奖按钮
        const isActionDisabled = !this.state.isColorSelected;
        this.elements.singleDrawBtn.disabled = isActionDisabled;
        this.elements.tenDrawBtn.disabled = isActionDisabled;
        
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
            currentGain: this.state.currentGain,
            spareGems: this.state.spareGems,
            checkedForLucky: this.state.checkedForLucky,
            gameRound: this.state.gameRound,
            hasGameStarted: this.state.hasGameStarted,
            isColorSelected: this.state.isColorSelected,
            lastDrawGain: this.state.lastDrawGain
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
                this.state.currentGain = saveData.currentGain || 0;
                this.state.spareGems = saveData.spareGems || 0;
                this.state.checkedForLucky = saveData.checkedForLucky || [];
                this.state.gameRound = saveData.gameRound || 0;
                this.state.hasGameStarted = saveData.hasGameStarted || false;
                this.state.isColorSelected = saveData.isColorSelected || false;
                this.state.lastDrawGain = saveData.lastDrawGain || 0;
                
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

document.addEventListener('DOMContentLoaded', () => {
    GemMatchGame.init();
});
