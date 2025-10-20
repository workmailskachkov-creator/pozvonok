const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static('.'));
app.use(express.json());

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

const clients = new Map();
const rooms = new Map(); // roomId -> Set of clientIds
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
                    // Отправляем конкретному получателю в той же комнате
                    if (data.to) {
                        const sender = clients.get(clientId);
                        const recipient = clients.get(data.to);
                        
                        // Проверяем, что оба в одной комнате
                        if (sender && recipient && 
                            sender.roomId === recipient.roomId &&
                            recipient.ws.readyState === WebSocket.OPEN) {
                            recipient.ws.send(JSON.stringify({ ...data, from: clientId }));
                        }
                    }
                    break;
                case 'audio-level':
                    // Транслируем уровень звука всем в комнате
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
                    // Транслируем сообщение чата всем в комнате
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
                    // Устанавливаем кастомное имя пользователя
                    const client = clients.get(clientId);
                    if (client && data.customName) {
                        const customName = sanitizeName(data.customName);
                        client.customName = customName;
                        console.log(`${client.userName} сменил имя на ${customName}`);
                        
                        // Уведомляем всех в комнате об обновлении имени
                        broadcastToRoom(client.roomId, {
                            type: 'name-updated',
                            userId: clientId,
                            customName: customName
                        });
                    }
                    break;
                case 'create-room':
                    // Создаем новую комнату
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
                        
                        // Отправляем список пользователей в комнате
                        sendRoomUserList(clientId, newRoomId);
                        
                        // Уведомляем других в комнате
                        broadcastToRoom(newRoomId, {
                            type: 'user-joined',
                            userId: clientId,
                            userName: creator.customName || creator.userName,
                            count: rooms.get(newRoomId).size
                        }, clientId);
                    }
                    break;
                case 'join-room':
                    // Присоединяемся к существующей комнате
                    if (data.roomId) {
                        const joiner = clients.get(clientId);
                        if (joiner) {
                            joiner.roomId = data.roomId;
                            
                            if (!rooms.has(data.roomId)) {
                                rooms.set(data.roomId, new Set());
                            }
                            rooms.get(data.roomId).add(clientId);
                            
                            console.log(`${joiner.customName || joiner.userName} присоединился к комнате ${data.roomId}`);
                            
                            // Отправляем список пользователей в комнате
                            sendRoomUserList(clientId, data.roomId);
                            
                            // Уведомляем других в комнате
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
        
        // Удаляем из комнаты
        if (userRoomId && rooms.has(userRoomId)) {
            rooms.get(userRoomId).delete(clientId);
            
            // Если комната пуста, удаляем её
            if (rooms.get(userRoomId).size === 0) {
                rooms.delete(userRoomId);
                console.log(`Комната ${userRoomId} удалена (пустая)`);
            } else {
                // Уведомляем оставшихся в комнате
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

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
    console.log(`Сервер запущен на http://${HOST}:${PORT}`);
});

