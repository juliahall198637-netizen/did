# Docker image for hosts outside Lovable (for example Liara).
# Lovable builds a Cloudflare worker; here nitro builds a plain Node.js server.
# bun.lock points at Lovable's private registry, so npm resolves package.json.

FROM node:22-slim AS build
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN NITRO_PRESET=node-server npx vite build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000
COPY --from=build /app/.output ./.output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
