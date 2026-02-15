# -*- coding: utf-8 -*-
"""
Модуль хмарних провайдерів
Підтримує LocalStack (AWS S3 емуляція), MinIO, та можливість додавання реальних API
"""
import os
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, Tuple
from datetime import datetime

import boto3
from botocore.exceptions import ClientError, EndpointConnectionError
from flask import current_app


class CloudProvider(ABC):
    """Абстрактний базовий клас для хмарних провайдерів"""

    PROVIDER_TYPE = "abstract"

    @abstractmethod
    def connect(self) -> Tuple[bool, Optional[str]]:
        """Перевірка з'єднання з провайдером"""
        pass

    @abstractmethod
    def upload(self, key: str, data: bytes, metadata: dict = None) -> Tuple[bool, Optional[str], Optional[str]]:
        """Завантаження файлу. Повертає (success, version_id, error)"""
        pass

    @abstractmethod
    def download(self, key: str) -> Tuple[Optional[bytes], Optional[str]]:
        """Скачування файлу. Повертає (data, error)"""
        pass

    @abstractmethod
    def delete(self, key: str) -> Tuple[bool, Optional[str]]:
        """Видалення файлу"""
        pass

    @abstractmethod
    def list_objects(self, prefix: str = "") -> Tuple[list, Optional[str]]:
        """Список об'єктів"""
        pass

    @abstractmethod
    def get_stats(self) -> Dict[str, Any]:
        """Статистика провайдера"""
        pass

    @abstractmethod
    def get_config_info(self) -> Dict[str, Any]:
        """Інформація про конфігурацію (безпечна для показу)"""
        pass


class LocalStackProvider(CloudProvider):
    """
    LocalStack - локальна емуляція AWS S3
    Безпечний для тестування, без ризику витрат та блокування
    """

    PROVIDER_TYPE = "localstack"
    DISPLAY_NAME = "LocalStack (AWS S3 емуляція)"
    ICON = "🔧"
    DESCRIPTION = """
LocalStack емулює AWS сервіси локально. Ідеально підходить для:
• Розробки та тестування без витрат
• Навчання роботі з AWS API
• Демонстрації атак без ризику блокування
• CI/CD пайплайнів

⚠️ Дані зберігаються локально і не синхронізуються з реальним AWS.
    """

    def __init__(self, config: dict = None):
        self.config = config or {}
        self._client = None

        # Дефолтні значення з environment або config
        self.endpoint_url = self.config.get('endpoint_url') or os.environ.get('AWS_ENDPOINT_URL', 'http://localstack:4566')
        self.access_key = self.config.get('access_key') or os.environ.get('AWS_ACCESS_KEY_ID', 'test')
        self.secret_key = self.config.get('secret_key') or os.environ.get('AWS_SECRET_ACCESS_KEY', 'test')
        self.region = self.config.get('region') or os.environ.get('AWS_DEFAULT_REGION', 'eu-central-1')
        self.bucket_name = self.config.get('bucket_name') or os.environ.get('S3_BUCKET_NAME', 'shieldcloud-files')

    @property
    def client(self):
        if self._client is None:
            self._client = boto3.client(
                's3',
                endpoint_url=self.endpoint_url,
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.secret_key,
                region_name=self.region
            )
        return self._client

    def connect(self) -> Tuple[bool, Optional[str]]:
        try:
            # Перевірка з'єднання через list_buckets
            self.client.list_buckets()

            # Перевірка існування bucket
            try:
                self.client.head_bucket(Bucket=self.bucket_name)
            except ClientError:
                # Створюємо bucket якщо не існує
                self.client.create_bucket(
                    Bucket=self.bucket_name,
                    CreateBucketConfiguration={'LocationConstraint': self.region}
                )

            return True, None
        except EndpointConnectionError:
            return False, "Не вдалося з'єднатися з LocalStack. Перевірте чи запущений контейнер."
        except Exception as e:
            return False, f"Помилка з'єднання: {str(e)}"

    def upload(self, key: str, data: bytes, metadata: dict = None) -> Tuple[bool, Optional[str], Optional[str]]:
        try:
            response = self.client.put_object(
                Bucket=self.bucket_name,
                Key=key,
                Body=data,
                Metadata=metadata or {}
            )
            version_id = response.get('VersionId')
            return True, version_id, None
        except Exception as e:
            return False, None, f"Помилка завантаження: {str(e)}"

    def download(self, key: str) -> Tuple[Optional[bytes], Optional[str]]:
        try:
            response = self.client.get_object(Bucket=self.bucket_name, Key=key)
            data = response['Body'].read()
            return data, None
        except ClientError as e:
            if e.response['Error']['Code'] == 'NoSuchKey':
                return None, "Файл не знайдено"
            return None, f"Помилка скачування: {str(e)}"
        except Exception as e:
            return None, f"Помилка: {str(e)}"

    def delete(self, key: str) -> Tuple[bool, Optional[str]]:
        try:
            self.client.delete_object(Bucket=self.bucket_name, Key=key)
            return True, None
        except Exception as e:
            return False, f"Помилка видалення: {str(e)}"

    def list_objects(self, prefix: str = "") -> Tuple[list, Optional[str]]:
        try:
            response = self.client.list_objects_v2(Bucket=self.bucket_name, Prefix=prefix)
            objects = response.get('Contents', [])
            return [{'key': obj['Key'], 'size': obj['Size'], 'modified': obj['LastModified']} for obj in objects], None
        except Exception as e:
            return [], f"Помилка: {str(e)}"

    def get_stats(self) -> Dict[str, Any]:
        try:
            objects, _ = self.list_objects()
            total_size = sum(obj['size'] for obj in objects)
            return {
                'connected': True,
                'total_objects': len(objects),
                'total_size': total_size,
                'bucket': self.bucket_name,
                'region': self.region
            }
        except:
            return {'connected': False, 'total_objects': 0, 'total_size': 0}

    def get_config_info(self) -> Dict[str, Any]:
        return {
            'provider': self.PROVIDER_TYPE,
            'display_name': self.DISPLAY_NAME,
            'icon': self.ICON,
            'description': self.DESCRIPTION,
            'endpoint': self.endpoint_url,
            'bucket': self.bucket_name,
            'region': self.region,
            'is_safe_for_testing': True,
            'supports_versioning': True,
            'cost': 'Безкоштовно (локальний)'
        }


