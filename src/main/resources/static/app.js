let webSocket = null
let pollingInterval = null
let longPollingActive = false
let longPollingRequest = null
const timeout = 10000

function connectToServer() {
    const username = $("#name")
    const usernameValue = username.val().trim()
    if (usernameValue === "") {
        username.css("border", "2px solid #fba4a4")
        return
    } else {
        username.css("border", "")
    }
    const xhr = new XMLHttpRequest()
    xhr.open("POST", `/connect?username=${encodeURIComponent(usernameValue)}`, true)
    xhr.onload = function () {
        if (xhr.status === 200) {
            console.log(xhr.responseText)
            showMessage(xhr.responseText)
            setConnected(true)
            updateConnectionStatus("Connected")
        } else {
            console.error("Failed to connect:", xhr.statusText)
        }
    }
    xhr.onerror = function () {
        console.error("Failed to connect.")
    }
    xhr.send()
}

function setConnected(connected) {
    $("#connect").prop("disabled", connected)
    $("#disconnect").prop("disabled", !connected)
    $("#send").prop("disabled", !connected)
    $("#regularPolling").prop("disabled", !connected)
    $("#longPolling").prop("disabled", !connected)
    $("#webSocket").prop("disabled", !connected)
    $("#conversation").html("")
}

function connectWebSocket() {
    const username = $("#name").val().trim()
    if (!username) {
        alert("Please enter a valid username.")
        return
    }
    clearPrevious()
    if (webSocket) {
        webSocket.close()
        webSocket = null
    }

    webSocket = new WebSocket(`ws://localhost:8080/chat?username=${encodeURIComponent(username)}`)
    webSocket.onopen = () => {
        const startMessage = "Connected to WebSocket."
        console.log(startMessage)
        updateConnectionStatus("WebSocket")
    }

    webSocket.onmessage = (event) => {
        console.log("WebSocket message received:", event.data)
        showMessage(event.data)
        let msg = event.data.split(":")[1].trim()
        console.log(msg)
        console.log(msg.startsWith("#"))
        if (msg.startsWith("#")) {
            console.log("DA")
            sendAutoResponse(event.data)
        }
    }

    webSocket.onclose = () => {
        console.log("WebSocket connection closed.")
    }

    webSocket.onerror = (error) => {
        console.error("WebSocket error:", error)
    }
}

function sendAutoResponse(message) {
    const fromUsername = $("#name").val().trim()
    console.log(message)
    const toUsername = message.split(":")[0]
    const response = "Auto-response: I'm busy."

    const xhr = new XMLHttpRequest()
    xhr.open("POST", `/send-message?fromUsername=${encodeURIComponent(fromUsername)}&toUsername=${encodeURIComponent(toUsername)}&message=${encodeURIComponent(response)}`, true)
    xhr.onload = function () {
        if (xhr.status === 200) {
            showMessage(xhr.responseText, true)
        } else {
            console.error("Send message error:", xhr.statusText)
        }
    }
    xhr.onerror = function () {
        console.error("Send message request failed.")
    }
    xhr.send()
}

function disconnect() {
    const xhr = new XMLHttpRequest()
    xhr.open("POST", "/disconnect", true)
    xhr.onload = function () {
        if (xhr.status === 200) {
            console.log(xhr.responseText)
            showMessage(xhr.responseText)
            setConnected(false)
            clearPrevious()
            updateConnectionStatus("Disconnected")
        } else {
            console.error("Failed to disconnect:", xhr.statusText)
        }
    }
    xhr.onerror = function () {
        console.error("Failed to send disconnect request.")
    }
    xhr.send()
}

