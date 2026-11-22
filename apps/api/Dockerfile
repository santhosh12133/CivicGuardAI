FROM node:26-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Amazon RDS certificate authorities, so the API can verify the database's TLS
# certificate (enable with DATABASE_SSL=true and
# DATABASE_SSL_CA=/app/certs/rds-global-bundle.pem). Harmless elsewhere.
ADD https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /app/certs/rds-global-bundle.pem
RUN chmod 644 /app/certs/rds-global-bundle.pem

COPY . .

RUN mkdir -p uploads && chown -R node:node /app/uploads
USER node

EXPOSE 5000

CMD ["node", "server.js"]
