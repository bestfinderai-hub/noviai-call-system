FROM node:20-alpine

# ffmpeg-static ships its own binary, but needs libstdc++ on alpine
RUN apk add --no-cache libstdc++

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3000

CMD ["node", "src/server.js"]
