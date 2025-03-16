package com.chat.demo

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication
class MessagingWebsocketApplication

fun main(args: Array<String>) {
	runApplication<MessagingWebsocketApplication>(*args)
}
