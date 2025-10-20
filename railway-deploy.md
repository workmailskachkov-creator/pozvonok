# Деплой Pozvonok на Railway.app - САМЫЙ ПРОСТОЙ СПОСОБ

## Шаг 1: Создай GitHub репозиторий

1. Зайди на https://github.com
2. Создай аккаунт (если нет)
3. Нажми **New repository**
4. Название: `pozvonok`
5. Public
6. Create repository

---

## Шаг 2: Запуш код на GitHub

В PowerShell в папке проекта:

```powershell
git init
git add .
git commit -m "Initial commit - Pozvonok"
git branch -M main
git remote add origin https://github.com/ТВОЙ_USERNAME/pozvonok.git
git push -u origin main
```

---

## Шаг 3: Деплой на Railway

1. Зайди на https://railway.app
2. **Start a New Project**
3. **Deploy from GitHub repo**
4. Войди через GitHub
5. Выбери репозиторий `pozvonok`
6. Railway автоматически:
   - Определит Node.js
   - Установит зависимости
   - Запустит сервер
   - Даст публичный URL

---

## Шаг 4: Настрой свой домен

1. В Railway → Settings → Domains
2. **Custom Domain** → введи:
```
api.5sept.ru
```

3. Railway даст CNAME запись, например:
```
pozvonok.up.railway.app
```

4. Зайди в панель управления доменом 5sept.ru
5. Добавь CNAME запись:
   - Тип: CNAME
   - Имя: api
   - Значение: pozvonok.up.railway.app
   - TTL: 3600

5. Подожди 5-10 минут - DNS обновится

---

## Шаг 5: Обнови Telegram Bot

В @BotFather:
```
/myapps → PoZvonok → Edit Web App URL
```

Укажи:
```
https://api.5sept.ru/telegram
```

---

## ✅ ГОТОВО!

Pozvonok работает на постоянном URL:
```
https://api.5sept.ru
```

**Преимущества Railway:**
- ✅ Бесплатно (500 часов/месяц)
- ✅ Автоматический SSL
- ✅ Автодеплой при push в GitHub
- ✅ Логи, мониторинг
- ✅ Всегда онлайн

---

## АЛЬТЕРНАТИВА - Render.com (еще проще)

1. https://render.com → Sign Up
2. **New** → **Web Service**
3. Connect GitHub → выбери `pozvonok`
4. Railway автоматически развернет
5. Settings → Custom Domain → `api.5sept.ru`

---

## АЛЬТЕРНАТИВА 2 - Vercel (самое быстрое)

```powershell
npm install -g vercel
vercel login
vercel
```

Следуй инструкциям → автоматически задеплоит и даст домен!

---

**Какой вариант пробуем?**
- Railway (рекомендую)
- Render
- Vercel

