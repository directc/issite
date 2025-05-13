document.addEventListener('DOMContentLoaded', async () => {
  // Инициализация Supabase
  const supabaseUrl = 'https://pnqliwwrebtnngtmmfwc.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBucWxpd3dyZWJ0bm5ndG1tZndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYyMzA1ODQsImV4cCI6MjA2MTgwNjU4NH0.mqjU6-ow_BgjsioIe7IHo_5l5LrIWgThTJ0ciIJLEk0';
  
  const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey, {
    db: { schema: 'public' },
    auth: { persistSession: true }
  });

  // Проверка авторизации
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  // DOM элементы
  const chatMessages = document.getElementById('chatMessages');
  const chatInput = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  // Состояние чата
  let chatData = [];

  // Функция отрисовки сообщений
  const renderChat = () => {
    chatMessages.innerHTML = chatData.map(msg => `
      <div class="message">
        <strong>${msg.profiles?.username || 'Гость'}</strong>
        <span class="message-time">
          ${new Date(msg.created_at).toLocaleTimeString()}
        </span>
        <div class="message-content">${msg.message}</div>
      </div>
    `).join('');
    chatMessages.scrollTop = chatMessages.scrollHeight;
  };

  // Загрузка чата
  const loadChat = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('chat_messages')
        .select(`
          id, 
          message, 
          created_at, 
          profiles:user_id (username)
        `)
        .order('created_at', { ascending: true })
        .limit(50);

      if (error) throw error;

      chatData = data;
      renderChat();
    } catch (err) {
      console.error('Ошибка загрузки чата:', err);
    }
  };

  // Отправка сообщения
  const sendMessage = async () => {
    const message = chatInput.value.trim();
    if (!message) return;

    try {
      // Мгновенное отображение
      const tempMsg = {
        id: `temp-${Date.now()}`,
        message,
        created_at: new Date().toISOString(),
        profiles: { username: user.email.split('@')[0] }
      };
      chatData.push(tempMsg);
      renderChat();
      chatInput.value = '';

      // Отправка на сервер
      const { error } = await supabaseClient
        .from('chat_messages')
        .insert({ 
          message, 
          user_id: user.id 
        });

      if (error) throw error;

      // Обновляем чат после успешной отправки
      await loadChat();
    } catch (err) {
      console.error('Ошибка отправки:', err);
      // Удаляем временное сообщение при ошибке
      chatData = chatData.filter(m => m.id !== tempMsg.id);
      renderChat();
      alert('Ошибка отправки сообщения');
    }
  };

  // Автообновление чата (исправленная версия)
  const startChatUpdater = () => {
    setInterval(async () => {
      try {
        const lastMsg = chatData[chatData.length - 1];
        
        if (lastMsg && !lastMsg.id.startsWith('temp-')) {
          const { data } = await supabaseClient
            .from('chat_messages')
            .select('id')
            .gt('created_at', lastMsg.created_at)
            .order('created_at', { ascending: false })
            .limit(1);
          
          if (data && data.length > 0) {
            await loadChat();
          }
        }
      } catch (err) {
        console.error('Ошибка проверки обновлений:', err);
      }
    }, 2000);
  };

  // Выход
  logoutBtn.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
  });

  // Инициализация
  const init = async () => {
    await loadChat();
    startChatUpdater();
    
    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
  };

  init();
});