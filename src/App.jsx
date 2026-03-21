import React, { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { Routes, Route } from 'react-router-dom'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    console.error("Uncaught rendering error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 bg-red-bg text-red font-mono text-sm max-w-2xl mx-auto mt-20 rounded shadow">
          <h2 className="text-xl font-bold mb-4">Something went wrong.</h2>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            <summary>Click for error details</summary>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}
import Sidebar from './components/Sidebar'
import ProcessSidebar from './components/ProcessSidebar'
import ChatPage from './pages/ChatPage'
import SettingsPage from './pages/SettingsPage'
import HabitsPage from './pages/HabitsPage'

// Theme context so Settings page can update it
export const ThemeContext = createContext({
  theme: 'light',
  setTheme: () => { },
})

// Daemon status context
export const DaemonContext = createContext({ online: true })

export function useTheme() {
  return useContext(ThemeContext)
}

export function useDaemon() {
  return useContext(DaemonContext)
}

function applyThemeClass(theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

export default function App() {
  const [theme, setThemeState] = useState('light')
  const [daemonOnline, setDaemonOnline] = useState(true)

  // Daemon health check
  const checkDaemon = useCallback(async () => {
    try {
      const res = await fetch('/api/servers', { signal: AbortSignal.timeout(5000) })
      setDaemonOnline(res.ok)
    } catch {
      setDaemonOnline(false)
    }
  }, [])

  useEffect(() => {
    checkDaemon()
    const interval = setInterval(checkDaemon, 10000)
    return () => clearInterval(interval)
  }, [checkDaemon])

  // Load theme from API on mount
  useEffect(() => {
    fetch('/api/settings/ui')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.theme) {
          setThemeState(data.theme)
          applyThemeClass(data.theme)
        }
      })
      .catch(() => { })
  }, [])

  const setTheme = (newTheme) => {
    setThemeState(newTheme)
    applyThemeClass(newTheme)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <DaemonContext.Provider value={{ online: daemonOnline }}>
        <div className="flex h-screen overflow-hidden relative">
          {!daemonOnline && (
            <div className="absolute top-0 left-0 right-0 z-50 bg-red text-white text-xs font-semibold text-center py-2 px-4 shadow-lg animate-fade-in">
              <div className="flex items-center justify-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                Daemon is not running — start it with <code className="bg-white/20 px-1.5 py-0.5 rounded font-mono text-[11px] mx-1">airavat start</code> or <code className="bg-white/20 px-1.5 py-0.5 rounded font-mono text-[11px] mx-1">npm run dev</code> in airavat-daemon
              </div>
            </div>
          )}
          <Sidebar />
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<ChatPage />} />
              <Route path="/chat/:id" element={<ChatPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/habits" element={<HabitsPage />} />
            </Routes>
          </ErrorBoundary>
          <ProcessSidebar />
        </div>
      </DaemonContext.Provider>
    </ThemeContext.Provider>
  )
}

