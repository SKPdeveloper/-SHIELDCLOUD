# -*- coding: utf-8 -*-
"""
Middleware для контролю доступу на основі ролей (RBAC)
"""
from functools import wraps
from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt, current_user


def require_role(*allowed_roles):
    """
    Декоратор для перевірки ролі користувача.

    Використання:
        @require_role('admin')
        def admin_only_route():
            ...

        @require_role('admin', 'user')
        def admin_or_user_route():
            ...
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            # Перевіряємо JWT
            verify_jwt_in_request()

            # Отримуємо дані з токена
            claims = get_jwt()
            user_role = claims.get('role', 'guest')

            # Перевіряємо роль
            if user_role not in allowed_roles:
                return jsonify({
                    'error': 'Доступ заборонено',
                    'message': f'Ця дія потребує одну з ролей: {", ".join(allowed_roles)}'
                }), 403

            # Перевіряємо, чи користувач активний
            if current_user and not current_user.is_active():
                return jsonify({
                    'error': 'Акаунт деактивовано',
                    'message': 'Ваш акаунт заблоковано або видалено'
                }), 403

            return fn(*args, **kwargs)

        return wrapper
    return decorator


def require_any_role(*allowed_roles):
    """
    Аліас для require_role для кращої читабельності.
    """
    return require_role(*allowed_roles)


def check_permission(user, action: str) -> bool:
    """
    Перевіряє, чи має користувач дозвіл на певну дію.

    Args:
        user: Об'єкт користувача
        action: Назва дії

    Returns:
        True якщо дозволено, False якщо ні
    """
    if user is None:
        return False

    if not user.is_active():
        return False

    return user.can_access(action)


class RBACChecker:
    """Клас для перевірки прав доступу"""

    # Матриця прав доступу
    PERMISSIONS = {
        'admin': {
            'files': ['create', 'read', 'read_all', 'update', 'delete', 'delete_all'],
            'users': ['read', 'create', 'update', 'delete', 'change_role', 'block'],
            'audit': ['read', 'export'],
            'threats': ['read', 'resolve'],
            'integrity': ['check', 'check_all']
        },
        'user': {
            'files': ['create', 'read', 'update', 'delete'],
            'users': [],
            'audit': [],
            'threats': [],
            'integrity': ['check']
        },
        'guest': {
            'files': ['read'],  # Тільки публічні
            'users': [],
            'audit': [],
            'threats': [],
            'integrity': []
        }
    }

    @classmethod
    def can(cls, role: str, resource: str, action: str) -> bool:
        """
        Перевіряє, чи може роль виконати дію над ресурсом.

        Args:
            role: Роль користувача
            resource: Тип ресурсу ('files', 'users', 'audit', 'threats')
            action: Дія ('create', 'read', 'update', 'delete', etc.)

        Returns:
            True якщо дозволено
        """
        role_permissions = cls.PERMISSIONS.get(role, {})
        resource_permissions = role_permissions.get(resource, [])
        return action in resource_permissions

    @classmethod
    def get_allowed_actions(cls, role: str, resource: str) -> list:
        """
        Повертає список дозволених дій для ролі над ресурсом.
        """
        role_permissions = cls.PERMISSIONS.get(role, {})
        return role_permissions.get(resource, [])

    @classmethod
    def get_permission_matrix(cls) -> dict:
        """
        Повертає повну матрицю прав для відображення на UI.
        """
        resources = ['files', 'users', 'audit', 'threats', 'integrity']
        roles = ['admin', 'user', 'guest']

        matrix = {}
        for resource in resources:
            matrix[resource] = {}
            all_actions = set()
            for role in roles:
                actions = cls.get_allowed_actions(role, resource)
                all_actions.update(actions)

            for action in all_actions:
                matrix[resource][action] = {
                    role: cls.can(role, resource, action)
                    for role in roles
                }

        return matrix
