import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * React hook for real-time config change events via WebSocket.
 * Auto-reconnects with exponential backoff.
 *
 * Usage:
 *   const { connected, subscribe, unsubscribe } = useConfigSocket()
 *   useEffect(() => {
 *     const handler = (data) => console.log(data)
 *     subscribe('llm_changed', handler)
 *     return () => unsubscribe('llm_changed', handler)
 *   }, [subscribe, unsubscribe])
 */
export default function useConfigSocket() {
    const [connected, setConnected] = useState(false)
    const listenersRef = useRef({})    // { eventType: Set<callback> }
    const wsRef = useRef(null)
    const retryRef = useRef(0)
    const timerRef = useRef(null)
    const mountedRef = useRef(true)

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
        }

        ws.onmessage = (event) => {
            try {
                const { type, data } = JSON.parse(event.data)
                const handlers = listenersRef.current[type]
                if (handlers) {
                    handlers.forEach((fn) => fn(data))
                }
            } catch { /* ignore malformed messages */ }
        }

        ws.onclose = () => {
            setConnected(false)
            if (!mountedRef.current) return
            // Exponential backoff: 500ms, 1s, 2s, 4s, max 10s
            const delay = Math.min(500 * Math.pow(2, retryRef.current), 10000)
            retryRef.current++
            timerRef.current = setTimeout(connect, delay)
        }

        ws.onerror = () => {
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
    }, [])

    const unsubscribe = useCallback((eventType, callback) => {
        listenersRef.current[eventType]?.delete(callback)
    }, [])

    return { connected, subscribe, unsubscribe }
}
