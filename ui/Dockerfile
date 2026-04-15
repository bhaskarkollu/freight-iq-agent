FROM node:20-alpine

WORKDIR /app

RUN npm install -g @angular/cli@17 --quiet

COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY . .

EXPOSE 4200

CMD ["ng", "serve", "--host", "0.0.0.0", "--port", "4200", "--proxy-config", "proxy.conf.json", "--poll", "2000"]
