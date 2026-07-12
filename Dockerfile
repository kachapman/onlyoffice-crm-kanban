FROM python:3.12-slim-bookworm

ARG INSTALL_ML=0

WORKDIR /app

RUN useradd --create-home --uid 10001 appuser

COPY server.py mail_scanner.py ics_calendar.py notes_store.py user_profile_store.py presence_store.py event_log_store.py crm_bot_store.py train_ml_head.py ./
COPY VERSION ./
COPY CHANGELOG.md ./
COPY public ./public

RUN mkdir -p /app/data && chown -R appuser:appuser /app

USER appuser

COPY requirements-ml.txt ./
RUN if [ "$INSTALL_ML" = "1" ]; then \
      pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu && \
      pip install --no-cache-dir -r requirements-ml.txt; \
    fi

ENV PORT=8765
ENV PYTHONUNBUFFERED=1

EXPOSE 8765

VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python3 -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8765/api/config', timeout=3)"

CMD ["python3", "server.py"]