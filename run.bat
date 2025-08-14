@echo off
echo 启动 AppHub 应用...
echo.

REM 检查是否存在虚拟环境
if exist "venv\Scripts\activate.bat" (
    echo 激活虚拟环境...
    call venv\Scripts\activate.bat
) else (
    echo 警告: 未找到虚拟环境，使用全局Python环境
)

REM 安装依赖
echo 检查并安装依赖...
pip install -r requirements.txt

REM 启动应用
echo.
echo 启动应用服务器...
echo 应用将在 http://localhost:5000 启动
echo 按 Ctrl+C 停止服务器
echo.
python app.py

pause