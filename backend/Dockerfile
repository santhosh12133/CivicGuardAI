FROM node:18-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

RUN mkdir -p uploads && chown -R node:node /app
USER node

EXPOSE 5000

CMD ["node", "server.js"]
