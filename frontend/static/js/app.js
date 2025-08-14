class AppHub {
    constructor() {
        this.currentUser = null;
        this.apps = [];
        this.currentFilter = 'all';
        this.searchQuery = '';
        this.currentTheme = 'light';
        this.selectedApps = new Set();
        this.batchMode = false;
        this.selectedTags = new Set();
        this.availableTags = [];
        this.currentAppTags = [];
        this.currentEditingAppId = null;
        
        this.initTheme();
        this.init();
    }
    
    async init() {
        await this.initUser();
        await this.loadApps();
        await this.loadTags();
        this.bindEvents();
        this.updateStats();
        this.renderTagsFilter();
    }
    
    initTheme() {
        // 检查本地存储的主题偏好
        const savedTheme = localStorage.getItem('apphub_theme');
        
        // 检查系统主题偏好
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        // 设置初始主题
        if (savedTheme) {
            this.currentTheme = savedTheme;
        } else if (prefersDark) {
            this.currentTheme = 'dark';
        } else {
            this.currentTheme = 'light';
        }
        
        this.applyTheme();
        
        // 监听系统主题变化
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem('apphub_theme')) {
                this.currentTheme = e.matches ? 'dark' : 'light';
                this.applyTheme();
            }
        });
    }
    
    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.currentTheme);
        
        // 保存主题偏好
        localStorage.setItem('apphub_theme', this.currentTheme);
        
        // 更新切换按钮状态
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.setAttribute('data-theme', this.currentTheme);
        }
    }
    
    createThemeCurtain(previousTheme) {
        const curtain = document.createElement('div');
        curtain.className = 'theme-curtain';
        
        const leftPanel = document.createElement('div');
        leftPanel.className = 'panel left';
        const rightPanel = document.createElement('div');
        rightPanel.className = 'panel right';
        
        const curtainColor = previousTheme === 'dark' ? '#1f2937' : '#ffffff';
        leftPanel.style.background = curtainColor;
        rightPanel.style.background = curtainColor;
        
        curtain.appendChild(leftPanel);
        curtain.appendChild(rightPanel);
        document.body.appendChild(curtain);
        
        return curtain;
    }
    
    toggleTheme() {
        const previousTheme = this.currentTheme;
        const nextTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        
        const curtain = this.createThemeCurtain(previousTheme);
        
        if (nextTheme === 'light') {
            // 浅色模式：窗帘打开
            this.currentTheme = nextTheme;
            this.applyTheme();
            
            requestAnimationFrame(() => {
                curtain.classList.add('open');
                setTimeout(() => {
                    curtain.remove();
                }, 700);
            });
        } else {
            // 深色模式：窗帘关闭
            // 先将面板定位到屏幕外，随后合拢覆盖旧主题
            curtain.classList.add('open');
            
            requestAnimationFrame(() => {
                curtain.classList.remove('open');
                setTimeout(() => {
                    // 合拢完成后再切换主题，并淡出窗帘
                    this.currentTheme = nextTheme;
                    this.applyTheme();
                    curtain.classList.add('fade-out');
                    setTimeout(() => {
                        curtain.remove();
                    }, 200);
                }, 700);
            });
        }
        
        this.showToast(
            nextTheme === 'dark' ? '已切换到深色模式 🌙' : '已切换到浅色模式 ☀️',
            'success'
        );
    }
    
    async initUser() {
        try {
            // 尝试使用现有的指纹
            let userId = BrowserFingerprint.getUserId();
            
            if (!userId) {
                // 生成新的指纹并注册用户
                const result = await BrowserFingerprint.register();
                this.currentUser = result;
                this.showToast(result.is_new_user ? '欢迎新用户！' : '欢迎回来！', 'success');
            } else {
                this.currentUser = { user_id: userId };
                this.showToast('欢迎回来！', 'success');
            }
            
            // 更新用户界面
            this.updateUserInfo();
            
        } catch (error) {
            console.error('用户初始化失败:', error);
            this.showToast('用户识别失败，部分功能受限', 'warning');
        }
    }
    
    updateUserInfo() {
        const userIdElement = document.querySelector('.user-id');
        if (this.currentUser && this.currentUser.user_id) {
            const shortId = this.currentUser.user_id.substring(0, 8);
            userIdElement.textContent = `用户 ${shortId}`;
        } else {
            userIdElement.textContent = '访客模式';
        }
    }
    
    async loadApps() {
        try {
            this.showLoading(true);
            
            const response = await fetch('/api/apps', {
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.apps = data.apps;
                this.renderApps();
            } else {
                throw new Error(data.error);
            }
            
        } catch (error) {
            console.error('加载应用失败:', error);
            this.showToast('加载应用失败', 'error');
        } finally {
            this.showLoading(false);
        }
    }
    
    renderApps() {
        const grid = document.getElementById('appsGrid');
        const addAppCard = document.getElementById('addAppCard');
        const emptyState = document.getElementById('emptyState');
        
        // 清除现有应用卡片（保留添加按钮）
        const existingCards = grid.querySelectorAll('.app-card:not(.add-app-card)');
        existingCards.forEach(card => card.remove());
        
        // 过滤应用
        let filteredApps = this.apps;
        
        // 按类型过滤
        if (this.currentFilter === 'my') {
            filteredApps = filteredApps.filter(app => 
                this.currentUser && app.creator_id === this.currentUser.user_id
            );
        } else if (this.currentFilter === 'public') {
            filteredApps = filteredApps.filter(app => app.is_public);
        }
        
        // 搜索过滤
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            filteredApps = filteredApps.filter(app => 
                app.name.toLowerCase().includes(query) ||
                app.url.toLowerCase().includes(query) ||
                (app.description && app.description.toLowerCase().includes(query))
            );
        }
        
        // 标签过滤
        filteredApps = this.filterAppsByTags(filteredApps);
        
        if (filteredApps.length === 0) {
            emptyState.style.display = 'flex';
            addAppCard.style.display = 'block';
        } else {
            emptyState.style.display = 'none';
            addAppCard.style.display = 'block';
            
            // 渲染应用卡片
            filteredApps.forEach(app => {
                const card = this.createAppCard(app);
                grid.appendChild(card);
            });
        }
    }
    
    highlightText(text, query) {
        if (!query) return text;
        
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<mark class="search-highlight">$1</mark>');
    }
    
    createAppCard(app) {
        const card = document.createElement('div');
        card.className = 'app-card';
        card.setAttribute('data-app-id', app.id);
        
        const isOwner = this.currentUser && app.creator_id === this.currentUser.user_id;
        
        // 获取域名作为默认图标
        let domain = '';
        try {
            domain = new URL(app.url).hostname;
        } catch (e) {
            domain = app.name.charAt(0).toUpperCase();
        }
        
        // 支持图标库：当 icon_url 以 'fa:' 开头时使用 Font Awesome；未提供时尝试根据域名猜测
        let iconHtml = '';
        const iconValue = (app.icon_url || '').trim();
        if (iconValue.startsWith('fa:')) {
            const faClass = iconValue.substring(3).trim();
            iconHtml = `<i class="${faClass}"></i>`;
        } else if (!iconValue) {
            const guessed = this.guessIconClassFromDomain(domain);
            if (guessed) {
                iconHtml = `<i class="${guessed}"></i>`;
            }
        }
        
        // 高亮搜索结果
        const highlightedName = this.highlightText(app.name, this.searchQuery);
        const highlightedDescription = app.description ? this.highlightText(app.description, this.searchQuery) : '';
        
        card.innerHTML = `
            ${isOwner && this.batchMode ? `
            <div class=\"app-checkbox\">
                <input type=\"checkbox\" class=\"app-select\" data-app-id=\"${app.id}\">
                <div class=\"checkbox-overlay\"></div>
            </div>
            ` : ''}
            
            
            <div class=\"app-header\">
                <div class=\"app-icon\">
                    ${app.icon_url ? 
                        `<img src=\"${app.icon_url}\" alt=\"${app.name}\" onerror=\"this.style.display='none'; this.nextElementSibling.style.display='flex'\">
                         <div style=\"display:none; width:100%; height:100%; align-items:center; justify-content:center; background:var(--bg-secondary); border-radius:var(--border-radius); color:var(--primary-color); font-weight:bold; font-size:20px;\">${domain.charAt(0).toUpperCase()}</div>` :
                        `<div style=\"background:var(--bg-secondary); color:var(--primary-color); font-weight:bold; font-size:20px;\">${domain.charAt(0).toUpperCase()}</div>`
                    }
                    ${app.is_healthy === false ? `
                    <div class=\"health-indicator offline\">
                        <i class=\"fas fa-exclamation-triangle\"></i>
                    </div>
                    ` : app.is_healthy === true ? `
                    <div class=\"health-indicator online\">
                        <i class=\"fas fa-check-circle\"></i>
                    </div>
                    ` : ''}
                </div>
                <div class=\"app-info\">
                    <h3>${highlightedName}</h3>
                    <a href=\"${app.url}\" target=\"_blank\" class=\"app-url\" onclick=\"event.stopPropagation()\">${domain}</a>
                </div>
            </div>
            
            ${highlightedDescription ? `<div class=\"app-description\">${highlightedDescription}</div>` : ''}
            
            ${this.renderAppTags(app.tags)}
            
            <div class=\"app-stats\">
                <div class=\"stats-row\">
                    <div class=\"stat-item\">
                        <i class=\"fas fa-mouse-pointer\"></i>
                        <span>${this.formatClickCount(app.click_count || 0)} 次访问</span>
                    </div>
                    <div class=\"stat-item\">
                        <i class=\"fas fa-clock\"></i>
                        <span>${this.getRelativeTime(app.last_accessed)}</span>
                    </div>
                </div>
            </div>
            
            <div class=\"app-meta\">
                <div class=\"visibility-indicator ${app.is_public ? 'public' : 'private'}\">
                    <i class=\"fas ${app.is_public ? 'fa-globe' : 'fa-lock'}\"></i>
                    <span>${app.is_public ? '公开' : '私有'}</span>
                </div>
                
                ${isOwner ? `
                <div class=\"app-actions\">
                    <button class=\"action-btn health\" onclick=\"appHub.checkHealth('${app.id}')\" title=\"健康检查\">
                        <i class=\"fas fa-heartbeat\"></i>
                    </button>
                    <button class=\"action-btn edit\" onclick=\"appHub.editApp('${app.id}')\" title=\"编辑应用\">
                        <i class=\"fas fa-edit\"></i>
                    </button>
                    <button class=\"action-btn delete\" onclick=\"appHub.deleteApp('${app.id}')\" title=\"删除应用\">
                        <i class=\"fas fa-trash\"></i>
                    </button>
                </div>
                ` : ''}
            </div>
        `;
        
        // 如果存在图标库图标，插入并隐藏原始图标占位
        if (iconHtml) {
            const iconContainer = card.querySelector('.app-icon');
            if (iconContainer) {
                // 隐藏第一个非健康指示器的元素（原始图标/占位）
                const firstNonHealth = Array.from(iconContainer.children).find(el => !el.classList.contains('health-indicator'));
                if (firstNonHealth) {
                    firstNonHealth.style.display = 'none';
                }
                // 插入字体图标
                iconContainer.insertAdjacentHTML('afterbegin', iconHtml);
            }
        }
        
        // 设置选中状态
        if (this.selectedApps.has(app.id)) {
            card.classList.add('selected');
            const checkbox = card.querySelector('.app-select');
            if (checkbox) checkbox.checked = true;
        }
        
        // 复选框事件
        const checkbox = card.querySelector('.app-select');
        if (checkbox) {
            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                this.toggleAppSelection(app.id);
            });
        }
        
        // 点击卡片事件
        card.addEventListener('click', (e) => {
            if (e.target.closest('.app-actions') || e.target.closest('.app-url') || e.target.closest('.app-checkbox')) {
                return;
            }
            
            if (this.batchMode && isOwner) {
                // 批量模式下切换选择状态
                this.toggleAppSelection(app.id);
                return;
            }
            
            // 记录应用访问
            this.recordAppAccess(app.id);
            
            // 打开应用
            window.open(app.url, '_blank');
        });
        
        return card;
    }
    
    guessIconClassFromDomain(domain) {
        if (!domain) return '';
        const d = String(domain).toLowerCase();
        const candidates = [
            { key: 'github', cls: 'fa-brands fa-github' },
            { key: 'gitlab', cls: 'fa-brands fa-gitlab' },
            { key: 'google', cls: 'fa-brands fa-google' },
            { key: 'youtube', cls: 'fa-brands fa-youtube' },
            { key: 'twitter', cls: 'fa-brands fa-x-twitter' },
            { key: 'x.com', cls: 'fa-brands fa-x-twitter' },
            { key: 'facebook', cls: 'fa-brands fa-facebook' },
            { key: 'microsoft', cls: 'fa-brands fa-microsoft' },
            { key: 'apple', cls: 'fa-brands fa-apple' },
            { key: 'slack', cls: 'fa-brands fa-slack' },
            { key: 'discord', cls: 'fa-brands fa-discord' },
            { key: 'stackoverflow', cls: 'fa-brands fa-stack-overflow' },
            { key: 'stackexchange', cls: 'fa-brands fa-stack-exchange' },
            { key: 'linkedin', cls: 'fa-brands fa-linkedin' },
            { key: 'wechat', cls: 'fa-brands fa-weixin' },
            { key: 'weixin', cls: 'fa-brands fa-weixin' },
            { key: 'qq.com', cls: 'fa-brands fa-qq' },
            { key: 'reddit', cls: 'fa-brands fa-reddit' },
            { key: 'telegram', cls: 'fa-brands fa-telegram' },
            { key: 'whatsapp', cls: 'fa-brands fa-whatsapp' },
            { key: 'tiktok', cls: 'fa-brands fa-tiktok' },
            { key: 'npmjs', cls: 'fa-brands fa-npm' },
            { key: 'docker', cls: 'fa-brands fa-docker' },
            { key: 'aws', cls: 'fa-brands fa-aws' },
            { key: 'cloudflare', cls: 'fa-brands fa-cloudflare' },
            { key: 'figma', cls: 'fa-brands fa-figma' },
        ];
        for (const item of candidates) {
            if (d.includes(item.key)) return item.cls;
        }
        return '';
    }
    
    bindEvents() {
        // 导航按钮事件
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const target = link.getAttribute('href').substring(1);
                this.navigateTo(target);
                
                // 更新导航状态
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            });
        });
        
        // 添加应用按钮
        document.getElementById('addAppCard').addEventListener('click', () => {
            this.showCreateAppModal();
        });

        // 标签筛选弹出层开关
        const tagFilterToggle = document.getElementById('tagFilterToggle');
        const tagsPopover = document.getElementById('tagsPopover');
        if (tagFilterToggle && tagsPopover) {
            tagFilterToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const isShown = tagsPopover.getAttribute('data-open') === 'true';
                if (isShown) {
                    tagsPopover.style.display = 'none';
                    tagsPopover.setAttribute('data-open', 'false');
                } else {
                    // 定位到按钮下方
                    const btnRect = tagFilterToggle.getBoundingClientRect();
                    tagsPopover.style.display = 'block';
                    tagsPopover.style.position = 'absolute';
                    tagsPopover.style.top = `${tagFilterToggle.offsetTop + tagFilterToggle.offsetHeight + 8}px`;
                    tagsPopover.style.right = '0px';
                    tagsPopover.setAttribute('data-open', 'true');
                    this.renderTagsFilter();
                }
            });
            // 点击外部关闭
            document.addEventListener('click', (e) => {
                if (!tagsPopover.contains(e.target) && !tagFilterToggle.contains(e.target)) {
                    tagsPopover.style.display = 'none';
                    tagsPopover.setAttribute('data-open', 'false');
                }
            });
        }
        
        // 模态框关闭按钮
        document.getElementById('closeModal').addEventListener('click', () => {
            this.hideCreateAppModal();
        });
        
        document.getElementById('closeDetailModal').addEventListener('click', () => {
            this.hideAppDetailModal();
        });
        
        // 编辑应用模态框
        document.getElementById('closeEditModal').addEventListener('click', () => {
            this.hideEditAppModal();
        });
        
        document.getElementById('cancelEditBtn').addEventListener('click', () => {
            this.hideEditAppModal();
        });
        
        document.getElementById('editAppForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateApp();
        });
        
        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.hideCreateAppModal();
        });
        
        // 创建应用表单
        document.getElementById('createAppForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createApp();
        });
        
        // 过滤按钮（仅限带 data-filter 的按钮）
        document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn[data-filter]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentFilter = btn.getAttribute('data-filter');
                this.renderApps();
                this.updateStats();
            });
        });
        
        // 搜索功能事件
        const searchInput = document.getElementById('searchInput');
        const searchClear = document.getElementById('searchClear');
        
        searchInput.addEventListener('input', (e) => {
            this.searchQuery = e.target.value.trim();
            this.renderApps();
            
            // 显示/隐藏清除按钮
            if (this.searchQuery) {
                searchClear.style.display = 'block';
            } else {
                searchClear.style.display = 'none';
            }
        });
        
        searchClear.addEventListener('click', () => {
            searchInput.value = '';
            this.searchQuery = '';
            this.renderApps();
            searchClear.style.display = 'none';
            searchInput.focus();
        });
        
        // 全局快捷键
        document.addEventListener('keydown', (e) => {
            // 忽略在输入框中的按键
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                // 只处理特殊快捷键
                if (e.key === 'Escape') {
                    e.target.blur();
                    if (e.target.id === 'searchInput') {
                        this.clearSearch();
                    }
                }
                return;
            }
            
            // Ctrl/Cmd + F: 搜索
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                searchInput.focus();
                searchInput.select();
                return;
            }
            
            // Ctrl/Cmd + N: 新建应用
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                this.showCreateAppModal();
                return;
            }
            
            // Ctrl/Cmd + A: 全选应用
            if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
                e.preventDefault();
                this.toggleSelectAll();
                return;
            }
            
            // B键: 切换批量模式
            if (e.key === 'b' || e.key === 'B') {
                this.toggleBatchMode();
                return;
            }
            
            // Ctrl/Cmd + D: 切换深色模式
            if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                e.preventDefault();
                this.toggleTheme();
                return;
            }
            
            // Escape: 关闭模态框或清除搜索
            if (e.key === 'Escape') {
                if (document.getElementById('createAppModal').classList.contains('show')) {
                    this.hideCreateAppModal();
                } else if (this.searchQuery) {
                    this.clearSearch();
                } else {
                    this.showToast('按 Ctrl/Cmd + ? 查看所有快捷键', 'info');
                }
                return;
            }
            
            // 数字键1-9: 快速打开应用
            if (e.key >= '1' && e.key <= '9' && !e.ctrlKey && !e.metaKey && !e.altKey) {
                const index = parseInt(e.key) - 1;
                this.quickLaunchApp(index);
                return;
            }
            
            // ? 键: 显示快捷键帮助
            if (e.key === '?' && !e.shiftKey) {
                this.showKeyboardShortcuts();
                return;
            }
            
            // H键: 回到首页
            if (e.key === 'h' || e.key === 'H') {
                this.navigateTo('home');
                document.querySelector('.nav-link[href="#home"]').classList.add('active');
                document.querySelectorAll('.nav-link:not([href="#home"])').forEach(l => l.classList.remove('active'));
                return;
            }
            
            // M键: 我的应用
            if (e.key === 'm' || e.key === 'M') {
                this.navigateTo('my-apps');
                document.querySelector('.nav-link[href="#my-apps"]').classList.add('active');
                document.querySelectorAll('.nav-link:not([href="#my-apps"])').forEach(l => l.classList.remove('active'));
                return;
            }
        });
        
        // 主题切换按钮
        const themeToggle = document.getElementById('themeToggle');
        themeToggle.addEventListener('click', () => {
            this.toggleTheme();
        });
        
        // 批量操作事件
        document.getElementById('batchHealthBtn').addEventListener('click', () => {
            this.batchHealthCheck();
        });
        
        document.getElementById('batchDeleteBtn').addEventListener('click', () => {
            this.batchDeleteApps();
        });
        
        document.getElementById('clearSelection').addEventListener('click', () => {
            this.clearSelection();
        });
        
        // 模态框背景点击关闭
        document.getElementById('createAppModal').addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.hideCreateAppModal();
            }
        });
        
        document.getElementById('appDetailModal').addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.hideAppDetailModal();
            }
        });
    }
    
    showCreateAppModal() {
        if (!this.currentUser || !this.currentUser.user_id) {
            this.showToast('请先完成身份验证', 'warning');
            return;
        }
        
        // 清空表单
        document.getElementById('createAppForm').reset();
        document.getElementById('appPublic').checked = true;
        
        // 初始化标签
        this.currentAppTags = [];
        this.renderTagsDisplay();
        this.initTagsInput();
        
        document.getElementById('createAppModal').classList.add('show');
    }
    
    hideCreateAppModal() {
        document.getElementById('createAppModal').classList.remove('show');
    }
    
    hideAppDetailModal() {
        document.getElementById('appDetailModal').classList.remove('show');
    }
    
    async createApp() {
        try {
            const form = document.getElementById('createAppForm');
            const formData = new FormData(form);
            // 吸收未按回车确认的剩余标签
            const pendingTagsInput = document.getElementById('appTags');
            if (pendingTagsInput) {
                const raw = pendingTagsInput.value.trim();
                if (raw) {
                    raw.split(/[\s,]+/).forEach(tag => {
                        const t = tag.trim();
                        if (t && !this.currentAppTags.includes(t)) {
                            this.addTag(t);
                        }
                    });
                    // 同步展示
                    this.renderTagsDisplay();
                }
            }
            
            const appData = {
                name: formData.get('name'),
                url: formData.get('url'),
                icon_url: formData.get('icon_url'),
                description: formData.get('description'),
                is_public: formData.get('is_public') === 'on',
                tags: this.currentAppTags
            };
            
            // 验证URL格式
            try {
                new URL(appData.url);
            } catch (e) {
                this.showToast('请输入有效的网站地址', 'error');
                return;
            }
            
            const response = await fetch('/api/apps', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(appData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.hideCreateAppModal();
                this.showToast('应用创建成功！', 'success');
                await this.loadApps();
                await this.loadTags();
                this.renderTagsFilter();
            } else {
                throw new Error(data.error);
            }
            
        } catch (error) {
            console.error('创建应用失败:', error);
            this.showToast('创建应用失败: ' + error.message, 'error');
        }
    }
    
    async deleteApp(appId) {
        if (!confirm('确定要删除这个应用吗？')) {
            return;
        }
        
        try {
            const response = await fetch(`/api/apps/${appId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showToast('应用已删除', 'success');
                await this.loadApps();
            } else {
                throw new Error(data.error);
            }
            
        } catch (error) {
            console.error('删除应用失败:', error);
            this.showToast('删除应用失败: ' + error.message, 'error');
        }
    }
    
    async editApp(appId) {
        // TODO: 实现编辑功能
        this.showToast('编辑功能即将推出', 'warning');
    }
    
    updateStats() {
        const totalApps = this.apps.length;
        const myApps = this.currentUser ? 
            this.apps.filter(app => app.creator_id === this.currentUser.user_id).length : 0;
        const publicApps = this.apps.filter(app => 
            app.is_public && (!this.currentUser || app.creator_id !== this.currentUser.user_id)
        ).length;
        
        document.getElementById('totalApps').textContent = totalApps;
        document.getElementById('myApps').textContent = myApps;
        document.getElementById('publicApps').textContent = publicApps;
        
        // 动画效果
        this.animateNumber('totalApps', totalApps);
        this.animateNumber('myApps', myApps);
        this.animateNumber('publicApps', publicApps);
    }
    
    animateNumber(elementId, targetValue) {
        const element = document.getElementById(elementId);
        const startValue = parseInt(element.textContent) || 0;
        const duration = 600;
        const startTime = Date.now();
        
        const update = () => {
            const now = Date.now();
            const progress = Math.min((now - startTime) / duration, 1);
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const currentValue = Math.round(startValue + (targetValue - startValue) * easeOut);
            
            element.textContent = currentValue;
            
            if (progress < 1) {
                requestAnimationFrame(update);
            }
        };
        
        update();
    }
    
    showLoading(show) {
        const spinner = document.getElementById('loadingSpinner');
        const grid = document.getElementById('appsGrid');
        
        if (show) {
            spinner.style.display = 'flex';
            grid.style.display = 'none';
        } else {
            spinner.style.display = 'none';
            grid.style.display = 'grid';
        }
    }
    
    navigateTo(section) {
        // 隐藏所有sections
        document.querySelectorAll('.page-section').forEach(s => {
            s.style.display = 'none';
        });
        
        // 显示目标section
        const targetSection = document.getElementById(section);
        if (targetSection) {
            targetSection.style.display = 'block';
        }
        
        // 特殊处理
        if (section === 'create') {
            this.showCreateAppModal();
        } else if (section === 'my-apps') {
            this.currentFilter = 'my';
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.remove('active');
                if (btn.getAttribute('data-filter') === 'my') {
                    btn.classList.add('active');
                }
            });
            this.renderApps();
        } else if (section === 'home') {
            this.currentFilter = 'all';
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.remove('active');
                if (btn.getAttribute('data-filter') === 'all') {
                    btn.classList.add('active');
                }
            });
            this.renderApps();
        }
    }
    
    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const icon = toast.querySelector('.toast-icon');
        const messageElement = toast.querySelector('.toast-message');
        
        // 设置图标
        let iconClass = 'fas fa-check-circle';
        if (type === 'error') iconClass = 'fas fa-exclamation-circle';
        if (type === 'warning') iconClass = 'fas fa-exclamation-triangle';
        
        icon.className = `toast-icon ${iconClass}`;
        messageElement.textContent = message;
        
        // 设置样式
        toast.className = `toast ${type} show`;
        
        // 3秒后自动隐藏
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
    
    clearSearch() {
        const searchInput = document.getElementById('searchInput');
        const searchClear = document.getElementById('searchClear');
        
        searchInput.value = '';
        this.searchQuery = '';
        this.renderApps();
        searchClear.style.display = 'none';
        
        this.showToast('搜索已清除', 'success');
    }
    
    quickLaunchApp(index) {
        // 获取当前显示的应用（排除添加按钮）
        const visibleApps = document.querySelectorAll('.app-card:not(.add-app-card)');
        
        if (index < visibleApps.length) {
            const appCard = visibleApps[index];
            const appName = appCard.querySelector('h3').textContent;
            
            // 触发点击事件
            appCard.click();
            
            this.showToast(`快速启动: ${appName} 🚀`, 'success');
        } else {
            this.showToast(`应用 ${index + 1} 不存在`, 'warning');
        }
    }
    
    showKeyboardShortcuts() {
        const shortcuts = `
            <div class="shortcuts-help">
                <h3>⌨️ 键盘快捷键</h3>
                <div class="shortcuts-grid">
                    <div class="shortcut-group">
                        <h4>🔍 搜索相关</h4>
                        <div class="shortcut-item">
                            <span class="shortcut-keys">Ctrl/Cmd + F</span>
                            <span class="shortcut-desc">搜索应用</span>
                        </div>
                        <div class="shortcut-item">
                            <span class="shortcut-keys">Escape</span>
                            <span class="shortcut-desc">清除搜索</span>
                        </div>
                    </div>
                    
                    <div class="shortcut-group">
                        <h4>🚀 快速操作</h4>
                        <div class="shortcut-item">
                            <span class="shortcut-keys">1-9</span>
                            <span class="shortcut-desc">快速启动应用</span>
                        </div>
                        <div class="shortcut-item">
                            <span class="shortcut-keys">Ctrl/Cmd + N</span>
                            <span class="shortcut-desc">创建新应用</span>
                        </div>
                    </div>
                    
                    <div class="shortcut-group">
                        <h4>🎨 界面控制</h4>
                        <div class="shortcut-item">
                            <span class="shortcut-keys">Ctrl/Cmd + D</span>
                            <span class="shortcut-desc">切换深色模式</span>
                        </div>
                        <div class="shortcut-item">
                            <span class="shortcut-keys">H</span>
                            <span class="shortcut-desc">回到首页</span>
                        </div>
                        <div class="shortcut-item">
                            <span class="shortcut-keys">M</span>
                            <span class="shortcut-desc">我的应用</span>
                        </div>
                    </div>
                    
                    <div class="shortcut-group">
                        <h4>❓ 帮助</h4>
                        <div class="shortcut-item">
                            <span class="shortcut-keys">?</span>
                            <span class="shortcut-desc">显示快捷键帮助</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // 创建临时的帮助模态框
        const helpModal = document.createElement('div');
        helpModal.className = 'modal help-modal show';
        helpModal.innerHTML = `
            <div class="modal-content help-content">
                <div class="modal-header">
                    <h3>键盘快捷键</h3>
                    <button class="modal-close help-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                ${shortcuts}
            </div>
        `;
        
        document.body.appendChild(helpModal);
        
        // 关闭帮助的事件监听
        const closeHelp = () => {
            helpModal.remove();
        };
        
        helpModal.querySelector('.help-close').addEventListener('click', closeHelp);
        helpModal.addEventListener('click', (e) => {
            if (e.target.classList.contains('help-modal')) {
                closeHelp();
            }
        });
        
        // ESC键关闭帮助
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                closeHelp();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }
    
    async recordAppAccess(appId) {
        try {
            await fetch(`/api/apps/${appId}/access`, {
                method: 'POST',
                credentials: 'include'
            });
        } catch (error) {
            console.error('记录应用访问失败:', error);
        }
    }
    
    formatClickCount(count) {
        if (count >= 1000) {
            return (count / 1000).toFixed(1) + 'k';
        }
        return count.toString();
    }
    
    getRelativeTime(dateString) {
        if (!dateString) return '从未访问';
        
        const now = new Date();
        const date = new Date(dateString);
        const diff = now - date;
        
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) return '刚刚';
        if (minutes < 60) return `${minutes}分钟前`;
        if (hours < 24) return `${hours}小时前`;
        if (days < 30) return `${days}天前`;
        return '很久以前';
    }
    
    
    async checkHealth(appId) {
        try {
            const response = await fetch(`/api/apps/${appId}/health`, {
                method: 'POST',
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (data.success) {
                const status = data.is_healthy ? '健康 ✅' : '离线 ❌';
                this.showToast(`应用状态: ${status}`, data.is_healthy ? 'success' : 'warning');
                this.loadApps(); // 刷新应用列表以显示健康状态
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('健康检查失败:', error);
            this.showToast('健康检查失败: ' + error.message, 'error');
        }
    }
    
    async batchHealthCheck() {
        try {
            this.showToast('正在进行批量健康检查...', 'info');
            
            const response = await fetch('/api/apps/batch/health', {
                method: 'POST',
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (data.success) {
                const results = data.results;
                const healthy = results.filter(r => r.is_healthy).length;
                const total = results.length;
                
                this.showToast(`批量检查完成: ${healthy}/${total} 应用健康`, 'success');
                this.loadApps();
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('批量健康检查失败:', error);
            this.showToast('批量健康检查失败: ' + error.message, 'error');
        }
    }
    
    toggleBatchMode() {
        this.batchMode = !this.batchMode;
        
        if (!this.batchMode) {
            this.clearSelection();
        }
        
        this.renderApps();
        this.updateBatchToolbar();
        
        this.showToast(
            this.batchMode ? '批量模式已开启 📦' : '批量模式已关闭',
            this.batchMode ? 'info' : 'success'
        );
    }
    
    toggleAppSelection(appId) {
        if (this.selectedApps.has(appId)) {
            this.selectedApps.delete(appId);
        } else {
            this.selectedApps.add(appId);
        }
        
        this.updateAppSelection(appId);
        this.updateBatchToolbar();
    }
    
    updateAppSelection(appId) {
        const card = document.querySelector(`[data-app-id="${appId}"]`);
        if (!card) return;
        
        const checkbox = card.querySelector('.app-select');
        const isSelected = this.selectedApps.has(appId);
        
        if (isSelected) {
            card.classList.add('selected');
            if (checkbox) checkbox.checked = true;
        } else {
            card.classList.remove('selected');
            if (checkbox) checkbox.checked = false;
        }
    }
    
    updateBatchToolbar() {
        const toolbar = document.getElementById('batchToolbar');
        const countElement = document.getElementById('selectedCount');
        
        const selectedCount = this.selectedApps.size;
        
        if (this.batchMode && selectedCount > 0) {
            toolbar.style.display = 'flex';
            countElement.textContent = selectedCount;
        } else {
            toolbar.style.display = 'none';
        }
    }
    
    toggleSelectAll() {
        const userApps = this.apps.filter(app => 
            this.currentUser && app.creator_id === this.currentUser.user_id
        );
        
        if (this.selectedApps.size === userApps.length) {
            // 全部取消选择
            this.clearSelection();
        } else {
            // 全部选择
            userApps.forEach(app => this.selectedApps.add(app.id));
            userApps.forEach(app => this.updateAppSelection(app.id));
            this.updateBatchToolbar();
        }
    }
    
    clearSelection() {
        this.selectedApps.clear();
        
        // 更新所有卡片状态
        document.querySelectorAll('.app-card').forEach(card => {
            card.classList.remove('selected');
            const checkbox = card.querySelector('.app-select');
            if (checkbox) checkbox.checked = false;
        });
        
        this.updateBatchToolbar();
    }
    
    
    async batchDeleteApps() {
        if (this.selectedApps.size === 0) {
            this.showToast('请先选择要删除的应用', 'warning');
            return;
        }
        
        if (!confirm(`确定要删除选中的 ${this.selectedApps.size} 个应用吗？此操作无法撤销！`)) {
            return;
        }
        
        this.showToast('正在批量删除应用...', 'info');
        
        let successCount = 0;
        let errorCount = 0;
        
        for (const appId of this.selectedApps) {
            try {
                const response = await fetch(`/api/apps/${appId}`, {
                    method: 'DELETE',
                    credentials: 'include'
                });
                
                if (response.ok) {
                    successCount++;
                } else {
                    errorCount++;
                }
            } catch (error) {
                errorCount++;
            }
        }
        
        this.showToast(`删除完成: ${successCount} 成功, ${errorCount} 失败`, 'success');
        this.clearSelection();
        this.loadApps();
    }
    
    // 标签相关方法
    async loadTags() {
        try {
            const response = await fetch('/api/tags', {
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                this.availableTags = data.tags || [];
            }
        } catch (error) {
            console.error('加载标签失败:', error);
            this.availableTags = [];
        }
    }
    
    renderTagsFilter() {
        const tagsFilterList = document.getElementById('tagsFilterList');
        const clearTagsFilter = document.getElementById('clearTagsFilter');
        
        if (!tagsFilterList) return;
        
        if (this.availableTags.length === 0) {
            tagsFilterList.innerHTML = '<span class="text-muted">暂无标签</span>';
            if (clearTagsFilter) clearTagsFilter.style.display = 'none';
            return;
        }
        
        tagsFilterList.innerHTML = this.availableTags.map(tag => 
            `<button class="tag-filter" data-tag="${this.escapeHtml(tag.name)}">
                <span>${this.escapeHtml(tag.name)}</span>
                <span class="tag-count">${tag.count}</span>
            </button>`
        ).join('');
        
        // 移除之前的事件监听器并重新绑定
        const newTagsFilterList = tagsFilterList.cloneNode(true);
        tagsFilterList.parentNode.replaceChild(newTagsFilterList, tagsFilterList);
        
        // 绑定标签过滤事件
        newTagsFilterList.addEventListener('click', (e) => {
            const tagFilter = e.target.closest('.tag-filter');
            if (!tagFilter) return;
            
            const tagName = tagFilter.dataset.tag;
            this.toggleTagFilter(tagName, tagFilter);
        });
        
        // 绑定清除标签过滤事件（如果还没绑定）
        if (clearTagsFilter && !clearTagsFilter.hasAttribute('data-bound')) {
            clearTagsFilter.setAttribute('data-bound', 'true');
            clearTagsFilter.addEventListener('click', () => {
                this.clearTagsFilter();
            });
        }
        
        this.updateTagsClearButton();
    }
    
    toggleTagFilter(tagName, element) {
        if (this.selectedTags.has(tagName)) {
            this.selectedTags.delete(tagName);
            element.classList.remove('active');
        } else {
            this.selectedTags.add(tagName);
            element.classList.add('active');
        }
        
        this.updateTagsClearButton();
        this.renderApps();
    }
    
    clearTagsFilter() {
        this.selectedTags.clear();
        document.querySelectorAll('.tag-filter').forEach(tag => {
            tag.classList.remove('active');
        });
        this.updateTagsClearButton();
        this.renderApps();
    }
    
    updateTagsClearButton() {
        const clearButton = document.getElementById('clearTagsFilter');
        if (clearButton) {
            clearButton.style.display = this.selectedTags.size > 0 ? 'block' : 'none';
        }
    }
    
    initTagsInput() {
        const tagsInput = document.getElementById('appTags');
        const tagsDisplay = document.getElementById('tagsDisplay');
        
        if (!tagsInput || !tagsDisplay) return;
        
        // 移除之前的事件监听器
        const newTagsInput = tagsInput.cloneNode(true);
        tagsInput.parentNode.replaceChild(newTagsInput, tagsInput);
        
        newTagsInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                const tagName = newTagsInput.value.trim();
                if (tagName && !this.currentAppTags.includes(tagName)) {
                    this.addTag(tagName);
                    newTagsInput.value = '';
                }
            }
        });
        
        this.renderTagsDisplay();
    }
    
    addTag(tagName) {
        if (!this.currentAppTags.includes(tagName)) {
            this.currentAppTags.push(tagName);
            this.renderTagsDisplay();
        }
    }
    
    removeTag(tagName) {
        const index = this.currentAppTags.indexOf(tagName);
        if (index > -1) {
            this.currentAppTags.splice(index, 1);
            this.renderTagsDisplay();
        }
    }
    
    renderTagsDisplay() {
        const tagsDisplay = document.getElementById('tagsDisplay');
        if (!tagsDisplay) return;
        
        tagsDisplay.innerHTML = this.currentAppTags.map(tag => 
            `<span class="tag removable" data-tag="${this.escapeHtml(tag)}">
                <span>${this.escapeHtml(tag)}</span>
                <button type="button" class="tag-remove" onclick="appHub.removeTag('${this.escapeHtml(tag)}')">
                    <i class="fas fa-times"></i>
                </button>
            </span>`
        ).join('');
    }
    
    renderAppTags(tags) {
        if (!tags || tags.length === 0) {
            return '<div class="app-tags"></div>';
        }
        
        const maxVisible = 3;
        const visibleTags = tags.slice(0, maxVisible);
        const hiddenTags = tags.slice(maxVisible);
        const hiddenCount = hiddenTags.length;
        const hiddenTitle = hiddenCount > 0 ? hiddenTags.join(', ') : '';
        
        const visibleHtml = visibleTags.map(tag => 
            `<span class="tag" title="${this.escapeHtml(tag)}"><span class="tag-text">${this.escapeHtml(tag)}</span></span>`
        ).join('');
        
        const moreHtml = hiddenCount > 0 
            ? `<span class="tag more" title="${this.escapeHtml(hiddenTitle)}">+${hiddenCount}</span>`
            : '';
        
        return `<div class="app-tags">${visibleHtml}${moreHtml}</div>`;
    }
    
    filterAppsByTags(apps) {
        if (this.selectedTags.size === 0) {
            return apps;
        }
        
        return apps.filter(app => {
            const appTags = app.tags || [];
            return Array.from(this.selectedTags).some(selectedTag => 
                appTags.includes(selectedTag)
            );
        });
    }
    
    // 编辑应用功能
    async editApp(appId) {
        const app = this.apps.find(a => a.id === appId);
        if (!app) {
            this.showToast('应用不存在', 'error');
            return;
        }
        
        if (!this.currentUser || app.creator_id !== this.currentUser.user_id) {
            this.showToast('只能编辑自己创建的应用', 'error');
            return;
        }
        
        this.currentEditingAppId = appId;
        this.showEditAppModal(app);
    }
    
    showEditAppModal(app) {
        // 填充表单数据
        document.getElementById('editAppName').value = app.name;
        document.getElementById('editAppUrl').value = app.url;
        document.getElementById('editAppIcon').value = app.icon_url || '';
        document.getElementById('editAppDescription').value = app.description || '';
        document.getElementById('editAppPublic').checked = app.is_public;
        
        // 设置标签
        this.currentAppTags = [...(app.tags || [])];
        this.renderEditTagsDisplay();
        this.initEditTagsInput();
        
        document.getElementById('editAppModal').classList.add('show');
    }
    
    hideEditAppModal() {
        document.getElementById('editAppModal').classList.remove('show');
        this.currentEditingAppId = null;
        this.currentAppTags = [];
    }
    
    initEditTagsInput() {
        const tagsInput = document.getElementById('editAppTags');
        const tagsDisplay = document.getElementById('editTagsDisplay');
        
        if (!tagsInput || !tagsDisplay) return;
        
        // 移除之前的事件监听器
        const newTagsInput = tagsInput.cloneNode(true);
        tagsInput.parentNode.replaceChild(newTagsInput, tagsInput);
        
        newTagsInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                const tagName = newTagsInput.value.trim();
                if (tagName && !this.currentAppTags.includes(tagName)) {
                    this.addTag(tagName);
                    newTagsInput.value = '';
                    this.renderEditTagsDisplay();
                }
            }
        });
    }
    
    renderEditTagsDisplay() {
        const tagsDisplay = document.getElementById('editTagsDisplay');
        if (!tagsDisplay) return;
        
        tagsDisplay.innerHTML = this.currentAppTags.map(tag => 
            `<span class="tag removable" data-tag="${this.escapeHtml(tag)}">
                <span>${this.escapeHtml(tag)}</span>
                <button type="button" class="tag-remove" onclick="appHub.removeTag('${this.escapeHtml(tag)}'); appHub.renderEditTagsDisplay();">
                    <i class="fas fa-times"></i>
                </button>
            </span>`
        ).join('');
    }
    
    async updateApp() {
        try {
            if (!this.currentEditingAppId) {
                throw new Error('没有选择要编辑的应用');
            }
            
            const form = document.getElementById('editAppForm');
            const formData = new FormData(form);
            // 吸收未按回车确认的剩余标签（编辑）
            const pendingEditTagsInput = document.getElementById('editAppTags');
            if (pendingEditTagsInput) {
                const raw = pendingEditTagsInput.value.trim();
                if (raw) {
                    raw.split(/[\s,]+/).forEach(tag => {
                        const t = tag.trim();
                        if (t && !this.currentAppTags.includes(t)) {
                            this.addTag(t);
                        }
                    });
                    this.renderEditTagsDisplay();
                }
            }
            
            const appData = {
                name: formData.get('name'),
                url: formData.get('url'),
                icon_url: formData.get('icon_url'),
                description: formData.get('description'),
                is_public: formData.get('is_public') === 'on',
                tags: this.currentAppTags
            };
            
            // 验证URL格式
            try {
                new URL(appData.url);
            } catch (e) {
                this.showToast('请输入有效的网站地址', 'error');
                return;
            }
            
            const response = await fetch(`/api/apps/${this.currentEditingAppId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(appData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.hideEditAppModal();
                this.showToast('应用更新成功！', 'success');
                await this.loadApps();
                await this.loadTags();
                this.renderTagsFilter();
            } else {
                throw new Error(data.error);
            }
            
        } catch (error) {
            console.error('更新应用失败:', error);
            this.showToast('更新应用失败: ' + error.message, 'error');
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// 初始化应用
let appHub;

document.addEventListener('DOMContentLoaded', () => {
    appHub = new AppHub();
});

// 全局错误处理
window.addEventListener('error', (e) => {
    console.error('JavaScript错误:', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Promise未处理的拒绝:', e.reason);
    e.preventDefault();
});