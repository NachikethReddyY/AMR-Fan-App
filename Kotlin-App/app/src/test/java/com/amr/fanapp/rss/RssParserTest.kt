package com.amr.fanapp.rss

import org.junit.Assert.*
import org.junit.Test

class RssParserTest {
    private fun parse(items: String) = RssParser.parse(("<rss><channel><title>Channel title</title><link>https://example.com</link>" + items + "</channel></rss>").byteInputStream())

    @Test fun skipsItemsWithoutOwnTitleAndRejectsUnsafeLinks() {
        val stories = parse("""
            <item><link>https://example.com/missing-title</link></item>
            <item><title>Unsafe</title><link>javascript:alert(1)</link></item>
            <item><title>Valid &amp; safe</title><link>https://example.com/story</link></item>
        """)
        assertEquals(listOf("Valid & safe"), stories.map { it.title })
    }

    @Test fun combinesTextAndCdataAndDoesNotLeakDatesBetweenItems() {
        val stories = parse("""
            <item><title>Team <![CDATA[& racing]]> news</title><link>https://example.com/one</link><pubDate>Thu, 01 Oct 2026 00:00:00 GMT</pubDate></item>
            <item><title>Two</title><link>https://example.com/two</link></item>
        """)
        assertEquals("Team & racing news", stories[0].title)
        assertNull(stories[1].published)
    }

    @Test fun rejectsMalformedXml() {
        assertThrows(Exception::class.java) { RssParser.parse("<rss><channel><item>".byteInputStream()) }
    }

    @Test fun readsNamespacedImagesAndRejectsUnsafeImageUrls() {
        val xml = """<rss xmlns:media="http://search.yahoo.com/mrss/"><channel>
            <item><title>One</title><link>https://example.com/one</link><media:content url="https://example.com/photo.jpg" medium="image" /></item>
            <item><title>Two</title><link>https://example.com/two</link><media:content url="file:///private/photo.jpg" /></item>
        </channel></rss>"""
        val stories = RssParser.parse(xml.byteInputStream())
        assertEquals("https://example.com/photo.jpg", stories[0].imageUrl)
        assertNull(stories[1].imageUrl)
    }

    @Test fun formatsPublishedDateWithoutTimeOrTimezone() {
        assertEquals("01 Oct 2026", formatRssDate("Thu, 01 Oct 2026 00:00:00 GMT"))
        assertNull(formatRssDate("not a date"))
    }
}
