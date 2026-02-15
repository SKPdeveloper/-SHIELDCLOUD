# -*- coding: utf-8 -*-
"""
Сервіс аудит-логування
"""
import json
import time
from datetime import datetime, timedelta
from typing import Optional, List, Tuple
from io import StringIO
import csv

import boto3
from botocore.exceptions import ClientError
from flask import current_app, request

from app import db
from app.models import AuditLog, User


class AuditService:
    """Сервіс для запису та отримання аудит-логів"""

    def __init__(self):
        self._cloudwatch_client = None

    @property
    def cloudwatch_client(self):
        """Lazy initialization CloudWatch клієнта"""
        if self._cloudwatch_client is None:
            self._cloudwatch_client = boto3.client(
                'logs',
                endpoint_url=current_app.config['AWS_ENDPOINT_URL'],
                aws_access_key_id=current_app.config['AWS_ACCESS_KEY_ID'],
                aws_secret_access_key=current_app.config['AWS_SECRET_ACCESS_KEY'],
                region_name=current_app.config['AWS_DEFAULT_REGION']
            )
        return self._cloudwatch_client

    def _get_client_ip(self) -> str:
        """Отримує IP-адресу клієнта"""
        if request.headers.get('X-Forwarded-For'):
            return request.headers.get('X-Forwarded-For').split(',')[0].strip()
        return request.remote_addr or '0.0.0.0'

    def _get_user_agent(self) -> str:
        """Отримує User-Agent"""
        return request.headers.get('User-Agent', '')[:500]

    def log(
        self,
        action: str,
        status: str,
        user: Optional[User] = None,
        resource_type: str = None,
        resource_id: str = None,
        details: dict = None
    ) -> AuditLog:
        """
        Записує подію в аудит-лог.

        Args:
            action: Тип дії (LOGIN_SUCCESS, FILE_UPLOADED, etc.)
            status: 'success', 'denied', 'error'
            user: Користувач (опційно)
            resource_type: Тип ресурсу ('file', 'user', 'session')
            resource_id: ID ресурсу
            details: Додаткові дані

        Returns:
            Створений запис AuditLog
        """
        audit_log = AuditLog(
            user_id=user.id if user else None,
            username=user.username if user else None,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            ip_address=self._get_client_ip(),
            user_agent=self._get_user_agent(),
            status=status
        )

        if details:
            audit_log.set_details(details)

        db.session.add(audit_log)
        db.session.commit()

        # Асинхронний запис у CloudWatch
        self._send_to_cloudwatch(audit_log)

        return audit_log

    def _send_to_cloudwatch(self, audit_log: AuditLog):
        """Відправляє лог у CloudWatch"""
        try:
            log_group = current_app.config['CLOUDWATCH_LOG_GROUP']
            log_stream = current_app.config['CLOUDWATCH_LOG_STREAM']

            log_event = {
                'timestamp': int(audit_log.timestamp.timestamp() * 1000),
                'message': json.dumps(audit_log.to_dict(), ensure_ascii=False)
            }

            self.cloudwatch_client.put_log_events(
                logGroupName=log_group,
                logStreamName=log_stream,
                logEvents=[log_event]
            )

        except ClientError as e:
            # Логування помилки, але не переривання роботи
            current_app.logger.warning(f"Не вдалося записати в CloudWatch: {e}")

    def get_logs(
        self,
        page: int = 1,
        per_page: int = 100,
        action: str = None,
        username: str = None,
        status: str = None,
        resource_type: str = None,
        from_date: datetime = None,
        to_date: datetime = None,
        sort_by: str = 'timestamp',
        order: str = 'desc'
    ) -> Tuple[List[AuditLog], int]:
        """
        Отримує аудит-логи з фільтрами та пагінацією.

        Returns:
            (logs, total_count)
        """
        query = AuditLog.query

        # Фільтри
        if action:
            query = query.filter(AuditLog.action == action)
        if username:
            query = query.filter(AuditLog.username.ilike(f'%{username}%'))
        if status:
            query = query.filter(AuditLog.status == status)
        if resource_type:
            query = query.filter(AuditLog.resource_type == resource_type)
        if from_date:
            query = query.filter(AuditLog.timestamp >= from_date)
        if to_date:
            query = query.filter(AuditLog.timestamp <= to_date)

        # Сортування
        sort_column = getattr(AuditLog, sort_by, AuditLog.timestamp)
        if order == 'desc':
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())

        # Пагінація
        total = query.count()
        logs = query.offset((page - 1) * per_page).limit(per_page).all()

        return logs, total

    def export_to_csv(
        self,
        from_date: datetime = None,
        to_date: datetime = None
    ) -> str:
        """
        Експортує логи в CSV формат.

        Returns:
            CSV string
        """
        query = AuditLog.query.order_by(AuditLog.timestamp.desc())

        if from_date:
            query = query.filter(AuditLog.timestamp >= from_date)
        if to_date:
            query = query.filter(AuditLog.timestamp <= to_date)

        logs = query.all()

        output = StringIO()
        writer = csv.writer(output)

        # Заголовки
        writer.writerow([
            'ID', 'Timestamp', 'User ID', 'Username', 'Action',
            'Resource Type', 'Resource ID', 'IP Address',
            'User Agent', 'Status', 'Details'
        ])

        # Дані
        for log in logs:
            writer.writerow([
                log.id,
                log.timestamp.isoformat() if log.timestamp else '',
                log.user_id or '',
                log.username or '',
                log.action,
                log.resource_type or '',
                log.resource_id or '',
                log.ip_address,
                log.user_agent or '',
                log.status,
                json.dumps(log.get_details(), ensure_ascii=False)
            ])

        return output.getvalue()

    def get_activity_stats(self, hours: int = 24) -> dict:
        """
        Отримує статистику активності за останні N годин.
        """
        since = datetime.utcnow() - timedelta(hours=hours)

        logs = AuditLog.query.filter(AuditLog.timestamp >= since).all()

        # Підрахунок за типами дій
        action_counts = {}
        for log in logs:
            action_counts[log.action] = action_counts.get(log.action, 0) + 1

        # Підрахунок за годинами
        hourly_counts = {}
        for log in logs:
            hour = log.timestamp.strftime('%H:00')
            hourly_counts[hour] = hourly_counts.get(hour, 0) + 1

        # Сортування за годинами
        sorted_hours = sorted(hourly_counts.items())

        return {
            'total_events': len(logs),
            'success_events': sum(1 for l in logs if l.status == 'success'),
            'denied_events': sum(1 for l in logs if l.status == 'denied'),
            'error_events': sum(1 for l in logs if l.status == 'error'),
            'by_action': action_counts,
            'by_hour': [{'hour': h, 'count': c} for h, c in sorted_hours]
        }

    def get_recent_events(self, limit: int = 10) -> List[dict]:
        """Отримує останні N подій"""
        logs = AuditLog.query.order_by(
            AuditLog.timestamp.desc()
        ).limit(limit).all()

        return [log.to_dict() for log in logs]
