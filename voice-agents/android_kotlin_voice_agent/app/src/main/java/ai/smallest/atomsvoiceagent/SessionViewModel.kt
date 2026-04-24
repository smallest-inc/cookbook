package ai.smallest.atomsvoiceagent

import android.app.Application
import android.content.Context
import android.media.AudioManager
import android.util.Base64
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlin.math.sqrt

sealed class SessionStatus(val label: String) {
    data object Idle         : SessionStatus("ready")
    data object Connecting   : SessionStatus("connecting")
    data object Joined       : SessionStatus("narrator joined")
    data object Listening    : SessionStatus("listening")
    data object Narrating    : SessionStatus("narrator speaking")
    data class  Error(val message: String) : SessionStatus("error")

    val inSession: Boolean get() = this is Connecting || this is Joined || this is Listening || this is Narrating
}

data class SessionState(
    val status: SessionStatus = SessionStatus.Idle,
    val micLevel: Float = 0f,
    val agentLevel: Float = 0f,
    val micChunksSent: Int = 0,
    val muted: Boolean = false,
    val error: String? = null,
)

/**
 * Owns the AtomsClient + AudioPlayer lifecycle and exposes an observable
 * SessionState for the Compose UI.
 *
 * Sets AudioManager.MODE_IN_COMMUNICATION for the duration of the session
 * so the Android audio HAL engages AEC on top of VOICE_COMMUNICATION capture.
 */
class SessionViewModel(app: Application) : AndroidViewModel(app) {
    private val sampleRate = 24_000
    private val state = MutableStateFlow(SessionState())
    val stateFlow: StateFlow<SessionState> = state.asStateFlow()

    private var client: AtomsClient? = null
    private var player: AudioPlayer? = null
    private var previousAudioMode: Int = AudioManager.MODE_NORMAL

    fun start(apiKey: String, agentId: String) {
        if (apiKey.isBlank() || agentId.isBlank()) {
            state.update { it.copy(status = SessionStatus.Error("Set ATOMS_API_KEY + ATOMS_AGENT_ID in local.properties or env"),
                                   error = "Missing credentials") }
            return
        }
        state.update { SessionState(status = SessionStatus.Connecting) }

        val ctx = getApplication<Application>()
        val am = ctx.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        previousAudioMode = am.mode
        am.mode = AudioManager.MODE_IN_COMMUNICATION

        val pl = AudioPlayer(sampleRate).also { it.start() }
        player = pl

        val cl = AtomsClient(
            apiKey = apiKey, agentId = agentId, sampleRate = sampleRate,
            onEvent = { event -> handleEvent(event) },
            onFatalError = { msg -> fail(msg) },
        )
        client = cl
        cl.start { ws ->
            streamMicrophone(
                sampleRate = sampleRate,
                ws = ws,
                client = cl,
                mutedProvider = { state.value.muted },
                onChunk = { level ->
                    viewModelScope.launch {
                        state.update { s ->
                            val next = if (s.muted) s else s.copy(micChunksSent = s.micChunksSent + 1)
                            next.copy(micLevel = level)
                        }
                    }
                },
                onError = { msg -> viewModelScope.launch { fail(msg) } },
            )
        }
    }

    fun stop() {
        client?.stop()
        client = null
        player?.stop()
        player = null
        val ctx = getApplication<Application>()
        val am = ctx.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        am.mode = previousAudioMode
        state.value = SessionState()
    }

    fun toggleMute() {
        state.update { it.copy(muted = !it.muted, micLevel = if (!it.muted) 0f else it.micLevel) }
    }

    private fun handleEvent(event: AtomsClient.ServerEvent) {
        viewModelScope.launch {
            when (event) {
                is AtomsClient.ServerEvent.SessionCreated -> state.update { it.copy(status = SessionStatus.Joined) }
                is AtomsClient.ServerEvent.OutputAudioDelta -> {
                    val pcm = try { Base64.decode(event.base64, Base64.NO_WRAP) } catch (_: Exception) { null }
                    pcm?.let { player?.enqueue(it) }
                    state.update { it.copy(agentLevel = pcm?.let { rmsPcm16(it) } ?: 0f) }
                }
                AtomsClient.ServerEvent.AgentStartTalking -> state.update { it.copy(status = SessionStatus.Narrating) }
                AtomsClient.ServerEvent.AgentStopTalking  -> state.update { it.copy(status = SessionStatus.Listening, agentLevel = 0f) }
                AtomsClient.ServerEvent.Interruption       -> { player?.flush(); state.update { it.copy(agentLevel = 0f) } }
                is AtomsClient.ServerEvent.SessionClosed -> stop()
                is AtomsClient.ServerEvent.Error -> fail("${event.code}: ${event.message}")
            }
        }
    }

    private fun fail(message: String) {
        val ctx = getApplication<Application>()
        client?.stop()
        client = null
        player?.stop()
        player = null
        val am = ctx.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        am.mode = previousAudioMode
        state.value = SessionState(status = SessionStatus.Error(message), error = message)
    }

    private fun rmsPcm16(pcm: ByteArray): Float {
        if (pcm.size < 2) return 0f
        val frames = pcm.size / 2
        var sum = 0.0
        var i = 0
        while (i < pcm.size - 1) {
            val raw = (pcm[i].toInt() and 0xFF) or (pcm[i + 1].toInt() shl 8)
            val s = raw.toShort().toInt() / 32768.0
            sum += s * s
            i += 2
        }
        return sqrt(sum / frames).toFloat()
    }
}
