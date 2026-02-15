# -*- coding: utf-8 -*-
"""
API маршрути автентифікації
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    jwt_required,
    get_jwt_identity,
    current_user
)

from app.services.auth_service import AuthService
from app.services.audit_service import AuditService
from app.services.threat_service import ThreatService
from app.utils.helpers import get_client_ip

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/register', methods=['POST'])
def register():
    """
    Реєстрація нового користувача.

    Body:
        {
            "username": "string",
            "email": "string",
            "password": "string"
        }

    Returns:
        {
            "access_token": "string",
            "refresh_token": "string",
            "user": {...}
        }
    """
    data = request.get_json()

    if not data:
        return jsonify({'error': 'Відсутні дані'}), 400

    username = data.get('username', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not all([username, email, password]):
        return jsonify({'error': 'Всі поля обов\'язкові'}), 400

    auth_service = AuthService()
    audit_service = AuditService()

    user, error = auth_service.register_user(username, email, password)

    if error:
        audit_service.log(
            action='USER_REGISTERED',
            status='error',
            details={'error': error, 'username': username}
        )
        return jsonify({'error': error}), 400

    # Генеруємо токени
    tokens = auth_service.generate_tokens(user)

    # Аудит
    audit_service.log(
        action='USER_REGISTERED',
        status='success',
        user=user,
        resource_type='user',
        resource_id=user.id
    )

    return jsonify({
        'access_token': tokens['access_token'],
        'refresh_token': tokens['refresh_token'],
        'user': user.to_dict()
    }), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    """
    Вхід у систему.

    Body:
        {
            "username": "string",
            "password": "string"
        }

    Returns:
        {
            "access_token": "string",
            "refresh_token": "string",
            "user": {...}
        }
    """
    data = request.get_json()

    if not data:
        return jsonify({'error': 'Відсутні дані'}), 400

    username = data.get('username', '').strip()
    password = data.get('password', '')

    if not all([username, password]):
        return jsonify({'error': 'Логін та пароль обов\'язкові'}), 400

    auth_service = AuthService()
    audit_service = AuditService()
    threat_service = ThreatService()
    ip_address = get_client_ip()

    user, error = auth_service.authenticate(username, password, ip_address)

    if error:
        # Логуємо невдалу спробу
        audit_service.log(
            action='LOGIN_FAILED',
            status='denied',
            details={'username': username, 'reason': error}
        )

        # Перевіряємо на brute force
        from app.models import User
        target_user = User.query.filter_by(username=username).first()
        if target_user:
            ThreatService.track_failed_login(target_user.id, ip_address)
            threat = threat_service.check_brute_force(target_user.id, ip_address)
            if threat:
                audit_service.log(
                    action='THREAT_DETECTED',
                    status='success',
                    user=target_user,
                    details={'threat_type': 'BRUTE_FORCE', 'threat_id': threat.id}
                )

        # Визначаємо код помилки
        if 'заблоковано' in error.lower():
            return jsonify({'error': error}), 423  # Locked

        return jsonify({'error': error}), 401

    # Успішний вхід
    tokens = auth_service.generate_tokens(user)

    audit_service.log(
        action='LOGIN_SUCCESS',
        status='success',
        user=user,
        resource_type='session'
    )

    return jsonify({
        'access_token': tokens['access_token'],
        'refresh_token': tokens['refresh_token'],
        'user': user.to_dict()
    }), 200


@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """
    Оновлення access токена.

    Headers:
        Authorization: Bearer <refresh_token>

    Returns:
        {
            "access_token": "string"
        }
    """
    auth_service = AuthService()
    audit_service = AuditService()

    if not current_user:
        return jsonify({'error': 'Користувача не знайдено'}), 401

    if not current_user.is_active():
        return jsonify({'error': 'Акаунт деактивовано'}), 403

    access_token = auth_service.refresh_access_token(current_user)

    audit_service.log(
        action='TOKEN_REFRESH',
        status='success',
        user=current_user,
        resource_type='session'
    )

    return jsonify({
        'access_token': access_token
    }), 200


@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    """
    Вихід із системи.

    В реальному проекті тут би додавали токен до чорного списку в Redis.
    """
    audit_service = AuditService()

    audit_service.log(
        action='LOGOUT',
        status='success',
        user=current_user,
        resource_type='session'
    )

    return jsonify({'message': 'Успішний вихід'}), 200


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    """
    Отримання інформації про поточного користувача.

    Returns:
        {
            "user": {...}
        }
    """
    if not current_user:
        return jsonify({'error': 'Користувача не знайдено'}), 401

    return jsonify({
        'user': current_user.to_dict()
    }), 200
