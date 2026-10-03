package com.amr.fanapp.rss

import java.io.InputStream
import org.xmlpull.v1.XmlPullParser
import org.xmlpull.v1.XmlPullParserFactory

data class RssStory(
    val title: String,
    val link: String,
    val published: String?,
    val summary: String = "",
    val imageUrl: String? = null,
)

object RssParser {
    fun parse(input: InputStream): List<RssStory> {
        val parser = XmlPullParserFactory.newInstance().newPullParser().apply {
            setFeature(XmlPullParser.FEATURE_PROCESS_NAMESPACES, false)
            setInput(input, null)
        }
        val stories = mutableListOf<RssStory>()
        var item: MutableStory? = null
        var field: String? = null
        var event = parser.eventType
        while (event != XmlPullParser.END_DOCUMENT) {
            when (event) {
                XmlPullParser.START_TAG -> {
                    if (parser.name == "item") item = MutableStory()
                    else if (item != null) {
                        field = parser.name
                        if (parser.name.substringAfterLast(':') == "content" && parser.getAttributeValue(null, "url") != null) {
                            item.imageUrl = parser.getAttributeValue(null, "url")
                        }
                    }
                }
                XmlPullParser.TEXT, XmlPullParser.CDSECT -> {
                    val current = item
                    when (field) {
                        "title" -> current?.title?.append(parser.text)
                        "link" -> current?.link?.append(parser.text)
                        "description", "summary" -> current?.summary?.append(parser.text)
                        "pubDate", "published" -> current?.published?.append(parser.text)
                    }
                }
                XmlPullParser.END_TAG -> {
                    if (parser.name == "item") {
                        item?.toStory()?.let(stories::add)
                        item = null
                    }
                    if (field == parser.name) field = null
                }
            }
            event = parser.next()
        }
        check(item == null) { "Malformed RSS item" }
        return stories
    }

    private class MutableStory {
        val title = StringBuilder()
        val link = StringBuilder()
        val published = StringBuilder()
        val summary = StringBuilder()
        var imageUrl: String? = null

        fun toStory(): RssStory? {
            val cleanTitle = title.toString().trim()
            val cleanLink = link.toString().trim()
            if (cleanTitle.isBlank() || !cleanLink.startsWith("https://")) return null
            return RssStory(cleanTitle, cleanLink, published.toString().trim().ifBlank { null }, summary.toString().trim(), imageUrl?.takeIf { it.startsWith("https://") })
        }
    }
}
