import { useState, useRef, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useConversationManager } from '../hooks/useConversationManager'
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

export default function EnhancedChatPage() {
    const location = useLocation()
    const navigate = useNavigate()
    const [input, setInput] = useState('')
    const [showWelcome, setShowWelcome] = useState(true)
    const [isRecording, setIsRecording] = useState(false)
    const [isProcessingAudio, setIsProcessingAudio] = useState(false)
    const [showRealtimeUpdates, setShowRealtimeUpdates] = useState(false)
    
    const messagesRef = useRef(null)
    const inputRef = useRef(null)
    const mediaRecorderRef = useRef(null)
    const audioChunksRef = useRef([])

    // Use enhanced conversation manager
    const {
        conversations,
        activeConversation,
        messages,
        isLoading,
        realtimeUpdates,
        loadConversation,
        sendMessage,
        clearHistory,
        getConversationStats,
        clearRealtimeUpdates
    } = useConversationManager()

    const scrollToBottom = useCallback(() => {
        requestAnimationFrame(() => {
            if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight
        })
    }, [])

    // Route-based conversation loading: /?conversation=<id>
    useEffect(() => {
        const params = new URLSearchParams(location.search || '')
        const id = params.get('conversation')
        if (!id) return

        loadConversation(id).finally(() => {
            // Clean the URL after we load, so refresh doesn't keep forcing the same load.
            navigate('/', { replace: true })
        })
    }, [location.search, loadConversation, navigate])

    useEffect(() => { 
        scrollToBottom() 
    }, [messages, scrollToBottom])

    useEffect(() => {
        const handleClear = () => { 
            clearHistory()
            setShowWelcome(true)
        }
        
        const handleLoadChat = async (e) => {
            const id = e.detail?.id
            if (!id) return
            await loadConversation(id)
        }

        window.addEventListener('airavat:clear-chat', handleClear)
        window.addEventListener('airavat:load-chat', handleLoadChat)
        return () => {
            window.removeEventListener('airavat:clear-chat', handleClear)
            window.removeEventListener('airavat:load-chat', handleLoadChat)
        }
    }, [clearHistory, loadConversation])

    const handleSubmit = async (e) => {
        e.preventDefault()
        const message = input.trim()
        if (!message) return
        await sendMessage(message, activeConversation?.id)
        setInput('')
        setShowWelcome(false)
    }

    const toggleRecording = async () => {
        if (isRecording) {
            mediaRecorderRef.current?.stop()
            setIsRecording(false)
            setIsProcessingAudio(true)
            return
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const mediaRecorder = new MediaRecorder(stream)
            mediaRecorderRef.current = mediaRecorder
            audioChunksRef.current = []

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data)
            }

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
                stream.getTracks().forEach(track => track.stop())

                try {
                    const result = await window.puter.ai.speech2txt({ audio: audioBlob })
                    if (result && result.text) {
                        const message = result.text.trim()
                        if (message) {
                            await sendMessage(message, activeConversation?.id)
                            setInput('')
                            setShowWelcome(false)
                        }
                    }
                } catch (err) {
                    console.error("Speech to text error", err)
                    setMessages((prev) => [...prev, { role: 'error', content: 'Voice input failed. Please try again.' }])
                } finally {
                    setIsProcessingAudio(false)
                }
            }

            mediaRecorder.start()
            setIsRecording(true)
        } catch (err) {
            console.error("Microphone access denied or error:", err)
            setMessages((prev) => [...prev, { role: 'error', content: 'Microphone access is required for voice input.' }])
            setIsProcessingAudio(false)
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

    const stats = getConversationStats()

    return (
        <main className="flex-1 flex flex-col bg-page-bg overflow-hidden">
            {/* Header */}
            <div className="bg-surface border-b border-border px-5 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-sm text-text-primary">
                    <img src={airavatLogo} alt="Airavat" className="w-5 h-5 object-contain" />
                    Chat
                    {activeConversation && (
                        <span className="text-xs text-text-muted ml-2">
                            ({stats.messageCount} messages, {stats.totalTokens} tokens)
                        </span>
                    )}
                </div>
                
                <div className="flex items-center gap-3">
                    {/* Real-time Updates Indicator */}
                    {realtimeUpdates.length > 0 && (
                        <button
                            onClick={() => setShowRealtimeUpdates(!showRealtimeUpdates)}
                            className="text-xs text-fb-blue hover:text-fb-blue-hover flex items-center gap-1"
                        >
                            <div className="w-2 h-2 bg-fb-blue rounded-full animate-pulse" />
                            {realtimeUpdates.length} updates
                        </button>
                    )}
                    
                    {/* Stats */}
                    <button
                        onClick={() => console.log('Stats:', stats)}
                        className="text-xs text-text-muted hover:text-text-primary"
                    >
                        Stats
                    </button>
                </div>
            </div>

            {/* Real-time Updates Panel */}
            {showRealtimeUpdates && realtimeUpdates.length > 0 && (
                <div className="bg-surface-hover border-b border-border p-2 max-h-32 overflow-y-auto">
                    <div className="text-xs font-bold text-text-primary mb-1">Real-time Updates</div>
                    {realtimeUpdates.map((update, i) => (
                        <div key={i} className="text-[10px] text-text-muted mb-1">
                            {update.type}: {update.conversationId} - {new Date(update.timestamp).toLocaleTimeString()}
                        </div>
                    ))}
                    <button
                        onClick={clearRealtimeUpdates}
                        className="text-[10px] text-fb-blue hover:text-fb-blue-hover mt-1"
                    >
                        Clear
                    </button>
                </div>
            )}

            {/* Messages */}
            <div ref={messagesRef} className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-2.5 custom-scrollbar scroll-smooth">
                {isLoading && (
                    <div className="flex justify-center py-4">
                        <div className="text-sm text-text-muted">Loading conversation...</div>
                    </div>
                )}

                {showWelcome && messages.length === 0 && !isLoading && (
                    <div className="flex flex-col items-center justify-center text-center py-16 animate-fade-in">
                        <div className="w-32 h-32 rounded-full flex items-center justify-center">
                            <img src={airavatLogo} alt="Airavat" className="w-full object-cover" />
                        </div>
                        <h2 className="text-xl font-bold mb-1.5 text-text-primary">Welcome to Airavat</h2>
                        <p className="text-[13px] text-text-secondary max-w-[400px] leading-relaxed">
                            Your MCP-powered AI assistant with enhanced real-time process tracking.
                        </p>
                        <div className="mt-4 text-xs text-text-muted">
                            {stats.totalConversations} conversations • {stats.totalTokens} total tokens
                        </div>
                    </div>
                )}

                {(messages || []).map((msg, i) => {
                    if (msg.role === 'tools') {
                        return (
                            <div key={i} className="max-w-[680px] w-full mx-auto animate-message-in">
                                {(msg.toolCalls || []).map((tc, j) => (
                                    <div key={j} className="px-3 py-2 bg-tool-bg border border-tool-border rounded mb-1 text-[11px] font-mono">
                                        <div className="flex items-center gap-1.5 text-orange font-semibold mb-1">
                                            <svg className="shrink-0" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
                                            </svg>
                                            <span className="font-bold">{tc.name}</span>
                                        </div>
                                        <div className="text-text-secondary text-[10px] leading-snug max-h-[100px] overflow-auto whitespace-pre-wrap thin-scrollbar">
                                            {JSON.stringify(tc.input || {}, null, 2)}
                                        </div>
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
                            <div className={`text-[11px] font-bold uppercase tracking-wide mb-1 px-0.5 ${isUser ? 'text-fb-blue text-right' : isError ? 'text-red' : 'text-text-muted'}`}>
                                {roleLabel}
                            </div>
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
                            disabled={isLoading}
                        />
                        <button 
                            type="button" 
                            onClick={toggleRecording} 
                            disabled={isProcessingAudio || isLoading} 
                            title={isRecording ? "Stop Recording" : "Voice Input"} 
                            className={`flex items-center justify-center w-8 h-8 border-none rounded cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 ${isRecording ? 'bg-red text-white animate-pulse' : 'bg-surface-hover text-text-secondary hover:text-text-primary'}`}
                        >
                            {isProcessingAudio ? (
                                <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                    <line x1="12" x2="12" y1="19" y2="23" />
                                    <line x1="8" x2="16" y1="23" y2="23" />
                                </svg>
                            )}
                        </button>
                        <button 
                            type="submit" 
                            disabled={!input.trim() || isProcessingAudio || isLoading} 
                            title="Send" 
                            className="flex items-center justify-center w-8 h-8 border-none rounded bg-fb-blue text-white cursor-pointer transition-colors hover:bg-fb-blue-hover disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                        >
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
