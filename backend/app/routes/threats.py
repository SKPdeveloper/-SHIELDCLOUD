# -*- coding: utf-8 -*-
"""
API маршрути для моніторингу загроз
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, current_user

from app.models import ThreatEvent
from app.services.threat_service import ThreatService
from app.services.audit_service import AuditService
from app.middleware.rbac import require_role
from app.utils.helpers import parse_datetime

threats_bp = Blueprint('threats', __name__)


@threats_bp.route('', methods=['GET'])
@jwt_required()
@require_role('admin')
def get_threats():
    """
    Отримання списку загроз з фільтрами.

    Query params:
        page: int (default 1)
        per_page: int (default 50, max 200)
        severity: 'low' | 'medium' | 'high' | 'critical'
        threat_type: string
        user_id: string
        is_resolved: bool
        from: datetime ISO string
        to: datetime ISO string

    Returns:
        {
            "threats": [...],
            "pagination": {...}
        }
    """
    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 50, type=int), 200)
    severity = request.args.get('severity')
    threat_type = request.args.get('threat_type')
    user_id = request.args.get('user_id')
    is_resolved = request.args.get('is_resolved')
    from_date = parse_datetime(request.args.get('from'))
    to_date = parse_datetime(request.args.get('to'))

    # Перетворення is_resolved
    if is_resolved is not None:
        is_resolved = is_resolved.lower() == 'true'

    threat_service = ThreatService()

    threats, total = threat_service.get_threats(
        page=page,
        per_page=per_page,
        severity=severity,
        threat_type=threat_type,
        user_id=user_id,
        is_resolved=is_resolved,
        from_date=from_date,
        to_date=to_date
    )

    total_pages = (total + per_page - 1) // per_page

    return jsonify({
        'threats': [t.to_dict(include_user=True) for t in threats],
        'pagination': {
            'page': page,
            'per_page': per_page,
            'total': total,
            'total_pages': total_pages,
            'has_next': page < total_pages,
            'has_prev': page > 1
        }
    }), 200


@threats_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_threat_stats():
    """
    Отримання статистики загроз.

    Query params:
        hours: int (default 24)

    Returns:
        {
            "total_events_24h": int,
            "critical_events_24h": int,
            "blocked_accounts": int,
            "threat_by_type": {...},
            "threat_by_hour": [...],
            "top_threat_users": [...]
        }
    """
    hours = request.args.get('hours', 24, type=int)
    hours = min(max(1, hours), 168)

    threat_service = ThreatService()
    stats = threat_service.get_stats(hours)

    return jsonify(stats), 200


@threats_bp.route('/<threat_id>/resolve', methods=['POST'])
@jwt_required()
@require_role('admin')
def resolve_threat(threat_id):
    """
    Вирішення загрози.

    Body:
        {
            "resolution": "false_positive" | "confirmed" | "mitigated",
            "notes": "string" (optional)
        }

    Returns:
        {
            "threat": {...}
        }
    """
    data = request.get_json()

    if not data or 'resolution' not in data:
        return jsonify({'error': 'Вкажіть resolution'}), 400

    resolution = data['resolution']
    notes = data.get('notes', '')

    threat_service = ThreatService()
    audit_service = AuditService()

    success, error = threat_service.resolve_threat(
        threat_id=threat_id,
        resolver=current_user,
        resolution=resolution,
        notes=notes
    )

    if not success:
        return jsonify({'error': error}), 400

    # Отримуємо оновлену загрозу
    threat = ThreatEvent.query.get(threat_id)

    audit_service.log(
        action='THREAT_RESOLVED',
        status='success',
        user=current_user,
        resource_type='threat',
        resource_id=threat_id,
        details={
            'threat_type': threat.threat_type,
            'resolution': resolution,
            'notes': notes
        }
    )

    return jsonify({
        'threat': threat.to_dict(include_user=True)
    }), 200


@threats_bp.route('/types', methods=['GET'])
@jwt_required()
@require_role('admin')
def get_threat_types():
    """
    Отримання списку типів загроз.

    Returns:
        {
            "types": {
                "BRUTE_FORCE": {
                    "description": "...",
                    "score": 25,
                    "severity": "high"
                },
                ...
            }
        }
    """
    return jsonify({
        'types': ThreatEvent.THREAT_TYPES
    }), 200


@threats_bp.route('/severities', methods=['GET'])
@jwt_required()
@require_role('admin')
def get_severities():
    """
    Отримання списку рівнів серйозності.

    Returns:
        {
            "severities": ["low", "medium", "high", "critical"]
        }
    """
    return jsonify({
        'severities': list(ThreatEvent.VALID_SEVERITIES)
    }), 200


@threats_bp.route('/resolutions', methods=['GET'])
@jwt_required()
@require_role('admin')
def get_resolutions():
    """
    Отримання списку типів вирішення.

    Returns:
        {
            "resolutions": ["false_positive", "confirmed", "mitigated"]
        }
    """
    return jsonify({
        'resolutions': list(ThreatEvent.RESOLUTIONS)
    }), 200
