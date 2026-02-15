# -*- coding: utf-8 -*-
"""
Модель події загрози
"""
import uuid
from datetime import datetime
from app import db


class ThreatEvent(db.Model):
    """Модель для зберігання подій безпекових загроз"""

    __tablename__ = 'threat_events'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    timestamp = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=True, index=True)
    threat_type = db.Column(db.String(50), nullable=False, index=True)
    severity = db.Column(db.String(20), nullable=False, index=True)
    score_added = db.Column(db.Integer, nullable=False)
    ip_address = db.Column(db.String(45), nullable=False)
    description = db.Column(db.Text, nullable=False)
    is_resolved = db.Column(db.Boolean, default=False)
    resolved_by = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=True)
    resolution = db.Column(db.String(30), nullable=True)
    resolution_notes = db.Column(db.Text, nullable=True)
    resolved_at = db.Column(db.DateTime, nullable=True)

    # Зв'язок для адміністратора, що вирішив загрозу
    resolver = db.relationship('User', foreign_keys=[resolved_by],
                               backref='resolved_threats')

    # Типи загроз з конфігурацією
    THREAT_TYPES = {
        'BRUTE_FORCE': {
            'description': 'Багаторазові невдалі спроби входу',
            'score': 25,
            'severity': 'high'
        },
        'UNAUTHORIZED_ACCESS': {
            'description': 'Спроба несанкціонованого доступу',
            'score': 10,
            'severity': 'medium'
        },
        'UNUSUAL_TIME_ACCESS': {
            'description': 'Доступ у незвичний час (02:00-05:00)',
            'score': 5,
            'severity': 'low'
        },
        'RAPID_REQUESTS': {
            'description': 'Занадто багато запитів за короткий час',
            'score': 15,
            'severity': 'medium'
        },
        'INTEGRITY_VIOLATION': {
            'description': 'Порушення цілісності файлу',
            'score': 50,
            'severity': 'critical'
        },
        'MASS_DOWNLOAD': {
            'description': 'Масове скачування файлів',
            'score': 20,
            'severity': 'high'
        },
        'FOREIGN_IP_ACCESS': {
            'description': 'Зміна IP-адреси під час сесії',
            'score': 10,
            'severity': 'medium'
        },
        'PRIVILEGE_ESCALATION': {
            'description': 'Спроба підвищення привілеїв',
            'score': 30,
            'severity': 'high'
        },
        'MASS_DELETE': {
            'description': 'Масове видалення файлів',
            'score': 25,
            'severity': 'high'
        }
    }

    # Типи вирішення
    RESOLUTIONS = ('false_positive', 'confirmed', 'mitigated')

    # Валідні рівні серйозності
    VALID_SEVERITIES = ('low', 'medium', 'high', 'critical')

    @classmethod
    def get_threat_config(cls, threat_type: str) -> dict:
        """Отримує конфігурацію для типу загрози"""
        return cls.THREAT_TYPES.get(threat_type, {
            'description': 'Невідома загроза',
            'score': 10,
            'severity': 'medium'
        })

    def to_dict(self, include_user: bool = False) -> dict:
        """Серіалізація події загрози в словник"""
        data = {
            'id': self.id,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'user_id': self.user_id,
            'threat_type': self.threat_type,
            'severity': self.severity,
            'score_added': self.score_added,
            'ip_address': self.ip_address,
            'description': self.description,
            'is_resolved': self.is_resolved,
            'resolution': self.resolution,
            'resolution_notes': self.resolution_notes,
            'resolved_at': self.resolved_at.isoformat() if self.resolved_at else None
        }

        if include_user and self.user:
            data['user'] = {
                'id': self.user.id,
                'username': self.user.username
            }

        if self.resolver:
            data['resolved_by'] = {
                'id': self.resolver.id,
                'username': self.resolver.username
            }

        return data

    def __repr__(self):
        return f'<ThreatEvent {self.threat_type} ({self.severity}) at {self.timestamp}>'
