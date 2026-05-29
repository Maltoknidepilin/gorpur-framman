FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/gorpur-framman

COPY gorpur-framman/package.json /opt/gorpur-framman/package.json
COPY gorpur-framman/yarn.lock /opt/gorpur-framman/yarn.lock

RUN corepack enable && \
    yarn install --frozen-lockfile && \
    yarn cache clean

COPY gorpur-framman/ /opt/gorpur-framman/
COPY gorps-stillingar-framman/ /opt/gorps-stillingar-framman/

EXPOSE 9111
