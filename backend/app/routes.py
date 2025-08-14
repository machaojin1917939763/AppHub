from flask import Blueprint, request, jsonify, session
from .models import db, User, App, BrowserFingerprint
from sqlalchemy.exc import IntegrityError
from datetime import datetime
import uuid
import requests
from urllib.parse import urlparse

api = Blueprint('api', __name__)

@api.route('/fingerprint', methods=['POST'])
def generate_fingerprint():
    """生成或获取浏览器指纹，返回用户ID"""
    try:
        data = request.get_json()
        
        # 生成指纹哈希
        fingerprint_hash = BrowserFingerprint.generate_fingerprint(data)
        
        # 检查是否已存在该指纹的用户
        existing_fingerprint = BrowserFingerprint.query.filter_by(
            fingerprint_hash=fingerprint_hash
        ).first()
        
        if existing_fingerprint and existing_fingerprint.user_id:
            user = User.query.get(existing_fingerprint.user_id)
            if user:
                session['user_id'] = user.id
                return jsonify({
                    'success': True,
                    'user_id': user.id,
                    'fingerprint': fingerprint_hash,
                    'is_new_user': False
                })
        
        # 创建新用户
        user = User(fingerprint=fingerprint_hash)
        db.session.add(user)
        db.session.commit()
        
        # 保存指纹详情
        fingerprint_record = BrowserFingerprint(
            fingerprint_hash=fingerprint_hash,
            user_agent=data.get('user_agent'),
            screen_resolution=data.get('screen_resolution'),
            timezone=data.get('timezone'),
            language=data.get('language'),
            platform=data.get('platform'),
            plugins=data.get('plugins'),
            canvas_fingerprint=data.get('canvas_fingerprint'),
            webgl_fingerprint=data.get('webgl_fingerprint'),
            user_id=user.id
        )
        db.session.add(fingerprint_record)
        db.session.commit()
        
        session['user_id'] = user.id
        
        return jsonify({
            'success': True,
            'user_id': user.id,
            'fingerprint': fingerprint_hash,
            'is_new_user': True
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@api.route('/apps', methods=['GET'])
def get_apps():
    """获取APP列表"""
    try:
        user_id = session.get('user_id')
        
        if user_id:
            # 获取用户自己的所有APP + 公开的其他APP
            user_apps = App.query.filter_by(creator_id=user_id).all()
            public_apps = App.query.filter(
                App.is_public == True,
                App.creator_id != user_id
            ).all()
            apps = user_apps + public_apps
        else:
            # 只获取公开APP
            apps = App.query.filter_by(is_public=True).all()
        
        return jsonify({
            'success': True,
            'apps': [app.to_dict() for app in apps],
            'user_id': user_id
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@api.route('/apps', methods=['POST'])
def create_app():
    """创建新APP"""
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        data = request.get_json()
        
        app = App(
            name=data.get('name'),
            url=data.get('url'),
            icon_url=data.get('icon_url', ''),
            description=data.get('description', ''),
            is_public=data.get('is_public', True),
            creator_id=user_id
        )
        
        # 设置标签
        if 'tags' in data and isinstance(data['tags'], list):
            app.set_tags_list(data['tags'])
        
        db.session.add(app)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'app': app.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@api.route('/apps/<app_id>', methods=['DELETE'])
def delete_app(app_id):
    """删除APP（只能删除自己创建的）"""
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        app = App.query.get(app_id)
        if not app:
            return jsonify({'success': False, 'error': 'App not found'}), 404
        
        if app.creator_id != user_id:
            return jsonify({'success': False, 'error': 'Permission denied'}), 403
        
        db.session.delete(app)
        db.session.commit()
        
        return jsonify({'success': True})
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@api.route('/apps/<app_id>', methods=['PUT'])
def update_app(app_id):
    """更新APP（只能更新自己创建的）"""
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        app = App.query.get(app_id)
        if not app:
            return jsonify({'success': False, 'error': 'App not found'}), 404
        
        if app.creator_id != user_id:
            return jsonify({'success': False, 'error': 'Permission denied'}), 403
        
        data = request.get_json()
        
        # 更新字段
        if 'name' in data:
            app.name = data['name']
        if 'url' in data:
            app.url = data['url']
        if 'icon_url' in data:
            app.icon_url = data['icon_url']
        if 'description' in data:
            app.description = data['description']
        if 'is_public' in data:
            app.is_public = data['is_public']
        if 'tags' in data and isinstance(data['tags'], list):
            app.set_tags_list(data['tags'])
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'app': app.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@api.route('/user/info', methods=['GET'])
def get_user_info():
    """获取当前用户信息"""
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({'success': False, 'error': 'User not found'}), 404
        
        # 获取用户的APP数量
        app_count = App.query.filter_by(creator_id=user_id).count()
        
        return jsonify({
            'success': True,
            'user': user.to_dict(),
            'app_count': app_count
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@api.route('/apps/<app_id>/access', methods=['POST'])
def record_app_access(app_id):
    """记录应用访问"""
    try:
        app = App.query.get(app_id)
        if not app:
            return jsonify({'success': False, 'error': 'App not found'}), 404
        
        # 增加点击计数
        app.click_count += 1
        app.last_accessed = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'click_count': app.click_count
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@api.route('/apps/<app_id>/preview', methods=['POST'])
def generate_app_preview(app_id):
    """生成应用预览图"""
    try:
        app = App.query.get(app_id)
        if not app:
            return jsonify({'success': False, 'error': 'App not found'}), 404
        
        # 使用免费的网站截图服务
        domain = urlparse(app.url).netloc or urlparse(f"https://{app.url}").netloc
        
        # 尝试多个免费截图服务
        preview_services = [
            f"https://api.screenshotmachine.com/?key=demo&url={app.url}&dimension=1024x768&format=png",
            f"https://mini.s-shot.ru/1024x768/PNG/1024/Z100/?{app.url}",
            f"https://image.thum.io/get/width/1200/crop/800/{app.url}",
            f"https://api.thumbnail.ws/api/f9c1aaecf1f4b5cb891a/thumbnail/get?url={app.url}&width=1200"
        ]
        
        preview_url = preview_services[2]  # 使用thum.io服务
        app.preview_url = preview_url
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'preview_url': preview_url
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@api.route('/apps/<app_id>/health', methods=['POST'])
def check_app_health(app_id):
    """检查应用健康状态"""
    try:
        app = App.query.get(app_id)
        if not app:
            return jsonify({'success': False, 'error': 'App not found'}), 404
        
        # 检查URL是否可访问
        try:
            response = requests.head(app.url, timeout=10, allow_redirects=True)
            is_healthy = response.status_code < 400
        except:
            is_healthy = False
        
        app.is_healthy = is_healthy
        app.health_check_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'is_healthy': is_healthy,
            'status_code': response.status_code if 'response' in locals() else None
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@api.route('/apps/batch/health', methods=['POST'])
def batch_health_check():
    """批量健康检查"""
    try:
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'success': False, 'error': 'User not authenticated'}), 401
        
        # 获取用户的所有应用
        apps = App.query.filter_by(creator_id=user_id).all()
        
        results = []
        for app in apps:
            try:
                response = requests.head(app.url, timeout=5, allow_redirects=True)
                is_healthy = response.status_code < 400
            except:
                is_healthy = False
            
            app.is_healthy = is_healthy
            app.health_check_at = datetime.utcnow()
            
            results.append({
                'id': app.id,
                'name': app.name,
                'url': app.url,
                'is_healthy': is_healthy
            })
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'results': results
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@api.route('/tags', methods=['GET'])
def get_all_tags():
    """获取所有标签"""
    try:
        user_id = session.get('user_id')
        
        if user_id:
            # 获取用户可见的应用（自己的+公开的）
            user_apps = App.query.filter_by(creator_id=user_id).all()
            public_apps = App.query.filter(
                App.is_public == True,
                App.creator_id != user_id
            ).all()
            apps = user_apps + public_apps
        else:
            # 只获取公开应用
            apps = App.query.filter_by(is_public=True).all()
        
        # 收集所有标签
        all_tags = set()
        for app in apps:
            tags = app.get_tags_list()
            all_tags.update(tags)
        
        # 统计每个标签的应用数量
        tag_counts = {}
        for tag in all_tags:
            count = 0
            for app in apps:
                if tag in app.get_tags_list():
                    count += 1
            tag_counts[tag] = count
        
        # 按使用频率排序
        sorted_tags = sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)
        
        return jsonify({
            'success': True,
            'tags': [{'name': tag, 'count': count} for tag, count in sorted_tags]
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500