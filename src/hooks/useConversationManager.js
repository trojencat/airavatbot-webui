import { useState, useEffect, useCallback } from 'react'
import useEnhancedSocket from '../hooks/useEnhancedSocket'

/**
 * Enhanced conversation manager with real-time updates
 * Handles all conversation state including messages, process tracking, and real-time events
 */
export function useConversationManager() {
    const { subscribe, unsubscribe } = useEnhancedSocket()
    const [conversations, setConversations] = useState([])
    const [activeConversation, setActiveConversation] = useState(null)
    const [messages, setMessages] = useState([])
    const [isLoading, setIsLoading] = useState(false)
    const [realtimeUpdates, setRealtimeUpdates] = useState([])

    // Subscribe to conversation events
    useEffect(() => {
        const handleConversationCreated = (data) => {
            setConversations(prev => [data, ...prev.slice(0, 49)]) // Keep last 50
        }

        const handleConversationUpdated = (data) => {
            setConversations(prev => {
                const index = prev.findIndex(conv => conv.id === data.id)
                if (index >= 0) {
                    const updated = [...prev]
                    updated[index] = data
                    return updated
                }
                return [data, ...prev.slice(0, 49)]
            })
        }

        const handleMessageAdded = (data) => {
            // Update messages if it's the active conversation
            if (activeConversation && data.conversation_id === activeConversation.id) {
                setMessages(prev => [...prev, data.message])
            }
            
            // Update conversation in list
            setConversations(prev => {
                const index = prev.findIndex(conv => conv.id === data.conversation_id)
                if (index >= 0) {
                    const updated = [...prev]
                    updated[index] = data.conversation
                    return updated
                }
                return prev
            })

            // Add to realtime updates for UI feedback
            setRealtimeUpdates(prev => [{
                type: 'message',
                conversationId: data.conversation_id,
                message: data.message,
                timestamp: Date.now()
            }, ...prev.slice(0, 9)]) // Keep last 10 updates
        }

        // Subscribe to events
        subscribe('conversation.created', handleConversationCreated)
        subscribe('conversation.updated', handleConversationUpdated)
        subscribe('conversation.message_added', handleMessageAdded)

        // Load initial conversations
        loadConversations()

        return () => {
            unsubscribe('conversation.created', handleConversationCreated)
            unsubscribe('conversation.updated', handleConversationUpdated)
            unsubscribe('conversation.message_added', handleMessageAdded)
        }
    }, [subscribe, unsubscribe, activeConversation])

    const loadConversations = useCallback(async () => {
        try {
            const response = await fetch('/api/chat/conversations')
            if (response.ok) {
                const data = await response.json()
                setConversations(data.conversations || [])
            }
        } catch (err) {
            console.error("Failed to load conversations:", err)
        }
    }, [])

    const loadConversation = useCallback(async (conversationId) => {
        setIsLoading(true)
        try {
            const response = await fetch(`/api/chat/conversations/${conversationId}`)
            if (response.ok) {
                const data = await response.json()
                setMessages(data.history || [])
                setActiveConversation({
                    id: data.id,
                    tokens: data.tokens
                })
            }
        } catch (err) {
            console.error("Failed to load conversation:", err)
        } finally {
            setIsLoading(false)
        }
    }, [])

    const sendMessage = useCallback(async (message, conversationId = null) => {
        try {
            const payload = { message }
            if (conversationId) {
                payload.conversation_id = conversationId
            }

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            if (!response.ok) {
                const err = await response.json()
                throw new Error(err.error || 'Failed to send message')
            }

            const data = await response.json()
            
            // Update active conversation if new one was created
            if (data.conversation_id && (!conversationId || data.conversation_id !== conversationId)) {
                await loadConversation(data.conversation_id)
                // Trigger conversation list refresh
                loadConversations()
            }

            return data
        } catch (err) {
            console.error("Failed to send message:", err)
            throw err
        }
    }, [loadConversation, loadConversations])

    const clearHistory = useCallback(async () => {
        try {
            await fetch('/api/clear', { method: 'POST' })
            setMessages([])
            setActiveConversation(null)
            await loadConversations()
        } catch (err) {
            console.error("Failed to clear history:", err)
        }
    }, [loadConversations])

    const deleteConversation = useCallback(async (conversationId) => {
        try {
            // This would need to be implemented on the backend
            console.log("Delete conversation not yet implemented:", conversationId)
        } catch (err) {
            console.error("Failed to delete conversation:", err)
        }
    }, [])

    const getConversationStats = useCallback(() => {
        const totalTokens = conversations.reduce((sum, conv) => sum + (conv.tokens || 0), 0)
        const totalMessages = conversations.length
        
        return {
            totalConversations: conversations.length,
            totalTokens,
            totalMessages,
            activeConversation: activeConversation?.id,
            messageCount: messages.length
        }
    }, [conversations, activeConversation, messages])

    const searchConversations = useCallback((query) => {
        if (!query.trim()) return conversations
        
        const searchTerm = query.toLowerCase()
        return conversations.filter(conv => 
            conv.title?.toLowerCase().includes(searchTerm)
        )
    }, [conversations])

    return {
        // State
        conversations,
        activeConversation,
        messages,
        isLoading,
        realtimeUpdates,
        
        // Actions
        loadConversation,
        sendMessage,
        clearHistory,
        deleteConversation,
        loadConversations,
        
        // Utilities
        getConversationStats,
        searchConversations,
        
        // Real-time
        clearRealtimeUpdates: () => setRealtimeUpdates([])
    }
}
