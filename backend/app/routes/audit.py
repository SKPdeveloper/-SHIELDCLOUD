# -*- coding: utf-8 -*-
"""
API маршрути для аудит-логів
"""
from datetime import datetime
from flask import Blueprint, request, jsonify, Response

from flask_jwt_extended import jwt_required, current_user

from app.services.audit_service import AuditService
from app.middleware.rbac import require_role
from app.utils.helpers import parse_datetime

audit_bp = Blueprint('audit', __name__)


@audit_bp.route('', methods=['GET'])
@jwt_required()
@require_role('admin')
def get_audit_logs():
    """
    Отримання аудит-логів з фільтрами та пагінацією.

    Query params:
        page: int (default 1)
        per_page: int (default 100, max 500)
        action: string (тип дії)
        username: string (пошук за іменем)
        status: 'success' | 'denied' | 'error'
        resource_type: string
        from: datetime ISO string
        to: datetime ISO string

    Returns:
        {
            "logs": [...],
            "pagination": {...}
        }
    """
    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 100, type=int), 500)
    action = request.args.get('action')
    username = request.args.get('username')
    status = request.args.get('status')
    resource_type = request.args.get('resource_type')
    from_date = parse_datetime(request.args.get('from'))
    to_date = parse_datetime(request.args.get('to'))

    audit_service = AuditService()

    logs, total = audit_service.get_logs(
        page=page,
        per_page=per_page,
        action=action,
        username=username,
        status=status,
        resource_type=resource_type,
        from_date=from_date,
        to_date=to_date
    )

    total_pages = (total + per_page - 1) // per_page

    return jsonify({
        'logs': [log.to_dict() for log in logs],
        'pagination': {
            'page': page,
            'per_page': per_page,
            'total': total,
            'total_pages': total_pages,
            'has_next': page < total_pages,
            'has_prev': page > 1
        }
    }), 200


@audit_bp.route('/export', methods=['GET'])
@jwt_required()
@require_role('admin')
def export_audit_logs():
    """
    Експорт аудит-логів у CSV.

    Query params:
        from: datetime ISO string
        to: datetime ISO string

    Returns:
        CSV файл
    """
    from_date = parse_datetime(request.args.get('from'))
    to_date = parse_datetime(request.args.get('to'))

    audit_service = AuditService()
    csv_content = audit_service.export_to_csv(from_date, to_date)

    # Формуємо ім'я файлу
    date_from = from_date.strftime('%Y-%m-%d') if from_date else 'start'
    date_to = to_date.strftime('%Y-%m-%d') if to_date else 'now'
    filename = f'audit_log_{date_from}_{date_to}.csv'

    # Логуємо експорт
    audit_service.log(
        action='AUDIT_EXPORT',
        status='success',
        user=current_user,
        resource_type='audit',
        details={
            'from': date_from,
            'to': date_to
        }
    )

    return Response(
        csv_content,
        mimetype='text/csv',
        headers={
            'Content-Disposition': f'attachment; filename="{filename}"'
        }
    )


@audit_bp.route('/stats', methods=['GET'])
@jwt_required()
@require_role('admin')
def get_activity_stats():
    """
    Отримання статистики активності.

    Query params:
        hours: int (default 24)

    Returns:
        {
            "total_events": int,
            "success_events": int,
            "denied_events": int,
            "error_events": int,
            "by_action": {...},
            "by_hour": [...]
        }
    """
    hours = request.args.get('hours', 24, type=int)
    hours = min(max(1, hours), 168)  # 1-168 годин (тиждень)

    audit_service = AuditService()
    stats = audit_service.get_activity_stats(hours)

    return jsonify(stats), 200


@audit_bp.route('/recent', methods=['GET'])
@jwt_required()
@require_role('admin')
def get_recent_events():
    """
    Отримання останніх подій.

    Query params:
        limit: int (default 10, max 50)

    Returns:
        {
            "events": [...]
        }
    """
    limit = min(request.args.get('limit', 10, type=int), 50)

    audit_service = AuditService()
    events = audit_service.get_recent_events(limit)

    return jsonify({
        'events': events
    }), 200


@audit_bp.route('/actions', methods=['GET'])
@jwt_required()
@require_role('admin')
def get_action_types():
    """
    Отримання списку типів дій для фільтрації.

    Returns:
        {
            "actions": {
                "LOGIN_SUCCESS": "Успішний вхід",
                ...
            }
        }
    """
    from app.models import AuditLog

    return jsonify({
        'actions': AuditLog.ACTIONS
    }), 200
