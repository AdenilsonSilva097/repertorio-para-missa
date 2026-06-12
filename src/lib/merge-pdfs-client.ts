// Cliente do endpoint /api/merge-pdfs.
//
// A rota responde em streaming NDJSON: uma linha JSON por evento de progresso
// e, no fim, o PDF mesclado em base64. Este helper lê esse stream, reporta o
// progresso via callback e devolve o PDF como Blob. Centralizado aqui para que
// a home e a tela de Repertórios Salvos compartilhem a mesma lógica.

export type MergeProgresso = {
  fase: "download" | "merge";
  baixados: number;
  total: number;
};

export type ResultadoMerge = {
  blob: Blob;
  avisos: string[];
};

type MergeEvento = {
  type: "progress" | "done" | "error";
  fase?: "download" | "merge";
  baixados?: number;
  total?: number;
  pdfBase64?: string;
  avisos?: string[];
  error?: string;
};

export async function gerarPdfMesclado(
  urls: string[],
  onProgress?: (p: MergeProgresso) => void
): Promise<ResultadoMerge> {
  const res = await fetch("/api/merge-pdfs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ urls }),
  });

  // Erros de validação (400/401) chegam como JSON normal, antes do stream.
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error ?? `Erro ao gerar PDF (HTTP ${res.status}).`);
  }
  if (!res.body) {
    throw new Error("Resposta sem corpo.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let pdfBase64: string | null = null;
  let avisos: string[] = [];
  let erro: string | null = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const linha = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!linha) continue;

      const evt = JSON.parse(linha) as MergeEvento;
      if (evt.type === "progress" && evt.fase) {
        onProgress?.({
          fase: evt.fase,
          baixados: evt.baixados ?? 0,
          total: evt.total ?? 0,
        });
      } else if (evt.type === "done") {
        pdfBase64 = evt.pdfBase64 ?? null;
        avisos = evt.avisos ?? [];
      } else if (evt.type === "error") {
        erro = evt.error ?? "Erro ao gerar PDF.";
      }
    }
  }

  if (erro) throw new Error(erro);
  if (!pdfBase64) throw new Error("Resposta inválida do servidor.");

  const bytes = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0));
  return { blob: new Blob([bytes], { type: "application/pdf" }), avisos };
}
