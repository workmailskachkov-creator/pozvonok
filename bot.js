const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const BOT_TOKEN = '8143486909:AAGU7BLjinOl-6auFF6w3ZRKCRclL6qgzTA';
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(express.static('.'));

// Хранилище приглашенных пользователей (в продакшене использовать БД)
const invitedUsers = new Map(); // roomId -> Set of {userId, userName, chatId}

// Serve manifest.json и sw.js
app.get('/manifest.json', (req, res) => {
    res.sendFile(__dirname + '/manifest.json');
});

app.get('/sw.js', (req, res) => {
    res.sendFile(__dirname + '/sw.js');
});

// Telegram Mini App
app.get('/telegram', (req, res) => {
    res.sendFile(__dirname + '/telegram.html');
});

// API для получения списка приглашенных
app.get('/api/invited/:roomId', (req, res) => {
    const roomId = req.params.roomId;
    const invited = invitedUsers.get(roomId) || [];
    res.json({ invited: Array.from(invited) });
});

// API для отправки приглашения через бота
app.post('/api/invite', async (req, res) => {
    const { userId, userName, roomId, inviteLink } = req.body;
    
    try {
        // Формируем сообщение с кнопкой
        const message = `🎙️ ${userName} приглашает вас в видеоконференцию Pozvonok!\n\nНажмите кнопку ниже для присоединения:`;
        
        const keyboard = {
            inline_keyboard: [[
                { text: '🎥 Присоединиться к конференции', url: inviteLink }
            ]]
        };
        
        // Отправляем сообщение пользователю
        const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: userId,
                text: message,
                reply_markup: keyboard
            })
        });
        
        const result = await response.json();
        
        if (result.ok) {
            // Сохраняем приглашенного пользователя
            if (!invitedUsers.has(roomId)) {
                invitedUsers.set(roomId, new Set());
            }
            invitedUsers.get(roomId).add({ userId, userName, timestamp: Date.now() });
            
            res.json({ success: true });
        } else {
            res.json({ success: false, error: result.description });
        }
    } catch (error) {
        console.error('Ошибка отправки приглашения:', error);
        res.json({ success: false, error: error.message });
    }
});

// Webhook для обработки сообщений бота
app.post(`/webhook/${BOT_TOKEN}`, async (req, res) => {
    const update = req.body;
    
    if (update.message) {
        const chatId = update.message.chat.id;
        const text = update.message.text;
        
        if (text === '/start') {
            console.log('Получена команда /start от:', chatId);
            
            // Приветственное сообщение
            const welcomeMessage = `🎙️ Добро пожаловать в Pozvonok!

Премиум платформа для видео и аудио конференций.

📞 Сейчас я отправлю вам специальную мелодию звонка для уведомлений от бота.

⚡ Это позволит отличать обычные сообщения в Telegram от приглашений в конференцию!`;
            
            const welcomeRes = await fetch(`${TELEGRAM_API}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: welcomeMessage
                })
            });
            
            console.log('Приветственное сообщение отправлено:', await welcomeRes.json());
            
            // Отправляем мелодию сразу
            setTimeout(async () => {
                const instructionText = `🔔 КАК УСТАНОВИТЬ МЕЛОДИЮ НА УВЕДОМЛЕНИЯ ОТ ЭТОГО БОТА:

📱 НА ANDROID:
1️⃣ Нажмите на аудиофайл выше и прослушайте
2️⃣ Нажмите три точки (⋮) в углу
3️⃣ Выберите "Использовать как рингтон"
4️⃣ Выберите "Для уведомлений"

📱 НА IPHONE:
1️⃣ Нажмите на аудиофайл и прослушайте
2️⃣ Нажмите "Поделиться" → "Сохранить в Файлы"
3️⃣ Настройки Telegram → Уведомления и звуки
4️⃣ Звук уведомлений → выберите сохраненный файл

💡 ЗАЧЕМ ЭТО НУЖНО:
Когда вас пригласят в видеоконференцию, вы услышите эту уникальную мелодию вместо обычного "дзинь" и сразу поймете, что это ЗВОНОК, а не просто сообщение!

✅ После установки откройте Pozvonok ↓`;
                
                console.log('Отправляем аудио файл...');
                
                // Отправляем аудио файл через URL (правильный метод)
                const audioRes = await fetch(`${TELEGRAM_API}/sendAudio`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: chatId,
                        audio: 'https://pozvonok.onrender.com/ringtone.mp3',
                        caption: instructionText,
                        title: 'Мелодия звонка Pozvonok',
                        performer: 'Pozvonok'
                    })
                });
                
                const audioResult = await audioRes.json();
                console.log('Результат отправки аудио:', audioResult);
                
                // Отправляем кнопку открытия Mini App
                const keyboard = {
                    inline_keyboard: [
                        [{ text: '▶️ Открыть Pozvonok', web_app: { url: 'https://pozvonok.onrender.com/telegram' } }]
                    ]
                };
                
                console.log('Отправляем кнопку открытия...');
                
                const btnRes = await fetch(`${TELEGRAM_API}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: chatId,
                        text: '👇 Нажмите кнопку ниже для запуска:',
                        reply_markup: keyboard
                    })
                });
                
                console.log('Кнопка отправлена:', await btnRes.json());
            }, 1000);
        }
    }
    
    
    res.sendStatus(200);
});

