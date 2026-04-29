const $ = s => document.querySelector(s)
const msgEl = $('#msg')
function showMsg(t, type) { msgEl.textContent = t; msgEl.className = `msg ${type}` }
function hideMsg() { msgEl.className = 'msg'; msgEl.style.display = 'none' }

async function init() {
  hideMsg()
  const user = await chrome.runtime.sendMessage({ type: 'GET_USER' })
  user ? showSignedIn(user) : showSignedOut()
}
function showSignedIn(u) {
  $('#signed-in').style.display = 'block'; $('#signed-out').style.display = 'none'
  const n = u.user_metadata?.username || u.email?.split('@')[0] || 'User'
  $('#display-name').textContent = n; $('#display-email').textContent = u.email || ''; $('#avatar').textContent = n[0].toUpperCase()
}
function showSignedOut() { $('#signed-in').style.display = 'none'; $('#signed-out').style.display = 'block' }

$('#signin-btn').addEventListener('click', async () => {
  hideMsg(); const e = $('#email').value.trim(), p = $('#password').value
  if (!e || !p) return showMsg('Fill in all fields.', 'error')
  $('#signin-btn').textContent = 'Signing in…'; $('#signin-btn').disabled = true
  const r = await chrome.runtime.sendMessage({ type: 'SIGN_IN', email: e, password: p })
  r.success ? (showSignedIn(r.user), hideMsg()) : showMsg(r.error, 'error')
  $('#signin-btn').textContent = 'Sign In'; $('#signin-btn').disabled = false
})
$('#signup-btn').addEventListener('click', async () => {
  hideMsg(); const u = $('#reg-username').value.trim(), e = $('#reg-email').value.trim(), p = $('#reg-password').value
  if (!u || !e || !p) return showMsg('Fill in all fields.', 'error')
  if (p.length < 6) return showMsg('Password must be 6+ characters.', 'error')
  $('#signup-btn').textContent = 'Creating…'; $('#signup-btn').disabled = true
  const r = await chrome.runtime.sendMessage({ type: 'SIGN_UP', email: e, password: p, username: u })
  r.success ? showMsg('Account created! Check email, then sign in.', 'success') : showMsg(r.error, 'error')
  $('#signup-btn').textContent = 'Sign Up'; $('#signup-btn').disabled = false
})
$('#signout-btn').addEventListener('click', async () => { await chrome.runtime.sendMessage({ type: 'SIGN_OUT' }); showSignedOut() })
$('#show-signup').addEventListener('click', () => { hideMsg(); $('#signin-form').style.display = 'none'; $('#signup-form').style.display = 'block' })
$('#show-signin').addEventListener('click', () => { hideMsg(); $('#signup-form').style.display = 'none'; $('#signin-form').style.display = 'block' })
$('#password').addEventListener('keydown', e => { if (e.key === 'Enter') $('#signin-btn').click() })
$('#reg-password').addEventListener('keydown', e => { if (e.key === 'Enter') $('#signup-btn').click() })
init()
