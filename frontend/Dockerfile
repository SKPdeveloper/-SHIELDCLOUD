# Етап збірки
FROM node:20-alpine AS builder

WORKDIR /app

# Копіювання package.json та встановлення залежностей
COPY package.json package-lock.json* ./
RUN npm install

# Копіювання решти коду та збірка
COPY . .
RUN npm run build

# Етап production
FROM nginx:alpine

# Копіювання зібраного додатку
COPY --from=builder /app/dist /usr/share/nginx/html

# Копіювання конфігурації nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
