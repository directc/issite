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
      // Получаем пользователей через auth API
      const { data: { users }, error: authError } = await supabaseAdminClient.auth.admin.listUsers();
      if (authError) throw authError;

      // Получаем профили
      const userIds = users.map(u => u.id);
      const { data: profiles, error: profilesError } = await supabaseClient
        .from('profiles')
        .select('user_id, username, is_admin, expires_at')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      // Объединяем данные и сортируем по дате создания (новые сверху)
      const mergedUsers = users.map(authUser => {
        const profile = profiles.find(p => p.user_id === authUser.id) || {};
        return {
          user_id: authUser.id,
          email: authUser.email,
          username: profile.username || authUser.email.split('@')[0],
          is_admin: profile.is_admin || false,
          expires_at: profile.expires_at || null,
          created_at: authUser.created_at
        };
      }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      renderUsersList(mergedUsers);
    } catch (err) {
      console.error('Ошибка загрузки пользователей:', err);
      showMessage('Ошибка загрузки пользователей: ' + err.message, 'error');
    }
  };

  // Отображение списка пользователей
  const renderUsersList = (users) => {
    const usersListBody = document.getElementById('usersListBody');
    if (!usersListBody) return;

    usersListBody.innerHTML = users.map(user => {
      const email = user.email || 'Неизвестно';
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
          <td class="actions-cell">
            <button class="edit-btn" data-user-id="${user.user_id}">Изменить срок</button>
            <button class="delete-btn" data-user-id="${user.user_id}">Удалить</button>
          </td>
        </tr>
      `;
    }).join('');

    // Обработчики для кнопок редактирования
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const userId = e.target.dataset.userId;
        openEditUserModal(userId);
      });
    });

    // Обработчики для кнопок удаления
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const userId = e.target.dataset.userId;
        deleteUser(userId);
      });
    });
  };

  // Модальное окно редактирования пользователя
  const openEditUserModal = (userId) => {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <span class="close-modal">&times;</span>
        <h2>Изменение срока действия</h2>
        <div class="form-group">
          <label for="editExpiryDays">Новый срок действия (дней):</label>
          <input type="number" id="editExpiryDays" value="30" min="1">
        </div>
        <div class="form-group">
          <label>
            <input type="checkbox" id="setUnlimited"> Бессрочный доступ
          </label>
        </div>
        <button id="saveExpiryBtn">Сохранить</button>
        <div id="expiryMessage" class="message"></div>
      </div>
    `;
    
    document.body.appendChild(modal);
    modal.style.display = 'block';

    // Обработчики для модального окна
    document.querySelector('.close-modal').addEventListener('click', () => {
      modal.remove();
    });

    document.getElementById('setUnlimited').addEventListener('change', (e) => {
      document.getElementById('editExpiryDays').disabled = e.target.checked;
    });

    document.getElementById('saveExpiryBtn').addEventListener('click', async () => {
      const expiryDays = parseInt(document.getElementById('editExpiryDays').value) || 30;
      const isUnlimited = document.getElementById('setUnlimited').checked;
      
      try {
        let expiresAt = null;
        if (!isUnlimited) {
          expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + expiryDays);
          expiresAt = expiresAt.toISOString();
        }

        const { error } = await supabaseClient
          .from('profiles')
          .update({ expires_at: expiresAt })
          .eq('user_id', userId);

        if (error) throw error;

        document.getElementById('expiryMessage').textContent = 'Изменения сохранены!';
        document.getElementById('expiryMessage').style.color = 'green';
        
        setTimeout(() => {
          modal.remove();
          loadUsersList(); // Обновляем список после сохранения
        }, 1000);
      } catch (err) {
        document.getElementById('expiryMessage').textContent = 'Ошибка: ' + err.message;
        document.getElementById('expiryMessage').style.color = 'red';
        console.error(err);
      }
    });

    window.onclick = (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    };
  };

  // Удаление пользователя
  const deleteUser = async (userId) => {
    if (!confirm('Вы уверены, что хотите удалить этого пользователя? Это действие нельзя отменить.')) {
      return;
    }

    try {
      // Удаляем профиль
      const { error: profileError } = await supabaseClient
        .from('profiles')
        .delete()
        .eq('user_id', userId);

      if (profileError) throw profileError;

      // Удаляем пользователя через auth API
      const { error: authError } = await supabaseAdminClient.auth.admin.deleteUser(userId);
      if (authError) throw authError;

      showMessage('Пользователь удален', 'success');
      await loadUsersList();
    } catch (err) {
      showMessage('Ошибка удаления: ' + err.message, 'error');
      console.error(err);
    }
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
