FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# The code imports itself as the `ai_services` package (ai_services.models...),
# so the source must live in /app/ai_services with /app on the import path.
COPY . ./ai_services/

ENV PYTHONPATH=/app

EXPOSE 8001

CMD ["uvicorn", "ai_services.api.main:app", "--host", "0.0.0.0", "--port", "8001"]
