import { useState, useEffect, useCallback } from 'react'
import { useTheme } from '../App'
import useConfigSocket from '../hooks/useConfigSocket'

const PROVIDERS = [
    { id: 'anthropic', name: 'Anthropic', icon: '🤖', modelKey: 'model' },
    { id: 'gemini', name: 'Gemini', icon: '✨', modelKey: 'model' },
    { id: 'ollama', name: 'Ollama', icon: '🦙', modelKey: 'model' },
]

function showToast(message, type = 'success') {
    const existing = document.querySelector('.toast')
    if (existing) existing.remove()
    const toast = document.createElement('div')
    toast.className = `toast ${type}`
    toast.textContent = message
    document.body.appendChild(toast)
    requestAnimationFrame(() => toast.classList.add('show'))
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300) }, 2500)
}

function formatSize(bytes) {
    if (!bytes) return ''
    const gb = bytes / (1024 * 1024 * 1024)
    if (gb >= 1) return gb.toFixed(1) + ' GB'
    return (bytes / (1024 * 1024)).toFixed(0) + ' MB'
}

export default function SettingsPage() {
    const { theme, setTheme } = useTheme()
    const { subscribe, unsubscribe } = useConfigSocket()
    const [agentConfig, setAgentConfig] = useState(null)
    const [mcpServers, setMcpServers] = useState([])
    const [ollamaModels, setOllamaModels] = useState([])
    const [switching, setSwitching] = useState(false)
    const [switchingOllama, setSwitchingOllama] = useState(false)
    const [apiKeys, setApiKeys] = useState({ anthropic: '', gemini: '' })
    const [savingKey, setSavingKey] = useState(false)
    const [keyVisibility, setKeyVisibility] = useState({ anthropic: false, gemini: false })
    const [togglingServer, setTogglingServer] = useState(null)
    const [togglingArg, setTogglingArg] = useState(null)
    const [onlineModels, setOnlineModels] = useState([])
    const [loadingModels, setLoadingModels] = useState(false)
    const [switchingModel, setSwitchingModel] = useState(false)

    const activeProvider = agentConfig?.llm?.provider || ''
    const activeOllamaModel = agentConfig?.llm?.ollama?.model || ''
    const activeOnlineModel = activeProvider === 'anthropic'
        ? agentConfig?.llm?.anthropic?.model || ''
        : activeProvider === 'gemini'
            ? agentConfig?.llm?.gemini?.model || ''
            : ''

    const loadAgentConfig = useCallback(async () => {
        try {
            const res = await fetch('/api/settings/agent')
            const config = await res.json()
            setAgentConfig(config)
            if (config.llm.provider === 'ollama') loadOllamaModels()
            if (config.llm.provider !== 'ollama') {
                loadApiKey(config.llm.provider)
                loadOnlineModels(config.llm.provider)
            }
        } catch { showToast('Failed to load config', 'error') }
    }, [])

    const loadMCPServers = useCallback(async () => {
        try { const res = await fetch('/api/settings/mcp'); const data = await res.json(); setMcpServers(Array.isArray(data.servers) ? data.servers : (Array.isArray(data) ? data : [])) }
        catch { setMcpServers([]) }
    }, [])

    const loadOllamaModels = async () => {
        try {
            const res = await fetch('/api/ollama/models')
            if (!res.ok) { const data = await res.json(); showToast(data.error || 'Failed to load models', 'error'); return }
            const data = await res.json()
            setOllamaModels(Array.isArray(data.models) ? data.models : [])
        } catch { setOllamaModels([]) }
    }

    const loadApiKey = async (provider) => {
        if (!provider || provider === 'ollama') return
        try {
            const res = await fetch(`/api/settings/agent/apikey/${provider}`)
            const data = await res.json()
            if (res.ok && data.apiKey) setApiKeys((prev) => ({ ...prev, [provider]: data.apiKey }))
        } catch { }
    }

    const loadOnlineModels = async (provider) => {
        if (!provider || provider === 'ollama') { setOnlineModels([]); return }
        setLoadingModels(true)
        try {
            const res = await fetch(`/api/models/${provider}`)
            const data = await res.json()
            if (res.ok) setOnlineModels(Array.isArray(data.models) ? data.models : [])
            else { setOnlineModels([]); if (data.error) showToast(data.error, 'error') }
        } catch { setOnlineModels([]) }
        finally { setLoadingModels(false) }
    }

    const switchOnlineModel = async (model) => {
        // Optimistic: update local state immediately
        const prevConfig = agentConfig
        setAgentConfig(prev => {
            if (!prev) return prev;
            const updated = JSON.parse(JSON.stringify(prev))
            if (!updated.llm) updated.llm = {};
            if (!updated.llm[activeProvider]) updated.llm[activeProvider] = {};
            updated.llm[activeProvider].model = model
            return updated
        })
        setSwitchingModel(true)
        try {
            const res = await fetch('/api/settings/agent/llm', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: activeProvider, model }) })
            const data = await res.json()
            if (res.ok) showToast(`Model set to ${data.model}`, 'success')
            else { showToast(data.error || 'Failed to switch model', 'error'); setAgentConfig(prevConfig) }
        } catch { showToast('Network error', 'error'); setAgentConfig(prevConfig) }
        finally { setSwitchingModel(false) }
    }

    useEffect(() => { loadAgentConfig(); loadMCPServers() }, [loadAgentConfig, loadMCPServers])

    // ── WebSocket subscriptions for hot-reload ──────────────────
    useEffect(() => {
        const onLlmChanged = (data) => {
            setAgentConfig(prev => {
                if (!prev) return prev
                const updated = JSON.parse(JSON.stringify(prev))
                updated.llm.provider = data.provider
                if (data.model && updated.llm[data.provider]) {
                    updated.llm[data.provider].model = data.model
                }
                return updated
            })
            if (data.provider === 'ollama') loadOllamaModels()
            if (data.provider !== 'ollama') {
                loadApiKey(data.provider)
                loadOnlineModels(data.provider)
            }
        }

        const onMcpToggled = (data) => {
            setMcpServers(prev =>
                (Array.isArray(prev) ? prev : []).map(s => s.name === data.name ? { ...s, enabled: data.enabled, connected: data.connected } : s)
            )
        }

        const onMcpArgsUpdated = (data) => {
            setMcpServers(prev =>
                (Array.isArray(prev) ? prev : []).map(s => s.name === data.name ? { ...s, args: data.args, connected: data.connected } : s)
            )
        }

        const onApikeyChanged = (data) => {
            loadApiKey(data.provider)
        }

        const onUiConfigChanged = (data) => {
            if (data?.theme && data.theme !== theme) {
                setTheme(data.theme)
            }
        }

        subscribe('llm_changed', onLlmChanged)
        subscribe('mcp_server_toggled', onMcpToggled)
        subscribe('mcp_server_args_updated', onMcpArgsUpdated)
        subscribe('apikey_saved', onApikeyChanged)
        subscribe('ui_config_changed', onUiConfigChanged)

        return () => {
            unsubscribe('llm_changed', onLlmChanged)
            unsubscribe('mcp_server_toggled', onMcpToggled)
            unsubscribe('mcp_server_args_updated', onMcpArgsUpdated)
            unsubscribe('apikey_saved', onApikeyChanged)
            unsubscribe('ui_config_changed', onUiConfigChanged)
        }
    }, [subscribe, unsubscribe, theme, setTheme])

    // ── Optimistic actions ──────────────────────────────────────

    const switchProvider = async (provider) => {
        // Optimistic: update provider immediately
        const prevConfig = agentConfig
        setAgentConfig(prev => {
            if (!prev) return prev;
            const updated = JSON.parse(JSON.stringify(prev))
            if (!updated.llm) updated.llm = {};
            updated.llm.provider = provider
            return updated
        })
        setSwitching(true)
        try {
            const res = await fetch('/api/settings/agent/llm', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider }) })
            const data = await res.json()
            if (res.ok) {
                showToast(`Switched to ${provider} / ${data.model}`, 'success')
                // Load provider-specific data
                if (provider === 'ollama') loadOllamaModels()
                else { loadApiKey(provider); loadOnlineModels(provider) }
            } else {
                showToast(data.error || 'Failed to switch', 'error')
                setAgentConfig(prevConfig) // Revert
            }
        } catch { showToast('Network error', 'error'); setAgentConfig(prevConfig) }
        finally { setSwitching(false) }
    }

    const switchOllamaModel = async (model) => {
        // Optimistic
        const prevConfig = agentConfig
        setAgentConfig(prev => {
            if (!prev) return prev;
            const updated = JSON.parse(JSON.stringify(prev))
            if (!updated.llm) updated.llm = {};
            if (!updated.llm.ollama) updated.llm.ollama = {};
            updated.llm.ollama.model = model
            return updated
        })
        setSwitchingOllama(true)
        try {
            const res = await fetch('/api/settings/agent/llm', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: 'ollama', model }) })
            const data = await res.json()
            if (res.ok) showToast(`Switched to ${data.model}`, 'success')
            else { showToast(data.error || 'Failed to switch', 'error'); setAgentConfig(prevConfig) }
        } catch { showToast('Network error', 'error'); setAgentConfig(prevConfig) }
        finally { setSwitchingOllama(false) }
    }

    const toggleMcpServer = async (name, enabled) => {
        // Optimistic: toggle immediately
        setMcpServers(prev => (Array.isArray(prev) ? prev : []).map(s => s.name === name ? { ...s, enabled } : s))
        setTogglingServer(name)
        try {
            const res = await fetch(`/api/settings/mcp/${encodeURIComponent(name)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }) })
            const data = await res.json()
            if (res.ok) showToast(`${name} ${enabled ? 'enabled' : 'disabled'}`, 'success')
            else { showToast(data.error || 'Failed to toggle', 'error'); loadMCPServers() }
        } catch { showToast('Network error', 'error'); loadMCPServers() }
        finally { setTogglingServer(null) }
    }

    const toggleServerArg = async (name, flag, shouldAdd) => {
        // Optimistic: toggle arg immediately
        setMcpServers(prev => (Array.isArray(prev) ? prev : []).map(s => {
            if (s.name !== name) return s
            const newArgs = shouldAdd ? [...s.args, flag] : s.args.filter(a => a !== flag)
            return { ...s, args: newArgs }
        }))
        setTogglingArg(`${name}:${flag}`)
        try {
            const body = shouldAdd ? { add: [flag] } : { remove: [flag] }
            const res = await fetch(`/api/settings/mcp/${encodeURIComponent(name)}/args`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
            const data = await res.json()
            if (res.ok) showToast(`${name} ${flag} ${shouldAdd ? 'enabled' : 'disabled'}`, 'success')
            else { showToast(data.error || 'Failed to update', 'error'); loadMCPServers() }
        } catch { showToast('Network error', 'error'); loadMCPServers() }
        finally { setTogglingArg(null) }
    }

    const saveApiKey = async () => {
        if (activeProvider === 'ollama') { showToast('Ollama does not require an API key', 'info'); return }
        const apiKey = apiKeys[activeProvider]?.trim()
        if (!apiKey) { showToast('API key cannot be empty', 'error'); return }
        setSavingKey(true)
        try {
            const res = await fetch('/api/settings/agent/apikey', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: activeProvider, apiKey }) })
            const data = await res.json()
            if (res.ok) showToast('API key saved successfully', 'success')
            else showToast(data.error || 'Failed to save', 'error')
        } catch { showToast('Network error', 'error') }
        finally { setSavingKey(false) }
    }

    const handleThemeToggle = async (newTheme) => {
        setTheme(newTheme) // Optimistic
        try {
            await fetch('/api/settings/ui', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ theme: newTheme }) })
            showToast(`Theme set to ${newTheme}`, 'success')
        } catch { showToast('Failed to save theme', 'error') }
    }

    const SectionCard = ({ children }) => (
        <section className="mb-6 bg-surface border border-border rounded-md p-4.5 shadow-[0_1px_2px_rgba(0,0,0,0.1)]">
            {children}
        </section>
    )

    const EyeIcon = () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
        </svg>
    )

    return (
        <main className="flex-1 overflow-y-auto p-6 bg-page-bg">
            <div className="max-w-[620px] mx-auto">
                <h2 className="text-xl font-bold mb-6 text-text-primary pb-3 border-b border-border">Settings</h2>

                {/* LLM Provider */}
                <SectionCard>
                    <div className="mb-3.5">
                        <h3 className="flex items-center gap-2 text-sm font-bold text-text-primary mb-1">
                            <svg className="text-fb-blue" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 2a4 4 0 014 4c0 1.95-1.4 3.58-3.25 3.93L12 22l-.75-12.07A4.001 4.001 0 0112 2z" />
                                <path d="M8 10a4 4 0 00-4 4c0 1.95 1.4 3.58 3.25 3.93" />
                                <path d="M16 10a4 4 0 014 4c0 1.95-1.4 3.58-3.25 3.93" />
                            </svg>
                            LLM Provider
                        </h3>
                        <span className="text-xs text-text-muted">Choose which language model powers the agent</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {PROVIDERS.map((p) => {
                            const model = agentConfig?.llm?.[p.id]?.[p.modelKey] || '—'
                            const isActive = p.id === activeProvider
                            return (
                                <div key={p.id} onClick={() => !switching && switchProvider(p.id)}
                                    className={`p-3.5 bg-surface border rounded text-center cursor-pointer transition-all ${isActive ? 'border-fb-blue bg-fb-blue-lightest shadow-[inset_0_0_0_1px_#6a3b1a]' : 'border-border hover:border-border-dark hover:bg-surface-hover'} ${switching ? 'opacity-50 pointer-events-none' : ''}`}>
                                    <span className="text-[22px] mb-1.5 block">{p.icon}</span>
                                    <div className="text-[13px] font-bold text-text-primary mb-0.5">{p.name}</div>
                                    <div className="text-[10px] font-mono text-text-muted">{model}</div>
                                </div>
                            )
                        })}
                    </div>
                </SectionCard>

                {/* API Keys */}
                {activeProvider && activeProvider !== 'ollama' && (
                    <SectionCard>
                        <div className="mb-3.5">
                            <h3 className="flex items-center gap-2 text-sm font-bold text-text-primary mb-1">
                                <svg className="text-fb-blue" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                                </svg>
                                API Key
                            </h3>
                            <span className="text-xs text-text-muted">Enter your provider API key (stored securely in config)</span>
                        </div>
                        {['anthropic', 'gemini'].filter(p => p === activeProvider).map(p => (
                            <div key={p} className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-text-primary">{p === 'anthropic' ? 'Anthropic' : 'Gemini'} API Key</label>
                                <div className="flex items-center gap-1.5">
                                    <input type={keyVisibility[p] ? 'text' : 'password'}
                                        className="flex-1 px-3 py-2 bg-input-bg border border-border rounded text-text-primary text-xs font-mono transition-[border-color] focus:outline-none focus:border-fb-blue focus:shadow-[0_0_0_2px_rgba(106,59,26,0.15)]"
                                        placeholder={p === 'anthropic' ? 'sk-ant-...' : 'AIzaSy...'} value={apiKeys[p]}
                                        onChange={(e) => setApiKeys(prev => ({ ...prev, [p]: e.target.value }))} autoComplete="off" />
                                    <button type="button" onClick={() => setKeyVisibility(prev => ({ ...prev, [p]: !prev[p] }))}
                                        className="p-[7px] bg-surface border border-border rounded text-text-secondary cursor-pointer transition-colors hover:text-text-primary hover:border-border-dark hover:bg-surface-hover flex items-center justify-center min-w-[34px] h-[34px]">
                                        <EyeIcon />
                                    </button>
                                </div>
                            </div>
                        ))}
                        <button onClick={saveApiKey} disabled={savingKey}
                            className="mt-2 px-4.5 py-2 bg-fb-blue border border-fb-blue-hover rounded text-white text-xs font-bold cursor-pointer transition-colors hover:bg-fb-blue-hover disabled:opacity-50 disabled:cursor-not-allowed">
                            {savingKey ? 'Saving...' : 'Save API Key'}
                        </button>
                    </SectionCard>
                )}

                {/* Online Model Selection (Anthropic / Gemini) */}
                {activeProvider && activeProvider !== 'ollama' && (
                    <SectionCard>
                        <div className="mb-3.5">
                            <h3 className="flex items-center gap-2 text-sm font-bold text-text-primary mb-1">
                                <svg className="text-fb-blue" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M20 7h-3a2 2 0 01-2-2V2" /><path d="M9 18a2 2 0 01-2-2V4a2 2 0 012-2h7l4 4v10a2 2 0 01-2 2H9z" /><path d="M3 7v10a2 2 0 002 2h2" />
                                </svg>
                                Model
                            </h3>
                            <span className="text-xs text-text-muted">Select which model to use for {activeProvider === 'anthropic' ? 'Anthropic' : 'Gemini'}</span>
                        </div>
                        {loadingModels ? (
                            <div className="flex items-center gap-2 py-3 justify-center">
                                <span className="w-4 h-4 border-2 border-fb-blue border-t-transparent rounded-full animate-spin" />
                                <span className="text-xs text-text-muted">Loading models...</span>
                            </div>
                        ) : (!onlineModels || onlineModels.length === 0) ? (
                            <p className="text-xs text-text-muted py-1">No models available. Make sure your API key is set and saved.</p>
                        ) : (
                            <div className="flex flex-col gap-1.5 max-h-[240px] overflow-y-auto thin-scrollbar">
                                {(onlineModels || []).map((m) => {
                                    const isActive = m.id === activeOnlineModel
                                    return (
                                        <div key={m.id} onClick={() => !switchingModel && !isActive && switchOnlineModel(m.id)}
                                            className={`flex items-center justify-between px-3.5 py-2.5 bg-surface border rounded cursor-pointer transition-all ${isActive ? 'border-fb-blue bg-fb-blue-lightest cursor-default' : 'border-border hover:border-border-dark hover:bg-surface-hover'} ${switchingModel ? 'opacity-50 pointer-events-none' : ''}`}>
                                            <div className="flex items-center gap-1.5">
                                                {isActive && <span className="w-1.5 h-1.5 rounded-full bg-green inline-block shrink-0" />}
                                                <span className="text-xs font-semibold text-text-primary font-mono">{m.id}</span>
                                            </div>
                                            {isActive && <span className="text-[10px] font-bold text-fb-blue bg-fb-blue-lightest px-2 py-0.5 rounded-full border border-[#d4c4b0] uppercase tracking-wide">Active</span>}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </SectionCard>
                )}

                {/* Ollama API Key info */}
                {activeProvider === 'ollama' && (
                    <SectionCard>
                        <h3 className="flex items-center gap-2 text-sm font-bold text-text-primary mb-3">
                            <svg className="text-fb-blue" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                            </svg>
                            API Key
                        </h3>
                        <div className="flex items-start gap-2.5 px-3 py-2.5 bg-fb-blue-lightest border border-[#d4c4b0] rounded">
                            <svg className="text-fb-blue shrink-0 mt-px" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            <p className="text-xs text-text-secondary leading-snug">Ollama is a local model and does not require an API key.</p>
                        </div>
                    </SectionCard>
                )}

                {/* Ollama Models */}
                {activeProvider === 'ollama' && (
                    <SectionCard>
                        <div className="mb-3.5">
                            <h3 className="flex items-center gap-2 text-sm font-bold text-text-primary mb-1">
                                <svg className="text-fb-blue" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M20 7h-3a2 2 0 01-2-2V2" /><path d="M9 18a2 2 0 01-2-2V4a2 2 0 012-2h7l4 4v10a2 2 0 01-2 2H9z" /><path d="M3 7v10a2 2 0 002 2h2" />
                                </svg>
                                Local Models
                            </h3>
                            <span className="text-xs text-text-muted">Select which downloaded Ollama model to use</span>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            {(!ollamaModels || ollamaModels.length === 0) ? (
                                <p className="text-xs text-text-muted py-1">No models downloaded. Run <code className="bg-surface-hover px-1 rounded font-mono text-[11px]">ollama pull &lt;model&gt;</code> to add one.</p>
                            ) : (ollamaModels || []).map((m) => {
                                const isActive = m.name === activeOllamaModel
                                return (
                                    <div key={m.name} onClick={() => !switchingOllama && !isActive && switchOllamaModel(m.name)}
                                        className={`flex items-center justify-between px-3.5 py-2.5 bg-surface border rounded cursor-pointer transition-all ${isActive ? 'border-fb-blue bg-fb-blue-lightest cursor-default' : 'border-border hover:border-border-dark hover:bg-surface-hover'} ${switchingOllama ? 'opacity-50 pointer-events-none' : ''}`}>
                                        <div className="flex flex-col gap-0.5">
                                            <div className="text-xs font-semibold text-text-primary flex items-center gap-1.5 font-mono">
                                                {isActive && <span className="w-1.5 h-1.5 rounded-full bg-green inline-block" />}
                                                {m.name}
                                            </div>
                                            <div className="text-[10px] text-text-muted">{formatSize(m.size)}</div>
                                        </div>
                                        {isActive && <span className="text-[10px] font-bold text-fb-blue bg-fb-blue-lightest px-2 py-0.5 rounded-full border border-[#d4c4b0] uppercase tracking-wide">Active</span>}
                                    </div>
                                )
                            })}
                        </div>
                    </SectionCard>
                )}

                {/* MCP Servers */}
                <SectionCard>
                    <div className="mb-3.5">
                        <h3 className="flex items-center gap-2 text-sm font-bold text-text-primary mb-1">
                            <svg className="text-fb-blue" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="2" y="2" width="20" height="8" rx="2" ry="2" /><rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                                <line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" />
                            </svg>
                            MCP Servers
                        </h3>
                        <span className="text-xs text-text-muted">Enable or disable MCP tool servers. Changes take effect immediately.</span>
                    </div>
                    <div className="flex flex-col gap-2">
                        {(!mcpServers || mcpServers.length === 0) ? (
                            <p className="text-xs text-text-muted py-1">No servers configured in mcp-config.json</p>
                        ) : (mcpServers || []).map((s) => {
                            if (!s) return null;
                            const isToggling = togglingServer === s.name
                            const isBrowser = s.name === 'browser'
                            const isHeadless = Array.isArray(s.args) && s.args.includes('--headless')
                            const isTogglingHeadless = togglingArg === `${s.name}:--headless`
                            return (
                                <div key={s.name || Math.random()} className={`bg-surface border border-border rounded transition-all hover:border-border-dark ${!s.enabled && !isToggling ? 'opacity-50' : ''} ${isToggling ? 'opacity-40 pointer-events-none' : ''}`}>
                                    <div className="flex items-center justify-between px-3.5 py-3">
                                        <div className="flex flex-col gap-1">
                                            <div className="text-[13px] font-bold text-text-primary flex items-center gap-1.5">
                                                {isToggling ? (
                                                    <span className="w-3 h-3 border-2 border-fb-blue border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <span className={`w-1.5 h-1.5 rounded-full ${s.connected ? 'bg-green' : 'bg-text-muted'}`} />
                                                )}
                                                {s.name}
                                            </div>
                                            <div className="text-[10px] font-mono text-text-muted">{s.command} {(s.args || []).join(' ')}</div>
                                        </div>
                                        <label className="relative w-10 h-[22px] shrink-0">
                                            <input type="checkbox" className="opacity-0 w-0 h-0" checked={s.enabled} onChange={(e) => toggleMcpServer(s.name, e.target.checked)} disabled={isToggling} />
                                            <span className="toggle-slider" />
                                        </label>
                                    </div>
                                    {isBrowser && s.enabled && (
                                        <div className={`border-t border-border px-3.5 py-2.5 flex items-center justify-between transition-all ${isTogglingHeadless ? 'opacity-40 pointer-events-none' : ''}`}>
                                            <div className="flex items-center gap-2">
                                                {isTogglingHeadless && <span className="w-3 h-3 border-2 border-fb-blue border-t-transparent rounded-full animate-spin shrink-0" />}
                                                <div>
                                                    <div className="text-[11px] font-semibold text-text-primary">Headless mode</div>
                                                    <div className="text-[10px] text-text-muted">Run browser without visible window</div>
                                                </div>
                                            </div>
                                            <label className="relative w-10 h-[22px] shrink-0">
                                                <input type="checkbox" className="opacity-0 w-0 h-0" checked={isHeadless} onChange={() => toggleServerArg('browser', '--headless', !isHeadless)} disabled={isTogglingHeadless} />
                                                <span className="toggle-slider" />
                                            </label>
                                        </div>
                                    )}
                                </div>)
                        })}
                    </div>
                </SectionCard>

                {/* UI Settings */}
                <SectionCard>
                    <div className="mb-3.5">
                        <h3 className="flex items-center gap-2 text-sm font-bold text-text-primary mb-1">
                            <svg className="text-fb-blue" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                            </svg>
                            UI Settings
                        </h3>
                        <span className="text-xs text-text-muted">Customize the interface appearance</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-[13px] font-semibold text-text-primary">Theme</div>
                            <div className="text-[11px] text-text-muted">Choose between light and dark mode</div>
                        </div>
                        <div className="flex bg-surface-hover border border-border rounded overflow-hidden">
                            {['light', 'dark'].map((t) => (
                                <button key={t} onClick={() => handleThemeToggle(t)}
                                    className={`px-3 py-1.5 text-xs font-semibold capitalize cursor-pointer transition-colors border-none ${theme === t ? 'bg-fb-blue text-white' : 'bg-transparent text-text-secondary hover:text-text-primary'}`}>
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>
                </SectionCard>
            </div>
        </main>
    )
}
