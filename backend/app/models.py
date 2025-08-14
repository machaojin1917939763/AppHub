from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import uuid
import hashlib

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    fingerprint = db.Column(db.String(64), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 关系
    apps = db.relationship('App', backref='creator', lazy='dynamic', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'fingerprint': self.fingerprint,
            'created_at': self.created_at.isoformat()
        }

class App(db.Model):
    __tablename__ = 'apps'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(100), nullable=False)
    url = db.Column(db.String(500), nullable=False)
    icon_url = db.Column(db.String(500), default='')
    description = db.Column(db.Text, default='')
    is_public = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 访问统计
    click_count = db.Column(db.Integer, default=0)
    last_accessed = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 预览图和健康状态
    preview_url = db.Column(db.String(500), default='')
    is_healthy = db.Column(db.Boolean, default=True)
    health_check_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 标签（用逗号分隔的字符串）
    tags = db.Column(db.String(200), default='')
    
    # 外键
    creator_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'url': self.url,
            'icon_url': self.icon_url,
            'description': self.description,
            'is_public': self.is_public,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'creator_id': self.creator_id,
            'click_count': self.click_count,
            'last_accessed': self.last_accessed.isoformat() if self.last_accessed else None,
            'preview_url': self.preview_url,
            'is_healthy': self.is_healthy,
            'health_check_at': self.health_check_at.isoformat() if self.health_check_at else None,
            'tags': self.get_tags_list()
        }
    
    def get_tags_list(self):
        """获取标签列表"""
        if not self.tags:
            return []
        return [tag.strip() for tag in self.tags.split(',') if tag.strip()]
    
    def set_tags_list(self, tags_list):
        """设置标签列表"""
        self.tags = ','.join(tags_list) if tags_list else ''

class BrowserFingerprint(db.Model):
    __tablename__ = 'fingerprints'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    fingerprint_hash = db.Column(db.String(64), unique=True, nullable=False)
    user_agent = db.Column(db.String(500))
    screen_resolution = db.Column(db.String(50))
    timezone = db.Column(db.String(50))
    language = db.Column(db.String(50))
    platform = db.Column(db.String(50))
    plugins = db.Column(db.Text)
    canvas_fingerprint = db.Column(db.String(64))
    webgl_fingerprint = db.Column(db.String(64))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 外键
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'))
    
    @staticmethod
    def generate_fingerprint(fingerprint_data):
        """生成浏览器指纹哈希值"""
        fingerprint_string = f"{fingerprint_data.get('user_agent', '')}" \
                           f"{fingerprint_data.get('screen_resolution', '')}" \
                           f"{fingerprint_data.get('timezone', '')}" \
                           f"{fingerprint_data.get('language', '')}" \
                           f"{fingerprint_data.get('platform', '')}" \
                           f"{fingerprint_data.get('plugins', '')}" \
                           f"{fingerprint_data.get('canvas_fingerprint', '')}" \
                           f"{fingerprint_data.get('webgl_fingerprint', '')}"
        
        return hashlib.sha256(fingerprint_string.encode()).hexdigest()
    
    def to_dict(self):
        return {
            'id': self.id,
            'fingerprint_hash': self.fingerprint_hash,
            'user_agent': self.user_agent,
            'screen_resolution': self.screen_resolution,
            'timezone': self.timezone,
            'language': self.language,
            'platform': self.platform,
            'created_at': self.created_at.isoformat()
        }