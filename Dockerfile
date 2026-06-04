FROM python:3.12-slim-bookworm

WORKDIR /app

RUN useradd --create-home --uid 10001 appuser

COPY server.py ics_calendar.py notes_store.py user_profile_store.py ./
COPY public ./public

RUN mkdir -p /app/data && chown -R appuser:appuser /app

USER appuser

ENV PORT=8765
ENV PYTHONUNBUFFERED=1

EXPOSE 8765

VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python3 -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8765/api/config', timeout=3)"

CMD ["python3", "server.py"]