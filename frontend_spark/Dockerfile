# ---- build ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# These REACT_APP_* become baked into the build; you can also leave them to default to localhost.
ARG REACT_APP_USER_API_BASE=http://localhost:8080
ARG REACT_APP_STORE_API_BASE=http://localhost:8081
ARG REACT_APP_VOICE_API_BASE=http://localhost:8082
ARG REACT_APP_NLP_API_BASE=http://localhost:8082
# Vite/CRA variants both respect REACT_APP_* at build time for your config.js usage
ENV REACT_APP_USER_API_BASE=$REACT_APP_USER_API_BASE \
    REACT_APP_STORE_API_BASE=$REACT_APP_STORE_API_BASE \
    REACT_APP_VOICE_API_BASE=$REACT_APP_VOICE_API_BASE \
    REACT_APP_NLP_API_BASE=$REACT_APP_NLP_API_BASE
RUN npm run build

# ---- serve ----
FROM nginx:1.27-alpine
COPY --from=build /app/build /usr/share/nginx/html
# single-page app fallback
RUN printf "server { \
  listen 80; \
  server_name _; \
  root /usr/share/nginx/html; \
  location / { try_files \$uri /index.html; } \
} " > /etc/nginx/conf.d/default.conf
EXPOSE 80
