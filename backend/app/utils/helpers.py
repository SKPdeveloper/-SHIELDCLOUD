# -*- coding: utf-8 -*-
"""
Допоміжні функції
"""
import re
from datetime import datetime
from typing import Optional

from flask import request


def get_client_ip() -> str:
    """
    Отримує IP-адресу клієнта з урахуванням проксі.
    """
    if request.headers.get('X-Forwarded-For'):
        return request.headers.get('X-Forwarded-For').split(',')[0].strip()
    if request.headers.get('X-Real-IP'):
        return request.headers.get('X-Real-IP')
    return request.remote_addr or '0.0.0.0'


def parse_datetime(date_string: str) -> Optional[datetime]:
    """
    Парсить рядок дати у datetime об'єкт.
    Підтримує формати: ISO 8601, YYYY-MM-DD
    """
    if not date_string:
        return None

    formats = [
        '%Y-%m-%dT%H:%M:%S.%fZ',
        '%Y-%m-%dT%H:%M:%SZ',
        '%Y-%m-%dT%H:%M:%S',
        '%Y-%m-%d %H:%M:%S',
        '%Y-%m-%d'
    ]

    for fmt in formats:
        try:
            return datetime.strptime(date_string, fmt)
        except ValueError:
            continue

    return None


def format_file_size(size_bytes: int) -> str:
    """
    Форматує розмір файлу у зручний для читання формат.
    """
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
    else:
        return f"{size_bytes / (1024 * 1024 * 1024):.2f} GB"


def sanitize_filename(filename: str) -> str:
    """
    Очищає ім'я файлу від небезпечних символів.
    """
    # Видаляємо шлях (path traversal protection)
    filename = filename.replace('\\', '/').split('/')[-1]

    # Залишаємо тільки безпечні символи
    filename = re.sub(r'[^\w\s\-_\.\(\)]', '', filename)

    # Обмежуємо довжину
    if len(filename) > 200:
        name, ext = filename.rsplit('.', 1) if '.' in filename else (filename, '')
        max_name_len = 200 - len(ext) - 1 if ext else 200
        filename = f"{name[:max_name_len]}.{ext}" if ext else name[:200]

    return filename or 'unnamed'


def validate_uuid(uuid_string: str) -> bool:
    """
    Перевіряє, чи рядок є валідним UUID.
    """
    uuid_pattern = re.compile(
        r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
        re.IGNORECASE
    )
    return bool(uuid_pattern.match(uuid_string))


def paginate_query(query, page: int = 1, per_page: int = 20, max_per_page: int = 100):
    """
    Пагінує SQLAlchemy запит.

    Returns:
        (items, pagination_info)
    """
    # Валідація параметрів
    page = max(1, page)
    per_page = min(max(1, per_page), max_per_page)

    total = query.count()
    items = query.offset((page - 1) * per_page).limit(per_page).all()

    total_pages = (total + per_page - 1) // per_page

    pagination = {
        'page': page,
        'per_page': per_page,
        'total': total,
        'total_pages': total_pages,
        'has_next': page < total_pages,
        'has_prev': page > 1
    }

    return items, pagination
