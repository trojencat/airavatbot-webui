import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * Enhanced React hook for real-time events via WebSocket.
 * Supports the new comprehensive event system with automatic reconnection.
 * 
 * Usage:
 *   const { connected, subscribe, unsubscribe, getLastEvent } = useEnhancedSocket()
 *   useEffect(() => {
 *     const handler = (data) => console.log(data)
 *     subscribe('process.created', handler)
 *     return () => unsubscribe('process.created', handler)
 *   }, [subscribe, unsubscribe])
 */
export default function useEnhancedSocket() {
    const [connected, setConnected] = useState(false)
    const [lastEvent, setLastEvent] = useState(null)
    const listenersRef = useRef({})    // { eventType: Set<callback> }
    const wsRef = useRef(null)
    const retryRef = useRef(0)
    const timerRef = useRef(null)
    const mountedRef = useRef(true)
    const eventHistoryRef = useRef([]) // Store recent events for debugging

    const connect = useCallback(() => {
        if (!mountedRef.current) return

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const host = window.location.host
        const wsUrl = `${protocol}//${host}/ws/config`
        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
            retryRef.current = 0
            setConnected(true)
            console.log('Enhanced WebSocket connected')
        }

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data)
                const { type, data, timestamp } = message
                
                // Store in history
                eventHistoryRef.current.unshift({
                    type,
                    data,
                    timestamp: timestamp || Date.now(),
                    received: Date.now()
                })
                
                // Keep only last 100 events
                if (eventHistoryRef.current.length > 100) {
                    eventHistoryRef.current = eventHistoryRef.current.slice(0, 100)
                }
                
                // Update last event
                setLastEvent({ type, data, timestamp })
                
                // Notify listeners
                const handlers = listenersRef.current[type]
                if (handlers) {
                    handlers.forEach((fn) => {
                        try {
                            fn(data)
                        } catch (err) {
                            console.error(`Error in event handler for ${type}:`, err)
                        }
                    })
                }
            } catch (err) {
                console.error('Failed to parse WebSocket message:', err, event.data)
            }
        }

        ws.onclose = () => {
            setConnected(false)
            console.log('Enhanced WebSocket disconnected')
            
            if (!mountedRef.current) return
            // Exponential backoff: 500ms, 1s, 2s, 4s, max 10s
            const delay = Math.min(500 * Math.pow(2, retryRef.current), 10000)
            retryRef.current++
            console.log(`Reconnecting in ${delay}ms...`)
            timerRef.current = setTimeout(connect, delay)
        }

        ws.onerror = (error) => {
            console.error('Enhanced WebSocket error:', error)
            ws.close()
        }
    }, [])

    useEffect(() => {
        mountedRef.current = true
        connect()
        return () => {
            mountedRef.current = false
            if (timerRef.current) clearTimeout(timerRef.current)
            if (wsRef.current) wsRef.current.close()
        }
    }, [connect])

    const subscribe = useCallback((eventType, callback) => {
        if (!listenersRef.current[eventType]) {
            listenersRef.current[eventType] = new Set()
        }
        listenersRef.current[eventType].add(callback)
        
        // Return unsubscribe function for convenience
        return () => unsubscribe(eventType, callback)
    }, [])

    const unsubscribe = useCallback((eventType, callback) => {
        listenersRef.current[eventType]?.delete(callback)
    }, [])

    const getLastEvent = useCallback((eventType) => {
        if (eventType) {
            return eventHistoryRef.current.find(event => event.type === eventType)
        }
        return lastEvent
    }, [lastEvent])

    const getEventHistory = useCallback((eventType, limit = 10) => {
        const history = eventType 
            ? eventHistoryRef.current.filter(event => event.type === eventType)
            : eventHistoryRef.current
        return history.slice(0, limit)
    }, [])

    const clearEventHistory = useCallback(() => {
        eventHistoryRef.current = []
    }, [])

    // Debug function to get connection stats
    const getConnectionStats = useCallback(() => {
        return {
            connected,
            retryCount: retryRef.current,
            eventHistorySize: eventHistoryRef.current.length,
            subscribedEvents: Object.keys(listenersRef.current),
            lastEventTimestamp: lastEvent?.timestamp
        }
    }, [connected, lastEvent])

    return { 
        connected, 
        subscribe, 
        unsubscribe, 
        getLastEvent,
        getEventHistory,
        clearEventHistory,
        getConnectionStats,
        eventHistory: eventHistoryRef.current
    }
}
