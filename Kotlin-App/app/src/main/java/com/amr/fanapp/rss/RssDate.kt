package com.amr.fanapp.rss

import java.time.Instant
import java.time.ZoneOffset
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

private val rssOutputDate = DateTimeFormatter.ofPattern("dd MMM yyyy", Locale.ENGLISH)

fun formatRssDate(value: String?): String? {
    val raw = value?.trim()?.takeIf { it.isNotEmpty() } ?: return null
    return runCatching {
        ZonedDateTime.parse(raw, DateTimeFormatter.RFC_1123_DATE_TIME).format(rssOutputDate)
    }.getOrElse {
        runCatching { Instant.parse(raw).atZone(ZoneOffset.UTC).format(rssOutputDate) }.getOrNull()
    }
}
