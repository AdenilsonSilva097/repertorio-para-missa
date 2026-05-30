"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";
import {
  FolderOpen,
  Loader2,
  Trash2,
  FileDown,
  Calendar,
} from "lucide-react";

type Repertorio = {
  id: string;
  nome: string;
  tipo_exportacao: string;
  created_at: string;
  updated_at: string;
  missas: { id: string; nome: string; tempo: string } | null;
  repertorio_musicas: { musica_id: string }[];
};

export default function RepertoriosSalvosPage() {
  const supabase = createSupabaseBrowser();
  const [repertorios, setRepertorios] = useState<Repertorio[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [gerandoId, setGerandoId] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchRepertorios();
  }, []);

  async function fetchRepertorios() {
    setLoading(true);
    const { data, error } = await supabase
      .from("repertorios")
      .select("id, nome, tipo_exportacao, created_at, updated_at, missas(id, nome, tempo), repertorio_musicas(musica_id)")
      .order("updated_at", { ascending: false });

    if (!error && data) {
      setRepertorios(data as unknown as Repertorio[]);
    }
    setLoading(false);
  }

  async function handleDelete(rep: Repertorio) {
    if (!confirm(`Excluir o repertório "${rep.nome}"?`)) return;

    setDeletingId(rep.id);
    setMensagem(null);

    const { error } = await supabase.from("repertorios").delete().eq("id", rep.id);

    if (error) {
      setMensagem({ tipo: "erro", texto: `Erro ao excluir: ${error.message}` });
    } else {
      setMensagem({ tipo: "sucesso", texto: `"${rep.nome}" excluído.` });
      fetchRepertorios();
    }
    setDeletingId(null);
  }

  async function handleGerarPdf(rep: Repertorio) {
    setGerandoId(rep.id);
    setMensagem(null);

    try {
      const musicaIds = rep.repertorio_musicas.map((rm) => rm.musica_id);

      if (musicaIds.length === 0) {
        setMensagem({ tipo: "erro", texto: "Este repertório não tem músicas." });
        setGerandoId(null);
        return;
      }

      const campo = rep.tipo_exportacao === "partitura" ? "partitura_pdf_url" : "cifra_pdf_url";

      const { data: musicas } = await supabase
        .from("musicas")
        .select(`id, ${campo}`)
        .in("id", musicaIds);

      const urls = (musicas ?? [])
        .map((m: Record<string, string | null>) => m[campo])
        .filter(Boolean) as string[];

      if (urls.length === 0) {
        setMensagem({
          tipo: "erro",
          texto: `Nenhuma música possui PDF de ${rep.tipo_exportacao === "partitura" ? "partitura" : "cifra"}.`,
        });
        setGerandoId(null);
        return;
      }

      const res = await fetch("/api/merge-pdfs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        setMensagem({ tipo: "erro", texto: err?.error ?? `Erro HTTP ${res.status}` });
        setGerandoId(null);
        return;
      }

      const blob = await res.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `${rep.nome.replace(/[^a-zA-Z0-9À-ú\s_-]/g, "")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(downloadUrl);

      setMensagem({ tipo: "sucesso", texto: "PDF gerado com sucesso!" });
    } catch {
      setMensagem({ tipo: "erro", texto: "Erro ao gerar PDF." });
    } finally {
      setGerandoId(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <FolderOpen className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Repertórios Salvos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visualize e gere PDFs dos repertórios anteriores
        </p>
      </div>

      {/* Mensagem */}
      {mensagem && (
        <div
          className={`mb-6 rounded-md p-3 text-sm ${
            mensagem.tipo === "sucesso"
              ? "bg-green-50 text-green-800 border border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800"
              : "bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800"
          }`}
        >
          {mensagem.texto}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : repertorios.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhum repertório salvo ainda. Gere um PDF na página de Repertório para salvar automaticamente.
        </div>
      ) : (
        <div className="space-y-3">
          {repertorios.map((rep) => (
            <div key={rep.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium">{rep.nome}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {rep.missas ? `${rep.missas.nome} — ${rep.missas.tempo}` : "—"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      {rep.repertorio_musicas.length} música{rep.repertorio_musicas.length !== 1 ? "s" : ""}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                      {rep.tipo_exportacao === "partitura" ? "Partituras" : "Cifras"}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {new Date(rep.updated_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleGerarPdf(rep)}
                    disabled={gerandoId === rep.id}
                    title="Gerar PDF"
                  >
                    {gerandoId === rep.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileDown className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(rep)}
                    disabled={deletingId === rep.id}
                    title="Excluir"
                    className="text-destructive hover:text-destructive"
                  >
                    {deletingId === rep.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
