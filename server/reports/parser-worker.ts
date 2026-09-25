import { getDocument, version } from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  MAX_FILE_BYTES,
  MAX_PAGES,
  MAX_TEXT_CHARACTERS,
  PARSER_VERSION,
} from './contracts.ts';

async function parse() {
  if (version !== '6.3.289') throw new Error('parser-version');
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of process.stdin) {
    bytes += chunk.length;
    if (bytes > MAX_FILE_BYTES) throw new Error('file-limit');
    chunks.push(Buffer.from(chunk));
  }
  const input = Buffer.concat(chunks);
  if (
    !input
      .subarray(0, 8)
      .toString('ascii')
      .match(/^%PDF-1\.[0-7]|^%PDF-2\.0/)
  )
    throw new Error('invalid-pdf');
  const loading = getDocument({
    data: new Uint8Array(input),
    verbosity: 0,
    stopAtErrors: true,
    useWorkerFetch: false,
    useWasm: false,
    useSystemFonts: false,
    disableFontFace: true,
    enableXfa: false,
    isOffscreenCanvasSupported: false,
    isImageDecoderSupported: false,
    disableAutoFetch: true,
    disableStream: true,
  });
  try {
    const doc = await loading.promise;
    if (doc.numPages > MAX_PAGES) throw new Error('page-limit');
    const pages: { page: number; text: string }[] = [];
    let characters = 0;
    for (let page = 1; page <= doc.numPages; page++) {
      const pdfPage = await doc.getPage(page);
      const stream = pdfPage.streamTextContent();
      const reader = stream.getReader();
      let text = '';
      try {
        while (true) {
          const result = await reader.read();
          if (result.done) break;
          for (const item of result.value.items) {
            if (!('str' in item)) continue;
            // A versioned, deterministic serialization; retain line breaks and PDF order.
            const piece = item.str + (item.hasEOL ? '\n' : '');
            characters += piece.length;
            if (characters > MAX_TEXT_CHARACTERS) throw new Error('text-limit');
            text += piece;
          }
        }
      } finally {
        await reader.cancel().catch(() => {});
        pdfPage.cleanup();
      }
      pages.push({ page, text });
    }
    if (!pages.some((page) => page.text.trim()))
      throw new Error('text-unavailable');
    return { pages, parserVersion: PARSER_VERSION };
  } finally {
    await loading.destroy();
  }
}
try {
  process.stdout.write(JSON.stringify(await parse()));
} catch (error) {
  const known = [
    'parser-version',
    'file-limit',
    'invalid-pdf',
    'page-limit',
    'text-limit',
    'text-unavailable',
  ];
  const reason =
    error instanceof Error && known.includes(error.message)
      ? error.message
      : 'invalid-pdf';
  process.stdout.write(JSON.stringify({ error: reason }));
  process.exitCode = 1;
}
