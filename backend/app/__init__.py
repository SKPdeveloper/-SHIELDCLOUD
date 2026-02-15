# -*- coding: utf-8 -*-
"""
Фабрика Flask-додатку ShieldCloud
"""
import os
from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate

# Глобальні екземпляри розширень
db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()


def create_app(config_name: str = None) -> Flask:
    """
    Створює та конфігурує Flask-додаток.
    """
    app = Flask(__name__, instance_relative_config=True)

    # Завантаження конфігурації
    from app.config import Config
    app.config.from_object(Config)

    # Переконатись, що існує директорія instance
    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass

    # Ініціалізація розширень
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)

    # CORS налаштування
    CORS(app, resources={
        r"/api/*": {
            "origins": ["http://localhost:3000", "http://127.0.0.1:3000"],
            "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "supports_credentials": True
        }
    })

    # Реєстрація моделей
    from app.models import User, FileMetadata, AuditLog, ThreatEvent

    # Реєстрація blueprints
    from app.routes.auth import auth_bp
    from app.routes.files import files_bp
    from app.routes.audit import audit_bp
    from app.routes.threats import threats_bp
    from app.routes.users import users_bp
    from app.routes.cloud import cloud_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(files_bp, url_prefix='/api/files')
    app.register_blueprint(audit_bp, url_prefix='/api/audit')
    app.register_blueprint(threats_bp, url_prefix='/api/threats')
    app.register_blueprint(users_bp, url_prefix='/api/users')
    app.register_blueprint(cloud_bp, url_prefix='/api/cloud')

    # Налаштування виявлення загроз
    from app.middleware.threat_detector import setup_threat_detection
    setup_threat_detection(app)

    # JWT callback для додавання інформації про користувача
    @jwt.user_identity_loader
    def user_identity_lookup(user):
        return str(user.id) if hasattr(user, 'id') else user

    @jwt.user_lookup_loader
    def user_lookup_callback(_jwt_header, jwt_data):
        identity = jwt_data["sub"]
        return User.query.filter_by(id=identity, deleted_at=None).first()

    # Обробка заблокованих токенів
    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(jwt_header, jwt_payload):
        # В реальному проекті тут перевірка в Redis
        return False

    # Створення таблиць та початкових даних
    with app.app_context():
        db.create_all()
        _create_initial_admin(app)

    return app


def _create_initial_admin(app: Flask):
    """
    Створює початкових користувачів (admin та user), якщо вони не існують.
    """
    from app.models import User
    from app.services.auth_service import AuthService

    auth_service = AuthService()

    # Адміністратор
    admin = User.query.filter_by(username='admin').first()
    if not admin:
        password_hash = auth_service.hash_password('Admin123!@#')
        admin = User(
            username='admin',
            email='admin@shieldcloud.local',
            password_hash=password_hash,
            role='admin'
        )
        db.session.add(admin)
        app.logger.info('Створено адміністратора: admin / Admin123!@#')

    # Звичайний користувач
    user = User.query.filter_by(username='user').first()
    if not user:
        password_hash = auth_service.hash_password('User123!@#')
        user = User(
            username='user',
            email='user@shieldcloud.local',
            password_hash=password_hash,
            role='user'
        )
        db.session.add(user)
        app.logger.info('Створено користувача: user / User123!@#')

    db.session.commit()
