package com.amr.fanapp.domain

import android.content.Context
import kotlinx.serialization.json.Json

class MerchCatalogRepository(private val context: Context, private val json: Json = Json { ignoreUnknownKeys = true }) {
    fun load(): List<MerchPreview> = context.assets.open("MerchStoreCatalog.json").use { stream -> json.decodeFromString<MerchCatalogDocument>(stream.bufferedReader().readText()).products.map(::MerchPreview) }
}
