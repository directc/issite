// Инициализация Supabase клиента
const supabaseUrl = 'https://pnqliwwrebtnngtmmfwc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBucWxpd3dyZWJ0bm5ndG1tZndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYyMzA1ODQsImV4cCI6MjA2MTgwNjU4NH0.mqjU6-ow_BgjsioIe7IHo_5l5LrIWgThTJ0ciIJLEk0';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// Состояние приложения
let mines = [];

// Основная функция инициализации
document.addEventListener('DOMContentLoaded', async () => {
  // Проверяем текущую сессию
  const { data: { user } } = await supabase.auth.getUser();
  
  if (user) {
    // Пользователь авторизован
    await handleSuccessfulAuth(user);
  } else {
    // Показываем форму входа
    showAuthForm();
    setupAuthHandlers();
  }
});

// Обработка успешной авторизации
async function handleSuccessfulAuth(user) {
  // Скрываем форму, показываем приложение
  document.getElementById('auth-container').style.display = 'none';
  document.getElementById('app-container').style.display = 'block';
  
  // Проверяем права администратора
  const { data: adminUser, error } = await supabase
    .from('users')
    .select('is_admin')
    .eq('uuid', user.id)
    .single();

  if (error || !adminUser?.is_admin) {
    alert('Требуются права администратора');
    await supabase.auth.signOut();
    showAuthForm();
    return;
  }

  // Инициализируем приложение
  await initApp();
}

// Показать форму авторизации
function showAuthForm() {
  document.getElementById('auth-container').style.display = 'flex';
  document.getElementById('app-container').style.display = 'none';
}

// Настройка обработчиков авторизации
function setupAuthHandlers() {
  // Переключение между вкладками
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      btn.classList.add('active');
      document.getElementById(`${btn.dataset.tab}-form`).classList.add('active');
      document.getElementById('auth-message').textContent = '';
    });
  });

  // Обработчик входа
  document.getElementById('login-btn').addEventListener('click', async () => {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value.trim();
    
    if (!email || !password) {
      showAuthMessage('Заполните все поля', 'error');
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      showAuthMessage(error.message, 'error');
      return;
    }

    await handleSuccessfulAuth(data.user);
  });

  // Обработчик регистрации
  document.getElementById('register-btn').addEventListener('click', async () => {
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value.trim();
    const username = document.getElementById('register-username').value.trim();
    
    if (!email || !password || !username) {
      showAuthMessage('Заполните все поля', 'error');
      return;
    }

    try {
      // Регистрация в Supabase Auth
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
      
      if (signUpError) throw signUpError;
      
      // Создание записи в таблице users
      const { error: userError } = await supabase
        .from('users')
        .insert({
          uuid: signUpData.user.id,
          username,
          is_admin: false // По умолчанию новые пользователи не админы
        });
      
      if (userError) throw userError;
      
      showAuthMessage('Регистрация успешна! Подтвердите email и войдите', 'success');
      document.querySelector('.tab-btn[data-tab="login"]').click();
    } catch (error) {
      showAuthMessage(error.message, 'error');
    }
  });
}

// Показать сообщение в форме авторизации
function showAuthMessage(message, type = 'info') {
  const authMessage = document.getElementById('auth-message');
  authMessage.textContent = message;
  authMessage.className = `auth-message ${type}`;
}

// Инициализация основного приложения
async function initApp() {
  // Загрузка данных
  await loadMines();
  await loadChat();
  
  // Настройка обработчиков
  document.getElementById('sendBtn').addEventListener('click', sendMessage);
  document.getElementById('chatInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
  
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabase.auth.signOut();
    showAuthForm();
  });

  // Запуск таймеров
  startTimers();
  setupRealtimeChat();
}

// =============== Функции работы с таймерами ===============
async function loadMines() {
  const { data, error } = await supabase.from('mines').select('*');
  if (error) return console.error('Ошибка загрузки таймеров:', error);
  
  mines = data.map(mine => {
    const elapsed = Math.floor((Date.now() - new Date(mine.updated_at).getTime()) / 1000);
    let current = mine.current_seconds - elapsed;
    if (current <= 0) current = mine.max_seconds - (Math.abs(current) % mine.max_seconds);
    return { ...mine, current_seconds: current };
  });
  
  updateTimers();
}

function updateTimers() {
  const timersContainer = document.getElementById('timersContainer');
  timersContainer.innerHTML = mines.map(mine => `
    <div class="timer ${mine.current_seconds <= 60 ? 'warning' : ''}">
      <span class="timer-name">${mine.name}</span>
      <span class="timer-time">${formatTime(mine.current_seconds)} / ${formatTime(mine.max_seconds)}</span>
    </div>
  `).join('');
}

function startTimers() {
  setInterval(async () => {
    mines.forEach(mine => {
      mine.current_seconds = Math.max(0, mine.current_seconds - 1);
      if (mine.current_seconds <= 0) mine.current_seconds = mine.max_seconds;
    });
    
    updateTimers();
    
    // Синхронизация с сервером каждые 10 секунд
    if (Date.now() % 10000 < 50) {
      const updates = mines.map(mine => ({
        id: mine.id,
        current_seconds: mine.current_seconds,
        updated_at: new Date().toISOString()
      }));
      
      const { error } = await supabase.from('mines').upsert(updates);
      if (error) console.error('Ошибка синхронизации:', error);
    }
  }, 1000);
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// =============== Функции работы с чатом ===============
async function loadChat() {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('id, message, created_at, users:user_id (username)')
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) throw error;
    
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = data.reverse().map(msg => `
      <div class="message">
        <strong>${msg.users?.username || 'Гость'}</strong>
        <span class="message-time">${new Date(msg.created_at).toLocaleTimeString()}</span>
        <div class="message-content">${msg.message}</div>
      </div>
    `).join('');
    
    chatMessages.scrollTop = chatMessages.scrollHeight;
  } catch (error) {
    console.error('Ошибка загрузки чата:', error);
  }
}

async function sendMessage() {
  const message = document.getElementById('chatInput').value.trim();
  if (!message) return;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Требуется авторизация');
    
    const { error } = await supabase
      .from('chat_messages')
      .insert({ 
        message, 
        user_id: user.id 
      });
    
    if (error) throw error;
    
    document.getElementById('chatInput').value = '';
  } catch (error) {
    console.error('Ошибка отправки:', error);
    alert(error.message);
  }
}

function setupRealtimeChat() {
  supabase
    .channel('chat_changes')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages'
      },
      () => loadChat()
    )
    .subscribe();
}
