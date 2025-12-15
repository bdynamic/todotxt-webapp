FROM node:20-alpine

RUN apk add --no-cache git openssh-client

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY . .

EXPOSE 5001

ENV TODO_DATA_DIR=/tmp/tododata
ENV TODO_CONFIG_DIR=/root/.config/todotxt-git

CMD ["node", "node-server.js"]
