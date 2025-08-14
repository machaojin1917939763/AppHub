from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from .models import db
import os

def create_app():
    # 获取正确的静态文件和模板路径
    current_dir = os.path.dirname(os.path.abspath(__file__))
    frontend_dir = os.path.join(current_dir, '../../frontend')
    static_dir = os.path.join(frontend_dir, 'static')
    template_dir = os.path.join(frontend_dir, 'templates')
    
    # 标准化路径
    static_dir = os.path.normpath(static_dir)
    template_dir = os.path.normpath(template_dir)
    
    print(f"Static directory: {static_dir}")
    print(f"Template directory: {template_dir}")
    
    app = Flask(__name__, 
                static_folder=static_dir,
                template_folder=template_dir)
    
    # 配置
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///apphub.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SECRET_KEY'] = 'your-secret-key-change-in-production'
    
    # 初始化扩展
    db.init_app(app)
    CORS(app)
    
    # 注册蓝图
    from .routes import api
    from .static_routes import static_bp
    app.register_blueprint(api, url_prefix='/api')
    app.register_blueprint(static_bp)
    
    # 创建数据库表
    with app.app_context():
        db.create_all()
    
    return app