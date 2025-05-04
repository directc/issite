// 1. Ожидаем загрузки DOM и библиотеки Supabase
document.addEventListener('DOMContentLoaded', async () => {
  // 2. Проверяем доступность Supabase
  if (typeof supabase === 'undefined') {
    console.error('Supabase library not loaded!');
    return;
  }

  // 3. Инициализация клиента Supabase
  const supabaseUrl = 'https://pnqliwwrebtnngtmmfwc.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBucWxpd3dyZWJ0bm5ndG1tZndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYyMzA1ODQsImV4cCI6MjA2MTgwNjU4NH0.mqjU6-ow_BgjsioIe7IHo_5l5LrIWgThTJ0ciIJLEk0';
  const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

  // 4. Основной код приложения
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

  // Загрузка таймеров
  const loadMines = async () => {
    const { data, error } = await supabaseClient.from('mines').select('*');
    if (!error) {
      mines = data;
      updateTimers();
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

  // Локальное обновление таймеров
  setInterval(() => {
    mines.forEach(mine => {
      mine.current_seconds = Math.max(0, mine.current_seconds - 1);
      if (mine.current_seconds <= 0) {
        mine.current_seconds = mine.max_seconds;
      }
    });
    updateTimers();
  }, 1000);

  // Загрузка чата
  const loadChat = async () => {
    const { data } = await supabaseClient
      .from('chat_messages')
      .select('*, user:users(username)')
      .order('created_at', { ascending: false })
      .limit(50);
    
    chatMessages.innerHTML = data.reverse().map(msg => `
      <div class="message">
        <strong>${msg.user.username}</strong>: ${msg.message}
      </div>
    `).join('');
    chatMessages.scrollTop = chatMessages.scrollHeight;
  };

  // Отправка сообщения
  sendBtn.addEventListener('click', async () => {
    const message = chatInput.value.trim();
    if (!message) return;

    const { error } = await supabaseClient
      .from('chat_messages')
      .insert({ message });
    
    if (!error) {
      chatInput.value = '';
    }
  });

  // Подписка на обновления чата
  supabaseClient
    .channel('chat')
    .on('postgres_changes', { 
      event: 'INSERT', 
      schema: 'public', 
      table: 'chat_messages' 
    }, () => loadChat())
    .subscribe();

  // Инициализация
  await loadMines();
  await loadChat();
});
