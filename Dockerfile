# Build stage: compiles the Vite frontend and bundles the Express server.
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage: only what's needed to serve the built app.
# node_modules is carried over (not reinstalled with --omit=dev) because
# server.cjs is bundled with esbuild --packages=external, so it still
# requires "vite" at load time even though the dev-only code path never runs.
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json ./

# Cloud Run injects PORT and expects the container to listen on it;
# server.ts already reads process.env.PORT with no hardcoded fallback conflict.
EXPOSE 8080
CMD ["node", "dist/server.cjs"]
