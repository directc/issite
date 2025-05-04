document.addEventListener('DOMContentLoaded', async () => {
  // Проверка загрузки Supabase
  if (typeof supabase === 'undefined') {
    console.error('Supabase library not loaded!');
    return;
  }

  // Инициализация клиента Supabase
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

  // Состояние приложения
  let mines = [];

  // ====================== ТАЙМЕРЫ ======================
  // ... (остальной код таймеров без изменений)

  // ====================== ЧАТ ======================
  // ... (остальной код чата без изменений)

  // ====================== ВЫХОД ======================
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await supabaseClient.auth.signOut();
      window.location.href = 'login.html';
    });
  }

  // ====================== ИНИЦИАЛИЗАЦИЯ ======================
  const init = async () => {
    await loadMines();
    await loadChat();
    setupRealtimeChat();
    
    // Обработчики событий
    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
  };

  init();
});
