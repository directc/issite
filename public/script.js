const API_URL = '/api';

let currentUser = null;
let mines = {};
let chatMessages = [];

// DOM элементы
const loginForm = document.getElementById('loginForm');
const mainContainer = document.getElementById('mainContainer');
const profileContainer = document.getElementById('profileContainer');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const profileBtn = document.getElementById('profileBtn');
const backBtn = document.getElementById('backBtn');
const logoutBtn = document.getElementById('logoutBtn');
const profileInfo = document.getElementById('profileInfo');
const timersContainer = document.getElementById('timersContainer');
const chatMessagesContainer = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const createUserBtn = document.getElementById('createUserBtn');
const adminControlsBtn = document.getElementById('adminControlsBtn');
const createUserModal = document.getElementById('createUserModal');
const editTimersModal = document.getElementById('editTimersModal');

// Форматирование времени
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Обновление таймеров
function updateTimers() {
    timersContainer.innerHTML = '';
    
    for (const [name, data] of Object.entries(mines)) {
        const timerDiv = document.createElement('div');
        timerDiv.className = 'timer';
        
        if (data.current_seconds <= 20 && data.current_seconds > 0) {
            timerDiv.classList.add('alert');
        } else if (data.current_seconds <= 60) {
            timerDiv.classList.add('warning');
        }
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'timer-name';
        nameSpan.textContent = name;
        
        const timeSpan = document.createElement('span');
        timeSpan.className = 'timer-time';
        timeSpan.textContent = `${formatTime(data.current_seconds)} / ${formatTime(data.max_seconds)}`;
        
        timerDiv.appendChild(nameSpan);
        timerDiv.appendChild(timeSpan);
        timersContainer.appendChild(timerDiv);
    }
}

// Обновление чата
function updateChat() {
    chatMessagesContainer.innerHTML = '';
    
    chatMessages.forEach(msg => {
        const isOwn = currentUser && msg.sender_id === currentUser.id;
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isOwn ? 'own-message' : 'other-message'}`;
        
        const senderSpan = document.createElement('span');
        senderSpan.className = 'message-sender';
        senderSpan.textContent = msg.username;
        
        const timeSpan = document.createElement('span');
        timeSpan.className = 'message-time';
        timeSpan.textContent = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const textDiv = document.createElement('div');
        textDiv.textContent = msg.message;
        
        messageDiv.appendChild(senderSpan);
        messageDiv.appendChild(timeSpan);
        messageDiv.appendChild(textDiv);
        chatMessagesContainer.appendChild(messageDiv);
    });
    
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

// Обновление профиля
function updateProfile() {
    profileInfo.innerHTML = `
        <p><strong>Имя:</strong> ${currentUser.username}</p>
        <p><strong>Роль:</strong> ${currentUser.is_admin ? 'Администратор' : 'Пользователь'}</p>
        <p><strong>Статус:</strong> Активен</p>
    `;
}

// Показать/скрыть модальные окна
function showModal(modal) {
    modal.style.display = 'flex';
}

function closeModal(modal) {
    modal.style.display = 'none';
}

// API функции
async function login() {
    const username = usernameInput.value;
    const password = passwordInput.value;
    
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            
            // Обновляем UI
            profileBtn.textContent = currentUser.username.charAt(0).toUpperCase();
            loginForm.style.display = 'none';
            mainContainer.classList.add('active-container');
            
            if (currentUser.is_admin) {
                createUserBtn.style.display = 'block';
                adminControlsBtn.style.display = 'block';
            }
            
            // Загружаем данные
            await loadMines();
            await loadChat();
            updateProfile();
            
            // Запускаем автообновление
            startAutoUpdate();
        } else {
            const error = await response.json();
            alert(error.detail || 'Ошибка входа');
        }
    } catch (err) {
        console.error('Login error:', err);
        alert('Ошибка соединения');
    }
}

async function logout() {
    try {
        await fetch(`${API_URL}/auth/logout`, { method: 'POST' });
        currentUser = null;
        mainContainer.classList.remove('active-container');
        profileContainer.classList.remove('active-container');
        loginForm.style.display = 'block';
        usernameInput.value = '';
        passwordInput.value = '';
    } catch (err) {
        console.error('Logout error:', err);
    }
}

async function loadMines() {
    try {
        const response = await fetch(`${API_URL}/mines`);
        if (response.ok) {
            mines = await response.json();
            updateTimers();
        }
    } catch (err) {
        console.error('Load mines error:', err);
    }
}

async function loadChat() {
    try {
        const response = await fetch(`${API_URL}/chat`);
        if (response.ok) {
            chatMessages = await response.json();
            updateChat();
        }
    } catch (err) {
        console.error('Load chat error:', err);
    }
}

async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message || !currentUser) return;
    
    try {
        const response = await fetch(`${API_URL}/chat`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentUser.token}`
            },
            body: JSON.stringify({ message })
        });
        
        if (response.ok) {
            chatInput.value = '';
            await loadChat();
        }
    } catch (err) {
        console.error('Send message error:', err);
    }
}

