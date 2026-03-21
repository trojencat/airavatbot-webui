import { useState, useEffect } from 'react'
import useConfigSocket from '../hooks/useConfigSocket'

export default function EnhancedProcessSidebar() {
    const { subscribe, unsubscribe } = useConfigSocket()
    const [processes, setProcesses] = useState({})
    const [filter, setFilter] = useState('all') // all, active, completed, failed
    const [showStats, setShowStats] = useState(false)
    const [stats, setStats] = useState(null)
    const [now, setNow] = useState(Date.now())

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(timer)
    }, [])

    useEffect(() => {
        // Subscribe to all process events
        const handleProcessCreated = (data) => {
            setProcesses(prev => ({ ...prev, [data.id]: data }))
        }

        const handleProcessUpdated = (data) => {
            setProcesses(prev => ({ ...prev, [data.id]: data }))
        }

        const handleProcessCompleted = (data) => {
            setProcesses(prev => ({ ...prev, [data.id]: data }))
        }

        const handleProcessFailed = (data) => {
            setProcesses(prev => ({ ...prev, [data.id]: data }))
        }

        const handleProcessCancelled = (data) => {
            setProcesses(prev => ({ ...prev, [data.id]: data }))
        }

        // Subscribe to enhanced events
        subscribe('process.created', handleProcessCreated)
        subscribe('process.updated', handleProcessUpdated)
        subscribe('process.completed', handleProcessCompleted)
        subscribe('process.failed', handleProcessFailed)
        subscribe('process.cancelled', handleProcessCancelled)

        // Legacy support
        subscribe('process_update', (data) => {
            setProcesses(data)
        })

        // Load initial data
        loadInitialData()

        return () => {
            unsubscribe('process.created', handleProcessCreated)
            unsubscribe('process.updated', handleProcessUpdated)
            unsubscribe('process.completed', handleProcessCompleted)
            unsubscribe('process.failed', handleProcessFailed)
            unsubscribe('process.cancelled', handleProcessCancelled)
            unsubscribe('process_update', (data) => {})
        }
    }, [subscribe, unsubscribe])

    const loadInitialData = async () => {
        try {
            // Load enhanced processes
            const response = await fetch('/api/processes/enhanced?limit=50')
            if (response.ok) {
                const data = await response.json()
                const processMap = {}
                data.processes.forEach(proc => {
                    processMap[proc.id] = proc
                })
                setProcesses(processMap)
            }

            // Load stats
            const statsResponse = await fetch('/api/stats')
            if (statsResponse.ok) {
                const statsData = await statsResponse.json()
                setStats(statsData)
            }
        } catch (err) {
            console.error("Failed to load initial data:", err)
        }
    }

    const cancelProcess = async (processId) => {
        try {
            const response = await fetch(`/api/processes/${processId}/cancel`, {
                method: 'POST'
            })
            if (response.ok) {
                // Process will be updated via WebSocket
            }
        } catch (err) {
            console.error("Failed to cancel process:", err)
        }
    }

    const filteredProcesses = Object.values(processes || {}).filter(proc => {
        switch (filter) {
            case 'active':
                return proc.is_active
            case 'completed':
                return proc.state === 'Completed'
            case 'failed':
                return proc.state === 'Failed'
            case 'cancelled':
                return proc.state === 'Cancelled'
            default:
                return true
        }
    }).sort((a, b) => b.created_at - a.created_at)

    const getStateColor = (state) => {
        switch (state) {
            case 'Thinking...':
            case 'Running':
                return 'text-fb-blue'
            case 'Completed':
                return 'text-green'
            case 'Failed':
                return 'text-red'
            case 'Cancelled':
                return 'text-orange'
            default:
                return 'text-text-secondary'
        }
    }

    const getStateIcon = (state) => {
        switch (state) {
            case 'Thinking...':
            case 'Running':
                return (
                    <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-fb-blue animate-bounce-dot shrink-0" />
                        <span className="w-1.5 h-1.5 rounded-full bg-fb-blue animate-bounce-dot-2 shrink-0" />
                        <span className="w-1.5 h-1.5 rounded-full bg-fb-blue animate-bounce-dot-3 shrink-0" />
                    </div>
                )
            case 'Completed':
                return (
                    <svg className="w-4 h-4 text-green shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M20 6L9 17l-5-5" />
                    </svg>
                )
            case 'Failed':
                return (
                    <svg className="w-4 h-4 text-red shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                )
            case 'Cancelled':
                return (
                    <svg className="w-4 h-4 text-orange shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M3 12h18" />
                    </svg>
                )
            default:
                return (
                    <svg className="w-4 h-4 text-text-secondary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="12" cy="12" r="10" />
                    </svg>
                )
        }
    }

    const formatDuration = (startedAt, completedAt) => {
        const start = startedAt * 1000
        const end = (completedAt || Date.now() / 1000) * 1000
        const duration = Math.floor((end - start) / 1000)
        
        if (duration < 60) return `${duration}s`
        if (duration < 3600) return `${Math.floor(duration / 60)}m ${duration % 60}s`
        return `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`
    }

    if (!filteredProcesses || filteredProcesses.length === 0) {
        return null
    }

    return (
        <aside className="w-[320px] min-w-[320px] bg-surface border-l border-border flex flex-col overflow-y-auto z-10 animate-fade-in shadow-xl shadow-black/5">
            {/* Header */}
            <div className="bg-header-bg px-4 py-3.5 border-b border-[#29487d]">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                            </svg>
                            Tasks
                        </h2>
                        <span className="text-[10px] font-normal text-white/50 tracking-wide block mt-0.5">
                            {filteredProcesses.length} total
                        </span>
                    </div>
                    <button
                        onClick={() => setShowStats(!showStats)}
                        className="text-white/70 hover:text-white text-xs"
                    >
                        {showStats ? 'Hide' : 'Stats'}
                    </button>
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-1 mt-2">
                    {['all', 'active', 'completed', 'failed'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-2 py-1 text-[10px] rounded transition-colors ${
                                filter === f
                                    ? 'bg-fb-blue text-white'
                                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                            }`}
                        >
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Stats Panel */}
            {showStats && stats && (
                <div className="bg-surface-hover border-b border-border p-3">
                    <h3 className="text-xs font-bold text-text-primary mb-2">System Stats</h3>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div>
                            <span className="text-text-muted">Total Events:</span>
                            <span className="ml-1 font-mono">{stats.total_events}</span>
                        </div>
                        <div>
                            <span className="text-text-muted">Active:</span>
                            <span className="ml-1 font-mono text-fb-blue">{stats.active_clients}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Process List */}
            <div className="flex-1 p-3 flex flex-col gap-3">
                {filteredProcesses.map((proc) => {
                    const isActive = proc.is_active
                    const isFinished = proc.is_finished

                    return (
                        <div key={proc.id} className="bg-page-bg border border-border rounded-md p-3 relative shadow-sm hover:shadow-md transition-shadow">
                            {/* Status Badge */}
                            <div className="absolute top-3 right-3">
                                <div className={`text-[10px] font-mono whitespace-nowrap px-1.5 py-0.5 rounded-sm ${getStateColor(proc.state)}`}>
                                    {proc.state}
                                </div>
                            </div>

                            {/* Query */}
                            <div className="text-text-primary text-[12px] font-semibold leading-snug mb-2 pr-12 line-clamp-2">
                                "{proc.query}"
                            </div>

                            {/* Status Row */}
                            <div className="flex items-center gap-2 mt-2">
                                {getStateIcon(proc.state)}
                                <span className={`text-[11px] font-medium truncate ${getStateColor(proc.state)}`}>
                                    {proc.status}
                                </span>
                            </div>

                            {/* Duration */}
                            <div className="text-[9px] text-text-muted mt-1">
                                Duration: {formatDuration(proc.started_at, proc.completed_at)}
                            </div>

                            {/* Tool Calls */}
                            {proc.tool_calls && proc.tool_calls.length > 0 && (
                                <div className="mt-3 pt-2 border-t border-border flex flex-col gap-1.5">
                                    <div className="text-[9px] uppercase tracking-wider font-bold text-text-muted">Tool History</div>
                                    {(proc.tool_calls || []).map((t, i) => (
                                        <div key={i} className="text-[10px] bg-surface border border-tool-border px-2 py-1 rounded font-mono text-text-secondary truncate">
                                            <span className="text-orange">{t.name}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Actions */}
                            {isActive && (
                                <div className="mt-3 pt-2 border-t border-border">
                                    <button
                                        onClick={() => cancelProcess(proc.id)}
                                        className="text-[10px] text-red hover:text-red-hover font-medium"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            )}

                            {/* Error Details */}
                            {proc.error && (
                                <div className="mt-2 pt-2 border-t border-border">
                                    <div className="text-[9px] text-red bg-red-bg/10 border border-red/20 rounded p-1.5">
                                        {proc.error}
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </aside>
    )
}
