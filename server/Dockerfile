# Railway (or any Docker host): the NestJS API, the paper runner, the broker and the Telegram bot.
FROM node:22 AS builder

WORKDIR /app

COPY package.json package-lock.json tsconfig.json tsconfig.build.json nest-cli.json ./
COPY scripts ./scripts/
RUN npm ci --include=dev

COPY src ./src/
RUN npm run build

FROM node:22-slim

WORKDIR /app

ENV NODE_ENV=production
# Listen on all interfaces inside the container (API_TOKEN guards every route but /health).
ENV HOST=0.0.0.0

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/main.js"]
