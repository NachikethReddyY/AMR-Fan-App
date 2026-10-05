package com.amr.fanapp.ui.screens

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.lifecycle.compose.LocalLifecycleOwner
import java.io.File
import java.util.UUID

@Composable
fun CameraPreview(
    onSelected: (Uri, () -> Unit) -> Unit,
    onBack: () -> Unit,
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    var hasPermission by remember {
        mutableStateOf(ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED)
    }
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { hasPermission = it }
    val galleryLauncher = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        uri?.let { onSelected(it) {} }
    }

    LaunchedEffect(Unit) {
        if (!hasPermission) permissionLauncher.launch(Manifest.permission.CAMERA)
    }

    if (!hasPermission) {
        Box(Modifier.fillMaxSize().background(Color.Black)) {
            BackButton(onBack, Modifier.align(Alignment.TopStart).padding(20.dp))
            Column(
                Modifier.align(Alignment.Center).padding(horizontal = 28.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                Text("Camera access is needed to capture a photo.", color = Color.White)
                GalleryButton(
                    onClick = { galleryLauncher.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
                )
            }
        }
        return
    }

    var previewView by remember { mutableStateOf<PreviewView?>(null) }
    var imageCapture by remember { mutableStateOf<ImageCapture?>(null) }

    DisposableEffect(previewView, lifecycleOwner) {
        var provider: ProcessCameraProvider? = null
        val view = previewView
        if (view != null) {
            val future = ProcessCameraProvider.getInstance(context)
            future.addListener({
                runCatching {
                    provider = future.get()
                    val preview = Preview.Builder().build().also { it.setSurfaceProvider(view.surfaceProvider) }
                    val capture = ImageCapture.Builder().setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY).build()
                    provider?.unbindAll()
                    provider?.bindToLifecycle(lifecycleOwner, CameraSelector.DEFAULT_BACK_CAMERA, preview, capture)
                    imageCapture = capture
                }
            }, ContextCompat.getMainExecutor(context))
        }
        onDispose {
            provider?.unbindAll()
            imageCapture = null
        }
    }

    Box(Modifier.fillMaxSize().background(Color.Black)) {
        AndroidView(
            factory = { PreviewView(context) },
            update = { if (previewView !== it) previewView = it },
            modifier = Modifier.fillMaxSize(),
        )
        BackButton(onBack, Modifier.align(Alignment.TopStart).padding(20.dp))
        GalleryButton(
            onClick = { galleryLauncher.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
            modifier = Modifier.align(Alignment.BottomStart).padding(start = 24.dp, bottom = 28.dp),
        )
        IconButton(
            onClick = {
                imageCapture?.let { capturePhoto(context, it, onSelected) }
            },
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 24.dp)
                .size(76.dp)
                .background(Color.White, CircleShape)
                .border(3.dp, Color.White.copy(alpha = .72f), CircleShape),
        ) {
            Icon(Icons.Filled.CameraAlt, contentDescription = "Take photo", tint = Color.Black, modifier = Modifier.size(34.dp))
        }
    }
}

@Composable
private fun GalleryButton(onClick: () -> Unit, modifier: Modifier = Modifier) {
    IconButton(
        onClick = onClick,
        modifier = modifier
            .size(52.dp)
            .background(Color.Black.copy(alpha = .58f), CircleShape)
            .border(1.dp, Color.White.copy(alpha = .3f), CircleShape),
    ) {
        Icon(Icons.Filled.PhotoLibrary, contentDescription = "Open gallery", tint = Color.White)
    }
}

private fun capturePhoto(context: Context, imageCapture: ImageCapture, onSelected: (Uri, () -> Unit) -> Unit) {
    val file = File(context.cacheDir, "camera-${UUID.randomUUID()}.jpg")
    val options = ImageCapture.OutputFileOptions.Builder(file).build()
    imageCapture.takePicture(
        options,
        ContextCompat.getMainExecutor(context),
        object : ImageCapture.OnImageSavedCallback {
            override fun onImageSaved(output: ImageCapture.OutputFileResults) {
                val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
                onSelected(uri) { file.delete() }
            }

            override fun onError(exception: ImageCaptureException) {
                file.delete()
            }
        },
    )
}
