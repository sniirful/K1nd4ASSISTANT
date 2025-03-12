FROM node:23.9.0-alpine

WORKDIR /app
COPY package.json .
RUN npm install

COPY . .
RUN tsc .

CMD node .