class MinIOProvider(CloudProvider):
    """
    MinIO - S3-сумісне сховище з відкритим кодом
    Реальне хмарне сховище, можна розгорнути локально або в хмарі
    """

    PROVIDER_TYPE = "minio"
    DISPLAY_NAME = "MinIO (S3-сумісне сховище)"
    ICON = "🗄️"
    DESCRIPTION = """
MinIO - високопродуктивне S3-сумісне об'єктне сховище.
Підходить для:
• Приватних хмарних рішень
• Зберігання великих обсягів даних
• Kubernetes та контейнерних середовищ
• Реального тестування S3 API

✅ Повна сумісність з AWS S3 API
✅ Шифрування на стороні сервера
✅ Версіонування об'єктів
    """

    def __init__(self, config: dict = None):
        self.config = config or {}
        self._client = None

        self.endpoint_url = self.config.get('endpoint_url') or os.environ.get('MINIO_ENDPOINT_URL', 'http://minio:9000')
        self.access_key = self.config.get('access_key') or os.environ.get('MINIO_ACCESS_KEY', 'minioadmin')
        self.secret_key = self.config.get('secret_key') or os.environ.get('MINIO_SECRET_KEY', 'minioadmin123')
        self.bucket_name = self.config.get('bucket_name') or os.environ.get('MINIO_BUCKET_NAME', 'shieldcloud-minio')
        self.region = 'us-east-1'  # MinIO дефолт

    @property
    def client(self):
        if self._client is None:
            self._client = boto3.client(
                's3',
                endpoint_url=self.endpoint_url,
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.secret_key,
                region_name=self.region
            )
        return self._client

    def connect(self) -> Tuple[bool, Optional[str]]:
        try:
            self.client.list_buckets()

            try:
                self.client.head_bucket(Bucket=self.bucket_name)
            except ClientError:
                self.client.create_bucket(Bucket=self.bucket_name)

            return True, None
        except EndpointConnectionError:
            return False, "Не вдалося з'єднатися з MinIO. Перевірте чи запущений контейнер."
        except Exception as e:
            return False, f"Помилка з'єднання: {str(e)}"

    def upload(self, key: str, data: bytes, metadata: dict = None) -> Tuple[bool, Optional[str], Optional[str]]:
        try:
            response = self.client.put_object(
                Bucket=self.bucket_name,
                Key=key,
                Body=data,
                Metadata=metadata or {}
            )
            version_id = response.get('VersionId')
            return True, version_id, None
        except Exception as e:
            return False, None, f"Помилка завантаження: {str(e)}"

    def download(self, key: str) -> Tuple[Optional[bytes], Optional[str]]:
        try:
            response = self.client.get_object(Bucket=self.bucket_name, Key=key)
            data = response['Body'].read()
            return data, None
        except ClientError as e:
            if e.response['Error']['Code'] == 'NoSuchKey':
                return None, "Файл не знайдено"
            return None, f"Помилка скачування: {str(e)}"
        except Exception as e:
            return None, f"Помилка: {str(e)}"

    def delete(self, key: str) -> Tuple[bool, Optional[str]]:
        try:
            self.client.delete_object(Bucket=self.bucket_name, Key=key)
            return True, None
        except Exception as e:
            return False, f"Помилка видалення: {str(e)}"

    def list_objects(self, prefix: str = "") -> Tuple[list, Optional[str]]:
        try:
            response = self.client.list_objects_v2(Bucket=self.bucket_name, Prefix=prefix)
            objects = response.get('Contents', [])
            return [{'key': obj['Key'], 'size': obj['Size'], 'modified': obj['LastModified']} for obj in objects], None
        except Exception as e:
            return [], f"Помилка: {str(e)}"

    def get_stats(self) -> Dict[str, Any]:
        try:
            objects, _ = self.list_objects()
            total_size = sum(obj['size'] for obj in objects)
            return {
                'connected': True,
                'total_objects': len(objects),
                'total_size': total_size,
                'bucket': self.bucket_name
            }
        except:
            return {'connected': False, 'total_objects': 0, 'total_size': 0}

    def get_config_info(self) -> Dict[str, Any]:
        return {
            'provider': self.PROVIDER_TYPE,
            'display_name': self.DISPLAY_NAME,
            'icon': self.ICON,
            'description': self.DESCRIPTION,
            'endpoint': self.endpoint_url,
            'bucket': self.bucket_name,
            'is_safe_for_testing': True,
            'supports_versioning': True,
            'cost': 'Безкоштовно (self-hosted)'
        }


