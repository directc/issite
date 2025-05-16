document.addEventListener('DOMContentLoaded', async () => {
  // Проверка авторизации
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
  if (authError || !user) {
    window.location.href = 'login.html';
    return;
  }

  const onlineUsersScript = document.createElement('script');
  onlineUsersScript.src = 'online-users.js';
  document.body.appendChild(onlineUsersScript);
  
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

  const calculateElapsedTime = (lastUpdated) => {
    return Math.floor((Date.now() - new Date(lastUpdated).getTime()) / 1000);
  };

  const loadMines = async () => {
    const { data, error } = await supabaseClient.from('mines').select('*');
    if (!error) {
      mines = data.map(mine => {
        const elapsed = calculateElapsedTime(mine.updated_at);
        let current = mine.current_seconds - elapsed;
        if (current <= 0) {
          current = mine.max_seconds - (Math.abs(current) % mine.max_seconds);
        }
        return { ...mine, current_seconds: current };
      });
      updateTimers();
      startTimers();
    }
  };

  const updateTimers = () => {
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

    if (isNaN(currentTime) {
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
        .eq('id', currentEditingMine.id);

      if (error) throw error;

      // Обновляем локальные данные
      const mineIndex = mines.findIndex(m => m.id === currentEditingMine.id);
      if (mineIndex !== -1) {
        mines[mineIndex] = {
          ...mines[mineIndex],
          current_seconds: currentTime,
          max_seconds: maxTime
        };
      }

      messageEl.textContent = 'Изменения сохранены!';
      messageEl.style.color = 'green';
      updateTimers();

      setTimeout(() => {
        closeEditModal();
      }, 1000);
    } catch (err) {
      console.error('Ошибка сохранения:', err);
      messageEl.textContent = 'Ошибка сохранения: ' + err.message;
      messageEl.style.color = 'red';
    }
  };

  const startTimers = () => {
    setInterval(async () => {
      mines.forEach(mine => {
        mine.current_seconds = Math.max(0, mine.current_seconds - 1);
        if (mine.current_seconds <= 0) mine.current_seconds = mine.max_seconds;
      });
      
      updateTimers();
      if (Date.now() % 10000 < 50) await syncTimers();
    }, 1000);
  };

  const syncTimers = async () => {
    const updates = mines.map(mine => ({
      id: mine.id,
      current_seconds: mine.current_seconds,
      updated_at: new Date().toISOString()
    }));
    
    const { error } = await supabaseClient.from('mines').upsert(updates);
    if (error) console.error('Sync error:', error);
  };

  // ====================== ЧАТ ======================
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
    const message = chatInput.value.trim();
    if (!message) return;

    try {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (!user) throw new Error('Требуется авторизация');
      
      // Локальное добавление для мгновенного отображения
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
        .insert({ 
          message, 
          user_id: user.id 
        });
      
      if (error) throw error;
      
      // Обновляем после успешной отправки
      await loadChat();
    } catch (err) {
      console.error('Ошибка отправки:', err);
      // Удаляем временное сообщение при ошибке
      chatData = chatData.filter(m => m.id !== tempMsg.id);
      renderChat();
      alert('Ошибка отправки: ' + err.message);
    }
  };

  // Автообновление чата каждые 2 секунды
  const startChatUpdater = () => {
    setInterval(checkNewMessages, 2000);
  };

  // Обработчик выхода
  logoutBtn.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
  });

  // Инициализация приложения
  const init = async () => {
    await loadMines();
    await loadChat();
    startChatUpdater();
    
    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });

    // Обработчики модального окна
    document.querySelector('.close').addEventListener('click', closeEditModal);
    document.getElementById('saveTimerBtn').addEventListener('click', saveTimerChanges);
    window.addEventListener('click', (e) => {
      if (e.target === document.getElementById('editTimerModal')) {
        closeEditModal();
      }
    });
  };

  init();
});