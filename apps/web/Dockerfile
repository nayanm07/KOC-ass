FROM node:22-alpine AS build
WORKDIR /app
ARG API_INTERNAL_URL
ARG NEXT_PUBLIC_SOCKET_URL
ENV API_INTERNAL_URL=$API_INTERNAL_URL NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci -w web --include-workspace-root=false
COPY apps/web apps/web
RUN npm run build -w web

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static apps/web/.next/static
COPY --from=build /app/apps/web/public apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
