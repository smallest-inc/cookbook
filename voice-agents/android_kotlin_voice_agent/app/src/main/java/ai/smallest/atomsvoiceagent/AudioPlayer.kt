package ai.smallest.atomsvoiceagent

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit

/**
 * AudioTrack-backed PCM16 playback with a background writer thread.
 *
 * USAGE_MEDIA routes to the loud speaker by default. USAGE_VOICE_COMMUNICATION
 * would map to STREAM_VOICE_CALL which is system-controlled (inaudible on
 * emulators, volume not settable by apps). AEC coupling still works because
 * the recorder uses AudioSource.VOICE_COMMUNICATION and AudioManager mode
 * is set to MODE_IN_COMMUNICATION by the view-model.
 */
class AudioPlayer(private val sampleRate: Int) {
    private val channelConfig = AudioFormat.CHANNEL_OUT_MONO
    private val encoding      = AudioFormat.ENCODING_PCM_16BIT
    private val minBuffer     = AudioTrack.getMinBufferSize(sampleRate, channelConfig, encoding)

    private val queue = LinkedBlockingQueue<ByteArray>()
    @Volatile private var running = false
    private var thread: Thread? = null
    private var track: AudioTrack? = null

    fun start() {
        running = true
        track = AudioTrack.Builder()
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()
            )
            .setAudioFormat(
                AudioFormat.Builder()
                    .setSampleRate(sampleRate)
                    .setChannelMask(channelConfig)
                    .setEncoding(encoding)
                    .build()
            )
            .setBufferSizeInBytes(minBuffer * 4)
            .setTransferMode(AudioTrack.MODE_STREAM)
            .build()
            .also { it.play() }

        thread = Thread {
            while (running) {
                val chunk = try {
                    queue.poll(50, TimeUnit.MILLISECONDS)
                } catch (_: InterruptedException) { null } ?: continue
                track?.write(chunk, 0, chunk.size)
            }
        }.also { it.start() }
    }

    fun enqueue(pcm: ByteArray) { queue.offer(pcm) }

    fun flush() {
        queue.clear()
        track?.flush()
    }

    fun stop() {
        running = false
        thread?.join()
        track?.stop(); track?.release(); track = null
    }
}
