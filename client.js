let ws;
let myId;
let myUserName;
let customUserName = '';
let roomId = null;
let localStream;
let localVideoStream;
let peerConnections = new Map();
let isMuted = false;
let isVideoEnabled = false;
let isSpeakerMode = true; // Громкая связь по умолчанию
let users = new Map();
let audioContext;
let analyser;
let audioCheckInterval;

const config = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const joinBtn = document.getElementById('joinBtn');
const leaveBtn = document.getElementById('leaveBtn');
const muteBtn = document.getElementById('muteBtn');
const muteIcon = document.getElementById('muteIcon');
const videoBtn = document.getElementById('videoBtn');
const videoIcon = document.getElementById('videoIcon');
const conferenceControls = document.getElementById('conferenceControls');
const participantsBlock = document.getElementById('participantsBlock');
const userCount = document.getElementById('userCount');
const userCount2 = document.getElementById('userCount2');
const audioContainer = document.getElementById('audioContainer');
const videoGrid = document.getElementById('videoGrid');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const toggleChatBtn = document.getElementById('toggleChatBtn');
const nameModal = document.getElementById('nameModal');
const nameInput = document.getElementById('nameInput');
const nameSubmitBtn = document.getElementById('nameSubmitBtn');
const inviteBlock = document.getElementById('inviteBlock');
const inviteLink = document.getElementById('inviteLink');
const copyBtn = document.getElementById('copyBtn');
const inviteTelegramBtn = document.getElementById('inviteTelegramBtn');

