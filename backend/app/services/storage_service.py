# -*- coding: utf-8 -*-
"""
Сервіс роботи з S3 сховищем
"""
import uuid
import base64
from datetime import datetime
from typing import Optional, Tuple, List

import boto3
from botocore.exceptions import ClientError
from flask import current_app

from app import db
from app.models import FileMetadata, User
from app.services.crypto_service import CryptoService
from app.services.integrity_service import IntegrityService


class StorageService:
    """Сервіс для роботи з файлами в S3"""

    def __init__(self):
        self._s3_client = None
        self.crypto_service = CryptoService()
        self.integrity_service = IntegrityService()

    @property
    def s3_client(self):
        """Lazy initialization S3 клієнта"""
        if self._s3_client is None:
            self._s3_client = boto3.client(
                's3',
                endpoint_url=current_app.config['AWS_ENDPOINT_URL'],
                aws_access_key_id=current_app.config['AWS_ACCESS_KEY_ID'],
                aws_secret_access_key=current_app.config['AWS_SECRET_ACCESS_KEY'],
                region_name=current_app.config['AWS_DEFAULT_REGION']
            )
        return self._s3_client

    @property
    def bucket_name(self) -> str:
        return current_app.config['S3_BUCKET_NAME']

    def generate_s3_key(self, user_id: str, original_name: str) -> str:
        """Генерує унікальний S3 ключ для файлу"""
        file_uuid = str(uuid.uuid4())
        return f"{user_id}/{file_uuid}/{original_name}.enc"

    def upload_file(
        self,
        user: User,
        file_content: bytes,
        original_name: str,
        client_iv: str,
        is_public: bool = False
    ) -> Tuple[Optional[FileMetadata], Optional[str]]:
        """
        Завантажує файл у S3 з серверним шифруванням.

        Args:
            user: Користувач-власник
            file_content: Вміст файлу (вже зашифрований клієнтом)
            original_name: Оригінальна назва файлу
            client_iv: IV клієнтського шифрування (base64)
            is_public: Чи публічний файл

        Returns:
            (FileMetadata, None) або (None, error_message)
        """
        try:
            # Обчислюємо хеш клієнт-зашифрованих даних
            sha256_hash = self.integrity_service.compute_hash(file_content)

            # Серверне шифрування
            encrypted_content, encrypted_data_key = self.crypto_service.encrypt_file_content(file_content)

            # Генеруємо S3 ключ
            s3_key = self.generate_s3_key(user.id, original_name)

            # Метадані для S3 (original-name кодуємо в base64 для підтримки Unicode)
            encoded_name = base64.b64encode(original_name.encode('utf-8')).decode('ascii')
            s3_metadata = {
                'original-name': encoded_name,
                'client-iv': client_iv,
                'upload-timestamp': datetime.utcnow().isoformat(),
                'owner-id': user.id
            }

            # Завантаження в S3
            response = self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=s3_key,
                Body=encrypted_content,
                Metadata=s3_metadata
            )

            s3_version_id = response.get('VersionId')

            # Створення запису в БД
            file_meta = FileMetadata(
                user_id=user.id,
                original_name=original_name,
                s3_key=s3_key,
                s3_version_id=s3_version_id,
                encrypted_data_key=encrypted_data_key,
                client_iv=client_iv,
                sha256_hash=sha256_hash,
                file_size=len(file_content),
                is_public=is_public
            )

            db.session.add(file_meta)
            db.session.commit()

            return file_meta, None

        except ClientError as e:
            current_app.logger.error(f"Помилка S3 при завантаженні: {e}")
            return None, f"Помилка завантаження файлу: {str(e)}"
        except Exception as e:
            current_app.logger.error(f"Помилка при завантаженні файлу: {e}")
            db.session.rollback()
            return None, f"Внутрішня помилка: {str(e)}"

    def download_file(self, file_meta: FileMetadata) -> Tuple[Optional[bytes], Optional[str], Optional[str]]:
        """
        Завантажує файл з S3 та дешифрує серверний шар.

        Returns:
            (file_content, client_iv, None) або (None, None, error_message)
        """
        try:
            # Отримання з S3
            response = self.s3_client.get_object(
                Bucket=self.bucket_name,
                Key=file_meta.s3_key
            )

            encrypted_content = response['Body'].read()

            # Серверне дешифрування
            decrypted_content = self.crypto_service.decrypt_file_content(
                encrypted_content,
                file_meta.encrypted_data_key
            )

            return decrypted_content, file_meta.client_iv, None

        except ClientError as e:
            current_app.logger.error(f"Помилка S3 при скачуванні: {e}")
            return None, None, f"Помилка скачування файлу: {str(e)}"
        except Exception as e:
            current_app.logger.error(f"Помилка при скачуванні файлу: {e}")
            return None, None, f"Внутрішня помилка: {str(e)}"

    def delete_file(self, file_meta: FileMetadata) -> Tuple[bool, Optional[str]]:
        """
        Видаляє файл з S3 та позначає як видалений в БД.
        """
        try:
            # Видалення з S3
            self.s3_client.delete_object(
                Bucket=self.bucket_name,
                Key=file_meta.s3_key
            )

            # Soft delete в БД
            file_meta.deleted_at = datetime.utcnow()
            db.session.commit()

            return True, None

        except ClientError as e:
            current_app.logger.error(f"Помилка S3 при видаленні: {e}")
            return False, f"Помилка видалення файлу: {str(e)}"
        except Exception as e:
            current_app.logger.error(f"Помилка при видаленні файлу: {e}")
            db.session.rollback()
            return False, f"Внутрішня помилка: {str(e)}"

    def get_file_list(
        self,
        user: User,
        page: int = 1,
        per_page: int = 20,
        sort_by: str = 'created_at',
        order: str = 'desc',
        search: str = None
    ) -> Tuple[List[FileMetadata], int]:
        """
        Отримує список файлів з пагінацією.

        Returns:
            (files, total_count)
        """
        query = FileMetadata.query.filter(FileMetadata.deleted_at.is_(None))

        # Фільтрація за роллю
        if user.role == 'admin':
            pass  # Бачить всі файли
        elif user.role == 'user':
            # Свої + публічні
            query = query.filter(
                db.or_(
                    FileMetadata.user_id == user.id,
                    FileMetadata.is_public == True
                )
            )
        else:  # guest
            # Тільки публічні
            query = query.filter(FileMetadata.is_public == True)

        # Пошук за назвою
        if search:
            query = query.filter(FileMetadata.original_name.ilike(f'%{search}%'))

        # Сортування
        sort_column = getattr(FileMetadata, sort_by, FileMetadata.created_at)
        if order == 'desc':
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())

        # Пагінація
        total = query.count()
        files = query.offset((page - 1) * per_page).limit(per_page).all()

        return files, total

    def change_visibility(self, file_meta: FileMetadata, is_public: bool) -> bool:
        """Змінює видимість файлу"""
        file_meta.is_public = is_public
        file_meta.updated_at = datetime.utcnow()
        db.session.commit()
        return True

    def get_storage_stats(self, user: User = None) -> dict:
        """
        Отримує статистику сховища.
        Якщо user=None — загальна статистика (для admin).
        """
        query = FileMetadata.query.filter(FileMetadata.deleted_at.is_(None))

        if user and user.role != 'admin':
            query = query.filter(FileMetadata.user_id == user.id)

        files = query.all()

        total_files = len(files)
        total_size = sum(f.file_size for f in files)
        public_files = sum(1 for f in files if f.is_public)
        private_files = total_files - public_files

        integrity_stats = {
            'unchecked': sum(1 for f in files if f.integrity_status == 'unchecked'),
            'verified': sum(1 for f in files if f.integrity_status == 'verified'),
            'compromised': sum(1 for f in files if f.integrity_status == 'compromised')
        }

        return {
            'total_files': total_files,
            'total_size': total_size,
            'public_files': public_files,
            'private_files': private_files,
            'integrity': integrity_stats
        }
