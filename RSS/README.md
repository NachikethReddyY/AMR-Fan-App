# Aston Martin F1 RSS feed

This folder contains the host-neutral Python standard-library RSS 2.0 generator and a known-good `feed.xml` snapshot for the AMR Fan App handoff. It reads the official Aston Martin Aramco F1 sitemap and official `/en-GB/news/` pages, preserving article URLs as stable GUIDs and publication dates from each article.

## Run from `RSS/`

Python 3.10+ and network access are required; no third-party packages are used:

```text
python generate_feed.py
python generate_feed.py --max-items 20 --output feed.xml
python -m unittest discover -s tests -v
```

`--max-items` is bounded to 1–30 (default 20). Every selected article must be fetched and parsed. A failed run exits nonzero and leaves the existing output untouched; validated XML is staged and atomically replaced only after success. The generator enforces request timeouts, response-size limits, a maximum of three redirects, and strict HTTPS origin/path checks. Sitemap `lastmod` selects candidates only; article publication metadata supplies RSS dates (day-only dates use 00:00 UTC). No fallback dates or fabricated promotions are created.

Valid article `og:image` values on Aston Martin's `assets.astonmartinf1.com/public/cms/` host are included as Media RSS image URLs using a 480-pixel CDN variant. Images are fetched by readers from Aston Martin's CDN and are not copied here; the linked official article remains the source and attribution. Missing or invalid image metadata leaves the item without an image.

## Hosted feed and schedule ownership

The current published snapshot is served at [https://green-sky-08b27ad10.4.azurestaticapps.net/feed.xml](https://green-sky-08b27ad10.4.azurestaticapps.net/feed.xml). The standalone source repository is [ashura-oss/AMR-F1-RSS-Feed](https://github.com/ashura-oss/AMR-F1-RSS-Feed), at commit [6a11e334](https://github.com/ashura-oss/AMR-F1-RSS-Feed/tree/6a11e334bc341c5f31dc01c2100d480b17fe76d1). Its scheduled deployment remains owned by [`refresh-feed.yml`](https://github.com/ashura-oss/AMR-F1-RSS-Feed/blob/6a11e334bc341c5f31dc01c2100d480b17fe76d1/.github/workflows/refresh-feed.yml), which runs at 00:17, 06:17, 12:17 and 18:17 UTC and can be started manually.

Copying this folder into AMR-Fan-App does not move or activate that deployment. No deployment secret is copied. The included `scheduler.example.cron` is an example only and is not installed.
