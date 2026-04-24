import AVFoundation
import Foundation

/// Thin AVAudioEngine wrapper: configures `.playAndRecord` + `.voiceChat`,
/// installs a mic tap that delivers base64 Int16 LE PCM chunks, and exposes
/// a gapless scheduled playback path for agent audio.
///
/// iOS audio session choice for a voice agent:
/// - `.voiceChat` mode enables the hardware AEC + noise-suppression pipeline.
/// - `.defaultToSpeaker` + `.allowBluetooth` routes to the loud speaker and
///   honors Bluetooth headsets.
/// On simulator, audio goes through macOS CoreAudio's resampler, which can
/// sound buzzy; validate audio quality on a physical device.
final class AudioEngine: NSObject {
    struct Options {
        let sampleRate: Double
        let onChunk: (String, Float) -> Void     // base64, RMS level
        let onError: (String) -> Void
    }

    private let options: Options
    private let engine = AVAudioEngine()
    private var playerNode: AVAudioPlayerNode?
    private var playerFormat: AVAudioFormat?
    private var muted = false

    init(options: Options) { self.options = options }

    func configureSession() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(
            .playAndRecord,
            mode: .voiceChat,
            options: [.allowBluetoothHFP, .defaultToSpeaker]
        )
        try session.setPreferredSampleRate(options.sampleRate)
        try session.setPreferredIOBufferDuration(0.02)
        try session.setActive(true)
    }

    func start() throws {
        try setupPlayback()
        try startMicrophoneTap()
        engine.prepare()
        try engine.start()
    }

    func stop() {
        engine.stop()
        engine.inputNode.removeTap(onBus: 0)
        playerNode?.stop()
        playerNode = nil
        playerFormat = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    func setMuted(_ value: Bool) { muted = value }

    // MARK: - Playback

    func enqueueBase64(_ b64: String) {
        guard let data = Data(base64Encoded: b64) else { return }
        playPCM16(data)
    }

    func flushPlayback() {
        playerNode?.stop()
        playerNode?.play()
    }

    private func setupPlayback() throws {
        let player = AVAudioPlayerNode()
        playerNode = player

        guard let format = AVAudioFormat(
            commonFormat: .pcmFormatInt16,
            sampleRate:   options.sampleRate,
            channels:     1,
            interleaved:  true
        ) else { throw NSError(domain: "AudioEngine", code: -1) }
        playerFormat = format

        engine.attach(player)
        engine.connect(player, to: engine.mainMixerNode, format: format)
        player.play()
    }

    private func playPCM16(_ data: Data) {
        guard let player = playerNode, let format = playerFormat else { return }
        let frames = AVAudioFrameCount(data.count / MemoryLayout<Int16>.size)
        guard frames > 0,
              let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frames) else { return }
        buffer.frameLength = frames
        data.withUnsafeBytes { raw in
            guard let src = raw.bindMemory(to: Int16.self).baseAddress else { return }
            buffer.int16ChannelData?[0].update(from: src, count: Int(frames))
        }
        player.scheduleBuffer(buffer, completionHandler: nil)
    }

    // MARK: - Mic capture

    private func startMicrophoneTap() throws {
        let input = engine.inputNode
        let hwFormat = input.inputFormat(forBus: 0)

        guard let targetFormat = AVAudioFormat(
            commonFormat: .pcmFormatInt16,
            sampleRate:   options.sampleRate,
            channels:     1,
            interleaved:  true
        ) else { throw NSError(domain: "AudioEngine", code: -2) }

        guard let converter = AVAudioConverter(from: hwFormat, to: targetFormat) else {
            throw NSError(domain: "AudioEngine", code: -3)
        }

        // 100 ms frames at the target rate (2400 @ 24 kHz)
        let frameCapacity = AVAudioFrameCount(targetFormat.sampleRate / 10)

        input.installTap(onBus: 0, bufferSize: 1024, format: hwFormat) { [weak self] buffer, _ in
            guard let self else { return }
            if self.muted { return }
            guard let converted = AVAudioPCMBuffer(pcmFormat: targetFormat,
                                                   frameCapacity: frameCapacity) else { return }
            var error: NSError?
            converter.convert(to: converted, error: &error) { _, outStatus in
                outStatus.pointee = .haveData
                return buffer
            }
            if let error {
                self.options.onError(error.localizedDescription)
                return
            }
            guard let channelData = converted.int16ChannelData?[0] else { return }
            let frames = Int(converted.frameLength)
            if frames == 0 { return }

            var sumSquares: Float = 0
            for i in 0..<frames {
                let sample = Float(channelData[i]) / 32768.0
                sumSquares += sample * sample
            }
            let rms = sqrtf(sumSquares / Float(frames))

            let byteCount = frames * MemoryLayout<Int16>.size
            let data = Data(bytes: channelData, count: byteCount)
            self.options.onChunk(data.base64EncodedString(), rms)
        }
    }
}
