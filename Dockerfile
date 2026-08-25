FROM node:22-alpine AS build
RUN apk add --no-cache openssl

WORKDIR /app

# Install build tools (vite, typescript, rollup). NODE_ENV=production before
# npm ci would skip them and break `react-router build`.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-alpine
RUN apk add --no-cache openssl

WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
EXPOSE 3000

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/prisma ./prisma

CMD ["npm", "run", "docker-start"]
