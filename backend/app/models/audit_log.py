# -*- coding: utf-8 -*-
"""
Модель аудит-логу
"""
import uuid
import json
from datetime import datetime
from app import db


class AuditLog(db.Model):
    """Модель для зберігання аудит-записів системи"""

    __tablename__ = 'audit_logs'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    timestamp = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=True, index=True)
    username = db.Column(db.String(50), nullable=True)
    action = db.Column(db.String(50), nullable=False, index=True)
    resource_type = db.Column(db.String(30), nullable=True)
    resource_id = db.Column(db.String(100), nullable=True)
    ip_address = db.Column(db.String(45), nullable=False)
    user_agent = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), nullable=False)
    details = db.Column(db.Text, nullable=True)  # JSON string

    # Типи дій
    ACTIONS = {
        # Автентифікація
        'LOGIN_SUCCESS': 'Успішний вхід',
        'LOGIN_FAILED': 'Невдала спроба входу',
        'LOGOUT': 'Вихід із системи',
        'TOKEN_REFRESH': 'Оновлення токена',
        'ACCOUNT_LOCKED': 'Акаунт заблоковано',
        'ACCOUNT_UNLOCKED': 'Акаунт розблоковано',
        'USER_REGISTERED': 'Реєстрація користувача',

        # Файли
        'FILE_UPLOADED': 'Завантаження файлу',
        'FILE_DOWNLOADED': 'Скачування файлу',
        'FILE_DELETED': 'Видалення файлу',
        'FILE_VISIBILITY_CHANGED': 'Зміна видимості файлу',

        # Цілісність
        'INTEGRITY_CHECK': 'Перевірка цілісності',
        'BULK_INTEGRITY_CHECK': 'Масова перевірка цілісності',

        # Користувачі
        'USER_ROLE_CHANGED': 'Зміна ролі користувача',
        'USER_BLOCKED': 'Блокування користувача',
        'USER_UNBLOCKED': 'Розблокування користувача',
        'USER_DELETED': 'Видалення користувача',

        # Безпека
        'THREAT_DETECTED': 'Виявлено загрозу',
        'THREAT_RESOLVED': 'Загрозу вирішено',
        'RATE_LIMITED': 'Обмеження запитів'
    }

    # Статуси
    VALID_STATUSES = ('success', 'denied', 'error')

    def set_details(self, details_dict: dict):
        """Зберігає деталі як JSON"""
        self.details = json.dumps(details_dict, ensure_ascii=False)

    def get_details(self) -> dict:
        """Отримує деталі з JSON"""
        if self.details:
            try:
                return json.loads(self.details)
            except json.JSONDecodeError:
                return {}
        return {}

    def to_dict(self) -> dict:
        """Серіалізація аудит-запису в словник"""
        return {
            'id': self.id,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'user_id': self.user_id,
            'username': self.username,
            'action': self.action,
            'action_description': self.ACTIONS.get(self.action, self.action),
            'resource_type': self.resource_type,
            'resource_id': self.resource_id,
            'ip_address': self.ip_address,
            'user_agent': self.user_agent,
            'status': self.status,
            'details': self.get_details()
        }

    def __repr__(self):
        return f'<AuditLog {self.action} by {self.username} at {self.timestamp}>'
