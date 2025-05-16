document.addEventListener('DOMContentLoaded', async () => {
  // Проверка авторизации
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
  if (authError || !user) {
    window.location.href = 'login.html';
    return;
  }

  // Проверка срока действия аккаунта
  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('expires_at, is_admin')
    .eq('user_id', user.id)
    .single();

  if (profile && profile.expires_at && new Date(profile.expires_at) < new Date()) {
    alert('Ваш аккаунт истек. Обратитесь к администратору.');
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
    return;
  }

  // Добавляем кнопку админки если пользователь админ
  const headerButtons = document.querySelector('.header-buttons');
  if (profile?.is_admin && headerButtons) {
    const adminBtn = document.createElement('button');
    adminBtn.id = 'adminBtn';
    adminBtn.textContent = 'Админка';
    headerButtons.insertBefore(adminBtn, document.getElementById('logoutBtn'));
    
    adminBtn.addEventListener('click', () => {
      window.location.href = 'admin.html';
    });
  }

  // Состояние приложения
  let mines = [];
  let isAdmin = profile?.is_admin || false;

  // Форматирование времени
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Загрузка шахт из базы
  const loadMines = async () => {
    const { data, error } = await supabaseClient
      .from('mines')
      .select('*')
      .order('id', { ascending: true });

    if (!error) {
      mines = data;
      updateTimers();
    } else {
      console.error('Ошибка загрузки шахт:', error);
    }
  };

  // Обновление отображения таймеров
  const updateTimers = () => {
    const timersContainer = document.getElementById('timersContainer');
    if (!timersContainer) return;

    timersContainer.innerHTML = mines.map(mine => `
      <div class="timer ${mine.current_seconds <= 60 ? 'warning' : ''}" data-id="${mine.id}">
        <span class="timer-name">${mine.name}</span>
        <span class="timer-time">${formatTime(mine.current_seconds)} / ${formatTime(mine.max_seconds)}</span>
        ${isAdmin ? '<button class="edit-timer-btn">✏️</button>' : ''}
      </div>
    `).join('');

    // Добавляем обработчики для кнопок редактирования
    if (isAdmin) {
      document.querySelectorAll('.edit-timer-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const timerId = parseInt(btn.closest('.timer').dataset.id);
          openEditModal(timerId);
        });
      });
    }
  };

  // Открытие модального окна редактирования
  const openEditModal = (timerId) => {
    const mine = mines.find(m => m.id === timerId);
    if (!mine) return;

    document.getElementById('editTimerName').value = mine.name;
    document.getElementById('editCurrentTime').value = mine.current_seconds;
    document.getElementById('editMaxTime').value = mine.max_seconds;
    document.getElementById('timerMessage').textContent = '';
    document.getElementById('editTimerModal').style.display = 'block';
    
    // Сохраняем ID редактируемой шахты
    window.currentEditingMineId = timerId;
  };

  // Закрытие модального окна
  const closeEditModal = () => {
    document.getElementById('editTimerModal').style.display = 'none';
    window.currentEditingMineId = null;
  };

  // Сохранение изменений
  const saveTimerChanges = async () => {
    const currentTime = parseInt(document.getElementById('editCurrentTime').value);
    const maxTime = parseInt(document.getElementById('editMaxTime').value);
    const messageEl = document.getElementById('timerMessage');

    if (isNaN(currentTime) || currentTime < 0) {
      messageEl.textContent = 'Введите корректное текущее время';
      messageEl.style.color = 'red';
      return;
    }

    if (isNaN(maxTime) || maxTime <= 0) {
      messageEl.textContent = 'Введите корректное максимальное время';
      messageEl.style.color = 'red';
      return;
    }

    try {
      const { error } = await supabaseClient
        .from('mines')
        .update({
          current_seconds: currentTime,
          max_seconds: maxTime,
          updated_at: new Date().toISOString()
        })
        .eq('id', window.currentEditingMineId);

      if (error) throw error;

      // Принудительно обновляем данные
      await loadMines();
      
      messageEl.textContent = 'Изменения сохранены!';
      messageEl.style.color = 'green';
      
      setTimeout(() => {
        closeEditModal();
      }, 1000);
    } catch (err) {
      console.error('Ошибка сохранения:', err);
      messageEl.textContent = 'Ошибка: ' + err.message;
      messageEl.style.color = 'red';
    }
  };

  // Запуск таймеров
  const startTimers = () => {
    setInterval(() => {
      mines.forEach(mine => {
        mine.current_seconds = Math.max(0, mine.current_seconds - 1);
        if (mine.current_seconds <= 0) {
          mine.current_seconds = mine.max_seconds;
        }
      });
      updateTimers();
    }, 1000);
  };

  // Инициализация
  const init = async () => {
    await loadMines();
    startTimers();
    
    // Обработчики модального окна
    document.querySelector('.close')?.addEventListener('click', closeEditModal);
    document.getElementById('saveTimerBtn')?.addEventListener('click', saveTimerChanges);
    
    // Закрытие по клику вне окна
    window.addEventListener('click', (e) => {
      if (e.target === document.getElementById('editTimerModal')) {
        closeEditModal();
      }
    });
  };

  init();
});