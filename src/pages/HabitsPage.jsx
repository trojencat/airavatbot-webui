import { useState, useEffect, useCallback } from 'react'
import useConfigSocket from '../hooks/useConfigSocket'

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

const SectionCard = ({ children }) => (
    <section className="mb-6 bg-surface border border-border rounded-md p-4.5 shadow-[0_1px_2px_rgba(0,0,0,0.1)]">
        {children}
    </section>
)

export default function HabitsPage() {
    const { subscribe, unsubscribe } = useConfigSocket()
    const [habits, setHabits] = useState([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editingHabit, setEditingHabit] = useState(null)

    // Form state
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [scheduledTime, setScheduledTime] = useState('09:00')
    const [saving, setSaving] = useState(false)

    const loadHabits = useCallback(async () => {
        try {
            const res = await fetch('/api/habits')
            if (res.ok) {
                const data = await res.json()
                setHabits(data.habits || [])
            }
        } catch { /* ignore */ }
        finally { setLoading(false) }
    }, [])

    useEffect(() => { loadHabits() }, [loadHabits])

    // Live updates via WebSocket
    useEffect(() => {
        const onHabitsChanged = () => loadHabits()
        const onHabitExecuted = (data) => {
            loadHabits()
            if (data.status === 'success') {
                showToast(`✅ Habit "${data.title}" completed`, 'success')
            } else {
                showToast(`❌ Habit "${data.title}" failed`, 'error')
            }
        }
        const onHabitStarted = (data) => {
            showToast(`🕐 Running habit: ${data.title}...`, 'info')
        }

        subscribe('habits_changed', onHabitsChanged)
        subscribe('habit_executed', onHabitExecuted)
        subscribe('habit_started', onHabitStarted)

        return () => {
            unsubscribe('habits_changed', onHabitsChanged)
            unsubscribe('habit_executed', onHabitExecuted)
            unsubscribe('habit_started', onHabitStarted)
        }
    }, [subscribe, unsubscribe, loadHabits])

    const resetForm = () => {
        setTitle('')
        setDescription('')
        setScheduledTime('09:00')
        setEditingHabit(null)
        setShowForm(false)
    }

    const openEditForm = (habit) => {
        setTitle(habit.title)
        setDescription(habit.description)
        setScheduledTime(habit.scheduledTime)
        setEditingHabit(habit)
        setShowForm(true)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!title.trim() || !description.trim()) {
            showToast('Title and description are required', 'error')
            return
        }
        setSaving(true)
        try {
            const body = { title: title.trim(), description: description.trim(), scheduledTime }
            let res
            if (editingHabit) {
                res = await fetch(`/api/habits/${editingHabit.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                })
            } else {
                res = await fetch('/api/habits', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                })
            }
            if (res.ok) {
                showToast(editingHabit ? 'Habit updated' : 'Habit created', 'success')
                resetForm()
                loadHabits()
            } else {
                const data = await res.json()
                showToast(data.error || 'Failed to save', 'error')
            }
        } catch { showToast('Network error', 'error') }
        finally { setSaving(false) }
    }

    const deleteHabit = async (id) => {
        try {
            const res = await fetch(`/api/habits/${id}`, { method: 'DELETE' })
            if (res.ok) {
                showToast('Habit deleted', 'success')
                loadHabits()
            }
        } catch { showToast('Failed to delete', 'error') }
    }

    const toggleEnabled = async (habit) => {
        // Optimistic
        setHabits(prev => prev.map(h => h.id === habit.id ? { ...h, enabled: !habit.enabled } : h))
        try {
            await fetch(`/api/habits/${habit.id}/toggle`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: !habit.enabled })
            })
        } catch { loadHabits() }
    }

    const toggleNotifications = async (habit) => {
        setHabits(prev => prev.map(h => h.id === habit.id ? { ...h, notificationsOn: !habit.notificationsOn } : h))
        try {
            await fetch(`/api/habits/${habit.id}/notifications`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notificationsOn: !habit.notificationsOn })
            })
        } catch { loadHabits() }
    }

    const formatLastRun = (ts) => {
        if (!ts) return 'Never'
        const d = new Date(ts * 1000)
        const now = new Date()
        const diff = Math.floor((now - d) / 1000)
        if (diff < 60) return 'Just now'
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
        return d.toLocaleDateString()
    }

    return (
        <main className="flex-1 overflow-y-auto p-6 bg-page-bg">
            <div className="max-w-[620px] mx-auto">
                <div className="flex items-center justify-between mb-6 pb-3 border-b border-border">
                    <div>
                        <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                            <svg className="text-fb-blue" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                            </svg>
                            Habits
                        </h2>
                        <p className="text-xs text-text-muted mt-1">Automated tasks the agent runs on schedule</p>
                    </div>
                    <button
                        onClick={() => { resetForm(); setShowForm(!showForm) }}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-fb-blue border border-fb-blue-hover rounded text-white text-xs font-bold cursor-pointer transition-colors hover:bg-fb-blue-hover"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M12 5v14M5 12h14" />
                        </svg>
                        New Habit
                    </button>
                </div>

                {/* Create/Edit Form */}
                {showForm && (
                    <SectionCard>
                        <h3 className="flex items-center gap-2 text-sm font-bold text-text-primary mb-3">
                            <svg className="text-fb-blue" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                            {editingHabit ? 'Edit Habit' : 'Create New Habit'}
                        </h3>
                        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                            <div>
                                <label className="text-xs font-bold text-text-primary block mb-1">Title</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g., Morning Briefing"
                                    className="w-full px-3 py-2 bg-input-bg border border-border rounded text-text-primary text-xs transition-[border-color] focus:outline-none focus:border-fb-blue focus:shadow-[0_0_0_2px_rgba(106,59,26,0.15)]"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-text-primary block mb-1">Description</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Describe in detail what the agent should do with the available tools..."
                                    rows={4}
                                    className="w-full px-3 py-2 bg-input-bg border border-border rounded text-text-primary text-xs transition-[border-color] focus:outline-none focus:border-fb-blue focus:shadow-[0_0_0_2px_rgba(106,59,26,0.15)] resize-y"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-text-primary block mb-1">Scheduled Time (24h)</label>
                                <input
                                    type="time"
                                    value={scheduledTime}
                                    onChange={(e) => setScheduledTime(e.target.value)}
                                    className="px-3 py-2 bg-input-bg border border-border rounded text-text-primary text-xs transition-[border-color] focus:outline-none focus:border-fb-blue focus:shadow-[0_0_0_2px_rgba(106,59,26,0.15)]"
                                />
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-4.5 py-2 bg-fb-blue border border-fb-blue-hover rounded text-white text-xs font-bold cursor-pointer transition-colors hover:bg-fb-blue-hover disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {saving ? 'Saving...' : (editingHabit ? 'Update Habit' : 'Create Habit')}
                                </button>
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="px-4 py-2 bg-transparent border border-border rounded text-text-secondary text-xs font-semibold cursor-pointer transition-colors hover:bg-surface-hover hover:text-text-primary"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </SectionCard>
                )}

                {/* Habits List */}
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <span className="w-5 h-5 border-2 border-fb-blue border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : habits.length === 0 ? (
                    <SectionCard>
                        <div className="text-center py-8">
                            <svg className="mx-auto mb-3 text-text-muted" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                            </svg>
                            <p className="text-sm text-text-muted">No habits configured yet</p>
                            <p className="text-xs text-text-muted mt-1">Click "New Habit" to create your first automated task</p>
                        </div>
                    </SectionCard>
                ) : (
                    <div className="flex flex-col gap-3">
                        {habits.map((habit) => (
                            <SectionCard key={habit.id}>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`w-2 h-2 rounded-full shrink-0 ${habit.enabled ? 'bg-green' : 'bg-text-muted'}`} />
                                            <h4 className="text-[13px] font-bold text-text-primary truncate">{habit.title}</h4>
                                            <span className="text-[10px] font-mono text-fb-blue bg-fb-blue-lightest px-1.5 py-0.5 rounded shrink-0">
                                                {habit.scheduledTime}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-text-secondary leading-relaxed line-clamp-2 ml-4">
                                            {habit.description}
                                        </p>
                                        <div className="flex items-center gap-3 mt-2 ml-4">
                                            <span className="text-[10px] text-text-muted">
                                                Last run: {formatLastRun(habit.lastRunAt)}
                                            </span>
                                            {habit.lastRunStatus && (
                                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${habit.lastRunStatus === 'success' ? 'text-green bg-green/10' : 'text-red bg-red/10'}`}>
                                                    {habit.lastRunStatus}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1 shrink-0">
                                        <label className="relative w-10 h-[22px]">
                                            <input type="checkbox" className="opacity-0 w-0 h-0" checked={habit.enabled} onChange={() => toggleEnabled(habit)} />
                                            <span className="toggle-slider" />
                                        </label>
                                    </div>
                                </div>

                                {/* Controls */}
                                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => openEditForm(habit)}
                                            className="text-[11px] font-semibold text-text-secondary hover:text-fb-blue transition-colors flex items-center gap-1 bg-transparent border-none cursor-pointer"
                                        >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                                            </svg>
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => deleteHabit(habit.id)}
                                            className="text-[11px] font-semibold text-text-secondary hover:text-red transition-colors flex items-center gap-1 bg-transparent border-none cursor-pointer"
                                        >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" />
                                            </svg>
                                            Delete
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] text-text-muted">Notifications</span>
                                        <label className="relative w-8 h-[18px]">
                                            <input type="checkbox" className="opacity-0 w-0 h-0" checked={habit.notificationsOn} onChange={() => toggleNotifications(habit)} />
                                            <span className="toggle-slider" />
                                        </label>
                                    </div>
                                </div>
                            </SectionCard>
                        ))}
                    </div>
                )}
            </div>
        </main>
    )
}
