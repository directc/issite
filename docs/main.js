const loadMines = async () => {
  const { data, error } = await supabaseClient
    .from('mines')
    .select('*')
    .order('id', { ascending: true });

  if (!error && data) {
    const now = new Date();
    mines = data.filter(mine => mine).map(mine => { // Добавлен фильтр
      if (!mine || !mine.updated_at) return null;
      
      const lastUpdated = new Date(mine.updated_at);
      const elapsedSeconds = Math.floor((now - lastUpdated) / 1000);
      let currentSeconds = (mine.current_seconds || 0) - elapsedSeconds;

      while (currentSeconds <= 0 && mine.max_seconds) {
        currentSeconds += mine.max_seconds;
      }

      return {
        ...mine,
        current_seconds: Math.min(currentSeconds, mine.max_seconds || 0)
      };
    }).filter(Boolean); // Удаляем null

    if (mines.length) {
      updateTimers();
      startTimers();
    }
  }
};

const updateTimers = () => {
  const timersContainer = document.getElementById('timersContainer');
  if (!timersContainer || !mines.length) return;

  timersContainer.innerHTML = mines.filter(mine => mine).map(mine => `
    <div class="timer ${mine.current_seconds <= 60 ? 'warning' : ''}" data-id="${mine.id}">
      <span class="timer-name">${mine.name || 'Без названия'}</span>
      <span class="timer-time">${formatTime(mine.current_seconds)} / ${formatTime(mine.max_seconds)}</span>
      ${isAdmin ? '<button class="edit-timer-btn">✏️</button>' : ''}
    </div>
  `).join('');

  if (isAdmin) {
    document.querySelectorAll('.edit-timer-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const timerId = parseInt(btn.closest('.timer').dataset.id);
        if (timerId) openEditModal(timerId);
      });
    });
  }
};

const saveTimerChanges = async () => {
  if (!currentEditingMine?.id) return;

  try {
    const currentTime = parseInt(document.getElementById('editCurrentTime')?.value || 0);
    const maxTime = parseInt(document.getElementById('editMaxTime')?.value || 0);
    
    if (isNaN(currentTime)) throw new Error('Некорректное текущее время');
    if (isNaN(maxTime)) throw new Error('Некорректное максимальное время');

    const { data, error } = await supabaseClient
      .from('mines')
      .update({
        current_seconds: currentTime,
        max_seconds: maxTime,
        updated_at: new Date().toISOString()
      })
      .eq('id', currentEditingMine.id)
      .select();

    if (error) throw error;
    if (!data?.[0]) throw new Error('Данные не получены');

    // Полная замена массива mines
    mines = mines.map(m => m.id === currentEditingMine.id ? data[0] : m);
    updateTimers();
    
  } catch (err) {
    console.error('Ошибка сохранения:', err);
    alert('Ошибка сохранения: ' + err.message);
  }
};

const startTimers = () => {
  if (timerInterval) clearInterval(timerInterval);
  if (syncInterval) clearInterval(syncInterval);

  timerInterval = setInterval(() => {
    mines = mines.filter(mine => mine).map(mine => {
      if (!mine.current_seconds) return mine;
      return {
        ...mine,
        current_seconds: Math.max(0, mine.current_seconds - 1)
      };
    });
    updateTimers();
  }, 1000);

  syncInterval = setInterval(async () => {
    try {
      const updates = mines.filter(mine => mine?.id).map(mine => ({
        id: mine.id,
        current_seconds: mine.current_seconds,
        updated_at: new Date().toISOString()
      }));
      
      if (updates.length) {
        const { error } = await supabaseClient.from('mines').upsert(updates);
        if (error) console.error('Ошибка синхронизации:', error);
      }
    } catch (err) {
      console.error('Ошибка синхронизации:', err);
    }
  }, 10000);
};
