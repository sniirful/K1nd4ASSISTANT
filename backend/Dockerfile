FROM node:23.9.0-alpine

RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

RUN npm i -g typescript

WORKDIR /app
COPY package.json .
RUN npm install

COPY . .

RUN tsc
CMD node .
