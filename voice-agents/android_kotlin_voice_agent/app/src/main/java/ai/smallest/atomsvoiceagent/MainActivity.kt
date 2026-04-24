package ai.smallest.atomsvoiceagent

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle

class MainActivity : ComponentActivity() {
    private val viewModel: SessionViewModel by viewModels()

    // Credentials from BuildConfig (populated via local.properties at build time)
    // Fallback to an env lookup at runtime for CI / headless scenarios.
    private val apiKey: String by lazy {
        BuildConfig.ATOMS_API_KEY.ifBlank { System.getenv("ATOMS_API_KEY").orEmpty() }
    }
    private val agentId: String by lazy {
        BuildConfig.ATOMS_AGENT_ID.ifBlank { System.getenv("ATOMS_AGENT_ID").orEmpty() }
    }

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) viewModel.start(apiKey, agentId)
        else viewModel.stop()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { AppScreen(viewModel, onBeginPressed = ::beginSession) }
    }

    private fun beginSession() {
        val granted = ContextCompat.checkSelfPermission(
            this, Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED
        if (granted) viewModel.start(apiKey, agentId)
        else permissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
    }
}

@Composable
fun AppScreen(vm: SessionViewModel, onBeginPressed: () -> Unit) {
    val state by vm.stateFlow.collectAsStateWithLifecycle()

    MaterialTheme(colorScheme = darkColorScheme()) {
        Box(
            modifier = Modifier.fillMaxSize().background(Color(0xFF0E0B08)),
            contentAlignment = Alignment.Center,
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
                modifier = Modifier.fillMaxSize().padding(24.dp),
            ) {
                Box(Modifier.height(44.dp), contentAlignment = Alignment.Center) {
                    if (state.status.inSession) StatusChip(state.status.label)
                }

                Spacer(Modifier.weight(1f))

                if (state.status.inSession) {
                    LaneBlock(
                        title = "narrator",
                        level = state.agentLevel,
                        color = Color(0xFFDB984A),
                        active = state.status == SessionStatus.Narrating,
                    )
                    Spacer(Modifier.height(32.dp))
                    LaneBlock(
                        title = if (state.muted) "you — muted" else "you",
                        level = if (state.muted) 0f else state.micLevel,
                        color = Color(0xFF7CB8B5),
                        active = !state.muted,
                        footer = {
                            if (state.micChunksSent > 0) {
                                SendingPill(state.muted, state.micChunksSent)
                            }
                            Spacer(Modifier.width(8.dp))
                            MuteButton(state.muted, onClick = vm::toggleMute)
                        },
                    )
                } else {
                    when (val s = state.status) {
                        is SessionStatus.Error -> ErrorBanner(
                            message = s.message,
                            onDismiss = vm::stop,
                        )
                        else -> Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("AtomsVoiceAgent",
                                color = Color(0xFFF0E8DA), fontSize = 36.sp, fontWeight = FontWeight.Normal)
                            Text("a voice session",
                                color = Color(0xFF8B8278), fontSize = 16.sp)
                        }
                    }
                }

                Spacer(Modifier.weight(1f))

                CallButton(
                    label = if (state.status.inSession) "End session"
                            else if (state.error != null) "Try again"
                            else "Begin session",
                    danger = state.status.inSession,
                    onClick = {
                        if (state.status.inSession) vm.stop() else onBeginPressed()
                    },
                )
            }
        }
    }
}

@Composable
private fun StatusChip(label: String) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .clip(RoundedCornerShape(100.dp))
            .background(Color(0x1AFFFFFF))
            .padding(horizontal = 14.dp, vertical = 8.dp),
    ) {
        Box(Modifier.size(8.dp).clip(CircleShape).background(Color(0xFFDB984A)))
        Spacer(Modifier.width(8.dp))
        Text(label, color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun LaneBlock(
    title: String,
    level: Float,
    color: Color,
    active: Boolean,
    footer: @Composable () -> Unit = {},
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Waveform(level = level, color = color, active = active)
        Spacer(Modifier.height(8.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(title, color = Color(0x80FFFFFF), fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.width(10.dp))
            footer()
        }
    }
}

@Composable
private fun Waveform(level: Float, color: Color, active: Boolean) {
    // Simple meter: a single animated bar reflecting current RMS.
    // Keeps the UI deterministic; consumers can swap in a rolling FFT view.
    val width = 220.dp
    val height = 48.dp
    val normalized = (level * 3.2f).coerceIn(0f, 1f)
    Box(
        Modifier.size(width = width, height = height),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            Modifier
                .fillMaxHeight(if (active) normalized.coerceAtLeast(0.06f) else 0.06f)
                .fillMaxWidth()
                .clip(RoundedCornerShape(6.dp))
                .background(if (active) color.copy(alpha = 0.9f) else Color(0x26FFFFFF))
        )
    }
}

@Composable
private fun SendingPill(muted: Boolean, count: Int) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .clip(RoundedCornerShape(100.dp))
            .background(Color(0x14FFFFFF))
            .padding(horizontal = 8.dp, vertical = 3.dp),
    ) {
        val dot = if (muted) Color(0xFFFF5F52)
                  else if (count % 2 == 0) Color(0xFF7CB8B5) else Color(0x33FFFFFF)
        Box(Modifier.size(6.dp).clip(CircleShape).background(dot))
        Spacer(Modifier.width(6.dp))
        Text(
            if (muted) "muted" else "sending · $count",
            color = Color(0x80FFFFFF),
            fontSize = 10.sp,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

@Composable
private fun MuteButton(muted: Boolean, onClick: () -> Unit) {
    val bg by animateColorAsState(
        targetValue = if (muted) Color(0xFFFF5F52) else Color.Transparent,
        animationSpec = tween(180), label = "muteBg",
    )
    val fg = if (muted) Color.Black else Color.White
    Box(
        Modifier
            .clip(RoundedCornerShape(100.dp))
            .background(bg)
            .padding(horizontal = 10.dp, vertical = 4.dp),
    ) {
        Text(
            if (muted) "unmute" else "mute",
            color = fg, fontSize = 10.sp, fontWeight = FontWeight.SemiBold,
            textAlign = TextAlign.Center,
            modifier = Modifier.clickable(onClick = onClick),
        )
    }
}

@Composable
private fun CallButton(label: String, danger: Boolean, onClick: () -> Unit) {
    val color = if (danger) Color(0xFFFF5F52) else Color(0xFFDB984A)
    Box(
        Modifier
            .clip(RoundedCornerShape(100.dp))
            .background(color)
            .clickable(onClick = onClick)
            .padding(horizontal = 40.dp, vertical = 14.dp),
    ) {
        Text(label, color = Color.Black, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun ErrorBanner(message: String, onDismiss: () -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color(0x22FF5F52))
            .padding(16.dp),
    ) {
        Text("AGENT REPORTED AN ERROR",
            color = Color(0xFFFF5F52), fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(8.dp))
        Text(message, color = Color.White.copy(alpha = 0.85f))
        Spacer(Modifier.height(8.dp))
        TextButton(onClick = onDismiss) { Text("Dismiss") }
    }
}

