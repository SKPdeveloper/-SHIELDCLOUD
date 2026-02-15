# -*- coding: utf-8 -*-
"""
Сервіс автентифікації та авторизації
"""
import re
from datetime import datetime, timedelta
from typing import Optional, Tuple

import bcrypt
from flask import current_app
from flask_jwt_extended import create_access_token, create_refresh_token

from app import db
from app.models import User


class AuthService:
    """Сервіс для роботи з автентифікацією та авторизацією"""

    def hash_password(self, password: str) -> str:
        """Хешує пароль за допомогою bcrypt"""
        salt = bcrypt.gensalt(rounds=current_app.config.get('BCRYPT_SALT_ROUNDS', 12))
        return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

    def verify_password(self, password: str, password_hash: str) -> bool:
        """Перевіряє пароль"""
        try:
            return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))
        except Exception:
            return False

    def validate_password(self, password: str) -> Tuple[bool, Optional[str]]:
        """
        Перевіряє відповідність пароля вимогам безпеки.
        Повертає (True, None) або (False, повідомлення_помилки)
        """
        if len(password) < 8:
            return False, "Пароль має містити щонайменше 8 символів"
        if not re.search(r'[A-Z]', password):
            return False, "Пароль має містити хоча б одну велику літеру"
        if not re.search(r'[a-z]', password):
            return False, "Пароль має містити хоча б одну малу літеру"
        if not re.search(r'\d', password):
            return False, "Пароль має містити хоча б одну цифру"
        return True, None

    def validate_email(self, email: str) -> bool:
        """Перевіряє формат email"""
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return bool(re.match(pattern, email))

    def register_user(self, username: str, email: str, password: str) -> Tuple[Optional[User], Optional[str]]:
        """
        Реєструє нового користувача.
        Повертає (user, None) або (None, повідомлення_помилки)
        """
        # Валідація
        if len(username) < 3:
            return None, "Ім'я користувача має містити щонайменше 3 символи"

        if not self.validate_email(email):
            return None, "Невірний формат email"

        valid, error = self.validate_password(password)
        if not valid:
            return None, error

        # Перевірка унікальності
        if User.query.filter_by(username=username).first():
            return None, "Це ім'я користувача вже зайняте"

        if User.query.filter_by(email=email).first():
            return None, "Цей email вже зареєстровано"

        # Створення користувача
        user = User(
            username=username,
            email=email,
            password_hash=self.hash_password(password),
            role='guest'  # За замовчуванням guest
        )

        db.session.add(user)
        db.session.commit()

        return user, None

    def authenticate(self, username: str, password: str, ip_address: str) -> Tuple[Optional[User], Optional[str]]:
        """
        Автентифікує користувача.
        Повертає (user, None) або (None, повідомлення_помилки)
        """
        user = User.query.filter_by(username=username, deleted_at=None).first()

        if not user:
            return None, "Невірне ім'я користувача або пароль"

        # Перевірка блокування
        if user.is_blocked:
            if user.blocked_until and datetime.utcnow() > user.blocked_until:
                # Розблокування
                user.is_blocked = False
                user.blocked_until = None
                user.failed_logins = 0
                db.session.commit()
            else:
                remaining = ""
                if user.blocked_until:
                    delta = user.blocked_until - datetime.utcnow()
                    remaining = f" Спробуйте через {delta.seconds // 60} хвилин."
                return None, f"Акаунт тимчасово заблоковано.{remaining}"

        # Перевірка пароля
        if not self.verify_password(password, user.password_hash):
            user.failed_logins += 1
            max_attempts = current_app.config.get('MAX_FAILED_LOGIN_ATTEMPTS', 5)

            if user.failed_logins >= max_attempts:
                lock_duration = current_app.config.get('ACCOUNT_LOCK_DURATION_MINUTES', 30)
                user.is_blocked = True
                user.blocked_until = datetime.utcnow() + timedelta(minutes=lock_duration)
                db.session.commit()
                return None, f"Акаунт заблоковано на {lock_duration} хвилин через занадто багато невдалих спроб"

            db.session.commit()
            return None, "Невірне ім'я користувача або пароль"

        # Успішна автентифікація
        user.failed_logins = 0
        user.last_login_at = datetime.utcnow()
        user.last_login_ip = ip_address
        db.session.commit()

        return user, None

    def generate_tokens(self, user: User) -> dict:
        """Генерує JWT токени для користувача"""
        additional_claims = {
            'role': user.role,
            'username': user.username
        }

        access_token = create_access_token(
            identity=user,
            additional_claims=additional_claims
        )
        refresh_token = create_refresh_token(
            identity=user,
            additional_claims=additional_claims
        )

        return {
            'access_token': access_token,
            'refresh_token': refresh_token
        }

    def refresh_access_token(self, user: User) -> str:
        """Генерує новий access token"""
        additional_claims = {
            'role': user.role,
            'username': user.username
        }
        return create_access_token(
            identity=user,
            additional_claims=additional_claims
        )

    def change_user_role(self, user: User, new_role: str, changed_by: User) -> Tuple[bool, Optional[str]]:
        """Змінює роль користувача"""
        if new_role not in User.VALID_ROLES:
            return False, f"Невірна роль. Допустимі: {', '.join(User.VALID_ROLES)}"

        if user.id == changed_by.id:
            return False, "Не можна змінити власну роль"

        old_role = user.role
        user.role = new_role
        db.session.commit()

        return True, None

    def block_user(self, user: User, duration_minutes: int = None) -> bool:
        """Блокує користувача"""
        user.is_blocked = True
        if duration_minutes:
            user.blocked_until = datetime.utcnow() + timedelta(minutes=duration_minutes)
        else:
            user.blocked_until = None  # Безстрокове блокування
        db.session.commit()
        return True

    def unblock_user(self, user: User) -> bool:
        """Розблоковує користувача"""
        user.is_blocked = False
        user.blocked_until = None
        user.failed_logins = 0
        db.session.commit()
        return True
