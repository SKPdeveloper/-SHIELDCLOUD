# -*- coding: utf-8 -*-
"""
API маршрути для управління користувачами
"""
from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, current_user

from app import db
from app.models import User
from app.services.auth_service import AuthService
from app.services.audit_service import AuditService
from app.services.threat_service import ThreatService
from app.middleware.rbac import require_role, RBACChecker
from app.utils.helpers import get_client_ip

users_bp = Blueprint('users', __name__)


@users_bp.route('', methods=['GET'])
@jwt_required()
@require_role('admin')
def get_users():
    """
    Отримання списку користувачів.

    Query params:
        page: int (default 1)
        per_page: int (default 20, max 100)
        search: string (пошук за username/email)
        role: string (фільтр за роллю)
        is_blocked: bool

    Returns:
        {
            "users": [...],
            "pagination": {...}
        }
    """
    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 20, type=int), 100)
    search = request.args.get('search')
    role = request.args.get('role')
    is_blocked = request.args.get('is_blocked')

    query = User.query.filter(User.deleted_at.is_(None))

    # Фільтри
    if search:
        query = query.filter(
            db.or_(
                User.username.ilike(f'%{search}%'),
                User.email.ilike(f'%{search}%')
            )
        )

    if role:
        query = query.filter(User.role == role)

    if is_blocked is not None:
        is_blocked = is_blocked.lower() == 'true'
        query = query.filter(User.is_blocked == is_blocked)

    # Сортування
    query = query.order_by(User.created_at.desc())

    # Пагінація
    total = query.count()
    users = query.offset((page - 1) * per_page).limit(per_page).all()
    total_pages = (total + per_page - 1) // per_page

    return jsonify({
        'users': [u.to_dict(include_sensitive=True) for u in users],
        'pagination': {
            'page': page,
            'per_page': per_page,
            'total': total,
            'total_pages': total_pages,
            'has_next': page < total_pages,
            'has_prev': page > 1
        }
    }), 200


@users_bp.route('/<user_id>', methods=['GET'])
@jwt_required()
@require_role('admin')
def get_user(user_id):
    """
    Отримання інформації про користувача.
    """
    user = User.query.filter_by(id=user_id, deleted_at=None).first()

    if not user:
        return jsonify({'error': 'Користувача не знайдено'}), 404

    return jsonify({
        'user': user.to_dict(include_sensitive=True)
    }), 200


@users_bp.route('/<user_id>/role', methods=['PATCH'])
@jwt_required()
@require_role('admin')
def change_user_role(user_id):
    """
    Зміна ролі користувача.

    Body:
        {
            "role": "admin" | "user" | "guest"
        }
    """
    data = request.get_json()

    if not data or 'role' not in data:
        return jsonify({'error': 'Вкажіть role'}), 400

    new_role = data['role']

    if new_role not in User.VALID_ROLES:
        return jsonify({
            'error': f'Невірна роль. Допустимі: {", ".join(User.VALID_ROLES)}'
        }), 400

    user = User.query.filter_by(id=user_id, deleted_at=None).first()

    if not user:
        return jsonify({'error': 'Користувача не знайдено'}), 404

    # Не можна змінити свою роль
    if user.id == current_user.id:
        ThreatService().create_privilege_escalation(
            user_id=current_user.id,
            ip_address=get_client_ip(),
            attempted_action='change own role'
        )
        return jsonify({'error': 'Не можна змінити власну роль'}), 403

    auth_service = AuthService()
    audit_service = AuditService()

    old_role = user.role
    success, error = auth_service.change_user_role(user, new_role, current_user)

    if not success:
        return jsonify({'error': error}), 400

    audit_service.log(
        action='USER_ROLE_CHANGED',
        status='success',
        user=current_user,
        resource_type='user',
        resource_id=user_id,
        details={
            'target_user': user.username,
            'old_role': old_role,
            'new_role': new_role
        }
    )

    return jsonify({
        'user': user.to_dict(include_sensitive=True)
    }), 200


@users_bp.route('/<user_id>/block', methods=['POST'])
@jwt_required()
@require_role('admin')
def block_user(user_id):
    """
    Блокування користувача.

    Body (optional):
        {
            "duration_minutes": int (якщо не вказано — безстроково)
        }
    """
    data = request.get_json() or {}
    duration_minutes = data.get('duration_minutes')

    user = User.query.filter_by(id=user_id, deleted_at=None).first()

    if not user:
        return jsonify({'error': 'Користувача не знайдено'}), 404

    if user.id == current_user.id:
        return jsonify({'error': 'Не можна заблокувати себе'}), 403

    auth_service = AuthService()
    audit_service = AuditService()

    auth_service.block_user(user, duration_minutes)

    audit_service.log(
        action='USER_BLOCKED',
        status='success',
        user=current_user,
        resource_type='user',
        resource_id=user_id,
        details={
            'target_user': user.username,
            'duration_minutes': duration_minutes or 'indefinite'
        }
    )

    # Також логуємо для самого користувача
    audit_service.log(
        action='ACCOUNT_LOCKED',
        status='success',
        user=user,
        resource_type='user',
        resource_id=user_id,
        details={
            'blocked_by': current_user.username,
            'reason': 'manual_block'
        }
    )

    return jsonify({
        'user': user.to_dict(include_sensitive=True),
        'message': 'Користувача заблоковано'
    }), 200


