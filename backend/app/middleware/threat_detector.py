# -*- coding: utf-8 -*-
"""
Middleware для виявлення загроз
"""
import json
from datetime import datetime
from flask import Flask, Request


class ThreatDetectorMiddleware:
    """
    WSGI Middleware для аналізу всіх запитів на підозрілу активність.
    """

    def __init__(self, app, flask_app: Flask):
        self.app = app
        self.flask_app = flask_app

    def __call__(self, environ, start_response):
        """Обробка кожного запиту"""
        # Пропускаємо запит через основний додаток
        # Аналіз відбувається в before_request хуках

        return self.app(environ, start_response)


def setup_threat_detection(app: Flask):
    """
    Налаштовує виявлення загроз через before_request хук.
    Викликається при ініціалізації додатку.
    """
    from flask import request, g
    from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
    from app.services.threat_service import ThreatService

    @app.before_request
    def detect_threats():
        """Аналізує кожен запит на підозрілу активність"""
        # Пропускаємо статичні файли та health-check
        if request.path.startswith('/static') or request.path == '/health':
            return

        # Пропускаємо OPTIONS запити (CORS preflight)
        if request.method == 'OPTIONS':
            return

        ip_address = _get_client_ip()

        # Отримуємо user_id якщо є JWT
        user_id = None
        try:
            verify_jwt_in_request(optional=True)
            user_id = get_jwt_identity()
        except Exception:
            pass

        if user_id:
            threat_service = ThreatService()

            # Відстежуємо запит
            ThreatService.track_request(user_id, ip_address, request.path)

            # Перевіряємо на швидкі запити
            threat = threat_service.check_rapid_requests(user_id, ip_address)
            if threat:
                _log_threat(threat)

            # Перевіряємо на незвичний час
            threat = threat_service.check_unusual_time(user_id, ip_address)
            if threat:
                _log_threat(threat)

        # Зберігаємо IP в g для подальшого використання
        g.client_ip = ip_address

    @app.after_request
    def log_response(response):
        """Логуємо відповідь для аналізу"""
        # Можна додати додаткову логіку тут
        return response


def _get_client_ip() -> str:
    """Отримує IP-адресу клієнта"""
    from flask import request

    if request.headers.get('X-Forwarded-For'):
        return request.headers.get('X-Forwarded-For').split(',')[0].strip()
    return request.remote_addr or '0.0.0.0'


def _log_threat(threat):
    """Логує виявлену загрозу"""
    from flask import current_app

    current_app.logger.warning(
        f"THREAT DETECTED: {threat.threat_type} | "
        f"Severity: {threat.severity} | "
        f"User: {threat.user_id} | "
        f"IP: {threat.ip_address} | "
        f"Description: {threat.description}"
    )