function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}`);
    
    // Проверяем, есть ли roomId в URL
    const urlParams = new URLSearchParams(window.location.search);
    const urlRoomId = urlParams.get('room');
    if (urlRoomId) {
        roomId = urlRoomId;
        console.log('Присоединение к комнате:', roomId);
    }
    
    ws.onopen = () => {
        console.log('WebSocket подключен');
        updateStatus('connected', 'Подключено к серверу');
        joinBtn.disabled = false;
        
        // Если есть roomId в URL, присоединяемся к комнате
        if (roomId) {
            sendMessage({
                type: 'join-room',
                roomId: roomId
            });
        }
    };
    
    ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        
        switch(data.type) {
            case 'welcome':
                myId = data.clientId;
                myUserName = data.customName || data.userName;
                userCount.textContent = data.totalUsers;
                if (userCount2) userCount2.textContent = data.totalUsers;
                console.log('Мой ID:', myId, 'Имя:', myUserName);
                break;
            
            case 'name-updated':
                if (data.userId === myId) {
                    myUserName = data.customName;
                } else if (users.has(data.userId)) {
                    users.get(data.userId).userName = data.customName;
                    updateUserList();
                }
                break;
            
            case 'room-created':
                roomId = data.roomId;
                console.log('Комната создана:', roomId);
                updateInviteLink();
                
                // Отправляем ссылку в родительское окно (для Telegram Mini App)
                if (window.parent !== window) {
                    const link = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
                    window.parent.postMessage({
                        type: 'invite-link',
                        link: link,
                        roomId: roomId
                    }, '*');
                }
                break;
            
            case 'user-list':
                data.users.forEach(user => {
                    if (user.id !== myId) {
                        users.set(user.id, { userName: user.userName, audioLevel: 0 });
                    }
                });
                updateUserList();
                break;
                
            case 'user-joined':
                if (data.userId !== myId) {
                    users.set(data.userId, { userName: data.userName, audioLevel: 0 });
                    userCount.textContent = data.count;
                    if (userCount2) userCount2.textContent = data.count;
                    updateUserList();
                    
                    // Если мы уже в конференции, создаем соединение с новым пользователем
                    if (localStream) {
                        createOffer(data.userId);
                    }
                }
                break;
                
            case 'offer':
                await handleOffer(data);
                break;
                
            case 'answer':
                await handleAnswer(data);
                break;
                
            case 'ice-candidate':
                await handleIceCandidate(data);
                break;
                
            case 'user-left':
                handleUserLeft(data.userId);
                users.delete(data.userId);
                userCount.textContent = data.count;
                if (userCount2) userCount2.textContent = data.count;
                updateUserList();
                break;
            
            case 'audio-level':
                if (users.has(data.userId)) {
                    const user = users.get(data.userId);
                    user.audioLevel = data.level;
                    updateUserIndicator(data.userId, data.level);
                }
                break;
            
            case 'video-toggle':
                if (users.has(data.userId)) {
                    const user = users.get(data.userId);
                    user.videoEnabled = data.enabled;
                }
                break;
            
            case 'chat-message':
                addChatMessage(data.userName, data.message, data.userId === myId);
                break;
        }
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket ошибка:', error);
        updateStatus('disconnected', 'Ошибка подключения');
    };
    
    ws.onclose = () => {
        console.log('WebSocket отключен');
        updateStatus('disconnected', 'Отключено от сервера');
        joinBtn.disabled = true;
        leaveBtn.disabled = true;
        muteBtn.disabled = true;
    };
}

function showNameModal() {
    nameModal.classList.add('show');
    nameInput.focus();
}

function hideNameModal() {
    nameModal.classList.remove('show');
}

function submitName() {
    const name = nameInput.value.trim();
    if (!name) {
        nameInput.focus();
        return;
    }
    
    customUserName = name;
    myUserName = name;
    
    // Сохраняем имя в localStorage для последующих использований
    localStorage.setItem('pozvonok_username', name);
    
    // Обновляем отображение имени
    const myVideoNameEl = document.getElementById('myVideoName');
    if (myVideoNameEl) {
        myVideoNameEl.textContent = name;
    }
    
    const myUserEl = document.querySelector('.my-user .user-name');
    if (myUserEl) {
        myUserEl.textContent = name;
    }
    
    hideNameModal();
    
    // АВТОМАТИЧЕСКИ присоединяемся к конференции
    proceedToJoin();
}

async function proceedToJoin() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            } 
        });
        
        console.log('Микрофон получен');
        updateStatus('active', 'В конференции');
        
        const urlParams = new URLSearchParams(window.location.search);
        const isTelegram = urlParams.get('tg') === '1';
        
        // Скрываем контролы присоединения
        const joinControls = document.getElementById('joinControls');
        if (joinControls) {
            joinControls.style.display = 'none';
        }
        
        // В Telegram режиме скрываем кнопки управления и invite блок
        if (isTelegram) {
            conferenceControls.style.display = 'none';
            inviteBlock.style.display = 'none';
            toggleChatBtn.style.display = 'none'; // Скрываем плавающую кнопку чата
            
            // Показываем встроенный чат
            const chatContainer = document.getElementById('chatContainer');
            if (chatContainer) {
                chatContainer.classList.add('embedded');
                chatContainer.style.display = 'flex';
            }
        } else {
            conferenceControls.style.display = 'flex';
            inviteBlock.style.display = 'block';
        }
        
        participantsBlock.style.display = 'block';
        
        // Отправляем кастомное имя на сервер
        if (customUserName) {
            sendMessage({
                type: 'set-custom-name',
                customName: customUserName
            });
        }
        
        // Если нет комнаты, создаем новую
        if (!roomId) {
            sendMessage({
                type: 'create-room'
            });
        } else {
            updateInviteLink();
        }
        
        // Настраиваем анализатор звука
        setupAudioAnalyzer();
        
        // Создаем соединения со всеми существующими пользователями
        users.forEach((user, userId) => {
            createOffer(userId);
        });
        
    } catch (error) {
        console.error('Ошибка доступа к микрофону:', error);
        alert('Не удалось получить доступ к микрофону. Проверьте разрешения браузера.');
    }
}

async function joinConference() {
    // Сразу начинаем подключение, так как имя уже введено
    proceedToJoin();
}

async function createOffer(peerId) {
    console.log('Создаем оффер для', peerId);
    const pc = createPeerConnection(peerId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    sendMessage({
        type: 'offer',
        offer: offer,
        to: peerId
    });
}

async function handleOffer(data) {
    console.log('Получен offer от', data.from);
    
    if (!localStream) {
        console.log('Еще не в конференции, игнорируем оффер');
        return;
    }
    
    const pc = createPeerConnection(data.from);
    
    try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        sendMessage({
            type: 'answer',
            answer: answer,
            to: data.from
        });
    } catch (error) {
        console.error('Ошибка обработки оффера:', error);
    }
}

async function handleAnswer(data) {
    console.log('Получен answer от', data.from);
    
    const pc = peerConnections.get(data.from);
    if (!pc) {
        console.error('Нет peer connection для', data.from);
        return;
    }
    
    try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
    } catch (error) {
        console.error('Ошибка обработки ответа:', error);
    }
}

async function handleIceCandidate(data) {
    const pc = peerConnections.get(data.from);
    if (pc && data.candidate) {
        try {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (error) {
            console.error('Ошибка добавления ICE кандидата:', error);
        }
    }
}

function createPeerConnection(peerId) {
    if (peerConnections.has(peerId)) {
        return peerConnections.get(peerId);
    }
    
    const pc = new RTCPeerConnection(config);
    peerConnections.set(peerId, pc);
    
    // Добавляем локальный аудио стрим
    if (localStream) {
        localStream.getTracks().forEach(track => {
            pc.addTrack(track, localStream);
        });
    }
    
    // Добавляем локальный видео стрим если включен
    if (localVideoStream) {
        localVideoStream.getTracks().forEach(track => {
            pc.addTrack(track, localVideoStream);
        });
    }
    
    // Обработка ICE кандидатов
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            sendMessage({
                type: 'ice-candidate',
                candidate: event.candidate,
                to: peerId
            });
        }
    };
    
    // Получение удаленного стрима
    pc.ontrack = (event) => {
        console.log('Получен удаленный трек от', peerId, 'Тип:', event.track.kind);
        
        if (event.track.kind === 'audio') {
            let audio = document.getElementById(`audio-${peerId}`);
            if (!audio) {
                audio = document.createElement('audio');
                audio.id = `audio-${peerId}`;
                audio.autoplay = true;
                audioContainer.appendChild(audio);
            }
            
            if (!audio.srcObject) {
                audio.srcObject = new MediaStream();
            }
            audio.srcObject.addTrack(event.track);
            
            // Применяем текущий режим динамика
            audio.volume = isSpeakerMode ? 1.0 : 0.5;
            
            // Пытаемся установить аудио устройство если доступно
            if (!isSpeakerMode && typeof audio.setSinkId === 'function') {
                audio.setSinkId('default').catch(err => console.log('setSinkId error:', err));
            }
        } else if (event.track.kind === 'video') {
            let video = document.getElementById(`video-${peerId}`);
            if (!video) {
                addRemoteVideo(peerId);
                video = document.getElementById(`video-${peerId}`);
            }
            
            if (!video.srcObject) {
                video.srcObject = new MediaStream();
            }
            video.srcObject.addTrack(event.track);
            
            // Показываем видео контейнер
            const videoContainer = document.getElementById(`video-container-${peerId}`);
            if (videoContainer) {
                videoContainer.querySelector('.video-placeholder').style.display = 'none';
                video.style.display = 'block';
            }
        }
    };
    
    pc.onconnectionstatechange = () => {
        console.log(`Соединение с ${peerId}:`, pc.connectionState);
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            handleUserLeft(peerId);
        }
    };
    
    return pc;
}

function handleUserLeft(peerId) {
    const pc = peerConnections.get(peerId);
    if (pc) {
        pc.close();
        peerConnections.delete(peerId);
    }
    
    const audio = document.getElementById(`audio-${peerId}`);
    if (audio) {
        audio.remove();
    }
}

function leaveConference() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    if (localVideoStream) {
        localVideoStream.getTracks().forEach(track => track.stop());
        localVideoStream = null;
    }
    
    if (audioCheckInterval) {
        clearInterval(audioCheckInterval);
        audioCheckInterval = null;
    }
    
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
    
    peerConnections.forEach(pc => pc.close());
    peerConnections.clear();
    
    audioContainer.innerHTML = '';
    videoGrid.innerHTML = '';
    
    updateStatus('connected', 'Подключено к серверу');
    
    // Скрываем все элементы конференции
    const joinControls = document.getElementById('joinControls');
    if (joinControls) {
        joinControls.style.display = 'none';
    }
    conferenceControls.style.display = 'none';
    participantsBlock.style.display = 'none';
    inviteBlock.style.display = 'none';
    
    const urlParams = new URLSearchParams(window.location.search);
    const isTelegram = urlParams.get('tg') === '1';
    
    if (!isTelegram) {
        // В обычном вебе показываем модал для нового входа
        const savedName = localStorage.getItem('pozvonok_username');
        if (!savedName) {
            showNameModal();
        }
    }
    
    isMuted = false;
    isVideoEnabled = false;
    updateMuteButton();
    updateVideoButton();
}

function toggleMute() {
    if (!localStream) return;
    
    isMuted = !isMuted;
    localStream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
    });
    
    updateMuteButton();
}

function updateMuteButton() {
    if (isMuted) {
        muteIcon.textContent = '🔇';
        muteBtn.classList.add('muted');
        muteBtn.title = 'Включить микрофон';
    } else {
        muteIcon.textContent = '🎤';
        muteBtn.classList.remove('muted');
        muteBtn.title = 'Выключить микрофон';
    }
}

async function toggleVideo() {
    if (!isVideoEnabled) {
        try {
            localVideoStream = await navigator.mediaDevices.getUserMedia({ 
                video: {
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                    frameRate: { ideal: 30 },
                    facingMode: 'user'
                }
            });
            
            isVideoEnabled = true;
            
            // Показываем свое видео
            showMyVideo();
            
            // Добавляем видео треки во все существующие соединения
            peerConnections.forEach((pc, peerId) => {
                localVideoStream.getTracks().forEach(track => {
                    pc.addTrack(track, localVideoStream);
                });
            });
            
            // Уведомляем всех о включении видео
            sendMessage({
                type: 'video-toggle',
                enabled: true
            });
            
            // Пересоздаем соединения для передачи видео
            const userIds = Array.from(users.keys());
            for (const userId of userIds) {
                await renegotiateConnection(userId);
            }
            
        } catch (error) {
            console.error('Ошибка доступа к камере:', error);
            alert('Не удалось получить доступ к камере. Проверьте разрешения браузера.');
            return;
        }
    } else {
        // Выключаем видео
        if (localVideoStream) {
            localVideoStream.getTracks().forEach(track => track.stop());
            localVideoStream = null;
        }
        
        isVideoEnabled = false;
        hideMyVideo();
        
        // Уведомляем всех о выключении видео
        sendMessage({
            type: 'video-toggle',
            enabled: false
        });
    }
    
    updateVideoButton();
}

function updateVideoButton() {
    if (isVideoEnabled) {
        videoIcon.textContent = '📹';
        videoBtn.classList.add('active');
        videoBtn.title = 'Выключить камеру';
    } else {
        videoIcon.textContent = '📹';
        videoBtn.classList.remove('active');
        videoBtn.title = 'Включить камеру';
    }
}

async function renegotiateConnection(peerId) {
    const pc = peerConnections.get(peerId);
    if (!pc) return;
    
    try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        
        sendMessage({
            type: 'offer',
            offer: offer,
            to: peerId
        });
    } catch (error) {
        console.error('Ошибка пересоздания соединения:', error);
    }
}

function showMyVideo() {
    const myVideoContainer = document.getElementById('myVideoContainer');
    const myVideo = document.getElementById('myVideo');
    
    if (myVideo && localVideoStream) {
        myVideo.srcObject = localVideoStream;
        myVideoContainer.querySelector('.video-placeholder').style.display = 'none';
        myVideo.style.display = 'block';
    }
}

function hideMyVideo() {
    const myVideoContainer = document.getElementById('myVideoContainer');
    const myVideo = document.getElementById('myVideo');
    
    if (myVideo) {
        myVideo.srcObject = null;
        myVideo.style.display = 'none';
        myVideoContainer.querySelector('.video-placeholder').style.display = 'flex';
    }
}

function addRemoteVideo(userId) {
    const user = users.get(userId);
    if (!user) return;
    
    const videoContainer = document.createElement('div');
    videoContainer.className = 'video-item';
    videoContainer.id = `video-container-${userId}`;
    
    videoContainer.innerHTML = `
        <video id="video-${userId}" autoplay playsinline></video>
        <div class="video-placeholder">
            <div class="video-placeholder-icon">👤</div>
        </div>
        <div class="video-name">${user.userName}</div>
        <div class="video-indicator" id="video-indicator-${userId}"></div>
    `;
    
    videoGrid.appendChild(videoContainer);
}

function updateStatus(state, text) {
    statusDot.className = 'status-dot ' + state;
    statusText.textContent = text;
}

function sendMessage(data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
}

function setupAudioAnalyzer() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(localStream);
    source.connect(analyser);
    analyser.fftSize = 256;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    audioCheckInterval = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / bufferLength;
        const level = Math.min(100, (average / 128) * 100);
        
        // Отправляем уровень звука на сервер
        sendMessage({
            type: 'audio-level',
            level: level
        });
        
        // Обновляем свой индикатор
        updateMyIndicator(level);
    }, 100);
}

function updateUserList() {
    const container = document.getElementById('userListContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    users.forEach((user, userId) => {
        const userDiv = document.createElement('div');
        userDiv.className = 'user-item';
        userDiv.id = `user-${userId}`;
        userDiv.innerHTML = `
            <div class="user-indicator" id="indicator-${userId}"></div>
            <div class="user-name">${user.userName}</div>
        `;
        container.appendChild(userDiv);
    });
}

function updateUserIndicator(userId, level) {
    const indicator = document.getElementById(`indicator-${userId}`);
    if (indicator) {
        const opacity = 0.3 + (level / 100) * 0.7;
        const scale = 1 + (level / 100) * 0.5;
        indicator.style.opacity = opacity;
        indicator.style.transform = `scale(${scale})`;
    }
    
    // Обновляем также индикатор на видео
    const videoIndicator = document.getElementById(`video-indicator-${userId}`);
    if (videoIndicator) {
        if (level > 10) {
            videoIndicator.classList.add('speaking');
        } else {
            videoIndicator.classList.remove('speaking');
        }
    }
}

function updateMyIndicator(level) {
    const indicator = document.getElementById('myIndicator');
    if (indicator) {
        const opacity = 0.3 + (level / 100) * 0.7;
        const scale = 1 + (level / 100) * 0.5;
        indicator.style.opacity = opacity;
        indicator.style.transform = `scale(${scale})`;
    }
}

function sendChatMessage() {
    const message = chatInput.value.trim();
    if (!message || !localStream) return;
    
    sendMessage({
        type: 'chat-message',
        message: message
    });
    
    chatInput.value = '';
    
    // Скрываем input в Telegram режиме после отправки
    const urlParams = new URLSearchParams(window.location.search);
    const isTelegram = urlParams.get('tg') === '1';
    if (isTelegram) {
        const chatContainer = document.getElementById('chatContainer');
        chatContainer.classList.remove('input-open');
    }
}

function addChatMessage(userName, message, isOwn = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${isOwn ? 'own' : ''}`;
    
    const time = new Date().toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    // Используем customUserName если сообщение от нас
    const displayName = isOwn ? (customUserName || myUserName || 'Вы') : userName;
    
    messageDiv.innerHTML = `
        <div class="chat-message-header">
            <span class="chat-message-author">${displayName}</span>
            <span class="chat-message-time">${time}</span>
        </div>
        <div class="chat-message-text">${escapeHtml(message)}</div>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Показываем уведомление если чат свернут и сообщение не от нас
    if (!isOwn && !document.getElementById('chatContainer').classList.contains('open')) {
        const badge = document.getElementById('chatBadge');
        badge.style.display = 'flex';
        const count = parseInt(badge.textContent) || 0;
        badge.textContent = count + 1;
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function toggleChat() {
    const chatContainer = document.getElementById('chatContainer');
    const badge = document.getElementById('chatBadge');
    
    chatContainer.classList.toggle('open');
    
    if (chatContainer.classList.contains('open')) {
        badge.style.display = 'none';
        badge.textContent = '0';
        chatInput.focus();
    }
}

function openChatInput() {
    const chatContainer = document.getElementById('chatContainer');
    chatContainer.classList.add('input-open');
    chatInput.focus();
}

async function toggleSpeaker() {
    isSpeakerMode = !isSpeakerMode;
    
    const audioElements = document.querySelectorAll('audio');
    
    if (isSpeakerMode) {
        // Громкая связь - максимальная громкость
        audioElements.forEach(audio => {
            audio.volume = 1.0;
            
            // Пытаемся включить громкую связь через setSinkId (если поддерживается)
            if (typeof audio.setSinkId === 'function') {
                navigator.mediaDevices.enumerateDevices().then(devices => {
                    const speaker = devices.find(device => 
                        device.kind === 'audiooutput' && 
                        device.label.toLowerCase().includes('speaker')
                    );
                    if (speaker) {
                        audio.setSinkId(speaker.deviceId).catch(err => {
                            console.log('setSinkId не поддерживается:', err);
                        });
                    }
                });
            }
        });
    } else {
        // Обычный режим (ближе к телефонному динамику)
        audioElements.forEach(audio => {
            audio.volume = 0.5;
            
            // Пытаемся переключить на телефонный динамик
            if (typeof audio.setSinkId === 'function') {
                audio.setSinkId('default').catch(err => {
                    console.log('setSinkId не поддерживается:', err);
                });
            }
        });
    }
    
    console.log('Режим динамика:', isSpeakerMode ? 'Громкая связь (100%)' : 'Обычный (50%)');
    
    // Уведомляем родительское окно (Telegram) об изменении
    if (window.parent !== window) {
        window.parent.postMessage({
            type: 'speaker-changed',
            speakerMode: isSpeakerMode
        }, '*');
    }
}

// Event listeners
joinBtn.addEventListener('click', joinConference);
leaveBtn.addEventListener('click', leaveConference);
muteBtn.addEventListener('click', toggleMute);
videoBtn.addEventListener('click', toggleVideo);
sendBtn.addEventListener('click', sendChatMessage);
toggleChatBtn.addEventListener('click', toggleChat);

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
    }
});

nameSubmitBtn.addEventListener('click', submitName);

nameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        submitName();
    }
});

nameInput.addEventListener('input', () => {
    nameSubmitBtn.disabled = !nameInput.value.trim();
});

copyBtn.addEventListener('click', () => {
    inviteLink.select();
    inviteLink.setSelectionRange(0, 99999); // For mobile
    
    navigator.clipboard.writeText(inviteLink.value).then(() => {
        copyBtn.textContent = '✅';
        setTimeout(() => {
            copyBtn.textContent = '📋';
        }, 2000);
    }).catch(err => {
        console.error('Ошибка копирования:', err);
    });
});

inviteLink.addEventListener('click', () => {
    inviteLink.select();
});

if (inviteTelegramBtn) {
    inviteTelegramBtn.addEventListener('click', inviteTelegramContacts);
}

function updateInviteLink() {
    if (roomId) {
        const urlParams = new URLSearchParams(window.location.search);
        const isTelegram = urlParams.get('tg') === '1';
        
        let link;
        
        if (isTelegram) {
            // Для Telegram Mini App используем Deep Link на бота
            link = `https://t.me/pozuonok_bot/PoZvonok?startapp=${roomId}`;
        } else {
            // Для обычного веба
            const baseUrl = window.location.origin + window.location.pathname;
            link = `${baseUrl}?room=${roomId}`;
        }
        
        inviteLink.value = link;
        
        // Показываем кнопку приглашения контактов только в Telegram
        if (isTelegram && inviteTelegramBtn) {
            inviteTelegramBtn.style.display = 'block';
        }
        
        // Отправляем ссылку в родительское окно для Telegram
        if (window.parent !== window && isTelegram) {
            window.parent.postMessage({
                type: 'invite-link',
                link: link,
                roomId: roomId
            }, '*');
        }
    }
}

