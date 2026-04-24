package ai.smallest.atomswidget

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ShowChart
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.People
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

class MainActivity : ComponentActivity() {
    // Populate these via local.properties / BuildConfig in a real app. For a
    // cookbook demo we keep them inline so the widget is runnable end-to-end
    // without scheme/env setup gymnastics.
    private val apiKey  = BuildConfig.ATOMS_API_KEY.ifBlank { System.getenv("ATOMS_API_KEY") ?: "" }
    private val agentId = BuildConfig.ATOMS_AGENT_ID.ifBlank { System.getenv("ATOMS_AGENT_ID") ?: "" }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(colorScheme = lightColorScheme(
                primary    = BrandColors.Teal,
                background = BrandColors.Surface,
                surface    = BrandColors.Surface,
                onPrimary  = BrandColors.TextOnDark,
                onSurface  = BrandColors.TextPrimary,
            )) {
                Box(Modifier.fillMaxSize().background(BrandColors.Surface)) {
                    HostDashboard()
                    // Widget sits at the root of the tree; pill is absolutely
                    // positioned so the host app continues to receive gestures.
                    AtomsWidget(apiKey = apiKey, agentId = agentId, label = "Ask AI")
                }
            }
        }
    }
}

@Composable
private fun HostDashboard() {
    val scroll = rememberScrollState()
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scroll)
            .padding(horizontal = 20.dp, vertical = 24.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp),
    ) {
        Header()
        Section("TODAY · 24 APR") {
            Appointment("09:00", "Ada Lovelace", "Annual checkup", "Checked in")
            Appointment("09:30", "Grace Hopper", "Blood work review", "Arrived", highlighted = true)
            Appointment("10:15", "Alan Turing", "Cardiology follow-up", "Pending")
            Appointment("11:00", "Marie Curie", "Lab results", "Pending")
        }
        Section("QUICK LINKS") {
            LinkRow(Icons.Outlined.CalendarMonth, "Full calendar")
            LinkRow(Icons.Outlined.People, "Patient directory")
            LinkRow(Icons.AutoMirrored.Outlined.ShowChart, "Today's metrics")
            LinkRow(Icons.Outlined.Settings, "Settings")
        }
        Spacer(Modifier.height(140.dp))
    }
}

@Composable
private fun Header() {
    Row(
        Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.Top,
    ) {
        Column {
            Text("MYCLINIC · RECEPTION", color = BrandColors.TextMuted, fontSize = 11.sp,
                 fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(4.dp))
            Text("Good morning, Dr. Rao", color = BrandColors.Ink, fontSize = 22.sp,
                 fontWeight = FontWeight.Medium)
        }
        Box(
            Modifier.size(40.dp).clip(CircleShape).background(BrandColors.TealSoft),
            contentAlignment = Alignment.Center,
        ) {
            Text("SR", color = BrandColors.Teal, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun Section(label: String, content: @Composable ColumnScope.() -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(label, color = BrandColors.TextMuted, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
        content()
    }
}

@Composable
private fun Appointment(time: String, name: String, reason: String, status: String, highlighted: Boolean = false) {
    val bg = if (highlighted) BrandColors.TealSoft else BrandColors.SurfaceHighlight
    val border = if (highlighted) BrandColors.Teal else BrandColors.Divider
    val pillBg = if (highlighted) BrandColors.Gold else BrandColors.Surface
    Row(
        Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(bg)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(time, color = BrandColors.Ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold,
             modifier = Modifier.width(54.dp))
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(name, color = BrandColors.Ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
            Text(reason, color = BrandColors.TextMuted, fontSize = 12.sp)
        }
        Box(
            Modifier.clip(RoundedCornerShape(100.dp))
                .background(pillBg)
                .padding(horizontal = 10.dp, vertical = 4.dp),
        ) {
            Text(status, color = BrandColors.TextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Medium)
        }
    }
}

@Composable
private fun LinkRow(icon: ImageVector, label: String) {
    Row(
        Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(BrandColors.SurfaceHighlight)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = null, tint = BrandColors.InkSoft, modifier = Modifier.size(20.dp))
        Spacer(Modifier.width(12.dp))
        Text(label, color = BrandColors.Ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold,
             modifier = Modifier.weight(1f))
        Icon(Icons.Outlined.ChevronRight, contentDescription = null, tint = BrandColors.TextMuted, modifier = Modifier.size(22.dp))
    }
}
