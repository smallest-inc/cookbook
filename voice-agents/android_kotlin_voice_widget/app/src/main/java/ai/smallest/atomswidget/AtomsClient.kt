package ai.smallest.atomswidget

import android.util.Log
import kotlinx.coroutines.*
import okhttp3.*
import okio.ByteString
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * OkHttp WebSocket wrapper with reconnect-on-transient + auth-close hard-stop.
 * All callbacks fire on OkHttp's internal executor; do not touch UI state
 * from them — the view-model hops to the main thread via viewModelScope.
 */
class AtomsClient(
    private val apiKey: String,
    private val agentId: String,
    private val sampleRate: Int,
    private val onEvent: (ServerEvent) -> Unit,
    private val onFatalError: (String) -> Unit,
) {
    sealed class ServerEvent {
        data class SessionCreated(val sessionId: String, val callId: String) : ServerEvent()
        data class OutputAudioDelta(val base64: String) : ServerEvent()
        data object AgentStartTalking : ServerEvent()
        data object AgentStopTalking : ServerEvent()
        data object Interruption : ServerEvent()
        data class SessionClosed(val reason: String?) : ServerEvent()
        data class Error(val code: String, val message: String) : ServerEvent()
    }

    // Own the scope: the microphone coroutine is launched asynchronously from
    // OkHttp's onOpen callback, so it must outlive any caller stack frame.
    private val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())
    private val client = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .build()
    private var webSocket: WebSocket? = null
    private var micJob: Job? = null
    private var reconnectAttempt = 0
    private val backoffMillis = longArrayOf(500, 1_000, 2_000, 5_000, 15_000)
    private val maxReconnects = 5
    private var explicitlyClosed = false

    private val onOpen = CompletableDeferred<Unit>()

    fun start(startMic: suspend (WebSocket) -> Unit) {
        explicitlyClosed = false
        connect(startMic)
    }

    fun sendMicChunk(base64: String) {
        val ws = webSocket ?: return
        val payload = JSONObject().apply {
            put("type", "input_audio_buffer.append")
            put("audio", base64)
        }
        ws.send(payload.toString())
    }

    fun stop() {
        explicitlyClosed = true
        micJob?.cancel()
        webSocket?.close(1000, "client stop")
        webSocket = null
        scope.cancel()
    }

    private fun connect(startMic: suspend (WebSocket) -> Unit) {
        val url = HttpUrl.Builder()
            .scheme("https")  // OkHttp wraps wss via https
            .host("api.smallest.ai")
            .addPathSegments("atoms/v1/agent/connect")
            .addQueryParameter("token", apiKey)
            .addQueryParameter("agent_id", agentId)
            .addQueryParameter("mode", "webcall")
            .addQueryParameter("sample_rate", sampleRate.toString())
            .build()

        val request = Request.Builder().url(url).build()

        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(ws: WebSocket, response: Response) {
                Log.i("Atoms", "WebSocket open")
                reconnectAttempt = 0
                micJob = scope.launch { startMic(ws) }
            }
            override fun onMessage(ws: WebSocket, text: String) = handleEvent(text)
            override fun onMessage(ws: WebSocket, bytes: ByteString) = handleEvent(bytes.utf8())
            override fun onClosing(ws: WebSocket, code: Int, reason: String) {
                Log.i("Atoms", "WebSocket closing $code $reason")
            }
            override fun onClosed(ws: WebSocket, code: Int, reason: String) {
                Log.i("Atoms", "WebSocket closed $code $reason")
            }
            override fun onFailure(ws: WebSocket, t: Throwable, r: Response?) {
                Log.e("Atoms", "WS failure: ${t.message}")
                if (explicitlyClosed) return
                val authFail = r?.code == 401 || r?.code == 403
                if (authFail || reconnectAttempt >= maxReconnects) {
                    onFatalError(
                        if (authFail) "auth rejected (${r?.code})"
                        else "reconnect gave up after $maxReconnects attempts"
                    )
                    return
                }
                val delay = backoffMillis[minOf(reconnectAttempt, backoffMillis.size - 1)]
                reconnectAttempt += 1
                scope.launch {
                    delay(delay)
                    connect(startMic)
                }
            }
        })
    }

    private fun handleEvent(text: String) {
        val json = try { JSONObject(text) } catch (_: Exception) { return }
        when (json.optString("type")) {
            "session.created" -> onEvent(ServerEvent.SessionCreated(
                json.optString("session_id"), json.optString("call_id")
            ))
            "output_audio.delta" -> onEvent(ServerEvent.OutputAudioDelta(json.optString("audio")))
            "agent_start_talking" -> onEvent(ServerEvent.AgentStartTalking)
            "agent_stop_talking" -> onEvent(ServerEvent.AgentStopTalking)
            "interruption" -> onEvent(ServerEvent.Interruption)
            "session.closed" -> onEvent(ServerEvent.SessionClosed(json.optString("reason").ifEmpty { null }))
            "error" -> onEvent(ServerEvent.Error(json.optString("code"), json.optString("message")))
        }
    }
}
