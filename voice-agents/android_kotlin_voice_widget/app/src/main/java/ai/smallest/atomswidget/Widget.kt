package ai.smallest.atomswidget

import android.Manifest
import android.content.pm.PackageManager
import android.content.Context
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.KeyboardAlt
import androidx.compose.material.icons.outlined.Mic
import androidx.compose.material.icons.outlined.MicOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.coroutines.launch
import kotlin.math.min

/**
 * Drop-in voice-agent widget. Renders a floating pill in the bottom-right
 * corner of the host screen; tap → bottom sheet with live session.
 *
 * Consumer:
 *   AtomsWidget(apiKey = KEY, agentId = ID, label = "Ask AI")
 *
 * Host app keeps rendering underneath the pill and the sheet's backdrop.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AtomsWidget(
    apiKey: String,
    agentId: String,
    label: String = "Ask AI",
    modifier: Modifier = Modifier,
    viewModel: SessionViewModel = androidx.lifecycle.viewmodel.compose.viewModel(),
) {
    val state by viewModel.stateFlow.collectAsStateWithLifecycle()
    var open by remember { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val scope = rememberCoroutineScope()
    val ctx = LocalContext.current

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) viewModel.start(apiKey, agentId) else open = false
    }

    // Sheet visibility drives session lifecycle.
    LaunchedEffect(open) {
        if (open && state.status is SessionStatus.Idle) {
            if (hasMicPermission(ctx)) viewModel.start(apiKey, agentId)
            else permissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
        }
        if (!open && state.status !is SessionStatus.Idle) viewModel.stop()
    }

    Box(modifier.fillMaxSize()) {
        // Pill — sits bottom-right, pointer-events-limited to itself.
        WidgetPill(
            label = label,
            onClick = { open = true },
            modifier = Modifier.align(Alignment.BottomEnd).padding(end = 20.dp, bottom = 28.dp)
        )

        if (open) {
            ModalBottomSheet(
                sheetState = sheetState,
                onDismissRequest = { open = false },
                containerColor = BrandColors.Surface,
                dragHandle = {
                    Box(
                        Modifier.padding(top = 10.dp, bottom = 6.dp)
                            .size(width = 44.dp, height = 5.dp)
                            .clip(RoundedCornerShape(3.dp))
                            .background(BrandColors.Divider)
                    )
                },
            ) {
                Column(
                    Modifier.padding(horizontal = 20.dp).padding(bottom = 18.dp, top = 14.dp),
                    verticalArrangement = Arrangement.spacedBy(18.dp),
                ) {
                    TranscriptPlaceholder()
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(14.dp),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        StatusLine(state.status)
                        Waveform(
                            level = activeLevel(state),
                            active = waveformActive(state),
                        )
                    }
                    ActionRow(
                        muted = state.muted,
                        onMicPress = { viewModel.toggleMute() },
                        onClose = {
                            scope.launch {
                                sheetState.hide()
                                open = false
                            }
                        },
                    )
                    state.error?.let {
                        Text(
                            it,
                            color = BrandColors.Coral,
                            fontSize = 12.sp,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                    Spacer(Modifier.height(2.dp))
                }
            }
        }
    }
}

// ───────────────────────── pieces ─────────────────────────

@Composable
private fun WidgetPill(label: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(100.dp))
            .background(BrandColors.Ink)
            .clickable(onClick = onClick)
            .padding(horizontal = 18.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(9.dp).clip(CircleShape).background(BrandColors.Teal))
        Spacer(Modifier.width(10.dp))
        Text(
            label,
            color = BrandColors.TextOnDark,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

@Composable
private fun TranscriptPlaceholder() {
    Text(
        "Speak after the assistant greets you. Transcript appears here.",
        color = BrandColors.TextMuted,
        fontSize = 12.sp,
        textAlign = TextAlign.Center,
        modifier = Modifier.fillMaxWidth().padding(vertical = 14.dp),
    )
}

@Composable
private fun StatusLine(status: SessionStatus) {
    val (label, dot) = when (status) {
        is SessionStatus.Idle        -> "Tap the mic to start" to BrandColors.Divider
        is SessionStatus.Connecting  -> "Connecting…" to BrandColors.Gold
        is SessionStatus.Joined      -> "Assistant joined" to BrandColors.Teal
        is SessionStatus.Listening   -> "Listening" to BrandColors.Teal
        is SessionStatus.Narrating   -> "Speaking" to BrandColors.Teal
        is SessionStatus.Error       -> "Something went wrong" to BrandColors.Coral
    }
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(8.dp).clip(CircleShape).background(dot))
        Spacer(Modifier.width(8.dp))
        Text(label, color = BrandColors.Teal, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun Waveform(level: Float, active: Boolean) {
    val bars = 9
    val minH = 4f
    val maxH = 26f
    Canvas(modifier = Modifier.size(width = 160.dp, height = 30.dp)) {
        val normalized = (level * 3f).coerceIn(0f, 1f)
        val spacing = 4f
        val barW = 3f
        val totalW = bars * barW + (bars - 1) * spacing
        val startX = (size.width - totalW) / 2
        for (i in 0 until bars) {
            val weight = 1f - kotlin.math.abs(i - (bars - 1) / 2f) / ((bars - 1) / 2f)
            val h = if (active) minH + (minH + weight * (maxH - minH)) * normalized + weight * 3
                    else minH
            val hClamped = min(h, maxH)
            val x = startX + i * (barW + spacing)
            val y = (size.height - hClamped) / 2
            drawLine(
                color = if (active) BrandColors.Teal else BrandColors.Divider,
                start = Offset(x + barW / 2, y),
                end = Offset(x + barW / 2, y + hClamped),
                strokeWidth = barW,
            )
        }
    }
}

@Composable
private fun ActionRow(muted: Boolean, onMicPress: () -> Unit, onClose: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        CircleIconButton(icon = Icons.Outlined.KeyboardAlt, contentDescription = "Keyboard", onClick = {}, enabled = false)
        MicButton(muted = muted, onClick = onMicPress)
        CircleIconButton(icon = Icons.Outlined.Close, contentDescription = "Close", onClick = onClose)
    }
}

@Composable
private fun CircleIconButton(
    icon: ImageVector,
    contentDescription: String,
    onClick: () -> Unit,
    enabled: Boolean = true,
) {
    Box(
        Modifier
            .size(44.dp)
            .clip(CircleShape)
            .background(BrandColors.SurfaceAlt)
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = contentDescription,
            tint = if (enabled) BrandColors.TextSecondary else BrandColors.TextMuted,
            modifier = Modifier.size(18.dp),
        )
    }
}

@Composable
private fun MicButton(muted: Boolean, onClick: () -> Unit) {
    val infinite = rememberInfiniteTransition(label = "halo")
    val haloScale by infinite.animateFloat(
        initialValue = 1f,
        targetValue = 1.35f,
        animationSpec = infiniteRepeatable(tween(900), RepeatMode.Reverse),
        label = "haloScale",
    )
    val haloAlpha by infinite.animateFloat(
        initialValue = 0.4f,
        targetValue = 0f,
        animationSpec = infiniteRepeatable(tween(900), RepeatMode.Reverse),
        label = "haloAlpha",
    )
    val bg = if (muted) BrandColors.Coral else BrandColors.Teal

    Box(contentAlignment = Alignment.Center, modifier = Modifier.size(72.dp)) {
        if (!muted) {
            Box(
                Modifier
                    .size(64.dp)
                    .scale(haloScale)
                    .clip(CircleShape)
                    .background(bg.copy(alpha = haloAlpha))
            )
        }
        Box(
            Modifier
                .size(56.dp)
                .clip(CircleShape)
                .background(bg)
                .clickable(onClick = onClick),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = if (muted) Icons.Outlined.MicOff else Icons.Outlined.Mic,
                contentDescription = if (muted) "Unmute" else "Mute",
                tint = BrandColors.TextOnDark,
                modifier = Modifier.size(24.dp),
            )
        }
    }
}

// ───────────────────────── helpers ─────────────────────────

private fun activeLevel(state: SessionState): Float = when (state.status) {
    is SessionStatus.Narrating -> state.agentLevel
    else -> state.micLevel
}

private fun waveformActive(state: SessionState): Boolean = when (state.status) {
    is SessionStatus.Narrating -> true
    is SessionStatus.Listening, is SessionStatus.Joined -> !state.muted
    else -> false
}

private fun hasMicPermission(ctx: Context): Boolean =
    ContextCompat.checkSelfPermission(ctx, Manifest.permission.RECORD_AUDIO) ==
        PackageManager.PERMISSION_GRANTED
