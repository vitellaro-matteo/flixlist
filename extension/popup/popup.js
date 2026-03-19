const $ = s => document.querySelector(s)
const msgEl = $('#msg')

function showMsg(text, type) {
  msgEl.textContent = text
  msgEl.className = `msg ${type}`
}
function hideMsg() { msgEl.className = 'msg'; msgEl.style.display = 'none' }

async function init() {
  hideMsg()
  const user = await chrome.runtime.sendMessage({ type: 'GET_USER' })
  user ? showSignedIn(user) : showSignedOut()
}

function showSignedIn(user) {
  $('#signed-in').style.display = 'block'
  $('#signed-out').style.display = 'none'
  const name = user.user_metadata?.username || user.email?.split('@')[0] || 'User'
  $('#display-name').textContent = name
  $('#display-email').textContent = user.email || ''
  $('#avatar').textContent = name[0].toUpperCase()
}

function showSignedOut() {
  $('#signed-in').style.display = 'none'
  $('#signed-out').style.display = 'block'
}

$('#signin-btn').addEventListener('click', async () => {
  hideMsg()
  const email = $('#email').value.trim()
  const password = $('#password').value
  if (!email || !password) return showMsg('Fill in all fields.', 'error')
  $('#signin-btn').textContent = 'Signing in…'
  $('#signin-btn').disabled = true
  const res = await chrome.runtime.sendMessage({ type: 'SIGN_IN', email, password })
  if (res.success) { showSignedIn(res.user); hideMsg() }
  else showMsg(res.error || 'Sign in failed', 'error')
  $('#signin-btn').textContent = 'Sign In'
  $('#signin-btn').disabled = false
})

$('#signup-btn').addEventListener('click', async () => {
  hideMsg()
  const username = $('#reg-username').value.trim()
  const email = $('#reg-email').value.trim()
  const password = $('#reg-password').value
  if (!username || !email || !password) return showMsg('Fill in all fields.', 'error')
  if (password.length < 6) return showMsg('Password must be 6+ characters.', 'error')
  $('#signup-btn').textContent = 'Creating…'
  $('#signup-btn').disabled = true
  const res = await chrome.runtime.sendMessage({ type: 'SIGN_UP', email, password, username })
  if (res.success) showMsg('Account created! Check email to confirm, then sign in.', 'success')
  else showMsg(res.error || 'Sign up failed', 'error')
  $('#signup-btn').textContent = 'Create Account'
  $('#signup-btn').disabled = false
})

$('#signout-btn').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'SIGN_OUT' })
  showSignedOut()
})

$('#show-signup').addEventListener('click', () => { hideMsg(); $('#signin-form').style.display = 'none'; $('#signup-form').style.display = 'block' })
$('#show-signin').addEventListener('click', () => { hideMsg(); $('#signup-form').style.display = 'none'; $('#signin-form').style.display = 'block' })
$('#password').addEventListener('keydown', e => { if (e.key === 'Enter') $('#signin-btn').click() })
$('#reg-password').addEventListener('keydown', e => { if (e.key === 'Enter') $('#signup-btn').click() })

init()
