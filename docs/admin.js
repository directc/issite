document.addEventListener('DOMContentLoaded', async () => {
  // Инициализация Supabase с SERVICE ROLE KEY
  const supabaseUrl = 'https://pnqliwwrebtnngtmmfwc.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBucWxpd3dyZWJ0bm5ndG1tZndjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjIzMDU4NCwiZXhwIjoyMDYxODA2NTg0fQ.Cfey4xKHpAVbVogrFG-QRR9MR-oMbqrn-QLl_haCc6M';
  const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  });

  // Проверка прав администратора
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
  if (authError || !user) {
    window.location.href = 'login.html';
    return;
  }

  // Проверка is_admin
  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('is_admin')
    .eq('user_id', user.id)
    .single();

  if (profileError || !profile || !profile.is_admin) {
    window.location.href = 'index.html';
    return;
  }

  // DOM элементы
  const logoutBtn = document.getElementById('logoutBtn');
  const createUserBtn = document.getElementById('createUserBtn');
  const clearChatBtn = document.getElementById('clearChatBtn');
  const userMessage = document.getElementById('userMessage');
  const chatMessage = document.getElementById('chatMessage');

  // Обработчик выхода
  logoutBtn.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
  });

  // Создание пользователя
  createUserBtn.addEventListener('click', async () => {
    const email = document.getElementById('newUserEmail').value.trim();
    const password = document.getElementById('newUserPassword').value.trim();
    const expiryDays = parseInt(document.getElementById('userExpiry').value);

    if (!email || !password) {
      userMessage.textContent = 'Заполните все поля';
      userMessage.style.color = 'red';
      return;
    }

    try {
      // 1. Создаем пользователя через admin API
      const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true // Пропускаем подтверждение email
      });

      if (authError) throw authError;

      // 2. Добавляем в профили
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiryDays);

      const { error: profileError } = await supabaseClient
        .from('profiles')
        .insert({
          user_id: authData.user.id,
          username: email.split('@')[0],
          is_admin: false,
          expires_at: expiresAt.toISOString()
        });

      if (profileError) throw profileError;

      userMessage.textContent = 'Пользователь успешно создан!';
      userMessage.style.color = 'green';
      
      // Очищаем поля
      document.getElementById('newUserEmail').value = '';
      document.getElementById('newUserPassword').value = '';
    } catch (err) {
      console.error('Ошибка создания пользователя:', err);
      userMessage.textContent = 'Ошибка: ' + err.message;
      userMessage.style.color = 'red';
    }
  });

  // Очистка чата
  clearChatBtn.addEventListener('click', async () => {
    if (!confirm('Вы уверены, что хотите очистить весь чат?')) return;

    try {
      const { error } = await supabaseClient
        .from('chat_messages')
        .delete()
        .neq('id', 0); // Удаляем все сообщения

      if (error) throw error;

      chatMessage.textContent = 'Чат успешно очищен!';
      chatMessage.style.color = 'green';
    } catch (err) {
      console.error('Ошибка очистки чата:', err);
      chatMessage.textContent = 'Ошибка: ' + err.message;
      chatMessage.style.color = 'red';
    }
  });

  // Автоматическая очистка чата каждые 3 дня
  const checkChatCleanup = async () => {
    const lastCleanup = localStorage.getItem('lastChatCleanup');
    const now = new Date().getTime();
    const threeDays = 3 * 24 * 60 * 60 * 1000;

    if (!lastCleanup || (now - parseInt(lastCleanup)) > threeDays) {
      try {
        await supabaseClient
          .from('chat_messages')
          .delete()
          .neq('id', 0);

        localStorage.setItem('lastChatCleanup', now.toString());
        console.log('Автоматическая очистка чата выполнена');
      } catch (err) {
        console.error('Ошибка автоматической очистки чата:', err);
      }
    }
  };

  // Проверяем при загрузке
  checkChatCleanup();
});