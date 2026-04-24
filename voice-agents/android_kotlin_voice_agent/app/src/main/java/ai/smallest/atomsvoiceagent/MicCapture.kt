package ai.smallest.atomsvoiceagent

import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.util.Base64
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.isActive
import okhttp3.WebSocket

/**
 * Mic capture loop. Runs in a coroutine on Dispatchers.Default.
 * Emits 20 ms PCM16 mono chunks at `sampleRate`, already base64-encoded.
 *
 * Gate via [mutedProvider] — when muted, the chunk is dropped client-side
 * so it never reaches the server's VAD. onChunk still fires with rms=0 so
 * the UI can reflect the muted waveform.
 */
suspend fun streamMicrophone(
    sampleRate: Int,
    ws: WebSocket,
    client: AtomsClient,
    mutedProvider: () -> Boolean,
    onChunk: (rms: Float) -> Unit,
    onError: (String) -> Unit,
) {
    val channelConfig = AudioFormat.CHANNEL_IN_MONO
    val encoding      = AudioFormat.ENCODING_PCM_16BIT
    val minBuffer     = AudioRecord.getMinBufferSize(sampleRate, channelConfig, encoding)
    val bufferSize    = (minBuffer * 2).coerceAtLeast(4096)

    val record = try {
        AudioRecord(
            MediaRecorder.AudioSource.VOICE_COMMUNICATION,
            sampleRate, channelConfig, encoding, bufferSize,
        )
    } catch (e: Throwable) {
        onError("AudioRecord init failed: ${e.message}")
        return
    }

    val chunk = ByteArray(bufferSize)
    try {
        record.startRecording()
        while (currentCoroutineContext().isActive) {
            val n = record.read(chunk, 0, chunk.size)
            if (n <= 0) continue
            if (mutedProvider()) {
                onChunk(0f)
                continue
            }
            val audio = Base64.encodeToString(chunk, 0, n, Base64.NO_WRAP)
            client.sendMicChunk(audio)
            onChunk(rmsPcm16(chunk, n))
        }
    } finally {
        record.stop()
        record.release()
    }
}

private fun rmsPcm16(bytes: ByteArray, len: Int): Float {
    if (len < 2) return 0f
    val frames = len / 2
    var sum = 0.0
    var i = 0
    while (i < len - 1) {
        val sample = (bytes[i].toInt() and 0xFF) or (bytes[i + 1].toInt() shl 8)
        val s16 = sample.toShort().toInt()  // sign-extend from Int16
        val norm = s16 / 32768.0
        sum += norm * norm
        i += 2
    }
    return kotlin.math.sqrt(sum / frames).toFloat()
}
