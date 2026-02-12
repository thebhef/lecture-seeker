FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/worker/package.json ./apps/worker/

RUN npm install

COPY packages/shared ./packages/shared
COPY apps/worker ./apps/worker
COPY tsconfig.base.json ./

RUN npx prisma generate --schema packages/shared/src/prisma/schema.prisma

COPY apps/worker/entrypoint.sh ./entrypoint.sh

CMD ["sh", "entrypoint.sh"]