function showMessage(message, isSentMessage = false) {
    const messageBox = $("#conversation")
    const timestamp = new Intl.DateTimeFormat('hr-HR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    }).format(new Date())
    const messageClass = isSentMessage ? 'sent-message' : 'received-message'

    const formattedMessage = `<div class='message ${messageClass}'>
        <span class='timestamp'>[${timestamp}]</span> ${message}
    </div>`
    messageBox.append(formattedMessage)
    messageBox.scrollTop(messageBox[0].scrollHeight)
}

function startRegularPolling() {
    console.log(`Polling for messages every ${timeout / 1000} seconds.`)
    updateConnectionStatus("Polling " + timeout / 1000 + "s")
    pollingInterval = setInterval(() => {
        const username = $("#name").val().trim()
        if (username) {
            regularPolling(username)
        }
    }, timeout)
}

function startLongPolling() {
    console.log("Polling for messages with long polling.")
    updateConnectionStatus("Long polling")
    clearInterval(pollingInterval)
    pollingInterval = null
    const username = $("#name").val().trim()
    if (!username) return

    longPollingActive = true
    longPolling(username)
}

function clearPrevious() {
    if (webSocket) {
        webSocket.onmessage = null
        webSocket.close()
        webSocket = null
    }
    clearInterval(pollingInterval)
    pollingInterval = null
    stopLongPolling()
    $("#regularPolling").prop("disabled", false)
    $("#longPolling").prop("disabled", false)
    $("#webSocket").prop("disabled", false)
}

function regularPolling(username) {
    const xhr = new XMLHttpRequest()
    xhr.open("GET", `/poll?username=${encodeURIComponent(username)}`, true)
    xhr.onload = function () {
        if (xhr.status === 200) {
            showMessage(xhr.responseText)
        } else {
            console.error("Polling error:", xhr.statusText)
        }
    }
    xhr.onerror = function () {
        console.error("Polling request failed.")
    }
    xhr.send()
}

function longPolling(username) {
    if (!longPollingActive) return

    longPollingRequest = new XMLHttpRequest()
    longPollingRequest.open("GET", `/long-poll?username=${encodeURIComponent(username)}`, true)
    longPollingRequest.onload = function () {
        if (!longPollingActive) return

        if (longPollingRequest.status === 200) {
            showMessage(longPollingRequest.responseText)
            longPolling(username)
        } else {
            console.error("Long polling error:", longPollingRequest.statusText)
        }
    }
    longPollingRequest.onerror = function () {
        console.error("Long polling request failed.")
        stopLongPolling()
    }
    longPollingRequest.send()
}

function stopLongPolling() {
    longPollingActive = false
    if (longPollingRequest != null) {
        longPollingRequest.abort()
        console.log("Long polling stopped.")
    }
}

function sendMessage() {
    const fromUsername = $("#name").val().trim()
    const toUsername = $("#toUsername").val().trim()
    const message = $("#message").val().trim()

    if (!fromUsername || !toUsername || !message) {
        alert("Please fill in all fields.")
        return
    }

    const xhr = new XMLHttpRequest()
    xhr.open("POST", `/send-message?fromUsername=${encodeURIComponent(fromUsername)}&toUsername=${encodeURIComponent(toUsername)}&message=${encodeURIComponent(message)}`, true)
    xhr.onload = function () {
        if (xhr.status === 200) {
            showMessage(xhr.responseText, true)
        } else {
            console.error("Send message error:", xhr.statusText)
        }
    }
    xhr.onerror = function () {
        console.error("Send message request failed.")
    }
    xhr.send()
}

$(function () {
    $("form").on("submit", (e) => e.preventDefault())

    $("#connect").click(() => connectToServer())
    $("#disconnect").click(() => disconnect())
    $("#send").click(() => sendMessage())

    $("#regularPolling").click(() => {
        if (pollingInterval) {
            console.log("Regular polling already active.")
        } else {
            clearPrevious()
            startRegularPolling()
        }
    })

    $("#longPolling").click(() => {
        if (longPollingActive) {
            console.log("Long polling already active.")
        } else {
            clearPrevious()
            startLongPolling()
        }
    })

    $("#webSocket").click(() => {
        if (webSocket) {
            console.log("WebSocket is already connected.")
        } else {
            clearPrevious()
            connectWebSocket()
        }
    })
})

function updateConnectionStatus(connectionType) {
    const connectionElement = $("#connection-status")
    connectionElement.removeClass("active inactive")
    if (connectionType === "Disconnected") {
        $("#connection-type").text("Disconnected")
        connectionElement.addClass("inactive")
        $("#regularPolling").prop("disabled", true)
        $("#longPolling").prop("disabled", true)
        $("#webSocket").prop("disabled", true)
    } else {
        $("#connection-type").text(connectionType)
        connectionElement.addClass("active")
    }
    const buttonsToDisable = {
        "Polling 10s": "#regularPolling",
        "Long polling": "#longPolling",
        "WebSocket": "#webSocket",
    }
    const buttonSelector = buttonsToDisable[connectionType]
    if (buttonSelector) {
        $(buttonSelector).prop("disabled", true)
    }
}

