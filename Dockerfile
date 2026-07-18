FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies for psycopg2
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install supervisord for running multiple processes
RUN pip install supervisor

# Copy requirements first (for Docker layer caching)
COPY requirements.txt .

# Install Python deps — use CPU-only PyTorch index for smaller image
RUN pip install --no-cache-dir \
    --extra-index-url https://download.pytorch.org/whl/cpu \
    -r requirements.txt

# Copy application code
COPY *.py ./
COPY .env.production .env

# Copy supervisord config
COPY supervisord.conf /etc/supervisord.conf

# Expose the API port
EXPOSE 8000

# Pre-download FinBERT model during build (so container starts fast)
RUN python -c "from transformers import AutoTokenizer, AutoModelForSequenceClassification; \
    AutoTokenizer.from_pretrained('ProsusAI/finbert'); \
    AutoModelForSequenceClassification.from_pretrained('ProsusAI/finbert'); \
    print('FinBERT model cached.')"

# Run both API server and bot engine via supervisord
CMD ["supervisord", "-c", "/etc/supervisord.conf"]
