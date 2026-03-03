import { useState, useRef, useEffect, useCallback } from 'react'
import airavatLogo from '/airavat_logo.png'

function escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
}

function formatContent(text) {
    let html = escapeHtml(text)
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre class="bg-surface-hover border border-border rounded px-3 py-2.5 my-2 overflow-x-auto font-mono text-xs leading-snug"><code>$2</code></pre>')
    html = html.replace(/`([^`]+)`/g, '<code class="bg-fb-blue/10 px-1 py-px rounded font-mono text-[11px]">$1</code>')
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    html = html.replace(/\n/g, '<br>')
    return html
}

export default function ChatPage() {
    const [messages, setMessages] = useState([])
    const [input, setInput] = useState('')
    const [showWelcome, setShowWelcome] = useState(true)
    const [conversationId, setConversationId] = useState(null)
    const messagesRef = useRef(null)
    const inputRef = useRef(null)

    const scrollToBottom = useCallback(() => {
        requestAnimationFrame(() => {
            if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight
        })
    }, [])

    useEffect(() => {
        const handleClear = () => { setMessages([]); setShowWelcome(true); setConversationId(null); }
        const handleLoadChat = async (e) => {
            const id = e.detail?.id
            if (!id) return

            try {
                const res = await fetch(`/api/chat/conversations/${id}`)
                if (res.ok) {
                    const data = await res.json()
                    setMessages(data.history || [])
                    setConversationId(data.id)
                    setShowWelcome(false)
                }
            } catch (err) {
                console.error("Failed to load chat", err)
            }
        }

        window.addEventListener('airavat:clear-chat', handleClear)
        window.addEventListener('airavat:load-chat', handleLoadChat)
        return () => {
            window.removeEventListener('airavat:clear-chat', handleClear)
            window.removeEventListener('airavat:load-chat', handleLoadChat)
        }
    }, [])

    useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

    const handleSubmit = async (e) => {
        e.preventDefault()
        const message = input.trim()
        if (!message) return
        setShowWelcome(false)
        setMessages((prev) => [...prev, { role: 'user', content: message }])
        setInput('')

        const wittyReplies = [
            "on it."
        ];
        const wittyReply = wittyReplies[Math.floor(Math.random() * wittyReplies.length)];
        setMessages((prev) => [...prev, { role: 'assistant', content: wittyReply }])

        try {
            const payload = { message }
            if (conversationId) {
                payload.conversation_id = conversationId
            }

            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            if (!res.ok) {
                const err = await res.json()
                setMessages((prev) => [...prev, { role: 'error', content: err.error || 'Something went wrong' }])
                return
            }
            const data = await res.json()
            if (data.toolCalls?.length > 0) setMessages((prev) => [...prev, { role: 'tools', toolCalls: data.toolCalls }])
            if (data.reply) setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }])

            if (data.conversation_id && data.conversation_id !== conversationId) {
                setConversationId(data.conversation_id)
                window.dispatchEvent(new CustomEvent('airavat:chat-active', { detail: { id: data.conversation_id } }))
            }
        } catch {
            setMessages((prev) => [...prev, { role: 'error', content: 'Network error — is the server running?' }])
        } finally {
            inputRef.current?.focus()
        }
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e) }
    }

    const handleInputChange = (e) => {
        setInput(e.target.value)
        const el = e.target
        el.style.height = 'auto'
        el.style.height = Math.min(el.scrollHeight, 120) + 'px'
    }

    return (
        <main className="flex-1 flex flex-col bg-page-bg overflow-hidden">
            {/* Header */}
            <div className="bg-surface border-b border-border px-5 py-2.5 flex items-center gap-2 font-bold text-sm text-text-primary">
                <img src={airavatLogo} alt="Airavat" className="w-5 h-5 object-contain" />
                Chat
            </div>

            {/* Messages */}
            <div ref={messagesRef} className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-2.5 custom-scrollbar scroll-smooth">
                {showWelcome && messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center text-center py-16 animate-fade-in">
                        <div className="w-32 h-32 rounded-full flex items-center justify-center  "><img src={airavatLogo} alt="Airavat" className="w-full object-cover" /></div>
                        <h2 className="text-xl font-bold mb-1.5 text-text-primary">Welcome to Airavat</h2>
                        <p className="text-[13px] text-text-secondary max-w-[400px] leading-relaxed">Your MCP-powered AI assistant. Ask me anything — I can use tools from connected MCP servers to help you.</p>
                    </div>
                )}

                {messages.map((msg, i) => {
                    if (msg.role === 'tools') {
                        return (
                            <div key={i} className="max-w-[680px] w-full mx-auto animate-message-in">
                                {msg.toolCalls.map((tc, j) => (
                                    <div key={j} className="px-3 py-2 bg-tool-bg border border-tool-border rounded mb-1 text-[11px] font-mono">
                                        <div className="flex items-center gap-1.5 text-orange font-semibold mb-1">
                                            <svg className="shrink-0" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
                                            </svg>
                                            <span className="font-bold">{tc.name}</span>
                                        </div>
                                        <div className="text-text-secondary text-[10px] leading-snug max-h-[100px] overflow-auto whitespace-pre-wrap thin-scrollbar">{JSON.stringify(tc.input, null, 2)}</div>
                                    </div>
                                ))}
                            </div>
                        )
                    }

                    const isUser = msg.role === 'user'
                    const isError = msg.role === 'error'
                    const roleLabel = isUser ? 'You' : msg.role === 'assistant' ? 'Assistant' : 'Error'

                    return (
                        <div key={i} className="max-w-[680px] w-full mx-auto animate-message-in">
                            <div className={`text-[11px] font-bold uppercase tracking-wide mb-1 px-0.5 ${isUser ? 'text-fb-blue text-right' : isError ? 'text-red' : 'text-text-muted'}`}>{roleLabel}</div>
                            <div
                                className={`px-3.5 py-2.5 text-[13px] leading-relaxed break-words whitespace-pre-wrap ${isUser
                                    ? 'bg-fb-blue text-white rounded-md rounded-bl-sm ml-20'
                                    : isError
                                        ? 'bg-red-bg border border-[#ffccc7] text-red rounded-md'
                                        : 'bg-surface border border-border text-text-primary rounded-md rounded-bl-sm'
                                    }`}
                                dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }}
                            />
                        </div>
                    )
                })}
            </div>

            {/* Input */}
            <div className="px-5 py-3 bg-surface border-t border-border">
                <form className="max-w-[680px] mx-auto w-full" onSubmit={handleSubmit}>
                    <div className="flex items-center gap-2 px-3 py-2 bg-input-bg border border-border rounded-lg transition-[border-color,box-shadow] focus-within:border-fb-blue focus-within:shadow-[0_0_0_2px_rgba(106,59,26,0.15)]">
                        <textarea
                            ref={inputRef}
                            className="flex-1 bg-transparent h-[100%] border-none outline-none text-text-primary text-[13px] leading-snug resize-none min-h-[100%] overflow-y-auto font-sans"
                            placeholder="Write a message..."
                            rows="1"
                            value={input}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            autoFocus
                        />
                        <button type="submit" disabled={!input.trim()} title="Send" className="flex items-center justify-center w-8 h-8 border-none rounded bg-fb-blue text-white cursor-pointer transition-colors hover:bg-fb-blue-hover disabled:opacity-40 disabled:cursor-not-allowed shrink-0">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13" />
                                <polygon points="22 2 15 22 11 13 2 9 22 2" />
                            </svg>
                        </button>
                    </div>
                </form>
            </div>
        </main>
    )
}
