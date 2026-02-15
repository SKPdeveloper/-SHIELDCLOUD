# -*- coding: utf-8 -*-
"""
API маршрути для роботи з файлами
"""
import base64
from flask import Blueprint, request, jsonify, send_file, Response
from flask_jwt_extended import jwt_required, current_user
from io import BytesIO

from app.models import FileMetadata
from app.services.storage_service import StorageService
from app.services.integrity_service import IntegrityService
from app.services.audit_service import AuditService
from app.services.threat_service import ThreatService
from app.middleware.rbac import require_role
from app.utils.helpers import get_client_ip, sanitize_filename

files_bp = Blueprint('files', __name__)


@files_bp.route('', methods=['GET'])
@jwt_required()
def list_files():
    """
    Отримання списку файлів.

    Query params:
        page: int (default 1)
        per_page: int (default 20, max 100)
        sort: string (default 'created_at')
        order: 'asc' | 'desc' (default 'desc')
        search: string (пошук за назвою)

    Returns:
        {
            "files": [...],
            "pagination": {
                "page": 1,
                "per_page": 20,
                "total": 100,
                "total_pages": 5
            }
        }
    """
    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 20, type=int), 100)
    sort_by = request.args.get('sort', 'created_at')
    order = request.args.get('order', 'desc')
    search = request.args.get('search', None)

    storage_service = StorageService()
    files, total = storage_service.get_file_list(
        user=current_user,
        page=page,
        per_page=per_page,
        sort_by=sort_by,
        order=order,
        search=search
    )

    total_pages = (total + per_page - 1) // per_page

    return jsonify({
        'files': [f.to_dict(include_owner=True) for f in files],
        'pagination': {
            'page': page,
            'per_page': per_page,
            'total': total,
            'total_pages': total_pages,
            'has_next': page < total_pages,
            'has_prev': page > 1
        }
    }), 200


@files_bp.route('/upload', methods=['POST'])
@jwt_required()
@require_role('admin', 'user')
def upload_file():
    """
    Завантаження файлу.

    Content-Type: multipart/form-data

    Fields:
        file: бінарний файл (вже зашифрований клієнтом)
        client_iv: string (base64)
        original_name: string
        is_public: bool (optional, default false)

    Returns:
        {
            "file": {...}
        }
    """
    # Перевірка наявності файлу
    if 'file' not in request.files:
        return jsonify({'error': 'Файл не надано'}), 400

    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'Порожнє ім\'я файлу'}), 400

    # Отримуємо параметри
    client_iv = request.form.get('client_iv')
    original_name = request.form.get('original_name', file.filename)
    is_public = request.form.get('is_public', 'false').lower() == 'true'

    if not client_iv:
        return jsonify({'error': 'Відсутній client_iv'}), 400

    # Санітизація імені файлу
    original_name = sanitize_filename(original_name)

    # Читаємо вміст файлу
    file_content = file.read()

    # Перевірка розміру
    max_size = 50 * 1024 * 1024  # 50 MB
    if len(file_content) > max_size:
        return jsonify({'error': 'Файл занадто великий (максимум 50 MB)'}), 413

    storage_service = StorageService()
    audit_service = AuditService()

    file_meta, error = storage_service.upload_file(
        user=current_user,
        file_content=file_content,
        original_name=original_name,
        client_iv=client_iv,
        is_public=is_public
    )

    if error:
        audit_service.log(
            action='FILE_UPLOADED',
            status='error',
            user=current_user,
            resource_type='file',
            details={'error': error, 'filename': original_name}
        )
        return jsonify({'error': error}), 500

    audit_service.log(
        action='FILE_UPLOADED',
        status='success',
        user=current_user,
        resource_type='file',
        resource_id=file_meta.id,
        details={
            'filename': original_name,
            'size': len(file_content),
            'is_public': is_public
        }
    )

    return jsonify({
        'file': file_meta.to_dict()
    }), 201


