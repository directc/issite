document.addEventListener('DOMContentLoaded', async () => {
  // Инициализация Supabase
  const supabaseUrl = 'https://pnqliwwrebtnngtmmfwc.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBucWxpd3dyZWJ0bm5ndG1tZndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYyMzA1ODQsImV4cCI6MjA2MTgwNjU4NH0.mqjU6-ow_BgjsioIe7IHo_5l5LrIWgThTJ0ciIJLEk0';
  const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

  // Проверка авторизации
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  // DOM элементы
  const timersContainer = document.getElementById('timersContainer');
  const chatMessages = document.getElementById('chatMessages');
  const chatInput = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  // ====================== ЧАТ ======================
  const loadChat = async () => {
    try {
      // Загружаем сообщения с информацией о пользователях
      const { data, error } = await supabaseClient
        .from('chat_messages')
        .select(`
          id,
          message,
          created_at,
          profiles:user_id (username)
        `)
        .not('message', 'is', null) // Исключаем пустые сообщения
        .order('created_at', { ascending: true })
        .limit(50);
      
      if (error) throw error;
      
      // Отображаем сообщения
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
      // Проверяем авторизацию
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (!user) throw new Error('Требуется авторизация');
      
      // Создаем профиль, если его нет
      await supabaseClient
        .from('profiles')
        .upsert({ 
          user_id: user.id, 
          username: user.email.split('@')[0] 
        }, { onConflict: 'user_id' });
      
      // Отправляем сообщение
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
      alert('Ошибка отправки: ' + err.message);
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
          filter: 'message=neq.null' // Только сообщения с текстом
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

  // Инициализация чата
  const initChat = async () => {
    await loadChat();
    setupRealtimeChat();
    
    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
  };

  initChat();
});