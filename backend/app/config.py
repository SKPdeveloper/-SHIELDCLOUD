# -*- coding: utf-8 -*-
"""
Конфігурація Flask-додатку
"""
import os
from datetime import timedelta


class Config:
    """Базова конфігурація"""

    # Flask
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')

    # JWT
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'jwt-dev-secret-key')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=15)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=7)
    JWT_TOKEN_LOCATION = ['headers']
    JWT_HEADER_NAME = 'Authorization'
    JWT_HEADER_TYPE = 'Bearer'

    # SQLAlchemy
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', 'sqlite:///app.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # AWS / LocalStack
    AWS_ENDPOINT_URL = os.environ.get('AWS_ENDPOINT_URL', 'http://localhost:4566')
    AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID', 'test')
    AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY', 'test')
    AWS_DEFAULT_REGION = os.environ.get('AWS_DEFAULT_REGION', 'eu-central-1')
    S3_BUCKET_NAME = os.environ.get('S3_BUCKET_NAME', 'shieldcloud-files')
    KMS_KEY_ALIAS = os.environ.get('KMS_KEY_ALIAS', 'alias/shieldcloud-key')

    # CloudWatch
    CLOUDWATCH_LOG_GROUP = os.environ.get('CLOUDWATCH_LOG_GROUP', '/shieldcloud/audit')
    CLOUDWATCH_LOG_STREAM = 'events'

    # Безпека
    BCRYPT_SALT_ROUNDS = 12
    MAX_FAILED_LOGIN_ATTEMPTS = 5
    ACCOUNT_LOCK_DURATION_MINUTES = 30
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50 МБ

    # Rate Limiting
    RATE_LIMIT_AUTHENTICATED = 60  # запитів за хвилину
    RATE_LIMIT_ANONYMOUS = 20

    # Threat Detection
    THREAT_SCORE_DECAY_INTERVAL_MINUTES = 10
    THREAT_SCORE_DECAY_AMOUNT = 1
    THREAT_SCORE_WARNING_THRESHOLD = 50
    THREAT_SCORE_RATE_LIMIT_THRESHOLD = 80
    THREAT_SCORE_BLOCK_THRESHOLD = 100
