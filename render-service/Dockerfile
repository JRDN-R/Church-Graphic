FROM mcr.microsoft.com/playwright:v1.53.2-jammy

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev \
  && apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

COPY . .

ENV NODE_ENV=production
ENV PORT=8080

CMD ["npm", "start"]