class ExternalCloudProvider(CloudProvider):
    """
    Заглушка для зовнішніх провайдерів (Google Drive, Dropbox, AWS)
    Показує попередження про ризики
    """

    PROVIDER_TYPE = "external"
    DISPLAY_NAME = "Зовнішні хмари (AWS/GCP/Azure)"
    ICON = "☁️"
    DESCRIPTION = """
⚠️ УВАГА: РИЗИКИ ПІДКЛЮЧЕННЯ РЕАЛЬНИХ ХМАРНИХ СЕРВІСІВ

При підключенні до реальних хмарних провайдерів (AWS S3, Google Cloud,
Azure Blob, Dropbox, Google Drive) існують серйозні ризики:

🚨 РИЗИКИ:
• Блокування акаунту за підозрілу активність
• Фінансові втрати (API виклики коштують грошей)
• Юридичні наслідки при тестуванні без дозволу
• Втрата даних при помилкових операціях
• Бан IP адреси провайдером

⚖️ ПРАВОВІ ОБМЕЖЕННЯ:
• Тестувати можна ТІЛЬКИ власні акаунти
• Потрібна письмова згода власника даних
• Заборонено сканувати чужі ресурси
• DDoS-подібні атаки караються законом

✅ ДЛЯ БЕЗПЕЧНОГО ТЕСТУВАННЯ ВИКОРИСТОВУЙТЕ:
• LocalStack (емуляція AWS)
• MinIO (S3-сумісне self-hosted сховище)
• Тестові акаунти провайдерів
    """

    def __init__(self, config: dict = None):
        self.config = config or {}
        self.provider_name = self.config.get('provider_name', 'Unknown')

    def connect(self) -> Tuple[bool, Optional[str]]:
        return False, "Зовнішні провайдери потребують налаштування API ключів"

    def upload(self, key: str, data: bytes, metadata: dict = None) -> Tuple[bool, Optional[str], Optional[str]]:
        return False, None, "Провайдер не налаштований"

    def download(self, key: str) -> Tuple[Optional[bytes], Optional[str]]:
        return None, "Провайдер не налаштований"

    def delete(self, key: str) -> Tuple[bool, Optional[str]]:
        return False, "Провайдер не налаштований"

    def list_objects(self, prefix: str = "") -> Tuple[list, Optional[str]]:
        return [], "Провайдер не налаштований"

    def get_stats(self) -> Dict[str, Any]:
        return {'connected': False, 'total_objects': 0, 'total_size': 0}

    def get_config_info(self) -> Dict[str, Any]:
        return {
            'provider': self.PROVIDER_TYPE,
            'display_name': self.DISPLAY_NAME,
            'icon': self.ICON,
            'description': self.DESCRIPTION,
            'is_safe_for_testing': False,
            'requires_api_keys': True,
            'cost': 'Платно (за використання)',
            'warning': 'НЕБЕЗПЕЧНО для тестування атак!'
        }


