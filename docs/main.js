document.addEventListener('DOMContentLoaded', async () => {
  // Инициализация Supabase
  const supabaseUrl = 'https://pnqliwwrebtnngtmmfwc.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBucWxpd3dyZWJ0bm5ndG1tZndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYyMzA1ODQsImV4cCI6MjA2MTgwNjU4NH0.mqjU6-ow_BgjsioIe7IHo_5l5LrIWgThTJ0ciIJLEk0';
  const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

  // Проверка авторизации
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
  if (authError || !user) {
    window.location.href = 'login.html';
    return;
  }

  // DOM элементы
  const timersContainer = document.getElementById('timersContainer');
  const chatMessages = document.getElementById('chatMessages');
  const chatInput = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  // Состояние приложения
  let mines = [];

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
    const { data, error } = await supabaseClient.from('mines').select('*');
    if (!error) {
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
    if (!timersContainer) return;
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
    
    const { error } = await supabaseClient.from('mines').upsert(updates);
    if (error) console.error('Sync error:', error);
  };

  // ====================== ЧАТ ======================
  const loadChat = async () => {
    try {
      const { data, error } = await supabaseClient
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

  const sendMessage = async () => {
    const message = chatInput.value.trim();
    if (!message) return;

    try {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (!user) throw new Error('Требуется авторизация');
      
      const { error } = await supabaseClient
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

  const setupRealtimeChat = () => {
    supabaseClient
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

  // Обработчик выхода
  logoutBtn.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
  });

  // Инициализация приложения
  const init = async () => {
    await loadMines();
    await loadChat();
    setupRealtimeChat();
    
    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
  };

  init();
});