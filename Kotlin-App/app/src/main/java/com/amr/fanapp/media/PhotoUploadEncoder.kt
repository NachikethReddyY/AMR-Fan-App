package com.amr.fanapp.media

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import java.io.ByteArrayOutputStream

object PhotoUploadEncoder {
    const val maxUploadBytes = 1_800_000
    const val maxPixelDimension = 1600
    private val dimensions = intArrayOf(1600, 1280, 1024, 768, 640)
    private val qualities = intArrayOf(82, 68, 54, 40, 28)
    fun downsampledImage(data: ByteArray, maxPixelDimension: Int = this.maxPixelDimension): Bitmap? { val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }; BitmapFactory.decodeByteArray(data, 0, data.size, bounds); if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null; val sample = generateSequence(1) { it * 2 }.takeWhile { maxOf(bounds.outWidth, bounds.outHeight) / it > maxPixelDimension }.lastOrNull() ?: 1; return BitmapFactory.decodeByteArray(data, 0, data.size, BitmapFactory.Options().apply { inSampleSize = sample }) }
    fun jpegData(bitmap: Bitmap): ByteArray? { for (dimension in dimensions) { val scaled = resized(bitmap, dimension); for (quality in qualities) { val output = ByteArrayOutputStream(); scaled.compress(Bitmap.CompressFormat.JPEG, quality, output); if (output.size() <= maxUploadBytes) return output.toByteArray() } } ; return null }
    fun resized(bitmap: Bitmap, maxDimension: Int): Bitmap { val largest = maxOf(bitmap.width, bitmap.height); if (largest <= maxDimension) return bitmap; val scale = maxDimension.toFloat() / largest; return Bitmap.createScaledBitmap(bitmap, (bitmap.width * scale).toInt().coerceAtLeast(1), (bitmap.height * scale).toInt().coerceAtLeast(1), true) }
}
