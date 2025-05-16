// online-users.js
document.addEventListener('DOMContentLoaded', async () => {
  let onlineUsers = [];
  let lastActivityCheck = 0;

  const updateOnlineUsers = async () => {
    try {
      const now = Date.now();
      if (now - lastActivityCheck < 10000) return;
      lastActivityCheck = now;

      const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
      if (userError || !user) return;

      // Обновляем свою активность
      const { error: activityError } = await supabaseClient
        .from('user_activity')
        .upsert({
          user_id: user.id,
          last_seen: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (activityError) throw activityError;

      // Получаем активных пользователей через представление
      const timeThreshold = new Date(Date.now() - 3600000).toISOString();
      
      const { data: activeUsers, error: usersError } = await supabaseClient
        .from('online_users')
        .select('*')
        .gt('last_seen', timeThreshold);

      if (usersError) throw usersError;

      onlineUsers = activeUsers || [];
      renderOnlineUsers();
    } catch (err) {
      console.error('Ошибка обновления онлайн статуса:', err);
    }
  };

  const renderOnlineUsers = () => {
    const onlineUsersContainer = document.getElementById('onlineUsersContainer');
    if (!onlineUsersContainer) return;

    const now = new Date();
    const usersList = onlineUsers.map(user => {
      const lastSeen = new Date(user.last_seen);
      const secondsAgo = Math.floor((now - lastSeen) / 1000);
      const isOnline = secondsAgo <= 15;
      
      return `
        <div class="online-user">
          <span class="online-status ${isOnline ? 'online' : 'offline'}"></span>
          ${user.username || 'Unknown'}
          ${!isOnline ? `<span class="last-seen">(${secondsAgo} сек назад)</span>` : ''}
        </div>
      `;
    }).join('');

    onlineUsersContainer.innerHTML = usersList || '<div class="online-user">Нет активных пользователей</div>';
  };

  const setupOnlineUsersUI = () => {
    const chatHeader = document.querySelector('.chat-section h2');
    if (!chatHeader) return;

    const onlineUsersBtn = document.createElement('span');
    onlineUsersBtn.id = 'onlineUsersBtn';
    onlineUsersBtn.className = 'online-users-btn';
    onlineUsersBtn.textContent = 'Пользователи онлайн';
    
    const onlineUsersDropdown = document.createElement('div');
    onlineUsersDropdown.id = 'onlineUsersContainer';
    onlineUsersDropdown.className = 'online-users-dropdown';
    
    chatHeader.insertAdjacentElement('afterend', onlineUsersDropdown);
    chatHeader.appendChild(onlineUsersBtn);

    // Обработчики событий
    onlineUsersBtn.addEventListener('mouseenter', () => {
      onlineUsersDropdown.style.display = 'block';
      updateOnlineUsers();
    });
    
    onlineUsersDropdown.addEventListener('mouseleave', () => {
      onlineUsersDropdown.style.display = 'none';
    });

    // Обновляем каждые 15 секунд
    setInterval(updateOnlineUsers, 15000);
  };

  setupOnlineUsersUI();
  updateOnlineUsers();
});
