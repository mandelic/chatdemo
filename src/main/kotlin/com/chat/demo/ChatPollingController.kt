package com.chat.demo

import jakarta.servlet.http.HttpSession
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.context.request.async.DeferredResult
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import java.util.concurrent.ConcurrentHashMap

@RestController
class ChatPollingController {

    private val userMessages = ConcurrentHashMap<String, String>()
    private val clientSessions = ConcurrentHashMap<String, HttpSession>()
    private val longPollers = ConcurrentHashMap<String, DeferredResult<String>>()
    val userSessions = ConcurrentHashMap<String, WebSocketSession>()

    @PostMapping("/connect")
    fun connect(@RequestParam username: String, session: HttpSession): String {
        session.setAttribute("username", username)
        session.setAttribute("connect", true)
        clientSessions[session.id] = session
        return "Welcome, $username! You are now connected."
    }

    @GetMapping("/poll")
    fun poll(session: HttpSession): String {
        val username = session.getAttribute("username") as String? ?: return "You are not connected. Please connect first."
        val message = userMessages[username] ?: "No new messages."
        userMessages.remove(username)
        return message
    }

    @GetMapping("/long-poll")
    fun longPoll(session: HttpSession): DeferredResult<String> {
        val username = session.getAttribute("username") as String?
        if (username == null) {
            val deferredResult = DeferredResult<String>()
            deferredResult.setResult("You are not connected. Please connect first.")
            return deferredResult
        }
        val deferredResult = DeferredResult<String>(60000L)
        deferredResult.onTimeout {
            println("Long-polling request for $username timed out.")
            deferredResult.setResult("No new messages. Timeout reached.")
        }
        val message = userMessages[username]
        if (message != null) {
            userMessages.remove(username)
            deferredResult.setResult(message)
        } else {
            longPollers[username] = deferredResult
        }
        return deferredResult
    }

    @PostMapping("/send-message")
    fun sendMessage(@RequestParam fromUsername: String, @RequestParam toUsername: String, @RequestParam message: String): String {
        val isUserConnected = clientSessions.values
            .filter { it.getAttribute("username") == toUsername }
            .any { it.getAttribute("connect") == true }
        val messageToSend = "$fromUsername: $message"
        if (!isUserConnected) {
            userMessages[toUsername] = messageToSend
            return "$messageToSend\nUser $toUsername is not connected."
        }
        println("Sending message from $fromUsername to $toUsername: $message")
        userMessages[toUsername] = messageToSend
        notifyLongPollers(toUsername, messageToSend)
        return messageToSend
    }

    fun notifyLongPollers(toUsername: String, message: String) {
        if (userSessions.containsKey(toUsername)) {
            userSessions[toUsername]!!.sendMessage(TextMessage(message))
            userMessages.remove(toUsername)
        } else {
            val deferredResult = longPollers[toUsername]
            if (deferredResult != null) {
                deferredResult.setResult(message)
                longPollers.remove(toUsername)
                userMessages.remove(toUsername)
            }
        }
    }

    fun checkQueuedMessages(username: String) {
        val message = userMessages[username]
        if (message != null) {
            notifyLongPollers(username, message)
            userMessages.remove(username)
        }

    }

    @PostMapping("/disconnect")
    fun disconnect(session: HttpSession): String {
        clientSessions[session.id]?.setAttribute("connect", false)
        return "Disconnected."
    }

}