// WebSocket для конференций (из server.js)
const clients = new Map();
const rooms = new Map();
const userNames = [
    'Альфа', 'Браво', 'Чарли', 'Дельта', 'Эхо', 'Фокстрот', 'Гольф', 'Хотел',
    'Индия', 'Джульетта', 'Кило', 'Лима', 'Майк', 'Новембр', 'Оскар', 'Папа',
    'Квебек', 'Ромео', 'Сьерра', 'Танго', 'Юниформ', 'Виктор', 'Виски', 'Рентген',
    'Янки', 'Зулу', 'Феникс', 'Титан', 'Нептун', 'Орион', 'Атлас', 'Зевс'
];

function generateUserName() {
    const name = userNames[Math.floor(Math.random() * userNames.length)];
    const num = Math.floor(Math.random() * 99) + 1;
    return `${name}-${num}`;
}

function sanitizeName(name) {
    return name.replace(/[<>]/g, '').substring(0, 20);
}

function generateRoomId() {
    return Math.random().toString(36).substring(2, 10);
}

wss.on('connection', (ws) => {
    const clientId = generateId();
    const userName = generateUserName();
    
    clients.set(clientId, { ws, userName, customName: null, roomId: null });
    
    console.log(`Клиент подключился: ${userName} (${clientId}). Всего клиентов: ${clients.size}`);
    
    ws.send(JSON.stringify({
        type: 'welcome',
        clientId: clientId,
        userName: userName,
        totalUsers: clients.size
    }));
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            switch(data.type) {
                case 'offer':
                case 'answer':
                case 'ice-candidate':
                    if (data.to) {
                        const sender = clients.get(clientId);
                        const recipient = clients.get(data.to);
                        
                        if (sender && recipient && 
                            sender.roomId === recipient.roomId &&
                            recipient.ws.readyState === WebSocket.OPEN) {
                            recipient.ws.send(JSON.stringify({ ...data, from: clientId }));
                        }
                    }
                    break;
                case 'audio-level':
                    const audioClient = clients.get(clientId);
                    if (audioClient && audioClient.roomId) {
                        broadcastToRoom(audioClient.roomId, {
                            type: 'audio-level',
                            userId: clientId,
                            level: data.level
                        }, clientId);
                    }
                    break;
                case 'chat-message':
                    const userData = clients.get(clientId);
                    const displayName = userData?.customName || userData?.userName || 'Неизвестный';
                    if (userData && userData.roomId) {
                        broadcastToRoom(userData.roomId, {
                            type: 'chat-message',
                            userId: clientId,
                            userName: displayName,
                            message: data.message,
                            timestamp: Date.now()
                        });
                        console.log(`[Комната ${userData.roomId}] Сообщение от ${displayName}: ${data.message}`);
                    }
                    break;
                case 'set-custom-name':
                    const client = clients.get(clientId);
                    if (client && data.customName) {
                        const customName = sanitizeName(data.customName);
                        client.customName = customName;
                        console.log(`${client.userName} сменил имя на ${customName}`);
                        
                        broadcastToRoom(client.roomId, {
                            type: 'name-updated',
                            userId: clientId,
                            customName: customName
                        });
                    }
                    break;
                case 'create-room':
                    const newRoomId = generateRoomId();
                    const creator = clients.get(clientId);
                    if (creator) {
                        creator.roomId = newRoomId;
                        
                        if (!rooms.has(newRoomId)) {
                            rooms.set(newRoomId, new Set());
                        }
                        rooms.get(newRoomId).add(clientId);
                        
                        console.log(`Комната создана: ${newRoomId} пользователем ${creator.customName || creator.userName}`);
                        
                        ws.send(JSON.stringify({
                            type: 'room-created',
                            roomId: newRoomId
                        }));
                        
                        sendRoomUserList(clientId, newRoomId);
                        
                        broadcastToRoom(newRoomId, {
                            type: 'user-joined',
                            userId: clientId,
                            userName: creator.customName || creator.userName,
                            count: rooms.get(newRoomId).size
                        }, clientId);
                    }
                    break;
                case 'join-room':
                    if (data.roomId) {
                        const joiner = clients.get(clientId);
                        if (joiner) {
                            joiner.roomId = data.roomId;
                            
                            if (!rooms.has(data.roomId)) {
                                rooms.set(data.roomId, new Set());
                            }
                            rooms.get(data.roomId).add(clientId);
                            
                            console.log(`${joiner.customName || joiner.userName} присоединился к комнате ${data.roomId}`);
                            
                            sendRoomUserList(clientId, data.roomId);
                            
                            broadcastToRoom(data.roomId, {
                                type: 'user-joined',
                                userId: clientId,
                                userName: joiner.customName || joiner.userName,
                                count: rooms.get(data.roomId).size
                            }, clientId);
                        }
                    }
                    break;
            }
        } catch (e) {
            console.error('Ошибка парсинга сообщения:', e);
        }
    });
    
    ws.on('close', () => {
        const userData = clients.get(clientId);
        const userRoomId = userData?.roomId;
        
        clients.delete(clientId);
        
        if (userRoomId && rooms.has(userRoomId)) {
            rooms.get(userRoomId).delete(clientId);
            
            if (rooms.get(userRoomId).size === 0) {
                rooms.delete(userRoomId);
                console.log(`Комната ${userRoomId} удалена (пустая)`);
            } else {
                broadcastToRoom(userRoomId, {
                    type: 'user-left',
                    userId: clientId,
                    userName: userData?.customName || userData?.userName,
                    count: rooms.get(userRoomId).size
                });
            }
        }
        
        console.log(`Клиент отключился: ${userData?.customName || userData?.userName} (${clientId}). Осталось клиентов: ${clients.size}`);
    });
});

