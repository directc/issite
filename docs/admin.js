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
      
      // Обновляем список пользователей
      await loadUsersList();
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

  // Загрузка списка пользователей
  const loadUsersList = async () => {
    try {
      const { data: users, error } = await supabaseClient
        .from('profiles')
        .select(`
          user_id,
          username,
          is_admin,
          expires_at,
          auth_users:user_id (email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      renderUsersList(users);
    } catch (err) {
      console.error('Ошибка загрузки пользователей:', err);
      showMessage('Ошибка загрузки пользователей', 'error');
    }
  };

  // Отображение списка пользователей
  const renderUsersList = (users) => {
    const usersListBody = document.getElementById('usersListBody');
    if (!usersListBody) return;

    usersListBody.innerHTML = users.map(user => {
      const email = user.auth_users?.email || 'Неизвестно';
      const username = user.username || email.split('@')[0];
      const isAdmin = user.is_admin ? 'Администратор' : 'Пользователь';
      
      // Форматируем срок действия
      let expiresText = 'Бессрочно';
      if (user.expires_at) {
        const expiresDate = new Date(user.expires_at);
        const now = new Date();
        const diffDays = Math.ceil((expiresDate - now) / (1000 * 60 * 60 * 24));
        
        if (expiresDate < now) {
          expiresText = `Истек ${expiresDate.toLocaleDateString()}`;
        } else {
          expiresText = `${diffDays} дней (до ${expiresDate.toLocaleDateString()})`;
        }
      }

      return `
        <tr>
          <td>${email}</td>
          <td>${username}</td>
          <td>${isAdmin}</td>
          <td>${expiresText}</td>
          <td>
            <button class="action-btn" data-user-id="${user.user_id}">Изменить</button>
          </td>
        </tr>
      `;
    }).join('');

    // Добавляем обработчики для кнопок действий
    document.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const userId = e.target.dataset.userId;
        // Здесь можно добавить логику для изменения пользователя
        alert(`Редактирование пользователя ${userId}`);
      });
    });
  };

  function showMessage(text, type, elementId = 'userMessage') {
    const el = document.getElementById(elementId);
    el.textContent = text;
    el.style.color = type === 'error' ? 'red' : 'green';
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 3000);
  }

  // Инициализация
  loadUsersList();
});