@users_bp.route('/<user_id>/unblock', methods=['POST'])
@jwt_required()
@require_role('admin')
def unblock_user(user_id):
    """
    Розблокування користувача.
    """
    user = User.query.filter_by(id=user_id, deleted_at=None).first()

    if not user:
        return jsonify({'error': 'Користувача не знайдено'}), 404

    auth_service = AuthService()
    audit_service = AuditService()

    auth_service.unblock_user(user)

    audit_service.log(
        action='USER_UNBLOCKED',
        status='success',
        user=current_user,
        resource_type='user',
        resource_id=user_id,
        details={
            'target_user': user.username
        }
    )

    audit_service.log(
        action='ACCOUNT_UNLOCKED',
        status='success',
        user=user,
        resource_type='user',
        resource_id=user_id,
        details={
            'unblocked_by': current_user.username
        }
    )

    return jsonify({
        'user': user.to_dict(include_sensitive=True),
        'message': 'Користувача розблоковано'
    }), 200


@users_bp.route('/<user_id>', methods=['DELETE'])
@jwt_required()
@require_role('admin')
def delete_user(user_id):
    """
    Видалення користувача (soft delete).
    """
    user = User.query.filter_by(id=user_id, deleted_at=None).first()

    if not user:
        return jsonify({'error': 'Користувача не знайдено'}), 404

    if user.id == current_user.id:
        return jsonify({'error': 'Не можна видалити себе'}), 403

    audit_service = AuditService()

    user.deleted_at = datetime.utcnow()
    db.session.commit()

    audit_service.log(
        action='USER_DELETED',
        status='success',
        user=current_user,
        resource_type='user',
        resource_id=user_id,
        details={
            'deleted_user': user.username
        }
    )

    return jsonify({
        'message': 'Користувача видалено'
    }), 200


@users_bp.route('/roles', methods=['GET'])
@jwt_required()
@require_role('admin')
def get_roles():
    """
    Отримання списку ролей.
    """
    return jsonify({
        'roles': list(User.VALID_ROLES)
    }), 200


@users_bp.route('/permissions', methods=['GET'])
@jwt_required()
@require_role('admin')
def get_permissions_matrix():
    """
    Отримання матриці прав доступу.
    """
    return jsonify({
        'permissions': RBACChecker.PERMISSIONS
    }), 200


@users_bp.route('/stats', methods=['GET'])
@jwt_required()
@require_role('admin')
def get_users_stats():
    """
    Отримання статистики користувачів.
    """
    users = User.query.filter(User.deleted_at.is_(None)).all()

    stats = {
        'total': len(users),
        'by_role': {
            'admin': sum(1 for u in users if u.role == 'admin'),
            'user': sum(1 for u in users if u.role == 'user'),
            'guest': sum(1 for u in users if u.role == 'guest')
        },
        'blocked': sum(1 for u in users if u.is_blocked),
        'active_24h': sum(
            1 for u in users
            if u.last_login_at and
            (datetime.utcnow() - u.last_login_at).total_seconds() < 86400
        ),
        'high_threat_score': sum(1 for u in users if u.threat_score >= 50)
    }

    return jsonify(stats), 200


@users_bp.route('/demo-reset', methods=['POST'])
def demo_reset():
    """
    Скидання демо-режиму: розблокування всіх акаунтів та скидання Threat Score.
    Доступний без аутентифікації для освітніх цілей.

    Returns:
        {
            "message": "Демо скинуто",
            "unblocked_users": [...],
            "reset_scores": int
        }
    """
    users = User.query.filter(User.deleted_at.is_(None)).all()

    unblocked = []
    reset_count = 0

    for user in users:
        # Розблокування
        if user.is_blocked:
            user.is_blocked = False
            user.blocked_at = None
            user.blocked_until = None
            unblocked.append(user.username)

        # Скидання Threat Score
        if user.threat_score > 0:
            user.threat_score = 0
            reset_count += 1

        # Скидання лічильника невдалих входів
        user.failed_login_attempts = 0

    db.session.commit()

    return jsonify({
        'message': 'Демо-режим скинуто! Всі акаунти розблоковано.',
        'unblocked_users': unblocked,
        'reset_scores': reset_count
    }), 200


@users_bp.route('/demo-status', methods=['GET'])
def demo_status():
    """
    Статус демо-режиму (скільки заблоковано, threat scores).
    Доступний без аутентифікації.
    """
    users = User.query.filter(User.deleted_at.is_(None)).all()

    blocked_users = [
        {'username': u.username, 'threat_score': u.threat_score}
        for u in users if u.is_blocked
    ]

    high_threat_users = [
        {'username': u.username, 'threat_score': u.threat_score}
        for u in users if u.threat_score >= 50 and not u.is_blocked
    ]

    return jsonify({
        'total_users': len(users),
        'blocked_count': len(blocked_users),
        'blocked_users': blocked_users,
        'high_threat_users': high_threat_users
    }), 200
