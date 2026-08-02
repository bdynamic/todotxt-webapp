# Stage 1: capture the source commit at build time so the running
# container needs no git access of its own (no .git is shipped in the
# final image).
FROM node:20-alpine AS gitinfo
RUN apk add --no-cache git
WORKDIR /src
COPY .git .git
RUN git log -1 --format='{"commit":"%H","shortCommit":"%h","date":"%cI"}' > /version.json \
    || echo '{"commit":null,"shortCommit":null,"date":null}' > /version.json

FROM node:20-alpine

RUN apk add --no-cache git openssh-client

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY . .
COPY --from=gitinfo /version.json ./version.json

EXPOSE 5001

ENV TODO_DATA_DIR=/tmp/tododata
ENV TODO_CONFIG_DIR=/root/.config/todotxt-git

CMD ["node", "node-server.js"]
