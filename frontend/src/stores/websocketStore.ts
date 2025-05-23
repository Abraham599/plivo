import { create } from "zustand"

interface WebSocketStore {
  socket: WebSocket | null
  isConnected: boolean
  connect: () => void
  disconnect: () => void
  sendMessage: (message: any) => void
}

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8000"

export const useWebSocketStore = create<WebSocketStore>((set, get) => ({
  socket: null,
  isConnected: false,

  connect: () => {
    const socket = new WebSocket(`${WS_URL}/ws`)

    socket.onopen = () => {
      console.log("WebSocket connected")
      set({ socket, isConnected: true })
    }

    socket.onclose = () => {
      console.log("WebSocket disconnected")
      set({ socket: null, isConnected: false })
    }

    socket.onerror = (error) => {
      console.error("WebSocket error:", error)
    }

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        // Handle incoming messages here
        console.log("WebSocket message:", data)
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error)
      }
    }
  },

  disconnect: () => {
    const { socket } = get()
    if (socket) {
      socket.close()
      set({ socket: null, isConnected: false })
    }
  },

  sendMessage: (message) => {
    const { socket, isConnected } = get()
    if (socket && isConnected) {
      socket.send(JSON.stringify(message))
    }
  },
}))
