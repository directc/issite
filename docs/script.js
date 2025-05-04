document.addEventListener('DOMContentLoaded', async () => {
  if (typeof supabase === 'undefined') {
    console.error('Supabase library not loaded!');
    return;
  }

  const supabaseUrl = 'https://pnqliwwrebtnngtmmfwc.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBucWxpd3dyZWJ0bm5ndG1tZndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYyMzA1ODQsImV4cCI6MjA2MTgwNjU4NH0.mqjU6-ow_BgjsioIe7IHo_5l5LrIWgThTJ0ciIJLEk0';
  const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

  let mines = [];
  const timersContainer = document.getElementById('timersContainer');
  const chatMessages = document.getElementById('chatMessages');
  const chatInput = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');

  // Форматирование времени
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Расчет прошедшего времени
  const calculateElapsedTime = (lastUpdated) => {
    const now = new Date();
    const lastUpdate = new Date(lastUpdated);
    return Math.floor((now - lastUpdate) / 1000); // в секундах
  };

  // Загрузка таймеров с сервера
  const loadMines = async () => {
    const { data, error } = await supabaseClient.from('mines').select('*');
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

  // Обновление UI таймеров
  const updateTimers = () => {
    timersContainer.innerHTML = mines.map(mine => `
      <div class="timer ${mine.current_seconds <= 60 ? 'warning' : ''}">
        <span class="timer-name">${mine.name}</span>
        <span class="timer-time">${formatTime(mine.current_seconds)} / ${formatTime(mine.max_seconds)}</span>
      </div>
    `).join('');
  };

  // Запуск таймеров
  const startTimers = () => {
    setInterval(async () => {
      mines.forEach(mine => {
        mine.current_seconds = Math.max(0, mine.current_seconds - 1);
        if (mine.current_seconds <= 0) {
          mine.current_seconds = mine.max_seconds;
        }
      });
      updateTimers();
      
      // Синхронизация с сервером каждые 10 секунд
      if (Date.now() % 10000 < 50) {
        await syncTimers();
      }
    }, 1000);
  };

  // Синхронизация таймеров с сервером
  const syncTimers = async () => {
    const updates = mines.map(mine => ({
      id: mine.id,
      current_seconds: mine.current_seconds,
      updated_at: new Date().toISOString()
    }));
    
    const { error } = await supabaseClient
      .from('mines')
      .upsert(updates);
    
    if (error) console.error('Sync error:', error);
  };

  // Работа с чатом
  const loadChat = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('chat_messages')
        .select('*, user:users(username)')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      
      chatMessages.innerHTML = data.reverse().map(msg => `
        <div class="message">
          <strong>${msg.user.username}</strong>: ${msg.message}
        </div>
      `).join('');
      chatMessages.scrollTop = chatMessages.scrollHeight;
    } catch (err) {
      console.error('Chat load error:', err);
    }
  };

  // Отправка сообщения
  sendBtn.addEventListener('click', async () => {
    const message = chatInput.value.trim();
    if (!message) return;

    try {
      const { error } = await supabaseClient
        .from('chat_messages')
        .insert({ 
          message,
          sender_id: (await supabaseClient.auth.getUser()).data.user?.id 
        });
      
      if (error) throw error;
      
      chatInput.value = '';
    } catch (err) {
      console.error('Send message error:', err);
      alert('Ошибка отправки сообщения');
    }
  });

  // Подписка на обновления чата
  const setupRealtime = () => {
    supabaseClient
      .channel('chat_channel')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages'
      }, () => loadChat())
      .subscribe();
  };

  // Инициализация
  const init = async () => {
    await loadMines();
    await loadChat();
    setupRealtime();
  };

  init();
});
