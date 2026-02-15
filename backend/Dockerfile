FROM python:3.12-slim

WORKDIR /app

# Встановлення системних залежностей
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Копіювання та встановлення Python залежностей
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копіювання коду додатку
COPY . .

# Створення директорії для БД
RUN mkdir -p /app/instance

# Змінні середовища для Flask
ENV FLASK_APP=app:create_app

# Запуск
EXPOSE 5000
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "1", "--threads", "4", "wsgi:app"]
