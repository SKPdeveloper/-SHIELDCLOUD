# -*- coding: utf-8 -*-
"""
Сервіс перевірки цілісності файлів
"""
import hashlib
from datetime import datetime
from typing import Tuple, List, Optional

import boto3
from botocore.exceptions import ClientError
from flask import current_app

from app import db
from app.models import FileMetadata


class IntegrityService:
    """Сервіс для перевірки цілісності файлів"""

    def __init__(self):
        self._s3_client = None

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

    def compute_hash(self, data: bytes) -> str:
        """Обчислює SHA-256 хеш даних"""
        return hashlib.sha256(data).hexdigest()

    def verify_file(self, file_meta: FileMetadata) -> Tuple[str, str, str]:
        """
        Перевіряє цілісність одного файлу.

        Returns:
            (status, expected_hash, actual_hash)
            status: 'verified' або 'compromised'
        """
        try:
            # Отримуємо файл з S3 (зашифрований серверним ключем)
            response = self.s3_client.get_object(
                Bucket=self.bucket_name,
                Key=file_meta.s3_key
            )

            encrypted_content = response['Body'].read()

            # Дешифруємо серверний шар для перевірки хешу
            from app.services.crypto_service import CryptoService
            crypto_service = CryptoService()

            decrypted_content = crypto_service.decrypt_file_content(
                encrypted_content,
                file_meta.encrypted_data_key
            )

            # Обчислюємо хеш
            actual_hash = self.compute_hash(decrypted_content)
            expected_hash = file_meta.sha256_hash

            # Порівнюємо
            if actual_hash == expected_hash:
                status = 'verified'
            else:
                status = 'compromised'

            # Оновлюємо статус у БД
            file_meta.integrity_status = status
            file_meta.last_verified_at = datetime.utcnow()
            db.session.commit()

            return status, expected_hash, actual_hash

        except ClientError as e:
            current_app.logger.error(f"Помилка S3 при перевірці цілісності: {e}")
            raise
        except Exception as e:
            current_app.logger.error(f"Помилка при перевірці цілісності: {e}")
            raise

    def verify_all_files(self) -> dict:
        """
        Масова перевірка цілісності всіх файлів.

        Returns:
            {
                'total': int,
                'verified': int,
                'compromised': int,
                'errors': int,
                'compromised_files': List[dict],
                'checked_at': str
            }
        """
        files = FileMetadata.query.filter(FileMetadata.deleted_at.is_(None)).all()

        results = {
            'total': len(files),
            'verified': 0,
            'compromised': 0,
            'errors': 0,
            'compromised_files': [],
            'checked_at': datetime.utcnow().isoformat()
        }

        for file_meta in files:
            try:
                status, expected_hash, actual_hash = self.verify_file(file_meta)

                if status == 'verified':
                    results['verified'] += 1
                else:
                    results['compromised'] += 1
                    results['compromised_files'].append({
                        'id': file_meta.id,
                        'name': file_meta.original_name,
                        'owner': file_meta.owner.username if file_meta.owner else 'unknown',
                        'expected_hash': expected_hash,
                        'actual_hash': actual_hash
                    })

            except Exception as e:
                results['errors'] += 1
                current_app.logger.error(
                    f"Помилка перевірки файлу {file_meta.id}: {e}"
                )

        return results

    def get_integrity_stats(self) -> dict:
        """Отримує статистику цілісності"""
        files = FileMetadata.query.filter(FileMetadata.deleted_at.is_(None)).all()

        return {
            'total': len(files),
            'unchecked': sum(1 for f in files if f.integrity_status == 'unchecked'),
            'verified': sum(1 for f in files if f.integrity_status == 'verified'),
            'compromised': sum(1 for f in files if f.integrity_status == 'compromised')
        }
