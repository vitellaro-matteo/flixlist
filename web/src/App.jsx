import { Routes, Route } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import PlaylistPage from './pages/PlaylistPage'
import ProfilePage from './pages/ProfilePage'
import AuthPage from './pages/AuthPage'

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Navbar user={user} />
      <main className="pt-16">
        <Routes>
          <Route path="/" element={<Home user={user} />} />
          <Route path="/playlist/:id" element={<PlaylistPage user={user} />} />
          <Route path="/profile/:id" element={<ProfilePage user={user} />} />
          <Route path="/auth" element={<AuthPage user={user} />} />
        </Routes>
      </main>
    </div>
  )
}
