# ── Stage 1: Build React client with Vite ────────────────────────
FROM node:20-slim AS builder

WORKDIR /app/client

COPY client/package.json client/vite.config.js ./
RUN npm install

COPY client/ ./
RUN npx vite build

# ── Stage 2: Production runtime ──────────────────────────────────
FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

COPY parser/requirements.txt /tmp/requirements.txt
RUN pip3 install --no-cache-dir --break-system-packages -r /tmp/requirements.txt

WORKDIR /app

COPY server/package.json ./server/
RUN cd server && npm install --production
COPY server/ ./server/

COPY parser/ ./parser/

COPY --from=builder /app/client/build ./client/build

RUN mkdir -p ./booth_lists
COPY booth_lists/ ./booth_lists/

ENV PORT=3001
EXPOSE 3001

CMD ["node", "server/index.js"]
