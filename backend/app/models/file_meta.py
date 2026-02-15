# -*- coding: utf-8 -*-
"""
Модель метаданих файлу
"""
import uuid
from datetime import datetime
from app import db


class FileMetadata(db.Model):
    """Модель для зберігання метаданих зашифрованих файлів"""

    __tablename__ = 'file_metadata'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False, index=True)
    original_name = db.Column(db.String(255), nullable=False)
    s3_key = db.Column(db.String(500), nullable=False, unique=True)
    s3_version_id = db.Column(db.String(100), nullable=True)
    encrypted_data_key = db.Column(db.Text, nullable=False)  # base64-encoded
    client_iv = db.Column(db.String(100), nullable=False)  # base64-encoded
    sha256_hash = db.Column(db.String(64), nullable=False)
    file_size = db.Column(db.BigInteger, nullable=False)
    is_public = db.Column(db.Boolean, default=False)
    integrity_status = db.Column(db.String(20), default='unchecked')
    last_verified_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = db.Column(db.DateTime, nullable=True)

    # Валідація статусу цілісності
    VALID_INTEGRITY_STATUSES = ('unchecked', 'verified', 'compromised')

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if self.integrity_status not in self.VALID_INTEGRITY_STATUSES:
            self.integrity_status = 'unchecked'

    def is_accessible_by(self, user) -> bool:
        """Перевіряє, чи має користувач доступ до файлу"""
        if user is None:
            return self.is_public
        if user.role == 'admin':
            return True
        if self.user_id == user.id:
            return True
        if self.is_public:
            return True
        return False

    def can_delete(self, user) -> bool:
        """Перевіряє, чи може користувач видалити файл"""
        if user is None:
            return False
        if user.role == 'admin':
            return True
        return self.user_id == user.id

    def to_dict(self, include_owner: bool = False) -> dict:
        """Серіалізація файлу в словник"""
        data = {
            'id': self.id,
            'original_name': self.original_name,
            'file_size': self.file_size,
            'sha256_hash': self.sha256_hash,
            'is_public': self.is_public,
            'integrity_status': self.integrity_status,
            'last_verified_at': self.last_verified_at.isoformat() if self.last_verified_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            's3_version_id': self.s3_version_id
        }
        if include_owner and self.owner:
            data['owner'] = {
                'id': self.owner.id,
                'username': self.owner.username
            }
        return data

    def __repr__(self):
        return f'<FileMetadata {self.original_name} ({self.id})>'
