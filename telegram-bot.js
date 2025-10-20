const express = require('express');
const app = express();

app.use(express.json());
app.use(express.static('.'));

// Telegram Mini App endpoint
app.get('/telegram', (req, res) => {
    res.sendFile(__dirname + '/telegram.html');
});

// Валидация данных от Telegram
app.post('/api/validate-telegram', (req, res) => {
    const { initData } = req.body;
    
    // В продакшене здесь нужна проверка подписи от Telegram
    // Для разработки просто принимаем
    
    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Telegram Mini App запущен на http://localhost:${PORT}/telegram`);
});

