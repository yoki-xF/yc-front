ARG YC_NODE_IMAGE=public.ecr.aws/docker/library/node:22-alpine
ARG YC_WEB_IMAGE=public.ecr.aws/docker/library/nginx:stable-alpine
FROM ${YC_NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
RUN npm run check
ARG YC_FRONT_SHA=unknown
RUN printf '{"application":"yc-h5","environment":"test","frontendCommit":"%s"}\n' "$YC_FRONT_SHA" > dist/version.json
FROM ${YC_WEB_IMAGE}
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=12 CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
