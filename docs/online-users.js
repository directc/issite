// online-users.js
let onlineUsers = [];
let lastActivityCheck = 0;

const updateOnlineUsers = async () => {
  try {
    const now = Date.now();
    // Проверяем не чаще чем раз в 10 секунд
    if (now - lastActivityCheck < 10000) return;
    lastActivityCheck = now;

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    // Обновляем свою активность
    await supabaseClient
      .from('user_activity')
      .upsert({
        user_id: user.id,
        last_seen: new Date().toISOString()
      });

    // Получаем всех пользователей с активностью за последние 60 секунд
    const timeThreshold = new Date(Date.now() - 60000).toISOString();
    
    const { data: activeUsers } = await supabaseClient
      .from('profiles')
      .select('user_id, username, user_activity(last_seen)')
      .gt('user_activity.last_seen', timeThreshold);

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
    const lastSeen = new Date(user.user_activity[0].last_seen);
    const secondsAgo = Math.floor((now - lastSeen) / 1000);
    const isOnline = secondsAgo <= 15;
    
    return `
      <div class="online-user">
        <span class="online-status ${isOnline ? 'online' : 'offline'}"></span>
        ${user.username}
        ${!isOnline ? `<span class="last-seen">(${secondsAgo} сек назад)</span>` : ''}
      </div>
    `;
  }).join('');

  onlineUsersContainer.innerHTML = usersList;
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

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
  setupOnlineUsersUI();
  updateOnlineUsers();
});