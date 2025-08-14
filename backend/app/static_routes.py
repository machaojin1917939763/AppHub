from flask import Blueprint, render_template

static_bp = Blueprint('static', __name__)

@static_bp.route('/')
def index():
    """主页路由"""
    return render_template('index.html')