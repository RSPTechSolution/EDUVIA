# Vidyanexa API: FastAPI on uvicorn. Migrations run on start (set RUN_MIGRATIONS=0 to skip).
FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1 \
    STORAGE_DIR=/data/storage
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY alembic.ini docker-entrypoint.sh ./
COPY migrations ./migrations
COPY app ./app
RUN chmod +x docker-entrypoint.sh \
 && useradd --uid 10001 --create-home eduvia \
 && mkdir -p /data/storage && chown -R eduvia /data
USER eduvia

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD curl -fsS http://localhost:8000/api/v1/health || exit 1
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2", "--proxy-headers", "--forwarded-allow-ips", "*"]
