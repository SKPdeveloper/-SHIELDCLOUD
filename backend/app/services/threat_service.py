# -*- coding: utf-8 -*-
"""
Сервіс моніторингу та аналізу загроз
"""
from datetime import datetime, timedelta
from typing import Optional, List, Tuple, Dict
from collections import defaultdict
import threading
import time

from flask import current_app

from app import db
from app.models import ThreatEvent, User


class ThreatService:
    """Сервіс для виявлення та реагування на загрози"""

    # Зберігання даних про активність користувачів в пам'яті
    # В реальному проекті використовувався б Redis
    _activity_tracker: Dict[str, Dict] = defaultdict(lambda: {
        'requests': [],
        'failed_logins': [],
        'downloads': [],
        'deletes': [],
        'last_ip': None
    })
    _lock = threading.Lock()

    @classmethod
    def track_request(cls, user_id: str, ip_address: str, endpoint: str):
        """Відстежує запит користувача"""
        with cls._lock:
            now = datetime.utcnow()
            tracker = cls._activity_tracker[user_id]

            # Очищення старих записів (старше 10 хвилин)
            cutoff = now - timedelta(minutes=10)
            tracker['requests'] = [t for t in tracker['requests'] if t > cutoff]
            tracker['failed_logins'] = [t for t in tracker['failed_logins'] if t > cutoff]

            cutoff_5min = now - timedelta(minutes=5)
            tracker['downloads'] = [t for t in tracker['downloads'] if t > cutoff_5min]
            tracker['deletes'] = [t for t in tracker['deletes'] if t > cutoff_5min]

            # Додаємо новий запит
            tracker['requests'].append(now)

            # Перевірка зміни IP
            if tracker['last_ip'] and tracker['last_ip'] != ip_address:
                cls._check_ip_change(user_id, tracker['last_ip'], ip_address)

            tracker['last_ip'] = ip_address

    @classmethod
    def track_failed_login(cls, user_id: str, ip_address: str):
        """Відстежує невдалу спробу входу"""
        with cls._lock:
            tracker = cls._activity_tracker[user_id]
            tracker['failed_logins'].append(datetime.utcnow())

    @classmethod
    def track_download(cls, user_id: str):
        """Відстежує скачування файлу"""
        with cls._lock:
            tracker = cls._activity_tracker[user_id]
            tracker['downloads'].append(datetime.utcnow())

    @classmethod
    def track_delete(cls, user_id: str):
        """Відстежує видалення файлу"""
        with cls._lock:
            tracker = cls._activity_tracker[user_id]
            tracker['deletes'].append(datetime.utcnow())

    @classmethod
    def _check_ip_change(cls, user_id: str, old_ip: str, new_ip: str):
        """Перевіряє зміну IP (внутрішній метод)"""
        # Створення події загрози буде викликано зовні
        pass

    def __init__(self):
        self.threat_configs = ThreatEvent.THREAT_TYPES

    def check_brute_force(self, user_id: str, ip_address: str) -> Optional[ThreatEvent]:
        """Перевіряє на brute force атаку"""
        with self._lock:
            tracker = self._activity_tracker.get(user_id, {})
            failed_logins = tracker.get('failed_logins', [])

            if len(failed_logins) >= 5:
                return self.create_threat_event(
                    user_id=user_id,
                    threat_type='BRUTE_FORCE',
                    ip_address=ip_address,
                    description=f"Виявлено {len(failed_logins)} невдалих спроб входу за останні 10 хвилин"
                )
        return None

    def check_rapid_requests(self, user_id: str, ip_address: str) -> Optional[ThreatEvent]:
        """Перевіряє на занадто багато запитів"""
        with self._lock:
            tracker = self._activity_tracker.get(user_id, {})
            requests = tracker.get('requests', [])

            # Перевірка запитів за останню хвилину
            one_minute_ago = datetime.utcnow() - timedelta(minutes=1)
            recent_requests = [r for r in requests if r > one_minute_ago]

            if len(recent_requests) > 100:
                return self.create_threat_event(
                    user_id=user_id,
                    threat_type='RAPID_REQUESTS',
                    ip_address=ip_address,
                    description=f"Виявлено {len(recent_requests)} запитів за останню хвилину"
                )
        return None

    def check_mass_download(self, user_id: str, ip_address: str) -> Optional[ThreatEvent]:
        """Перевіряє на масове скачування"""
        with self._lock:
            tracker = self._activity_tracker.get(user_id, {})
            downloads = tracker.get('downloads', [])

            if len(downloads) > 20:
                return self.create_threat_event(
                    user_id=user_id,
                    threat_type='MASS_DOWNLOAD',
                    ip_address=ip_address,
                    description=f"Виявлено {len(downloads)} скачувань за останні 5 хвилин"
                )
        return None

    def check_mass_delete(self, user_id: str, ip_address: str) -> Optional[ThreatEvent]:
        """Перевіряє на масове видалення"""
        with self._lock:
            tracker = self._activity_tracker.get(user_id, {})
            deletes = tracker.get('deletes', [])

            if len(deletes) > 10:
                return self.create_threat_event(
                    user_id=user_id,
                    threat_type='MASS_DELETE',
                    ip_address=ip_address,
                    description=f"Виявлено {len(deletes)} видалень за останні 5 хвилин"
                )
        return None

    def check_unusual_time(self, user_id: str, ip_address: str) -> Optional[ThreatEvent]:
        """Перевіряє на доступ у незвичний час (02:00-05:00)"""
        current_hour = datetime.utcnow().hour

        if 2 <= current_hour < 5:
            # Перевіряємо, чи вже є така загроза за останню годину
            recent_threat = ThreatEvent.query.filter(
                ThreatEvent.user_id == user_id,
                ThreatEvent.threat_type == 'UNUSUAL_TIME_ACCESS',
                ThreatEvent.timestamp > datetime.utcnow() - timedelta(hours=1)
            ).first()

            if not recent_threat:
                return self.create_threat_event(
                    user_id=user_id,
                    threat_type='UNUSUAL_TIME_ACCESS',
                    ip_address=ip_address,
                    description=f"Доступ до системи о {current_hour}:00 UTC"
                )
        return None

    def check_ip_change(self, user_id: str, old_ip: str, new_ip: str) -> Optional[ThreatEvent]:
        """Перевіряє зміну IP під час сесії"""
        return self.create_threat_event(
            user_id=user_id,
            threat_type='FOREIGN_IP_ACCESS',
            ip_address=new_ip,
            description=f"Зміна IP-адреси з {old_ip} на {new_ip} під час активної сесії"
        )

    def create_threat_event(
        self,
        threat_type: str,
        ip_address: str,
        description: str,
        user_id: str = None
    ) -> ThreatEvent:
        """Створює подію загрози"""
        config = ThreatEvent.get_threat_config(threat_type)

        threat_event = ThreatEvent(
            user_id=user_id,
            threat_type=threat_type,
            severity=config['severity'],
            score_added=config['score'],
            ip_address=ip_address,
            description=description
        )

        db.session.add(threat_event)

        # Оновлення threat_score користувача
        if user_id:
            user = User.query.get(user_id)
            if user:
                user.threat_score += config['score']
                self._check_score_thresholds(user)

        db.session.commit()

        return threat_event

    def _check_score_thresholds(self, user: User):
        """Перевіряє пороги threat_score та вживає заходів"""
        config = current_app.config

        if user.threat_score >= config.get('THREAT_SCORE_BLOCK_THRESHOLD', 100):
            # Автоматичне блокування
            user.is_blocked = True
            current_app.logger.warning(
                f"Користувача {user.username} автоматично заблоковано (threat_score: {user.threat_score})"
            )
        elif user.threat_score >= config.get('THREAT_SCORE_WARNING_THRESHOLD', 50):
            current_app.logger.warning(
                f"Підозріла активність користувача {user.username} (threat_score: {user.threat_score})"
            )

    def create_integrity_violation(
        self,
        user_id: str,
        ip_address: str,
        file_id: str,
        file_name: str
    ) -> ThreatEvent:
        """Створює подію порушення цілісності"""
        return self.create_threat_event(
            user_id=user_id,
            threat_type='INTEGRITY_VIOLATION',
            ip_address=ip_address,
            description=f"Порушення цілісності файлу '{file_name}' (ID: {file_id})"
        )

    def create_unauthorized_access(
        self,
        user_id: str,
        ip_address: str,
        resource: str
    ) -> ThreatEvent:
        """Створює подію несанкціонованого доступу"""
        return self.create_threat_event(
            user_id=user_id,
            threat_type='UNAUTHORIZED_ACCESS',
            ip_address=ip_address,
            description=f"Спроба несанкціонованого доступу до {resource}"
        )

    def create_privilege_escalation(
        self,
        user_id: str,
        ip_address: str,
        attempted_action: str
    ) -> ThreatEvent:
        """Створює подію спроби підвищення привілеїв"""
        return self.create_threat_event(
            user_id=user_id,
            threat_type='PRIVILEGE_ESCALATION',
            ip_address=ip_address,
            description=f"Спроба підвищення привілеїв: {attempted_action}"
        )

    def resolve_threat(
        self,
        threat_id: str,
        resolver: User,
        resolution: str,
        notes: str = None
    ) -> Tuple[bool, Optional[str]]:
        """Позначає загрозу як вирішену"""
        if resolution not in ThreatEvent.RESOLUTIONS:
            return False, f"Невірний тип вирішення. Допустимі: {', '.join(ThreatEvent.RESOLUTIONS)}"

        threat = ThreatEvent.query.get(threat_id)
        if not threat:
            return False, "Загрозу не знайдено"

        threat.is_resolved = True
        threat.resolved_by = resolver.id
        threat.resolution = resolution
        threat.resolution_notes = notes
        threat.resolved_at = datetime.utcnow()

        db.session.commit()

        return True, None

    def get_threats(
        self,
        page: int = 1,
        per_page: int = 50,
        severity: str = None,
        threat_type: str = None,
        user_id: str = None,
        is_resolved: bool = None,
        from_date: datetime = None,
        to_date: datetime = None
    ) -> Tuple[List[ThreatEvent], int]:
        """Отримує список загроз з фільтрами"""
        query = ThreatEvent.query

        if severity:
            query = query.filter(ThreatEvent.severity == severity)
        if threat_type:
            query = query.filter(ThreatEvent.threat_type == threat_type)
        if user_id:
            query = query.filter(ThreatEvent.user_id == user_id)
        if is_resolved is not None:
            query = query.filter(ThreatEvent.is_resolved == is_resolved)
        if from_date:
            query = query.filter(ThreatEvent.timestamp >= from_date)
        if to_date:
            query = query.filter(ThreatEvent.timestamp <= to_date)

        query = query.order_by(ThreatEvent.timestamp.desc())

        total = query.count()
        threats = query.offset((page - 1) * per_page).limit(per_page).all()

        return threats, total

    def get_stats(self, hours: int = 24) -> dict:
        """Отримує статистику загроз"""
        since = datetime.utcnow() - timedelta(hours=hours)

        threats = ThreatEvent.query.filter(ThreatEvent.timestamp >= since).all()

        # Підрахунок за типами
        by_type = defaultdict(int)
        for t in threats:
            by_type[t.threat_type] += 1

        # Підрахунок за годинами
        by_hour = defaultdict(int)
        for t in threats:
            hour = t.timestamp.strftime('%H:00')
            by_hour[hour] += 1

        # Топ користувачів за threat_score
        top_users = User.query.filter(
            User.threat_score > 0,
            User.deleted_at.is_(None)
        ).order_by(User.threat_score.desc()).limit(5).all()

        # Заблоковані акаунти
        blocked_count = User.query.filter(
            User.is_blocked == True,
            User.deleted_at.is_(None)
        ).count()

        return {
            'total_events_24h': len(threats),
            'critical_events_24h': sum(1 for t in threats if t.severity == 'critical'),
            'high_events_24h': sum(1 for t in threats if t.severity == 'high'),
            'blocked_accounts': blocked_count,
            'threat_by_type': dict(by_type),
            'threat_by_hour': [{'hour': h, 'count': c} for h, c in sorted(by_hour.items())],
            'top_threat_users': [
                {
                    'id': u.id,
                    'username': u.username,
                    'score': u.threat_score,
                    'events': ThreatEvent.query.filter(
                        ThreatEvent.user_id == u.id,
                        ThreatEvent.timestamp >= since
                    ).count()
                }
                for u in top_users
            ]
        }

    def decay_threat_scores(self):
        """
        Зменшує threat_score всіх користувачів.
        Викликається періодично (кожні 10 хвилин).
        """
        decay_amount = current_app.config.get('THREAT_SCORE_DECAY_AMOUNT', 1)

        users = User.query.filter(
            User.threat_score > 0,
            User.deleted_at.is_(None)
        ).all()

        for user in users:
            user.threat_score = max(0, user.threat_score - decay_amount)

        db.session.commit()
