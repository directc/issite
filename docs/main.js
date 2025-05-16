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
  let chatData = [];
  let lastMessageId = 0;
  let isAdmin = profile?.is_admin || false;
  let currentEditingMine = null;

  // ====================== ТАЙМЕРЫ ======================
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const loadMines = async () => {
    const { data, error } = await supabaseClient
      .from('mines')
      .select('*')
      .order('id', { ascending: true });

    if (!error) {
      const now = new Date();
      mines = data.map(mine => {
        const lastUpdated = new Date(mine.updated_at);
        const elapsedSeconds = Math.floor((now - lastUpdated) / 1000);
        let currentSeconds = mine.current_seconds - elapsedSeconds;

        // Корректируем если таймер завершил цикл
        while (currentSeconds <= 0) {
          currentSeconds += mine.max_seconds;
        }

        return {
          ...mine,
          current_seconds: Math.min(currentSeconds, mine.max_seconds)
        };
      });
      updateTimers();
      startTimers();
    }
  };

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

  const openEditModal = (timerId) => {
    const mine = mines.find(m => m.id === timerId);
    if (!mine) return;

    currentEditingMine = mine;
    document.getElementById('editTimerName').value = mine.name;
    document.getElementById('editCurrentTime').value = mine.current_seconds;
    document.getElementById('editMaxTime').value = mine.max_seconds;
    document.getElementById('timerMessage').textContent = '';
    document.getElementById('editTimerModal').style.display = 'block';
  };

  const closeEditModal = () => {
    document.getElementById('editTimerModal').style.display = 'none';
    currentEditingMine = null;
  };

  const saveTimerChanges = async () => {
    if (!currentEditingMine) return;

    const currentTime = parseInt(document.getElementById('editCurrentTime').value);
    const maxTime = parseInt(document.getElementById('editMaxTime').value);
    const messageEl = document.getElementById('timerMessage');

    if (isNaN(currentTime)) {
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
      const now = new Date().toISOString();
      const { data, error } = await supabaseClient
        .from('mines')
        .update({
          current_seconds: currentTime,
          max_seconds: maxTime,
          updated_at: now
        })
        .eq('id', currentEditingMine.id)
        .select();

      if (error) throw error;

      mines = mines.map(m => m.id === currentEditingMine.id ? data[0] : m);
      updateTimers();
      messageEl.textContent = 'Изменения сохранены!';
      messageEl.style.color = 'green';
      setTimeout(() => closeEditModal(), 1000);
    } catch (err) {
      console.error('Ошибка сохранения:', err);
      messageEl.textContent = 'Ошибка: ' + err.message;
      messageEl.style.color = 'red';
    }
  };

  const startTimers = () => {
    setInterval(() => {
      mines.forEach(mine => {
        mine.current_seconds--;
        if (mine.current_seconds <= 0) {
          mine.current_seconds = mine.max_seconds;
        }
      });
      updateTimers();
    }, 1000);

    // Синхронизация каждые 10 секунд
    setInterval(async () => {
      const updates = mines.map(mine => ({
        id: mine.id,
        current_seconds: mine.current_seconds,
        updated_at: new Date().toISOString()
      }));
      
      const { error } = await supabaseClient.from('mines').upsert(updates);
      if (error) console.error('Ошибка синхронизации:', error);
    }, 10000);
  };

  // ====================== ЧАТ ======================
  const renderChat = () => {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
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

  const loadChat = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('chat_messages')
        .select('id, message, created_at, profiles:user_id (username)')
        .order('created_at', { ascending: true })
        .limit(50);
      
      if (!error && data.length > 0) {
        chatData = data;
        lastMessageId = data[data.length - 1].id;
        renderChat();
      }
    } catch (err) {
      console.error('Ошибка загрузки чата:', err);
    }
  };

  const checkNewMessages = async () => {
    try {
      const { data } = await supabaseClient
        .from('chat_messages')
        .select('id')
        .gt('id', lastMessageId)
        .order('id', { ascending: false })
        .limit(1);
      
      if (data && data.length > 0) {
        await loadChat();
      }
    } catch (err) {
      console.error('Ошибка проверки новых сообщений:', err);
    }
  };

  const sendMessage = async () => {
    const chatInput = document.getElementById('chatInput');
    if (!chatInput) return;
    
    const message = chatInput.value.trim();
    if (!message) return;

    try {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (!user) throw new Error('Требуется авторизация');
      
      const tempMsg = {
        id: Date.now(),
        message,
        created_at: new Date().toISOString(),
        profiles: { username: user.email.split('@')[0] }
      };
      chatData.push(tempMsg);
      renderChat();
      chatInput.value = '';
      
      const { error } = await supabaseClient
        .from('chat_messages')
        .insert({ message, user_id: user.id });
      
      if (error) throw error;
      
      await loadChat();
    } catch (err) {
      console.error('Ошибка отправки:', err);
      chatData = chatData.filter(m => m.id !== tempMsg.id);
      renderChat();
      alert('Ошибка отправки: ' + err.message);
    }
  };

  // Инициализация
  const init = async () => {
    await loadMines();
    await loadChat();
    
    // Обработчики чата
    const sendBtn = document.getElementById('sendBtn');
    const chatInput = document.getElementById('chatInput');
    
    if (sendBtn && chatInput) {
      sendBtn.addEventListener('click', sendMessage);
      chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
      });
    }

    // Обработчики модального окна
    document.querySelector('.close')?.addEventListener('click', closeEditModal);
    document.getElementById('saveTimerBtn')?.addEventListener('click', saveTimerChanges);
    
    window.addEventListener('click', (e) => {
      if (e.target === document.getElementById('editTimerModal')) {
        closeEditModal();
      }
    });

    // Автообновление чата
    setInterval(checkNewMessages, 2000);
  };

  init();
});
