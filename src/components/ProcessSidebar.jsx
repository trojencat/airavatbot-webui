import { useState, useEffect } from 'react'
import useConfigSocket from '../hooks/useConfigSocket'

export default function ProcessSidebar() {
    const { subscribe, unsubscribe } = useConfigSocket()
    const [processes, setProcesses] = useState({})
    const [now, setNow] = useState(Date.now())
    const [collapsed, setCollapsed] = useState(false)

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(timer)
    }, [])

    useEffect(() => {
        const handleProcessUpdate = (data) => {
            setProcesses(data)
        }

        // Since we want the raw current state immediately if possible, but our socket only pushes
        // on change, we rely on the backend pushing immediately when a process starts or changes.
        subscribe('process_update', handleProcessUpdate)
        return () => unsubscribe('process_update', handleProcessUpdate)
    }, [subscribe, unsubscribe])

    const procList = (Object.values(processes) || [])
        .sort((a, b) => b.started_at - a.started_at) // newest first

    if (!procList || procList.length === 0) {
        return null
    }

    return (
        <aside className={`${collapsed ? 'w-fit h-fit top-1/2 rounded-full ' : 'w-[280px] h-full min-w-[280px] '} right-0 absolute sm:relative bg-surface/60 sm:bg-surface backdrop-blur-lg sm:backdrop-blur-none border-l border-border flex flex-col overflow-y-auto z-50 animate-fade-in shadow-xl shadow-black/5`}>
            <div className={`bg-header-bg px-4 py-3.5 border-[#29487d] flex justify-around items-center ${!collapsed ? 'border-b' : ''}`}>
                {!collapsed && (
                    <div className="grow">
                        <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                            </svg>
                            Active Tasks
                        </h2>
                        <span className="text-[10px] font-normal text-white/50 tracking-wide block mt-0.5">
                            {procList.length} running...
                        </span>
                    </div>
                )}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="text-white/60 hover:text-white transition-colors"
                    aria-label="Collapse process sidebar"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
            </div>

            {!collapsed && (
                <div className="flex-1 p-3 flex flex-col gap-3">
                    {procList.map((proc) => {
                        const isThinking = proc.status === 'Thinking...' || proc.status === 'Initializing'

                        return (
                            <div key={proc.id} className="bg-page-bg border border-border rounded-md p-3 relative shadow-sm hover:shadow-md transition-shadow">
                                <div className="absolute top-3 right-3 text-[10px] font-mono whitespace-nowrap bg-fb-blue/10 text-fb-blue px-1.5 py-0.5 rounded-sm">
                                    {Math.max(0, Math.floor(now / 1000 - proc.started_at))}s
                                </div>

                                <div className="text-text-primary text-[12px] font-semibold leading-snug mb-2 pr-6 line-clamp-2">
                                    "{proc.query}"
                                </div>

                                <div className="flex items-center gap-2 mt-2">
                                    {isThinking ? (
                                        <div className="flex gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-fb-blue animate-bounce-dot shrink-0" />
                                            <span className="w-1.5 h-1.5 rounded-full bg-fb-blue animate-bounce-dot-2 shrink-0" />
                                            <span className="w-1.5 h-1.5 rounded-full bg-fb-blue animate-bounce-dot-3 shrink-0" />
                                        </div>
                                    ) : (
                                        <svg className="w-4 h-4 text-orange shrink-0 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
                                        </svg>
                                    )}
                                    <span className="text-[11px] font-medium text-text-secondary truncate">
                                        {proc.status}
                                    </span>
                                </div>

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
                            </div>
                        )
                    })}
                </div>
            )}
        </aside>
    )
}
