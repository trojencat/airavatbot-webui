import { useState, useEffect, useCallback } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import airavatLogo from '/airavat_logo.png'
import useConfigSocket from '../hooks/useConfigSocket'

export default function Sidebar() {
  const location = useLocation()
  const isChatPage = location.pathname === '/'
  const navigate = useNavigate()
  const { subscribe, unsubscribe } = useConfigSocket()

  const [llmInfo, setLlmInfo] = useState('Loading...')
  const [servers, setServers] = useState([])
  const [serversLoading, setServersLoading] = useState(true)
  const [expandedServers, setExpandedServers] = useState({})
  const [serversCollapsed, setServersCollapsed] = useState(true)

  const [conversations, setConversations] = useState([])
  const [activeConversationId, setActiveConversationId] = useState(null)

  const [habits, setHabits] = useState([])
  const [habitsCollapsed, setHabitsCollapsed] = useState(false)

  const [collapsed, setCollapsed] = useState(false)

  const loadServerInfo = useCallback(async () => {
    try {
      const res = await fetch('/api/servers')
      const data = await res.json()
      setLlmInfo(`${data.llm.provider} / ${data.llm.model}`)
      setServers(data.servers)
    } catch {
      setLlmInfo('Disconnected')
      setServers([])
    } finally {
      setServersLoading(false)
    }
  }, [])

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/conversations')
      if (res.ok) {
        const data = await res.json()
        setConversations(data.conversations || [])
      }
    } catch {
      // ignore
    }
  }, [])

  const loadHabits = useCallback(async () => {
    try {
      const res = await fetch('/api/habits')
      if (res.ok) {
        const data = await res.json()
        setHabits(data.habits || [])
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    loadServerInfo()
    loadConversations()
    loadHabits()
  }, [loadServerInfo, loadConversations, loadHabits])

  // Subscribe to live config changes
  useEffect(() => {
    const onLlmChanged = (data) => {
      setLlmInfo(`${data.provider} / ${data.model}`)
    }
    const onMcpToggled = () => {
      // Re-fetch full server list to get updated tool counts / connections
      loadServerInfo()
    }
    const onMcpArgsUpdated = () => {
      loadServerInfo()
    }

    subscribe('llm_changed', onLlmChanged)
    subscribe('mcp_server_toggled', onMcpToggled)
    subscribe('mcp_server_args_updated', onMcpArgsUpdated)

    const onHabitsChanged = () => loadHabits()
    subscribe('habits_changed', onHabitsChanged)
    subscribe('habit_executed', onHabitsChanged)

    return () => {
      unsubscribe('llm_changed', onLlmChanged)
      unsubscribe('mcp_server_toggled', onMcpToggled)
      unsubscribe('mcp_server_args_updated', onMcpArgsUpdated)
      unsubscribe('habits_changed', onHabitsChanged)
      unsubscribe('habit_executed', onHabitsChanged)
    }
  }, [subscribe, unsubscribe, loadServerInfo, loadHabits])

  const toggleServer = (name) => {
    setExpandedServers((prev) => ({ ...prev, [name]: !prev[name] }))
  }

  const handleClearChat = async () => {
    // If we're not currently on the chat page, navigate there and start a fresh chat.
    if (!isChatPage) {
      setActiveConversationId(null)
      navigate('/')
      try { await fetch('/api/clear', { method: 'POST' }) } catch { }
      return
    }

    try { await fetch('/api/clear', { method: 'POST' }) } catch { }
    setActiveConversationId(null)
    window.dispatchEvent(new CustomEvent('airavat:clear-chat'))
  }

  const handleSelectConversation = (id) => {
    setActiveConversationId(id)
    navigate(`/chat/${encodeURIComponent(id)}`)
  }

  // Listen for active conversation changes from ChatPage (like when a new chat gets an ID)
  useEffect(() => {
    const handleActiveChat = (e) => {
      if (e.detail?.id) {
        setActiveConversationId(e.detail.id)
        loadConversations() // Refresh title/list
      }
    }
    window.addEventListener('airavat:chat-active', handleActiveChat)
    return () => window.removeEventListener('airavat:chat-active', handleActiveChat)
  }, [loadConversations])

  return (
    <aside className={`${collapsed ? 'w-fit h-fit top-1/2 rounded-full ' : 'w-65 h-full min-w-65'} absolute sm:relative  bg-surface/60 sm:bg-surface backdrop-blur-lg sm:backdrop-blur-none z-50 border-r border-border flex flex-col overflow-y-auto`}>
      {/* Header */}
      <div className="bg-header-bg px-4 py-3.5 border-b border-[#29487d] flex justify-around items-center">
        {!collapsed && (<div className='grow'><h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2"><img src={airavatLogo} alt="Airavat" className="w-6 h-6 object-contain" /> Airavat</h1>
          <span className="text-[10px] font-normal text-white/65 uppercase tracking-widest block mt-0.5">MCP Agent</span>
        </div>)}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-white/60 hover:text-white transition-colors"
          aria-label="Expand sidebar"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

      </div>

      {/* Nav */}
      {!collapsed &&
        <>
          <nav className="px-2 pt-2 flex flex-col gap-px">
            <NavLink to="/settings" className={({ isActive }) =>
              `flex items-center gap-2 px-2.5 py-2 rounded text-[13px] font-semibold transition-colors ${isActive ? 'bg-fb-blue-lightest text-fb-blue' : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'}`
            }>
              <svg className="shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l-.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
              Settings
            </NavLink>
            <NavLink to="/habits" className={({ isActive }) =>
              `flex items-center gap-2 px-2.5 py-2 rounded text-[13px] font-semibold transition-colors ${isActive ? 'bg-fb-blue-lightest text-fb-blue' : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'}`
            }>
              <svg className="shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Habits
            </NavLink>
          </nav>

          {/* LLM */}
          <div className="px-3 py-3 border-t border-border">
            <h3 className="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2">LLM</h3>
            <div className="flex items-center gap-2 px-2.5 py-2 bg-surface-hover border border-border rounded text-[11px] text-text-secondary font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-green shrink-0" />
              <span className="truncate">{llmInfo}</span>
            </div>
          </div>

          {/* MCP Servers */}
          <div className="px-3 py-3 border-t border-border">
            <div
              className="flex items-center justify-between w-full text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2 bg-transparent border-none cursor-pointer select-none"
              onClick={() => setServersCollapsed(!serversCollapsed)}
            >
              <span>MCP Servers</span>
              <svg className={`text-text-muted transition-transform duration-200 ${serversCollapsed ? '-rotate-90' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
            {!serversCollapsed && (
              <div className="flex flex-col gap-1">
                {serversLoading ? (
                  <p className="text-xs text-text-muted py-1">Connecting...</p>
                ) : (!servers || servers.length === 0) ? (
                  <p className="text-xs text-text-muted py-1">No servers connected</p>
                ) : (servers || []).map((s) => (
                  <div key={s.name} className="bg-surface border border-border rounded transition-colors hover:bg-surface-hover overflow-hidden">
                    <div className="flex items-center justify-between px-2.5 py-2 cursor-pointer select-none" onClick={() => toggleServer(s.name)}>
                      <div className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                        <span className="w-[5px] h-[5px] rounded-full bg-green" />
                        {s.name}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-mono text-text-muted bg-fb-blue-lightest px-1.5 rounded-full">{(s.tools || []).length} tool{(s.tools || []).length !== 1 ? 's' : ''}</span>
                        <svg className={`text-text-muted transition-transform duration-200 ${expandedServers[s.name] ? 'rotate-180' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </div>
                    </div>
                    {expandedServers[s.name] && (
                      <div className="flex flex-wrap gap-1 px-2.5 pb-2">
                        {(s.tools || []).map((t) => (
                          <span key={t} className="text-[9px] font-mono px-1.5 py-0.5 bg-fb-blue text-white rounded">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Habits */}
          <div className="px-3 py-3 border-t border-border">
            <div
              className="flex items-center justify-between w-full text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2 bg-transparent border-none cursor-pointer select-none"
              onClick={() => setHabitsCollapsed(!habitsCollapsed)}
            >
              <span>Habits</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={(e) => { e.stopPropagation(); navigate('/habits') }}
                  className="text-text-muted hover:text-fb-blue transition-colors bg-transparent border-none cursor-pointer p-0"
                  title="Manage habits"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
                <svg className={`text-text-muted transition-transform duration-200 ${habitsCollapsed ? '-rotate-90' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>
            {!habitsCollapsed && (
              <div className="flex flex-col gap-1">
                {(!habits || habits.length === 0) ? (
                  <p className="text-xs text-text-muted py-1">No habits configured</p>
                ) : habits.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => navigate('/habits')}
                    className="w-full text-left px-2.5 py-2 rounded transition-colors bg-transparent border-none cursor-pointer hover:bg-surface-hover group"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={`w-[5px] h-[5px] rounded-full shrink-0 ${h.enabled ? 'bg-green' : 'bg-text-muted'}`} />
                      <span className="text-[12px] font-semibold text-text-primary truncate">{h.title}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 ml-3">
                      <span className="text-[10px] font-mono text-fb-blue">{h.scheduledTime}</span>
                      {h.lastRunStatus && (
                        <span className={`text-[9px] font-semibold ${h.lastRunStatus === 'success' ? 'text-green' : 'text-red'}`}>
                          {h.lastRunStatus === 'success' ? '✓' : '✗'}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Conversations */}
          <div className="flex-1 flex flex-col min-h-0 border-t border-border mt-1">
            <h3 className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase tracking-wide">Recent Chats</h3>
            <div className="flex-1 overflow-y-auto px-2 pb-2 custom-scrollbar">
              {(!conversations || conversations.length === 0) ? (
                <div className="text-xs text-text-muted px-1.5 py-1">No recent chats</div>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {(conversations || []).map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleSelectConversation(c.id)}
                      className={`w-full text-left truncate text-[12px] px-2.5 py-2 rounded transition-colors border-none cursor-pointer ${activeConversationId === c.id
                        ? 'bg-fb-blue-lightest text-fb-blue font-semibold'
                        : 'bg-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                        }`}
                      title={c.title}
                    >
                      {c.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-auto px-3 py-2.5 border-t border-border">
            <button onClick={handleClearChat} className="w-full flex items-center justify-center gap-1.5 px-3 py-[7px] bg-transparent border border-border rounded text-text-secondary text-xs font-semibold cursor-pointer transition-colors hover:bg-surface-hover hover:border-border-dark hover:text-text-primary">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" />
              </svg>
              New Chat
            </button>
          </div>
        </>
      }
    </aside>
  )
}