function inviteTelegramContacts() {
    if (!inviteLink.value) {
        alert('Пригласительная ссылка не готова');
        return;
    }
    
    // Проверяем, что мы в iframe Telegram Mini App
    if (window.parent !== window) {
        // Отправляем сообщение родительскому окну для вызова Telegram API
        window.parent.postMessage({
            type: 'request-invite-contacts',
            link: inviteLink.value
        }, '*');
    } else {
        // Fallback - просто копируем ссылку
        copyBtn.click();
    }
}

// Подключаемся при загрузке страницы
connectWebSocket();

// Показываем модал с именем сразу при загрузке
window.addEventListener('DOMContentLoaded', () => {
    // Проверяем, запущено ли из Telegram Mini App
    const urlParams = new URLSearchParams(window.location.search);
    const isTelegram = urlParams.get('tg') === '1';
    const autoName = urlParams.get('name');
    
    if (isTelegram && autoName) {
        // Telegram Mini App - автоматически устанавливаем имя и присоединяемся
        customUserName = decodeURIComponent(autoName);
        myUserName = customUserName;
        
        // Сохраняем имя
        localStorage.setItem('pozvonok_username', customUserName);
        
        const myUserNameEl = document.getElementById('myUserName');
        if (myUserNameEl) {
            myUserNameEl.textContent = customUserName;
        }
        
        joinBtn.disabled = false;
        
        // Скрываем header для Telegram
        const appHeader = document.querySelector('.app-header');
        if (appHeader) {
            appHeader.style.display = 'none';
        }
        
        // Адаптация под мобилу для Telegram
        document.body.style.paddingTop = '10px';
        const container = document.querySelector('.container');
        if (container) {
            container.style.padding = '20px';
            container.style.margin = '0';
            container.style.maxWidth = '100%';
            container.style.width = '100%';
            container.style.borderRadius = '0';
        }
        
        // Слушаем команды от родительского окна (Telegram)
        window.addEventListener('message', (event) => {
            const data = event.data;
            
            switch(data.type) {
                case 'toggle-video':
                    toggleVideo();
                    break;
                case 'toggle-mute':
                    toggleMute();
                    break;
                case 'leave-conference':
                    leaveConference();
                    break;
                case 'open-chat-input':
                    openChatInput();
                    break;
                case 'toggle-speaker':
                    toggleSpeaker();
                    break;
            }
        });
    } else {
        // Обычный веб - проверяем сохраненное имя
        const savedName = localStorage.getItem('pozvonok_username');
        if (savedName) {
            // Имя уже есть - автоматически присоединяемся
            customUserName = savedName;
            myUserName = savedName;
            
            const myVideoNameEl = document.getElementById('myVideoName');
            if (myVideoNameEl) {
                myVideoNameEl.textContent = savedName;
            }
            
            const myUserEl = document.getElementById('myUserName');
            if (myUserEl) {
                myUserEl.textContent = savedName;
            }
            
            // Автоматически входим в конференцию
            setTimeout(() => {
                proceedToJoin();
            }, 500);
        } else {
            // Имени нет - показываем модал
            nameInput.value = '';
            showNameModal();
        }
        
        joinBtn.disabled = true;
    }
    
    const myVideoContainer = document.createElement('div');
    myVideoContainer.className = 'video-item my-video';
    myVideoContainer.id = 'myVideoContainer';
    
    myVideoContainer.innerHTML = `
        <video id="myVideo" autoplay playsinline muted></video>
        <div class="video-placeholder">
            <div class="video-placeholder-icon">👤</div>
        </div>
        <div class="video-name" id="myVideoName">${customUserName || 'Вы'}</div>
        <div class="video-indicator" id="myVideoIndicator"></div>
    `;
    
    videoGrid.appendChild(myVideoContainer);
});