function broadcast(data, excludeId = null) {
    const message = JSON.stringify(data);
    clients.forEach((clientData, id) => {
        if (id !== excludeId && clientData.ws.readyState === WebSocket.OPEN) {
            clientData.ws.send(message);
        }
    });
}

function broadcastToOthers(data, fromId) {
    const message = JSON.stringify({ ...data, from: fromId });
    clients.forEach((clientData, id) => {
        if (id !== fromId && clientData.ws.readyState === WebSocket.OPEN) {
            clientData.ws.send(message);
        }
    });
}

function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

function broadcastToRoom(roomId, data, excludeId = null) {
    if (!rooms.has(roomId)) return;
    
    const message = JSON.stringify(data);
    rooms.get(roomId).forEach(clientId => {
        if (clientId !== excludeId) {
            const client = clients.get(clientId);
            if (client && client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(message);
            }
        }
    });
}

function sendRoomUserList(clientId, roomId) {
    if (!rooms.has(roomId)) return;
    
    const client = clients.get(clientId);
    if (!client) return;
    
    const userList = [];
    rooms.get(roomId).forEach(id => {
        if (id !== clientId) {
            const user = clients.get(id);
            if (user) {
                userList.push({
                    id: id,
                    userName: user.customName || user.userName
                });
            }
        }
    });
    
    client.ws.send(JSON.stringify({
        type: 'user-list',
        users: userList
    }));
}

// Установка webhook для бота
async function setWebhook() {
    const webhookUrl = 'https://pozvonok.onrender.com/webhook/' + BOT_TOKEN;
    
    try {
        const response = await fetch(`${TELEGRAM_API}/setWebhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: webhookUrl })
        });
        
        const result = await response.json();
        console.log('Webhook установлен:', result);
    } catch (error) {
        console.error('Ошибка установки webhook:', error);
    }
}

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
    console.log(`Сервер запущен на http://${HOST}:${PORT}`);
    
    // Устанавливаем webhook при запуске
    if (process.env.NODE_ENV === 'production') {
        setTimeout(() => setWebhook(), 2000);
    }
});

