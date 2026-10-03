package com.amr.fanapp.ui.screens

import android.content.Context
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.result.PickVisualMediaRequest
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.FileProvider
import java.io.File
import java.util.UUID

@Composable
fun CameraPicker(onSelected: (Uri, () -> Unit) -> Unit, onDismiss: () -> Unit) {
    val context = LocalContext.current
    val output = remember { CameraOutput(context) }
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { success ->
        val uri = output.uri
        if (success && uri != null) onSelected(uri, output::delete) else {
            output.delete()
            onDismiss()
        }
    }
    LaunchedEffect(Unit) { launcher.launch(output.createUri()) }
}

@Composable
fun GalleryPicker(onSelected: (Uri) -> Unit) {
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { it?.let(onSelected) }
    OutlinedButton(onClick = { launcher.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }) {
        Icon(Icons.Filled.PhotoLibrary, contentDescription = null)
        Text("Choose from device photos")
    }
}

private class CameraOutput(private val context: Context) {
    private var file: File? = null
    var uri: Uri? = null
        private set

    fun createUri(): Uri {
        file = File(context.cacheDir, "camera-${UUID.randomUUID()}.jpg")
        return FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file!!).also { uri = it }
    }

    fun delete() {
        file?.delete()
        file = null
        uri = null
    }
}
