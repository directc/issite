// admin.js - админ панель
document.addEventListener('DOMContentLoaded', async () => {
  // Проверка прав через обычный клиент
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
  if (authError || !user) {
    window.location.href = 'login.html';
    return;
  }

  // Проверка is_admin
  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('is_admin')
    .eq('user_id', user.id)
    .single();

  if (!profile?.is_admin) {
    window.location.href = 'index.html';
    return;
  }

  // Обработчики
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
  });

  // Создание пользователя
  document.getElementById('createUserBtn').addEventListener('click', async () => {
    const email = document.getElementById('newUserEmail').value.trim();
    const password = document.getElementById('newUserPassword').value.trim();
    const expiryDays = parseInt(document.getElementById('userExpiry').value) || 30;

    if (!email || !password) {
      showMessage('Заполните все поля', 'error');
      return;
    }

    try {
      // 1. Создаем пользователя
      const { data: authData, error: createError } = await supabaseAdminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });
      if (createError) throw createError;

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

      showMessage('Пользователь создан!', 'success');
      document.getElementById('newUserEmail').value = '';
      document.getElementById('newUserPassword').value = '';
    } catch (err) {
      showMessage('Ошибка: ' + err.message, 'error');
      console.error(err);
    }
  });

  // Очистка чата
  document.getElementById('clearChatBtn').addEventListener('click', async () => {
    if (!confirm('Вы уверены, что хотите очистить весь чат?')) return;
    
    try {
      const { error } = await supabaseClient
        .from('chat_messages')
        .delete()
        .neq('id', 0);
      
      if (error) throw error;
      showMessage('Чат очищен', 'success', 'chatMessage');
    } catch (err) {
      showMessage('Ошибка очистки: ' + err.message, 'error', 'chatMessage');
    }
  });

  function showMessage(text, type, elementId = 'userMessage') {
    const el = document.getElementById(elementId);
    el.textContent = text;
    el.style.color = type === 'error' ? 'red' : 'green';
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 3000);
  }
});