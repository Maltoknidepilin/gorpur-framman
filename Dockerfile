FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/gorpur-framman

COPY package.json /opt/gorpur-framman/package.json
COPY yarn.lock /opt/gorpur-framman/yarn.lock

RUN corepack enable && \
    yarn install --frozen-lockfile && \
    yarn cache clean

EXPOSE 9111