@files_bp.route('/<file_id>/download', methods=['GET'])
@jwt_required()
def download_file(file_id):
    """
    Скачування файлу.

    Returns:
        Бінарний файл + заголовки:
        - X-Client-IV: base64 IV для клієнтського дешифрування
        - Content-Disposition: attachment
    """
    file_meta = FileMetadata.query.filter_by(
        id=file_id,
        deleted_at=None
    ).first()

    if not file_meta:
        return jsonify({'error': 'Файл не знайдено'}), 404

    # Перевірка доступу
    if not file_meta.is_accessible_by(current_user):
        ThreatService().create_unauthorized_access(
            user_id=current_user.id if current_user else None,
            ip_address=get_client_ip(),
            resource=f'file:{file_id}'
        )
        return jsonify({'error': 'Доступ заборонено'}), 403

    storage_service = StorageService()
    audit_service = AuditService()

    content, client_iv, error = storage_service.download_file(file_meta)

    if error:
        audit_service.log(
            action='FILE_DOWNLOADED',
            status='error',
            user=current_user,
            resource_type='file',
            resource_id=file_id,
            details={'error': error}
        )
        return jsonify({'error': error}), 500

    # Відстежуємо скачування
    if current_user:
        ThreatService.track_download(current_user.id)
        threat_service = ThreatService()
        threat = threat_service.check_mass_download(current_user.id, get_client_ip())
        if threat:
            audit_service.log(
                action='THREAT_DETECTED',
                status='success',
                user=current_user,
                details={'threat_type': 'MASS_DOWNLOAD', 'threat_id': threat.id}
            )

    audit_service.log(
        action='FILE_DOWNLOADED',
        status='success',
        user=current_user,
        resource_type='file',
        resource_id=file_id,
        details={'filename': file_meta.original_name}
    )

    # Відправляємо файл
    response = Response(
        content,
        mimetype='application/octet-stream',
        headers={
            'Content-Disposition': f'attachment; filename="{file_meta.original_name}"',
            'X-Client-IV': client_iv,
            'X-Original-Name': file_meta.original_name
        }
    )

    return response


@files_bp.route('/<file_id>', methods=['DELETE'])
@jwt_required()
@require_role('admin', 'user')
def delete_file(file_id):
    """
    Видалення файлу.
    """
    file_meta = FileMetadata.query.filter_by(
        id=file_id,
        deleted_at=None
    ).first()

    if not file_meta:
        return jsonify({'error': 'Файл не знайдено'}), 404

    # Перевірка прав
    if not file_meta.can_delete(current_user):
        ThreatService().create_unauthorized_access(
            user_id=current_user.id,
            ip_address=get_client_ip(),
            resource=f'file:{file_id}:delete'
        )
        return jsonify({'error': 'Немає прав на видалення'}), 403

    storage_service = StorageService()
    audit_service = AuditService()

    # Відстежуємо видалення
    ThreatService.track_delete(current_user.id)
    threat_service = ThreatService()
    threat = threat_service.check_mass_delete(current_user.id, get_client_ip())
    if threat:
        audit_service.log(
            action='THREAT_DETECTED',
            status='success',
            user=current_user,
            details={'threat_type': 'MASS_DELETE', 'threat_id': threat.id}
        )

    success, error = storage_service.delete_file(file_meta)

    if not success:
        audit_service.log(
            action='FILE_DELETED',
            status='error',
            user=current_user,
            resource_type='file',
            resource_id=file_id,
            details={'error': error}
        )
        return jsonify({'error': error}), 500

    audit_service.log(
        action='FILE_DELETED',
        status='success',
        user=current_user,
        resource_type='file',
        resource_id=file_id,
        details={'filename': file_meta.original_name}
    )

    return jsonify({'message': 'Файл видалено'}), 200


