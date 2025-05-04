//04.05.2025 11:54
document.addEventListener('DOMContentLoaded', async () => {
  // Инициализация Supabase
  const supabaseUrl = 'https://pnqliwwrebtnngtmmfwc.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBucWxpd3dyZWJ0bm5ndG1tZndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYyMzA1ODQsImV4cCI6MjA2MTgwNjU4NH0.mqjU6-ow_BgjsioIe7IHo_5l5LrIWgThTJ0ciIJLEk0';
  const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

  // Проверка на странице входа
  if (window.location.pathname.includes('login.html')) {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const errorElement = document.getElementById('loginError');

        try {
          const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
          });

          if (error) throw error;
          
          // Проверяем наличие профиля
          const { data: profile } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('user_id', data.user.id)
            .single();

          if (!profile) {
            throw new Error('Профиль пользователя не найден. Обратитесь к администратору.');
          }

          window.location.href = 'index.html';
        } catch (err) {
          errorElement.textContent = err.message;
        }
      });
    }
    return;
  }

  // Проверка авторизации для других страниц
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
  if (!user || authError) {
    window.location.href = 'login.html';
    return;
  }

  // Загрузка профиля
  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('username')
    .eq('user_id', user.id)
    .single();

  if (!profile || profileError) {
    console.error('Ошибка загрузки профиля:', profileError?.message);
    alert('Ошибка загрузки профиля. Перезагрузите страницу.');
    return;
  }

  console.log('Авторизован как:', profile.username);

  // Инициализация интерфейса
  const initApp = async () => {
    // Таймеры
    const timersContainer = document.getElementById('timersContainer');
    let mines = [];

    const formatTime = (seconds) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const loadMines = async () => {
      const { data, error } = await supabaseClient.from('mines').select('*');
      if (!error) {
        mines = data;
        updateTimers();
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

    // Обновление таймеров каждую секунду
    setInterval(() => {
      // Уменьшаем current_seconds каждого таймера
      mines.forEach(mine => {
        if (mine.current_seconds < mine.max_seconds) {
          mine.current_seconds++;
        }
      });

      // Обновляем отображение
      updateTimers();
    }, 1000);

    // Чат
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');

    const loadChat = async () => {
      const { data, error } = await supabaseClient
        .from('chat_messages')
        .select('id, message, created_at, profiles:user_id (username)')
        .order('created_at', { ascending: true })
        .limit(50);
      
      if (!error) {
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
      }
    };

    const sendMessage = async () => {
      const message = chatInput.value.trim();
      if (!message) return;

      try {
        const { error } = await supabaseClient
          .from('chat_messages')
          .insert({ 
            message, 
            user_id: user.id 
          });
        
        if (error) throw error;
        chatInput.value = '';
      } catch (err) {
        console.error('Ошибка отправки:', err);
        alert('Ошибка отправки сообщения');
      }
    };

    // Выход
    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await supabaseClient.auth.signOut();
      window.location.href = 'login.html';
    });

    // Инициализация
    await loadMines();
    await loadChat();
    
    // Отправка сообщения
    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });

    // Режим реального времени для чата
    supabaseClient
      .channel('chat_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        () => loadChat()
      )
      .subscribe();
  };

  initApp();
});
