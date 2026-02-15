# -*- coding: utf-8 -*-
"""
Модель користувача
"""
import uuid
from datetime import datetime
from app import db


class User(db.Model):
    """Модель користувача системи"""

    __tablename__ = 'users'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = db.Column(db.String(50), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='guest')
    is_blocked = db.Column(db.Boolean, default=False)
    blocked_until = db.Column(db.DateTime, nullable=True)
    failed_logins = db.Column(db.Integer, default=0)
    threat_score = db.Column(db.Integer, default=0)
    last_login_at = db.Column(db.DateTime, nullable=True)
    last_login_ip = db.Column(db.String(45), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    deleted_at = db.Column(db.DateTime, nullable=True)

    # Зв'язки
    files = db.relationship('FileMetadata', backref='owner', lazy='dynamic',
                            foreign_keys='FileMetadata.user_id')
    audit_logs = db.relationship('AuditLog', backref='user', lazy='dynamic',
                                  foreign_keys='AuditLog.user_id')
    threat_events = db.relationship('ThreatEvent', backref='user', lazy='dynamic',
                                     foreign_keys='ThreatEvent.user_id')

    # Валідація ролі
    VALID_ROLES = ('admin', 'user', 'guest')

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if self.role not in self.VALID_ROLES:
            self.role = 'guest'

    def is_active(self) -> bool:
        """Перевіряє, чи активний користувач"""
        if self.deleted_at:
            return False
        if self.is_blocked:
            if self.blocked_until and datetime.utcnow() > self.blocked_until:
                # Автоматичне розблокування
                self.is_blocked = False
                self.blocked_until = None
                return True
            return False
        return True

    def can_access(self, action: str) -> bool:
        """Перевіряє, чи має користувач право на дію"""
        permissions = {
            'admin': [
                'upload_file', 'download_own_file', 'download_any_file',
                'delete_own_file', 'delete_any_file', 'view_public_file',
                'verify_integrity', 'view_audit', 'view_threats',
                'manage_users', 'change_roles', 'block_accounts'
            ],
            'user': [
                'upload_file', 'download_own_file', 'delete_own_file',
                'view_public_file', 'verify_integrity'
            ],
            'guest': ['view_public_file']
        }
        return action in permissions.get(self.role, [])

    def to_dict(self, include_sensitive: bool = False) -> dict:
        """Серіалізація користувача в словник"""
        data = {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'role': self.role,
            'is_blocked': self.is_blocked,
            'threat_score': self.threat_score,
            'last_login_at': self.last_login_at.isoformat() if self.last_login_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
        if include_sensitive:
            data['failed_logins'] = self.failed_logins
            data['blocked_until'] = self.blocked_until.isoformat() if self.blocked_until else None
            data['last_login_ip'] = self.last_login_ip
        return data

    def __repr__(self):
        return f'<User {self.username} ({self.role})>'
