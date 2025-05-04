// Инициализация Supabase клиента (глобально)
const supabaseUrl = 'https://pnqliwwrebtnngtmmfwc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBucWxpd3dyZWJ0bm5ndG1tZndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYyMzA1ODQsImV4cCI6MjA2MTgwNjU4NH0.mqjU6-ow_BgjsioIe7IHo_5l5LrIWgThTJ0ciIJLEk0';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// Состояние приложения
let mines = [];
let currentUser = null;

// Основная функция инициализации
document.addEventListener('DOMContentLoaded', async () => {
  // Проверяем текущую сессию
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (user) {
      currentUser = user;
      await handleSuccessfulAuth();
    } else {
      showAuthForm();
    }
  } catch (error) {
    console.error('Ошибка проверки сессии:', error);
    showAuthForm();
  }
  
  setupAuthHandlers();
});

// Обработка успешной авторизации
async function handleSuccessfulAuth() {
  try {
    // Скрываем форму, показываем приложение
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('app-container').style.display = 'block';
    
    // Проверяем/создаем запись пользователя
    const { data: dbUser, error: userError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('uuid', currentUser.id)
      .single();

    if (userError || !dbUser) {
      await createUserRecord();
    }

    // Инициализируем приложение
    await initApp();
  } catch (error) {
    console.error('Ошибка авторизации:', error);
    showAuthMessage('Ошибка авторизации', 'error');
    await supabase.auth.signOut();
    showAuthForm();
  }
}

// Создание записи пользователя
async function createUserRecord() {
  const { error } = await supabase
    .from('users')
    .insert({
      uuid: currentUser.id,
      username: currentUser.email.split('@')[0],
      is_admin: false
    });
  
  if (error) throw error;
}

// Показать форму авторизации
function showAuthForm() {
  document.getElementById('auth-container').style.display = 'flex';
  document.getElementById('app-container').style.display = 'none';
  document.getElementById('auth-message').textContent = '';
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
  document.getElementById('login-btn').addEventListener('click', handleLogin);

  // Обработчик регистрации
  document.getElementById('register-btn').addEventListener('click', handleRegister);
}

// Обработка входа
async function handleLogin() {
  try {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value.trim();
    
    if (!email || !password) {
      showAuthMessage('Заполните все поля', 'error');
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) throw error;

    currentUser = data.user;
    await handleSuccessfulAuth();
  } catch (error) {
    showAuthMessage(error.message || 'Ошибка входа', 'error');
    console.error('Ошибка входа:', error);
  }
}

// Обработка регистрации
async function handleRegister() {
  try {
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value.trim();
    const username = document.getElementById('register-username').value.trim();
    
    if (!email || !password || !username) {
      showAuthMessage('Заполните все поля', 'error');
      return;
    }

    // Регистрация в Supabase Auth
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        data: {
          username
        }
      }
    });
    
    if (signUpError) throw signUpError;
    
    showAuthMessage('Регистрация успешна! Проверьте email для подтверждения', 'success');
    document.querySelector('.tab-btn[data-tab="login"]').click();
  } catch (error) {
    showAuthMessage(error.message || 'Ошибка регистрации', 'error');
    console.error('Ошибка регистрации:', error);
  }
}

// Показать сообщение в форме авторизации
function showAuthMessage(message, type = 'info') {
  const authMessage = document.getElementById('auth-message');
  authMessage.textContent = message;
  authMessage.className = `auth-message ${type}`;
}

// Инициализация основного приложения
async function initApp() {
  try {
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
      currentUser = null;
      showAuthForm();
    });

    // Запуск таймеров
    startTimers();
    setupRealtimeChat();
  } catch (error) {
    console.error('Ошибка инициализации приложения:', error);
  }
}

// =============== Таймеры шахт ===============
async function loadMines() {
  try {
    const { data, error } = await supabase.from('mines').select('*');
    if (error) throw error;
    
    mines = data.map(mine => {
      const elapsed = Math.floor((Date.now() - new Date(mine.updated_at).getTime()) / 1000);
      let current = mine.current_seconds - elapsed;
      if (current <= 0) current = mine.max_seconds - (Math.abs(current) % mine.max_seconds);
      return { ...mine, current_seconds: current };
    });
    
    updateTimers();
  } catch (error) {
    console.error('Ошибка загрузки шахт:', error);
  }
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
      try {
        const updates = mines.map(mine => ({
          id: mine.id,
          current_seconds: mine.current_seconds,
          updated_at: new Date().toISOString()
        }));
        
        const { error } = await supabase.from('mines').upsert(updates);
        if (error) console.error('Ошибка синхронизации:', error);
      } catch (error) {
        console.error('Ошибка обновления шахт:', error);
      }
    }
  }, 1000);
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// =============== Чат ===============
async function loadChat() {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select(`
        id, 
        message, 
        created_at, 
        user_id,
        profiles:user_id (username),
        auth_users:user_id (raw_user_meta_data->username)
      `)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) throw error;
    
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = data.reverse().map(msg => `
      <div class="message">
        <strong>${msg.profiles?.username || msg.auth_users?.username || 'Гость'}</strong>
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
  try {
    const message = document.getElementById('chatInput').value.trim();
    if (!message) return;

    if (!currentUser) {
      throw new Error('Требуется авторизация');
    }
    
    const { error } = await supabase
      .from('chat_messages')
      .insert({ 
        message, 
        user_id: currentUser.id 
      });
    
    if (error) throw error;
    
    document.getElementById('chatInput').value = '';
  } catch (error) {
    console.error('Ошибка отправки сообщения:', error);
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
