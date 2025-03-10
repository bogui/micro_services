FROM node:21-alpine AS base
WORKDIR /app

FROM base AS dependencies
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm install --no-cache

FROM dependencies AS build
COPY . .
RUN npm run build

FROM mcr.microsoft.com/playwright:v1.50.0-noble AS production

ENV LANG=bg_BG.UTF-8 \
    LANGUAGE=bg_BG.UTF-8 \
    LC_ALL=bg_BG.UTF-8 \
    TZ=Europe/Sofia \
    PATH="/app/venv/bin:$PATH"

WORKDIR /app

RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone \
    && apt-get update && apt-get install -y --no-install-recommends \
    nodejs \
    python3-pip \
    python3-venv \
    tzdata \
    && rm -rf /var/lib/apt/lists/*

RUN npm --version

RUN python3 -m venv /app/venv

COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-cache-dir -r requirements.txt

RUN playwright install chrome && playwright install-deps

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/src/scripts ./src/scripts
COPY --from=build /app/src/templates ./src/templates
COPY --from=build /app/src/locales ./dist/locales

RUN mkdir -p /home/pwuser/Downloads /app/pdfs \
    && chown -R pwuser:pwuser /home/pwuser \
    && chown -R pwuser:pwuser /app

USER pwuser

CMD ["npm", "start"]