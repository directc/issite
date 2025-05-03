// Настройка Supabase
const supabaseUrl = 'https://ВАШ-PROJECT.supabase.co'
const supabaseKey = 'ВАШ-PUBLIC-KEY'
const supabase = supabase.createClient(supabaseUrl, supabaseKey)

// Данные
let mines = []
let currentUser = null

// DOM элементы
const timersContainer = document.getElementById('timersContainer')
const chatMessages = document.getElementById('chatMessages')
const chatInput = document.getElementById('chatInput')
const sendBtn = document.getElementById('sendBtn')

// Загрузка таймеров
async function loadMines() {
  const { data, error } = await supabase
    .from('mines')
    .select('*')
  
  if (!error) {
    mines = data
    updateTimers()
  }
}

// Обновление UI таймеров
function updateTimers() {
  timersContainer.innerHTML = ''
  mines.forEach(mine => {
    const timerEl = document.createElement('div')
    timerEl.className = 'timer'
    timerEl.innerHTML = `
      <span>${mine.name}</span>
      <span>${formatTime(mine.current_seconds)} / ${formatTime(mine.max_seconds)}</span>
    `
    timersContainer.appendChild(timerEl)
  })
}

// Форматирование времени
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// Локальное обновление таймеров
setInterval(() => {
  mines.forEach(mine => {
    if (mine.current_seconds > 0) {
      mine.current_seconds--
    } else {
      mine.current_seconds = mine.max_seconds
    }
  })
  updateTimers()
}, 1000)

// Чат
async function loadChat() {
  const { data } = await supabase
    .from('chat_messages')
    .select('*, user:users(username)')
    .order('created_at', { ascending: false })
    .limit(50)
  
  chatMessages.innerHTML = data.reverse().map(msg => `
    <div class="message">
      <strong>${msg.user.username}</strong>: ${msg.message}
    </div>
  `).join('')
}

// Отправка сообщения
sendBtn.addEventListener('click', async () => {
  const message = chatInput.value.trim()
  if (!message) return

  const { error } = await supabase
    .from('chat_messages')
    .insert({ message })
  
  if (!error) {
    chatInput.value = ''
    loadChat()
  }
})

// Подписка на обновления чата
supabase
  .channel('chat')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, () => {
    loadChat()
  })
  .subscribe()

// Инициализация
loadMines()
loadChat()
