package com.chat.demo

import org.springframework.web.socket.CloseStatus
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.handler.TextWebSocketHandler

class WebSocketHandler(private val pollingController: ChatPollingController) : TextWebSocketHandler() {

    override fun afterConnectionEstablished(session: WebSocketSession) {
        val username = session.uri?.query?.split("=")?.get(1) as String
        session.attributes["username"] = username
        pollingController.userSessions[username] = session
        pollingController.checkQueuedMessages(username)
        println("WebSocket connection established for user: $username")
    }

    override fun afterConnectionClosed(session: WebSocketSession, status: CloseStatus) {
        val username = session.attributes["username"] as String
        pollingController.userSessions.remove(username)
        println("WebSocket connection closed for user: $username")
    }
}