@files_bp.route('/<file_id>/visibility', methods=['PATCH'])
@jwt_required()
@require_role('admin', 'user')
def change_visibility(file_id):
    """
    Зміна видимості файлу (публічний/приватний).

    Body:
        {
            "is_public": bool
        }
    """
    data = request.get_json()
    if data is None or 'is_public' not in data:
        return jsonify({'error': 'Вкажіть is_public'}), 400

    is_public = bool(data['is_public'])

    file_meta = FileMetadata.query.filter_by(
        id=file_id,
        deleted_at=None
    ).first()

    if not file_meta:
        return jsonify({'error': 'Файл не знайдено'}), 404

    # Тільки власник або admin
    if file_meta.user_id != current_user.id and current_user.role != 'admin':
        return jsonify({'error': 'Немає прав на зміну'}), 403

    old_visibility = file_meta.is_public
    storage_service = StorageService()
    audit_service = AuditService()

    storage_service.change_visibility(file_meta, is_public)

    audit_service.log(
        action='FILE_VISIBILITY_CHANGED',
        status='success',
        user=current_user,
        resource_type='file',
        resource_id=file_id,
        details={
            'filename': file_meta.original_name,
            'old_visibility': 'public' if old_visibility else 'private',
            'new_visibility': 'public' if is_public else 'private'
        }
    )

    return jsonify({
        'file': file_meta.to_dict()
    }), 200


@files_bp.route('/<file_id>/verify', methods=['POST'])
@jwt_required()
@require_role('admin', 'user')
def verify_file(file_id):
    """
    Перевірка цілісності файлу.

    Returns:
        {
            "file_id": "uuid",
            "status": "verified" | "compromised",
            "expected_hash": "...",
            "actual_hash": "...",
            "checked_at": "2026-02-13T10:00:00Z"
        }
    """
    file_meta = FileMetadata.query.filter_by(
        id=file_id,
        deleted_at=None
    ).first()

    if not file_meta:
        return jsonify({'error': 'Файл не знайдено'}), 404

    integrity_service = IntegrityService()
    audit_service = AuditService()
    threat_service = ThreatService()

    try:
        status, expected_hash, actual_hash = integrity_service.verify_file(file_meta)

        audit_service.log(
            action='INTEGRITY_CHECK',
            status='success',
            user=current_user,
            resource_type='file',
            resource_id=file_id,
            details={
                'filename': file_meta.original_name,
                'result': status,
                'expected_hash': expected_hash[:16] + '...',
                'actual_hash': actual_hash[:16] + '...'
            }
        )

        # Якщо файл скомпрометований — створюємо загрозу
        if status == 'compromised':
            threat_service.create_integrity_violation(
                user_id=current_user.id,
                ip_address=get_client_ip(),
                file_id=file_id,
                file_name=file_meta.original_name
            )

        return jsonify({
            'file_id': file_id,
            'status': status,
            'expected_hash': expected_hash,
            'actual_hash': actual_hash,
            'checked_at': file_meta.last_verified_at.isoformat()
        }), 200

    except Exception as e:
        audit_service.log(
            action='INTEGRITY_CHECK',
            status='error',
            user=current_user,
            resource_type='file',
            resource_id=file_id,
            details={'error': str(e)}
        )
        return jsonify({'error': f'Помилка перевірки: {str(e)}'}), 500


@files_bp.route('/verify-all', methods=['POST'])
@jwt_required()
@require_role('admin')
def verify_all_files():
    """
    Масова перевірка цілісності всіх файлів.
    Тільки для admin.

    Returns:
        {
            "total": 150,
            "verified": 148,
            "compromised": 2,
            "errors": 0,
            "compromised_files": [...],
            "checked_at": "2026-02-13T10:00:00Z"
        }
    """
    integrity_service = IntegrityService()
    audit_service = AuditService()
    threat_service = ThreatService()

    results = integrity_service.verify_all_files()

    # Створюємо загрози для скомпрометованих файлів
    for cf in results['compromised_files']:
        threat_service.create_integrity_violation(
            user_id=current_user.id,
            ip_address=get_client_ip(),
            file_id=cf['id'],
            file_name=cf['name']
        )

    audit_service.log(
        action='BULK_INTEGRITY_CHECK',
        status='success',
        user=current_user,
        resource_type='file',
        details={
            'total': results['total'],
            'verified': results['verified'],
            'compromised': results['compromised'],
            'errors': results['errors']
        }
    )

    return jsonify(results), 200


@files_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_storage_stats():
    """
    Отримання статистики сховища.
    """
    storage_service = StorageService()

    # Admin бачить всю статистику, інші — тільки свою
    if current_user.role == 'admin':
        stats = storage_service.get_storage_stats()
    else:
        stats = storage_service.get_storage_stats(user=current_user)

    return jsonify(stats), 200
