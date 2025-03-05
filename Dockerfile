### STAGE 1: Base image ###
FROM node:21-alpine AS base
WORKDIR /app

### STAGE 2: Dependencies ###
FROM base AS dependencies
# Copy package files
COPY package*.json ./
# Install all dependencies including dev dependencies
RUN npm install

### STAGE 3: Build ###
FROM dependencies AS build
# Copy source files
COPY . .
# Build TypeScript
RUN npm run build

### STAGE 4: Production ###
FROM node:21-alpine AS production

# Install system dependencies
RUN apk update && apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont \
      --repository=http://dl-cdn.alpinelinux.org/alpine/edge/community \
      tzdata \
      && cp /usr/share/zoneinfo/Europe/Sofia /etc/localtime \
      && echo "Europe/Sofia" >  /etc/timezone \
      && rm -rf /var/cache/apk/*

# Set environment variables
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

ENV LANG=bg_BG.UTF-8
ENV LANGUAGE=bg_BG.UTF-8
ENV LC_ALL=bg_BG.UTF-8
ENV TZ=Europe/Sofia

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy only the built files from the build stage
COPY --from=build /app/dist ./dist
# Copy any other necessary files for production (adjust as needed)
COPY --from=build /app/src/templates ./src/templates
COPY --from=build /app/src/templates/assets ./src/templates/assets
COPY --from=build /app/src/locales ./dist/locales

# Create a non-root user
RUN addgroup -S pptruser && adduser -S -g pptruser pptruser \
    && mkdir -p /home/pptruser/Downloads /app/pdfs \
    && chown -R pptruser:pptruser /home/pptruser \
    && chown -R pptruser:pptruser /app

# Switch to non-root user
USER pptruser

# Run the application
CMD ["npm", "start"] 