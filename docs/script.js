document.addEventListener('DOMContentLoaded', async () => {
  // Инициализация Supabase
  const supabaseUrl = 'https://pnqliwwrebtnngtmmfwc.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBucWxpd3dyZWJ0bm5ndG1tZndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYyMzA1ODQsImV4cCI6MjA2MTgwNjU4NH0.mqjU6-ow_BgjsioIe7IHo_5l5LrIWgThTJ0ciIJLEk0';
  const supabase = supabase.createClient(supabaseUrl, supabaseKey);

  // DOM элементы
  const authContainer = document.getElementById('auth-container');
  const appContainer = document.getElementById('app-container');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const loginBtn = document.getElementById('login-btn');
  const registerBtn = document.getElementById('register-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const authMessage = document.getElementById('auth-message');
  const tabButtons = document.querySelectorAll('.tab-btn');

  // Переключение между вкладками
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      
      document.getElementById(`${btn.dataset.tab}-form`).classList.add('active');
      authMessage.textContent = '';
    });
  });

  // Функция входа
  loginBtn.addEventListener('click', async () => {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value.trim();
    
    if (!email || !password) {
      showAuthMessage('Заполните все поля', 'error');
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      showAuthMessage(error.message, 'error');
      return;
    }

    await handleSuccessfulAuth(data.user);
  });

  // Функция регистрации
  registerBtn.addEventListener('click', async () => {
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value.trim();
    const username = document.getElementById('register-username').value.trim();
    
    if (!email || !password || !username) {
      showAuthMessage('Заполните все поля', 'error');
      return;
    }

    // 1. Регистрация
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password
    });

    if (signUpError) {
      showAuthMessage(signUpError.message, 'error');
      return;
    }

    // 2. Создание профиля
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        user_id: signUpData.user.id,
        username
      });

    if (profileError) {
      showAuthMessage('Ошибка создания профиля', 'error');
      return;
    }

    showAuthMessage('Регистрация успешна! Подтвердите email и войдите', 'success');
    document.querySelector('.tab-btn[data-tab="login"]').click();
  });

  // Функция выхода
  logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    authContainer.style.display = 'flex';
    appContainer.style.display = 'none';
  });

  // Показать сообщение авторизации
  function showAuthMessage(message, type = 'info') {
    authMessage.textContent = message;
    authMessage.style.color = type === 'error' ? 'var(--danger-color)' : 
                             type === 'success' ? 'var(--secondary-color)' : 
                             'inherit';
  }

  // Успешная авторизация
  async function handleSuccessfulAuth(user) {
    authContainer.style.display = 'none';
    appContainer.style.display = 'block';
    
    // Инициализация приложения
    await initApp(user);
  }

  // Проверка текущей сессии
  async function checkSession() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await handleSuccessfulAuth(user);
    }
  }

  // Инициализация приложения
  async function initApp(user) {
    // Ваш существующий код инициализации приложения
    let mines = [];
    const timersContainer = document.getElementById('timersContainer');
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');

    // ... (остальной ваш код таймеров и чата)

    // Модифицированная функция отправки сообщения
    const sendMessage = async () => {
      const message = chatInput.value.trim();
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
        
        chatInput.value = '';
      } catch (err) {
        console.error('Send error:', err);
        alert(err.message);
      }
    };

    // Инициализация чата и таймеров
    await loadMines();
    await loadChat();
    setupRealtimeChat();
    
    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });

    // ====================== ТАЙМЕРЫ ======================
    const formatTime = (seconds) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const calculateElapsedTime = (lastUpdated) => {
      return Math.floor((Date.now() - new Date(lastUpdated).getTime()) / 1000);
    };

    const loadMines = async () => {
      const { data, error } = await supabase.from('mines').select('*');
      if (!error) {
        // Обновляем время с учетом прошедшего времени
        mines = data.map(mine => {
          const elapsed = calculateElapsedTime(mine.updated_at);
          let current = mine.current_seconds - elapsed;
          if (current <= 0) {
            current = mine.max_seconds - (Math.abs(current) % mine.max_seconds);
          }
          return { ...mine, current_seconds: current };
        });
        updateTimers();
        startTimers();
      }
    };

    const updateTimers = () => {
      timersContainer.innerHTML = mines.map(mine => `
        <div class="timer ${mine.current_seconds <= 60 ? 'warning' : ''}">
          <span class="timer-name">${mine.name}</span>
          <span class="timer-time">${formatTime(mine.current_seconds)} / ${formatTime(mine.max_seconds)}</span>
        </div>
      `).join('');
    };

    const startTimers = () => {
      setInterval(async () => {
        mines.forEach(mine => {
          mine.current_seconds = Math.max(0, mine.current_seconds - 1);
          if (mine.current_seconds <= 0) mine.current_seconds = mine.max_seconds;
        });
        
        updateTimers();
        if (Date.now() % 10000 < 50) await syncTimers();
      }, 1000);
    };

    const syncTimers = async () => {
      const updates = mines.map(mine => ({
        id: mine.id,
        current_seconds: mine.current_seconds,
        updated_at: new Date().toISOString()
      }));
      
      const { error } = await supabase.from('mines').upsert(updates);
      if (error) console.error('Sync error:', error);
    };

    // ====================== ЧАТ ======================
    const loadChat = async () => {
      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('id, message, created_at, profiles:user_id (username)')
          .order('created_at', { ascending: true })
          .limit(50);
        
        if (error) throw error;
        
        chatMessages.innerHTML = data.map(msg => `
          <div class="message">
            <strong>${msg.profiles?.username || 'Гость'}</strong>
            <span class="message-time">
              ${new Date(msg.created_at).toLocaleTimeString()}
            </span>
            <div class="message-content">${msg.message}</div>
          </div>
        `).join('');
        
        chatMessages.scrollTop = chatMessages.scrollHeight;
      } catch (err) {
        console.error('Chat load error:', err);
      }
    };

    const setupRealtimeChat = () => {
      supabase
        .channel('chat_changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: 'user_id=neq.null'
          },
          () => loadChat()
        )
        .subscribe();
    };
  }

  // Проверить сессию при загрузке
  checkSession();
});
