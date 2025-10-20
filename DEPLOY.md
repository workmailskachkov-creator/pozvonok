# ПРОСТОЙ ДЕПЛОЙ - 5 МИНУТ

## Вариант 1: Railway.app (САМЫЙ ПРОСТОЙ)

### 1. Создай GitHub аккаунт
https://github.com/signup

### 2. Создай новый репозиторий
https://github.com/new
- Название: `pozvonok`
- Public
- Create repository

### 3. Запуш код (в PowerShell):
```powershell
git init
git add .
git commit -m "Pozvonok deploy"
git branch -M main
git remote add origin https://github.com/ТВОЙ_USERNAME/pozvonok.git
git push -u origin main
```

GitHub спросит логин/пароль - введи данные аккаунта.

### 4. Деплой на Railway:
1. https://railway.app/new
2. Login with GitHub
3. Deploy from GitHub repo
4. Выбери `pozvonok`
5. Deploy Now!

**ГОТОВО!** Railway автоматом развернет.

### 5. Получи URL:
Railway даст URL типа: `pozvonok-production.up.railway.app`

### 6. Привяжи свой домен:
Railway → Settings → Domains → Add Custom Domain:
```
api.5sept.ru
```

Railway скажет что добавить в DNS (CNAME запись).

### 7. Обнови в @BotFather:
```
https://api.5sept.ru/telegram
```

---

## Вариант 2: Render.com (еще проще)

1. https://render.com/
2. Sign up with GitHub
3. New → Web Service
4. Connect repository `pozvonok`
5. Auto-deploy!
6. Settings → Custom Domain → `api.5sept.ru`

---

## Вариант 3: Vercel (САМЫЙ БЫСТРЫЙ - 1 КОМАНДА!)

```powershell
npm install -g vercel
vercel login
vercel --prod
```

Vercel задеплоит и даст домен!
Потом привяжешь свой домен в панели.

---

## Мой выбор: Railway

Самый простой для WebSocket приложений.
Бесплатно 500 часов/месяц (этого хватит).

**Начинай с Railway - какой шаг делаем?**

