FROM python:3.12.12-slim-bookworm@sha256:593bd06efe90efa80dc4eee3948be7c0fde4134606dd40d8dd8dbcade98e669c AS dependencies
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 libportaudio2 && rm -rf /var/lib/apt/lists/*
RUN python -m venv /opt/tf && python -m venv /opt/mp
COPY requirements-tf.txt requirements-mp.txt requirements-tf.lock requirements-mp.lock /build/
RUN /opt/tf/bin/pip install --no-cache-dir -r /build/requirements-tf.lock
RUN /opt/mp/bin/pip install --no-cache-dir -r /build/requirements-mp.lock
FROM dependencies AS runtime
ENV PATH="/opt/tf/bin:$PATH" MP_PYTHON=/opt/mp/bin/python \
    CUDA_VISIBLE_DEVICES=-1 AI_DEVICE=cpu PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 TF_CPP_MIN_LOG_LEVEL=2 AI_STATE_BACKEND=redis
WORKDIR /opt/signhearing
COPY src/ ./
COPY model/ ./model/
RUN python -B -c "from ai_inference.app.siformer_loader import inspect_export; inspect_export('model')"
EXPOSE 80
CMD ["python", "-B", "-m", "ai_inference.deploy.serve"]