class CloudProviderManager:
    """Менеджер хмарних провайдерів"""

    PROVIDERS = {
        'localstack': LocalStackProvider,
        'minio': MinIOProvider,
        'external': ExternalCloudProvider
    }

    def __init__(self):
        self._active_provider = None
        self._active_provider_type = 'localstack'
        self._providers_cache = {}

    def get_provider(self, provider_type: str = None, config: dict = None) -> CloudProvider:
        """Отримує провайдера за типом"""
        provider_type = provider_type or self._active_provider_type

        if provider_type not in self.PROVIDERS:
            raise ValueError(f"Невідомий провайдер: {provider_type}")

        cache_key = f"{provider_type}_{hash(str(config))}"

        if cache_key not in self._providers_cache:
            self._providers_cache[cache_key] = self.PROVIDERS[provider_type](config)

        return self._providers_cache[cache_key]

    def set_active_provider(self, provider_type: str) -> Tuple[bool, Optional[str]]:
        """Встановлює активного провайдера"""
        if provider_type not in self.PROVIDERS:
            return False, f"Невідомий провайдер: {provider_type}"

        provider = self.get_provider(provider_type)
        success, error = provider.connect()

        if success:
            self._active_provider_type = provider_type
            self._active_provider = provider
            return True, None

        return False, error

    def get_active_provider(self) -> CloudProvider:
        """Повертає активного провайдера"""
        if self._active_provider is None:
            self._active_provider = self.get_provider(self._active_provider_type)
        return self._active_provider

    def get_all_providers_info(self) -> list:
        """Інформація про всі провайдери"""
        result = []
        for provider_type, provider_class in self.PROVIDERS.items():
            provider = self.get_provider(provider_type)
            info = provider.get_config_info()

            # Перевірка статусу з'єднання
            if provider_type != 'external':
                connected, _ = provider.connect()
                info['connected'] = connected
                if connected:
                    info['stats'] = provider.get_stats()
            else:
                info['connected'] = False

            info['is_active'] = provider_type == self._active_provider_type
            result.append(info)

        return result

    def get_active_provider_type(self) -> str:
        return self._active_provider_type


# Глобальний екземпляр менеджера
cloud_manager = CloudProviderManager()
