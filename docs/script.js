// Сначала объявляем все глобальные переменные
let supabase;
let mines = [];

// Функция инициализации приложения
async function initApp() {
  // Инициализация Supabase
  supabase = supabase.createClient(
    'https://pnqliwwrebtnngtmmfwc.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBucWxpd3dyZWJ0bm5ndG1tZndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYyMzA1ODQsImV4cCI6MjA2MTgwNjU4NH0.mqjU6-ow_BgjsioIe7IHo_5l5LrIWgThTJ0ciIJLEk0'
  );

  // Проверяем авторизацию
  const { data: { user } } = await supabase.auth.getUser();
  
  if (user) {
    // Пользователь авторизован - показываем приложение
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('app-container').style.display = 'block';
    startApplication();
  } else {
    // Показываем форму входа
    document.getElementById('auth-container').style.display = 'flex';
    setupAuthHandlers();
  }
}

// Запуск основного приложения
async function startApplication() {
  // Инициализация DOM элементов
  const timersContainer = document.getElementById('timersContainer');
  const chatMessages = document.getElementById('chatMessages');
  const chatInput = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');
  const logoutBtn = document.getElementById('logout-btn');

  // Загрузка данных
  await loadMines();
  await loadChat();

  // Настройка обработчиков
  sendBtn.addEventListener('click', sendMessage);
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
  logoutBtn.addEventListener('click', () => supabase.auth.signOut());

  // Запуск таймеров
  startTimers();
  setupRealtimeChat();
}

// Остальные функции (loadMines, loadChat и т.д.) остаются без изменений
// ... (вставьте сюда все ваши существующие функции)

// Запускаем приложение после загрузки DOM
document.addEventListener('DOMContentLoaded', initApp);
