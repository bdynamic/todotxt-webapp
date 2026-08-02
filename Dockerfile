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

# So `user: dockeruser` (or any uid/gid override) in docker-compose has a
# passwd entry to resolve against - Docker refuses to start the container
# otherwise ("unable to find user dockeruser").
RUN adduser -D -u 1000 -h /home/dockeruser dockeruser

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY . .
COPY --from=gitinfo /version.json ./version.json

RUN chown -R dockeruser:dockeruser /app

EXPOSE 5001

ENV TODO_DATA_DIR=/tmp/tododata

CMD ["node", "node-server.js"]
