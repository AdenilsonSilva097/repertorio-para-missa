import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, PageSizes, PDFEmbeddedPage } from "pdf-lib";
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

// Quantos PDFs baixar simultaneamente. Mantém o paralelismo (rápido) sem
// segurar todos os arquivos na memória ao mesmo tempo — importante com o
// limite de 50 PDFs e/ou arquivos grandes (escaneados).
const DOWNLOAD_CONCURRENCY = 6;

const [A4_WIDTH, A4_HEIGHT] = PageSizes.A4;

// Desenha uma página já embutida, escalada e centralizada para caber em A4.
function desenharA4(mergedPdf: PDFDocument, embeddedPage: PDFEmbeddedPage) {
  const { width: srcW, height: srcH } = embeddedPage.size();
  const newPage = mergedPdf.addPage([A4_WIDTH, A4_HEIGHT]);

  const scale = Math.min(A4_WIDTH / srcW, A4_HEIGHT / srcH);
  const scaledW = srcW * scale;
  const scaledH = srcH * scale;

  newPage.drawPage(embeddedPage, {
    x: (A4_WIDTH - scaledW) / 2,
    y: (A4_HEIGHT - scaledH) / 2,
    width: scaledW,
    height: scaledH,
  });
}

// Acrescenta todas as páginas de um PDF de origem ao merged, normalizadas A4.
// Tenta embutir o documento inteiro de uma só vez (mais rápido); se isso
// falhar (ex.: página problemática), cai no caminho página-a-página com o
// mesmo fallback de copyPages de antes — preservando a resiliência original.
async function anexarComoA4(mergedPdf: PDFDocument, sourcePdf: PDFDocument) {
  const sourcePages = sourcePdf.getPages();

  let embeddedPages: PDFEmbeddedPage[] | null = null;
  try {
    embeddedPages = await mergedPdf.embedPages(sourcePages);
  } catch {
    embeddedPages = null;
  }

  if (embeddedPages) {
    for (const embeddedPage of embeddedPages) {
      desenharA4(mergedPdf, embeddedPage);
    }
    return;
  }

  // Fallback página a página (comportamento original).
  for (const idx of sourcePdf.getPageIndices()) {
    try {
      const [embeddedPage] = await mergedPdf.embedPages([sourcePages[idx]]);
      desenharA4(mergedPdf, embeddedPage);
    } catch {
      const [copiedPage] = await mergedPdf.copyPages(sourcePdf, [idx]);
      const { width: srcW, height: srcH } = copiedPage.getSize();

      if (Math.abs(srcW - A4_WIDTH) > 1 || Math.abs(srcH - A4_HEIGHT) > 1) {
        const scale = Math.min(A4_WIDTH / srcW, A4_HEIGHT / srcH);
        copiedPage.setSize(A4_WIDTH, A4_HEIGHT);
        copiedPage.scaleContent(scale, scale);
        copiedPage.translateContent(
          (A4_WIDTH - srcW * scale) / 2,
          (A4_HEIGHT - srcH * scale) / 2
        );
      }

      mergedPdf.addPage(copiedPage);
    }
  }
}

export async function POST(request: NextRequest) {
  // 1. Exige sessão autenticada — a rota fica fora do middleware (matcher
  //    exclui `api/`), então a checagem precisa ser feita aqui.
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
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
      return NextResponse.json({ error: `URL inválida: ${url}` }, { status: 400 });
    }

    if (parsed.protocol !== "https:" || parsed.host !== SUPABASE_HOST) {
      return NextResponse.json(
        { error: `URL não permitida: ${url}` },
        { status: 400 }
      );
    }
  }

  const validUrls = urls as string[];
  const total = validUrls.length;
  const encoder = new TextEncoder();

  // Resposta em streaming (NDJSON): emite eventos de progresso conforme os
  // PDFs são baixados/mesclados e, no fim, o PDF final em base64. A validação
  // acima (auth/body/urls) continua respondendo com status HTTP normais.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      try {
        const erros: string[] = [];
        // Mantém cada PDF na sua posição (índice) para preservar a ordem final
        // mesmo baixando em paralelo.
        const buffers: (ArrayBuffer | null)[] = new Array(total).fill(null);
        let baixados = 0;
        send({ type: "progress", fase: "download", baixados, total });

        // Downloads em paralelo com teto de concorrência. Cada worker pega o
        // próximo índice disponível; falhas individuais não abortam o resto.
        let cursor = 0;
        const baixarProximos = async (): Promise<void> => {
          for (;;) {
            const i = cursor++;
            if (i >= total) return;
            const url = validUrls[i];
            try {
              const response = await fetch(url);
              if (!response.ok) {
                erros.push(`Falha ao baixar ${url} (HTTP ${response.status})`);
              } else {
                buffers[i] = await response.arrayBuffer();
              }
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              erros.push(`Erro ao baixar ${url}: ${message}`);
            } finally {
              baixados++;
              send({ type: "progress", fase: "download", baixados, total });
            }
          }
        };
        await Promise.all(
          Array.from({ length: Math.min(DOWNLOAD_CONCURRENCY, total) }, () =>
            baixarProximos()
          )
        );

        // Mescla na ordem original dos índices.
        send({ type: "progress", fase: "merge", baixados: total, total });
        const mergedPdf = await PDFDocument.create();

        for (let i = 0; i < total; i++) {
          const bytes = buffers[i];
          if (!bytes) continue; // download falhou — já registrado em `erros`
          try {
            const sourcePdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
            await anexarComoA4(mergedPdf, sourcePdf);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            erros.push(`Erro ao processar ${validUrls[i]}: ${message}`);
          }
        }

        if (mergedPdf.getPageCount() === 0) {
          send({
            type: "error",
            error: "Nenhum PDF pôde ser processado.",
            detalhes: erros,
          });
          controller.close();
          return;
        }

        const mergedBytes = await mergedPdf.save();
        send({
          type: "done",
          pdfBase64: Buffer.from(mergedBytes).toString("base64"),
          avisos: erros,
        });
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        send({ type: "error", error: `Erro ao gerar PDF: ${message}` });
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
