FROM python:3.12-slim
COPY --from=node:24-slim /usr/local/bin/node /usr/local/bin/node
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements-forecast.txt .
RUN pip install --no-cache-dir -r requirements-forecast.txt
COPY . .
ENV HOST=0.0.0.0 PORT=4173 PYTHON=python
EXPOSE 4173
CMD ["node", "server.js"]
