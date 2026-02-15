# -*- coding: utf-8 -*-
"""
Сервіс шифрування з використанням AWS KMS
"""
import base64
from typing import Tuple, Optional

import boto3
from botocore.exceptions import ClientError
from cryptography.fernet import Fernet
from flask import current_app


class CryptoService:
    """Сервіс для шифрування та дешифрування даних через KMS"""

    def __init__(self):
        self._kms_client = None
        self._key_id = None

    @property
    def kms_client(self):
        """Lazy initialization KMS клієнта"""
        if self._kms_client is None:
            self._kms_client = boto3.client(
                'kms',
                endpoint_url=current_app.config['AWS_ENDPOINT_URL'],
                aws_access_key_id=current_app.config['AWS_ACCESS_KEY_ID'],
                aws_secret_access_key=current_app.config['AWS_SECRET_ACCESS_KEY'],
                region_name=current_app.config['AWS_DEFAULT_REGION']
            )
        return self._kms_client

    def get_key_id(self) -> str:
        """Отримує ID KMS ключа за alias"""
        if self._key_id is None:
            try:
                response = self.kms_client.describe_key(
                    KeyId=current_app.config['KMS_KEY_ALIAS']
                )
                self._key_id = response['KeyMetadata']['KeyId']
            except ClientError as e:
                current_app.logger.error(f"Помилка отримання KMS ключа: {e}")
                raise
        return self._key_id

    def generate_data_key(self) -> Tuple[bytes, str]:
        """
        Генерує Data Key для шифрування файлу.
        Повертає (plaintext_key, encrypted_key_base64)
        """
        try:
            response = self.kms_client.generate_data_key(
                KeyId=self.get_key_id(),
                KeySpec='AES_256'
            )

            plaintext_key = response['Plaintext']
            encrypted_key = response['CiphertextBlob']
            encrypted_key_base64 = base64.b64encode(encrypted_key).decode('utf-8')

            return plaintext_key, encrypted_key_base64

        except ClientError as e:
            current_app.logger.error(f"Помилка генерації Data Key: {e}")
            raise

    def decrypt_data_key(self, encrypted_key_base64: str) -> bytes:
        """
        Розшифровує Data Key за допомогою KMS.
        """
        try:
            encrypted_key = base64.b64decode(encrypted_key_base64)

            response = self.kms_client.decrypt(
                CiphertextBlob=encrypted_key
            )

            return response['Plaintext']

        except ClientError as e:
            current_app.logger.error(f"Помилка дешифрування Data Key: {e}")
            raise

    def _prepare_fernet_key(self, raw_key: bytes) -> bytes:
        """Підготовка ключа для Fernet (base64-encoded 32 bytes)"""
        return base64.urlsafe_b64encode(raw_key[:32])

    def encrypt_data(self, data: bytes) -> Tuple[bytes, str]:
        """
        Шифрує дані за допомогою KMS Data Key.
        Повертає (encrypted_data, encrypted_data_key_base64)
        """
        # Генеруємо новий Data Key
        plaintext_key, encrypted_key_base64 = self.generate_data_key()

        # Створюємо Fernet з ключем
        fernet_key = self._prepare_fernet_key(plaintext_key)
        fernet = Fernet(fernet_key)

        # Шифруємо дані
        encrypted_data = fernet.encrypt(data)

        # Очищаємо plaintext ключ з пам'яті (наскільки це можливо в Python)
        del plaintext_key

        return encrypted_data, encrypted_key_base64

    def decrypt_data(self, encrypted_data: bytes, encrypted_key_base64: str) -> bytes:
        """
        Дешифрує дані за допомогою KMS.
        """
        # Дешифруємо Data Key через KMS
        plaintext_key = self.decrypt_data_key(encrypted_key_base64)

        # Створюємо Fernet з ключем
        fernet_key = self._prepare_fernet_key(plaintext_key)
        fernet = Fernet(fernet_key)

        # Дешифруємо дані
        decrypted_data = fernet.decrypt(encrypted_data)

        # Очищаємо plaintext ключ з пам'яті
        del plaintext_key

        return decrypted_data

    def encrypt_file_content(self, content: bytes) -> Tuple[bytes, str]:
        """
        Шифрує вміст файлу (вже зашифрований клієнтом).
        Це серверний шар шифрування.
        """
        return self.encrypt_data(content)

    def decrypt_file_content(self, encrypted_content: bytes, encrypted_key_base64: str) -> bytes:
        """
        Дешифрує серверний шар шифрування.
        Повертає дані, ще зашифровані клієнтським ключем.
        """
        return self.decrypt_data(encrypted_content, encrypted_key_base64)

    def rotate_data_key(self, encrypted_data: bytes, old_key_base64: str) -> Tuple[bytes, str]:
        """
        Перешифровує дані новим Data Key.
        Корисно для ротації ключів.
        """
        # Дешифруємо старим ключем
        decrypted = self.decrypt_data(encrypted_data, old_key_base64)

        # Шифруємо новим ключем
        return self.encrypt_data(decrypted)
