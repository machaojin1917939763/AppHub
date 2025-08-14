# AppHub - 个人应用中心

一个基于浏览器指纹识别的个人应用管理平台，允许用户创建、管理和分享网页应用。

## 功能特色

- 🔐 **浏览器指纹识别** - 基于浏览器特征自动识别用户身份
- 🌐 **应用管理** - 轻松添加、编辑和删除网页应用
- 👁️ **隐私控制** - 可选择应用是否对其他用户可见
- 🎨 **现代化UI** - 响应式设计，支持桌面端和移动端
- ⚡ **快速访问** - 一键打开收藏的网站

## 技术栈

### 后端
- Python 3.8+
- Flask 2.3+
- SQLAlchemy (SQLite数据库)
- Flask-CORS (跨域支持)

### 前端
- HTML5 + CSS3 + JavaScript (ES6+)
- Font Awesome 图标
- Google Fonts (Inter字体)
- 现代化CSS Grid和Flexbox布局

## 快速开始

### 1. 环境准备

```bash
# 克隆项目
cd apphub

# 创建虚拟环境 (推荐)
python -m venv venv

# 激活虚拟环境
# Windows
venv\\Scripts\\activate
# Linux/Mac
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt
```

### 2. 配置环境变量

复制 `.env` 文件并根据需要修改配置：

```bash
cp .env.example .env
```

### 3. 运行应用

```bash
# 启动开发服务器
python app.py
```

应用将在 http://localhost:5000 启动。

## 项目结构

```
apphub/
├── backend/                 # 后端代码
│   └── app/
│       ├── __init__.py     # Flask应用工厂
│       ├── models.py       # 数据库模型
│       ├── routes.py       # API路由
│       └── static_routes.py # 静态文件路由
├── frontend/               # 前端代码
│   ├── static/
│   │   ├── css/           # CSS样式文件
│   │   └── js/            # JavaScript文件
│   └── templates/         # HTML模板
├── config/                # 配置文件
├── app.py                 # 应用入口
├── requirements.txt       # Python依赖
└── README.md             # 项目说明
```

## API接口

### 用户相关
- `POST /api/fingerprint` - 生成/获取浏览器指纹
- `GET /api/user/info` - 获取用户信息

### 应用管理
- `GET /api/apps` - 获取应用列表
- `POST /api/apps` - 创建新应用
- `PUT /api/apps/<id>` - 更新应用
- `DELETE /api/apps/<id>` - 删除应用

## 浏览器指纹算法

系统使用以下信息生成唯一的浏览器指纹：

- User Agent 字符串
- 屏幕分辨率
- 时区设置
- 语言设置
- 平台信息
- 浏览器插件列表
- Canvas指纹
- WebGL指纹

## 安全特性

- 浏览器指纹采用SHA-256哈希算法
- 用户只能删除自己创建的应用
- 支持私有应用（仅创建者可见）
- CORS跨域保护

## 开发说明

### 数据库模型

1. **User** - 用户表
   - id: 用户唯一标识
   - fingerprint: 浏览器指纹哈希
   - created_at: 创建时间

2. **App** - 应用表
   - id: 应用唯一标识
   - name: 应用名称
   - url: 网站地址
   - icon_url: 图标地址
   - description: 描述信息
   - is_public: 是否公开
   - creator_id: 创建者ID

3. **BrowserFingerprint** - 浏览器指纹详情表
   - 存储详细的浏览器指纹信息

### 自定义配置

可以通过修改以下文件进行配置：

- `.env` - 环境变量配置
- `backend/app/__init__.py` - Flask应用配置
- `frontend/static/css/style.css` - 样式自定义

## 部署说明

### 生产环境部署

1. 设置环境变量：
```bash
export FLASK_ENV=production
export SECRET_KEY=your-production-secret-key
```

2. 使用生产级WSGI服务器（如Gunicorn）：
```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

3. 配置反向代理（Nginx推荐）

## 贡献指南

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 许可证

本项目采用 MIT 许可证。查看 [LICENSE](LICENSE) 文件了解更多信息。

## 支持

如果你觉得这个项目有用，请给一个 ⭐️！

## 更新日志

### v1.0.0
- 初始版本发布
- 基础的应用创建、管理功能
- 浏览器指纹识别
- 响应式UI设计# AppHub
