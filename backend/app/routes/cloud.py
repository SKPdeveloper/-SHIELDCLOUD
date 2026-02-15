# -*- coding: utf-8 -*-
"""
API маршрути для управління хмарними провайдерами
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, current_user

from app.middleware.rbac import require_role
from app.services.cloud_providers import cloud_manager
from app.services.audit_service import AuditService

cloud_bp = Blueprint('cloud', __name__)
audit_service = AuditService()


@cloud_bp.route('/providers', methods=['GET'])
@jwt_required()
def get_providers():
    """
    Отримання списку всіх хмарних провайдерів.

    Returns:
        {
            "providers": [
                {
                    "provider": "localstack",
                    "display_name": "LocalStack",
                    "connected": true,
                    "is_active": true,
                    ...
                },
                ...
            ],
            "active_provider": "localstack"
        }
    """
    providers = cloud_manager.get_all_providers_info()
    active = cloud_manager.get_active_provider_type()

    return jsonify({
        'providers': providers,
        'active_provider': active
    }), 200


@cloud_bp.route('/providers/<provider_type>', methods=['GET'])
@jwt_required()
def get_provider_info(provider_type):
    """
    Отримання детальної інформації про провайдера.
    """
    try:
        provider = cloud_manager.get_provider(provider_type)
        info = provider.get_config_info()

        if provider_type != 'external':
            connected, error = provider.connect()
            info['connected'] = connected
            info['connection_error'] = error
            if connected:
                info['stats'] = provider.get_stats()

        return jsonify(info), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 404


@cloud_bp.route('/providers/<provider_type>/activate', methods=['POST'])
@jwt_required()
@require_role('admin')
def activate_provider(provider_type):
    """
    Активація хмарного провайдера (тільки admin).
    """
    if provider_type == 'external':
        return jsonify({
            'error': 'Зовнішні провайдери потребують налаштування API ключів',
            'warning': 'Підключення до реальних хмарних сервісів може призвести до блокування акаунту!'
        }), 400

    success, error = cloud_manager.set_active_provider(provider_type)

    if success:
        audit_service.log(
            action='CLOUD_PROVIDER_CHANGED',
            status='success',
            user=current_user,
            resource_type='cloud',
            details={'provider': provider_type}
        )

        return jsonify({
            'message': f'Провайдер {provider_type} активовано',
            'active_provider': provider_type
        }), 200

    return jsonify({'error': error}), 400


@cloud_bp.route('/providers/<provider_type>/test', methods=['POST'])
@jwt_required()
def test_provider_connection(provider_type):
    """
    Тестування з'єднання з провайдером.
    """
    try:
        provider = cloud_manager.get_provider(provider_type)
        connected, error = provider.connect()

        if connected:
            stats = provider.get_stats()
            return jsonify({
                'connected': True,
                'message': "З'єднання успішне",
                'stats': stats
            }), 200

        return jsonify({
            'connected': False,
            'error': error
        }), 200  # 200 бо це тест, не помилка
    except ValueError as e:
        return jsonify({'error': str(e)}), 404


@cloud_bp.route('/providers/<provider_type>/config', methods=['PUT'])
@jwt_required()
@require_role('admin')
def update_provider_config(provider_type):
    """
    Оновлення конфігурації провайдера (тільки admin).

    Body:
        {
            "endpoint_url": "string",
            "access_key": "string",
            "secret_key": "string",
            "bucket_name": "string"
        }
    """
    if provider_type == 'external':
        return jsonify({
            'error': 'Налаштування зовнішніх провайдерів наразі недоступне',
            'warning': '''
⚠️ УВАГА: Підключення до реальних хмарних сервісів несе ризики:

1. БЛОКУВАННЯ АКАУНТУ
   Провайдери (AWS, Google, Dropbox) можуть заблокувати акаунт
   за підозрілу активність (багато запитів, brute-force патерни)

2. ФІНАНСОВІ ВТРАТИ
   API виклики коштують грошей. Масові операції можуть
   призвести до значних витрат.

3. ЮРИДИЧНІ НАСЛІДКИ
   Тестування без дозволу = несанкціонований доступ.
   Це кримінальний злочин у більшості країн.

4. ВТРАТА ДАНИХ
   Помилкові операції видалення неможливо відмінити
   на реальних сервісах.

✅ Рекомендація: Використовуйте LocalStack або MinIO
'''
        }), 400

    data = request.get_json()

    if not data:
        return jsonify({'error': 'Не вказано конфігурацію'}), 400

    # Створюємо провайдера з новою конфігурацією
    try:
        provider = cloud_manager.get_provider(provider_type, data)
        connected, error = provider.connect()

        if connected:
            audit_service.log(
                action='CLOUD_PROVIDER_CONFIGURED',
                status='success',
                user=current_user,
                resource_type='cloud',
                details={
                    'provider': provider_type,
                    'endpoint': data.get('endpoint_url', 'default')
                }
            )

            return jsonify({
                'message': 'Конфігурацію оновлено',
                'connected': True,
                'stats': provider.get_stats()
            }), 200

        return jsonify({
            'error': f"Не вдалося з'єднатися: {error}",
            'connected': False
        }), 400

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@cloud_bp.route('/active/stats', methods=['GET'])
@jwt_required()
def get_active_provider_stats():
    """
    Отримання статистики активного провайдера.
    """
    provider = cloud_manager.get_active_provider()
    info = provider.get_config_info()
    stats = provider.get_stats()

    return jsonify({
        'provider': info['provider'],
        'display_name': info['display_name'],
        'stats': stats
    }), 200


@cloud_bp.route('/warnings', methods=['GET'])
@jwt_required()
def get_cloud_warnings():
    """
    Отримання попереджень про безпеку хмарних сервісів.
    """
    return jsonify({
        'warnings': [
            {
                'level': 'info',
                'title': 'Безпечне тестування',
                'message': 'LocalStack та MinIO — безпечні для тестування атак. Ніяких ризиків блокування чи витрат.'
            },
            {
                'level': 'warning',
                'title': 'Реальні хмарні сервіси',
                'message': 'Підключення до AWS, Google Cloud, Azure, Dropbox потребує обережності. Можливе блокування акаунту.'
            },
            {
                'level': 'danger',
                'title': 'Юридична відповідальність',
                'message': 'Тестування безпеки чужих систем без дозволу є злочином. Тестуйте тільки власні ресурси.'
            }
        ],
        'safe_providers': ['localstack', 'minio'],
        'risky_providers': ['aws', 'gcp', 'azure', 'dropbox', 'google_drive']
    }), 200