async function createUser() {
    const username = document.getElementById('newUsername').value;
    const password = document.getElementById('newPassword').value;
    
    if (!username || !password) {
        alert('Логин и пароль не могут быть пустыми!');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/users`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentUser.token}`
            },
            body: JSON.stringify({ username, password })
        });
        
        if (response.ok) {
            alert('Пользователь создан!');
            closeModal(createUserModal);
        } else {
            const error = await response.json();
            alert(error.detail || 'Ошибка создания пользователя');
        }
    } catch (err) {
        console.error('Create user error:', err);
        alert('Ошибка соединения');
    }
}

async function updateMines() {
    try {
        const response = await fetch(`${API_URL}/mines`);
        if (response.ok) {
            mines = await response.json();
            updateTimers();
        }
    } catch (err) {
        console.error('Update mines error:', err);
    }
}

// Автообновление данных
function startAutoUpdate() {
    setInterval(updateMines, 1000);
    setInterval(loadChat, 5000);
}

// Обработчики событий
loginBtn.addEventListener('click', login);
logoutBtn.addEventListener('click', logout);
sendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});
profileBtn.addEventListener('click', () => {
    mainContainer.classList.remove('active-container');
    profileContainer.classList.add('active-container');
});
backBtn.addEventListener('click', () => {
    profileContainer.classList.remove('active-container');
    mainContainer.classList.add('active-container');
});
createUserBtn.addEventListener('click', () => showModal(createUserModal));
adminControlsBtn.addEventListener('click', async () => {
    // Загружаем данные для редактирования
    try {
        const response = await fetch(`${API_URL}/mines`);
        if (response.ok) {
            const minesData = await response.json();
            const container = document.getElementById('timersEditContainer');
            container.innerHTML = '';
            
            minesData.forEach(mine => {
                const timerDiv = document.createElement('div');
                timerDiv.className = 'timer';
                
                const nameSpan = document.createElement('span');
                nameSpan.className = 'timer-name';
                nameSpan.textContent = mine.name;
                
                const maxTimeInput = document.createElement('input');
                maxTimeInput.type = 'number';
                maxTimeInput.value = mine.max_seconds;
                maxTimeInput.min = 1;
                maxTimeInput.dataset.id = mine.id;
                maxTimeInput.style.width = '80px';
                maxTimeInput.style.textAlign = 'center';
                
                timerDiv.appendChild(nameSpan);
                timerDiv.appendChild(maxTimeInput);
                container.appendChild(timerDiv);
            });
            
            showModal(editTimersModal);
        }
    } catch (err) {
        console.error('Load mines for edit error:', err);
    }
});
document.getElementById('confirmCreateUserBtn').addEventListener('click', createUser);
document.getElementById('cancelCreateUserBtn').addEventListener('click', () => closeModal(createUserModal));
document.getElementById('saveTimersBtn').addEventListener('click', async () => {
    const inputs = document.querySelectorAll('#timersEditContainer input');
    const updates = [];
    
    inputs.forEach(input => {
        updates.push({
            id: input.dataset.id,
            max_seconds: parseInt(input.value)
        });
    });
    
    try {
        const response = await fetch(`${API_URL}/mines`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentUser.token}`
            },
            body: JSON.stringify({ mines: updates })
        });
        
        if (response.ok) {
            await loadMines();
            closeModal(editTimersModal);
        }
    } catch (err) {
        console.error('Update mines error:', err);
    }
});
document.getElementById('cancelEditTimersBtn').addEventListener('click', () => closeModal(editTimersModal));
