# Деплой Pozvonok на api.5sept.ru

## Вариант 1: SSH доступ (рекомендуется)

### 1. Подключись к серверу:
```bash
ssh user@api.5sept.ru
```

### 2. Создай директорию:
```bash
mkdir -p /var/www/pozvonok
cd /var/www/pozvonok
```

### 3. Залей файлы:
На локальном ПК:
```bash
scp -r * user@api.5sept.ru:/var/www/pozvonok/
```

Или через Git:
```bash
git init
git add .
git commit -m "Initial commit"
# Затем push на сервер или GitHub
```

### 4. На сервере установи зависимости:
```bash
cd /var/www/pozvonok
npm install
```

### 5. Запусти с PM2:
```bash
npm install -g pm2
pm2 start server.js --name pozvonok
pm2 save
pm2 startup
```

### 6. Настрой Nginx:
```nginx
server {
    listen 80;
    server_name api.5sept.ru;
    
    location /pozvonok {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Примени:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## Вариант 2: Поддомен (лучше)

### Создай поддомен: `pozvonok.5sept.ru`

Nginx конфиг:
```nginx
server {
    listen 443 ssl http2;
    server_name pozvonok.5sept.ru;
    
    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 80;
    server_name pozvonok.5sept.ru;
    return 301 https://$server_name$request_uri;
}
```

---

## URL для Telegram Mini App:

После деплоя укажи в @BotFather:
```
https://pozvonok.5sept.ru/telegram
```

Или если через путь:
```
https://api.5sept.ru/pozvonok/telegram
```

---

## Быстрый деплой (если есть SSH):

Один файл для автоматизации - `deploy.sh`:
```bash
#!/bin/bash
cd /var/www/pozvonok
git pull
npm install
pm2 restart pozvonok
```

Скажи какой у тебя доступ к серверу!

