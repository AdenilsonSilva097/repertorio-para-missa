import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, PageSizes } from "pdf-lib";
import { createSupabaseServer } from "@/lib/supabase-server";

// Host permitido para download (Storage público do Supabase). Evita SSRF:
// a rota só baixa PDFs do próprio projeto, nunca de hosts arbitrários.
const SUPABASE_HOST = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).host;
  } catch {
    return "";
  }
})();

export async function POST(request: NextRequest) {
  // 1. Exige sessão autenticada — a rota fica fora do middleware (matcher
  //    exclui `api/`), então a checagem precisa ser feita aqui.
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Não autenticado." },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corpo da requisição inválido." },
      { status: 400 }
    );
  }

  const { urls } = body as { urls?: unknown };

  if (!Array.isArray(urls) || urls.length === 0) {
    return NextResponse.json(
      { error: "Envie um array 'urls' com pelo menos uma URL de PDF." },
      { status: 400 }
    );
  }

  // Limite máximo de PDFs por requisição
  const MAX_PDFS = 50;
  if (urls.length > MAX_PDFS) {
    return NextResponse.json(
      { error: `Máximo de ${MAX_PDFS} PDFs por requisição.` },
      { status: 400 }
    );
  }

  // Valida que todas as entradas são strings HTTPS e que apontam para o
  // Storage do Supabase deste projeto (allowlist anti-SSRF).
  for (const url of urls) {
    if (typeof url !== "string") {
      return NextResponse.json(
        { error: `URL inválida: ${String(url)}` },
        { status: 400 }
      );
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json(
        { error: `URL inválida: ${url}` },
        { status: 400 }
      );
    }

    if (parsed.protocol !== "https:" || parsed.host !== SUPABASE_HOST) {
      return NextResponse.json(
        { error: `URL não permitida: ${url}` },
        { status: 400 }
      );
    }
  }

  const validUrls = urls as string[];
  const erros: string[] = [];
  const mergedPdf = await PDFDocument.create();

  for (const url of validUrls) {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        erros.push(`Falha ao baixar ${url} (HTTP ${response.status})`);
        continue;
      }

      const pdfBytes = await response.arrayBuffer();
      const sourcePdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

      const [A4_WIDTH, A4_HEIGHT] = PageSizes.A4;

      const sourcePages = sourcePdf.getPages();
      const pageIndices = sourcePdf.getPageIndices();

      for (const idx of pageIndices) {
        try {
          const [embeddedPage] = await mergedPdf.embedPages([sourcePages[idx]]);
          const { width: srcW, height: srcH } = embeddedPage.size();

          const newPage = mergedPdf.addPage([A4_WIDTH, A4_HEIGHT]);

          const scale = Math.min(A4_WIDTH / srcW, A4_HEIGHT / srcH);
          const scaledW = srcW * scale;
          const scaledH = srcH * scale;

          const x = (A4_WIDTH - scaledW) / 2;
          const y = (A4_HEIGHT - scaledH) / 2;

          newPage.drawPage(embeddedPage, {
            x,
            y,
            width: scaledW,
            height: scaledH,
          });
        } catch {
          // Fallback: copia a página e força tamanho A4 via scale
          const [copiedPage] = await mergedPdf.copyPages(sourcePdf, [idx]);
          const { width: srcW, height: srcH } = copiedPage.getSize();

          if (Math.abs(srcW - A4_WIDTH) > 1 || Math.abs(srcH - A4_HEIGHT) > 1) {
            const scaleX = A4_WIDTH / srcW;
            const scaleY = A4_HEIGHT / srcH;
            const scale = Math.min(scaleX, scaleY);

            copiedPage.setSize(A4_WIDTH, A4_HEIGHT);
            copiedPage.scaleContent(scale, scale);

            // Centraliza o conteúdo na página
            const offsetX = (A4_WIDTH - srcW * scale) / 2;
            const offsetY = (A4_HEIGHT - srcH * scale) / 2;
            copiedPage.translateContent(offsetX, offsetY);
          }

          mergedPdf.addPage(copiedPage);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      erros.push(`Erro ao processar ${url}: ${message}`);
    }
  }

  if (mergedPdf.getPageCount() === 0) {
    return NextResponse.json(
      {
        error: "Nenhum PDF pôde ser processado.",
        detalhes: erros,
      },
      { status: 422 }
    );
  }

  const mergedBytes = await mergedPdf.save();

  const headers = new Headers({
    "Content-Type": "application/pdf",
    "Content-Disposition": 'attachment; filename="repertorio_unificado.pdf"',
    "Content-Length": String(mergedBytes.byteLength),
  });

  // Se houve erros parciais, adiciona header informativo
  if (erros.length > 0) {
    headers.set("X-Merge-Warnings", JSON.stringify(erros));
  }

  return new NextResponse(Buffer.from(mergedBytes), { status: 200, headers });
}
