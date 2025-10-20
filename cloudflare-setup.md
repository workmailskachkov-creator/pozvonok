# Настройка Pozvonok на постоянном домене api.5sept.ru

## Вариант 1: Cloudflare Tunnel (рекомендую)

### Преимущества:
- ✅ Не нужно пробрасывать порты
- ✅ Автоматический SSL (https)
- ✅ Работает за любым NAT
- ✅ Постоянный URL
- ✅ Бесплатно

### Шаги:

1. **Создай аккаунт на cloudflare.com**

2. **Добавь домен 5sept.ru:**
   - Dashboard → Add Site → введи `5sept.ru`
   - Выбери Free план
   - Cloudflare даст 2 nameserver'а

3. **Смени NS записи у регистратора домена:**
   - Зайди туда, где купил домен
   - DNS Settings → Nameservers
   - Укажи nameserver'ы от Cloudflare

4. **Скачай cloudflared на ПК:**
   https://github.com/cloudflare/cloudflared/releases
   
   Windows: `cloudflared-windows-amd64.exe`

5. **Авторизуйся:**
```bash
cloudflared.exe tunnel login
```

6. **Создай туннель:**
```bash
cloudflared.exe tunnel create pozvonok
```

7. **Создай конфиг файл `config.yml`:**
```yaml
tunnel: TUNNEL_ID_ИЗ_ПРЕДЫДУЩЕГО_ШАГА
credentials-file: C:\Users\Александр\.cloudflared\TUNNEL_ID.json

ingress:
  - hostname: api.5sept.ru
    service: http://localhost:3000
  - service: http_status:404
```

8. **Привяжи домен к туннелю:**
```bash
cloudflared.exe tunnel route dns pozvonok api.5sept.ru
```

9. **Запусти туннель:**
```bash
cloudflared.exe tunnel run pozvonok
```

10. **Готово!** Твой Pozvonok доступен на:
```
https://api.5sept.ru
```

---

## Вариант 2: Проброс портов + Dynamic DNS (сложнее)

### 1. Узнай внешний IP:
```bash
curl https://api.ipify.org
```

### 2. Проброс портов на роутере:
- Зайди в роутер (обычно 192.168.0.1)
- Port Forwarding
- Порт 3000 → твой локальный IP (192.168.0.111)

### 3. DNS запись:
В панели управления доменом 5sept.ru:
- Тип: A
- Имя: api
- Значение: ТВОй_ВНЕШНИЙ_IP
- TTL: 3600

### 4. SSL сертификат (нужен для HTTPS):
Используй Certbot на Windows или настрой через Cloudflare

---

## Рекомендация:

**Используй Cloudflare Tunnel!** Намного проще, безопаснее и работает из коробки.

Хочешь пойти этим путем?

