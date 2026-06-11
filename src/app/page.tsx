"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Music,
  FileDown,
  Loader2,
  CirclePlay,
  BookOpen,
  FileMusic,
  Check,
  ChevronDown,
  Circle,
} from "lucide-react";
import { ORDEM_MOMENTOS } from "@/lib/constants";

/* ---------- tipos ---------- */
type Missa = { id: string; nome: string; tempo: string };

type Musica = {
  id: string;
  titulo: string;
  autor_letra: string | null;
  autor_melodia: string | null;
  momento: string;
  youtube_url: string | null;
  cifra_pdf_url: string | null;
  partitura_pdf_url: string | null;
  abrangencia: "todas" | "tempo_liturgico" | "data_especifica";
};

/* ---------- componente ---------- */
export default function Home() {
  const supabase = createSupabaseBrowser();
  const [missas, setMissas] = useState<Missa[]>([]);
  const [tempoSelecionado, setTempoSelecionado] = useState("");
  const [missaId, setMissaId] = useState("");
  const [musicas, setMusicas] = useState<Musica[]>([]);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [tipoExportacao, setTipoExportacao] = useState<"cifra" | "partitura">("cifra");
  const [loadingMusicas, setLoadingMusicas] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: "erro" | "sucesso"; texto: string } | null>(null);
  const [momentoAberto, setMomentoAberto] = useState<string | null>(null);

  /* estado do modal de duplicidade */
  const [showDupModal, setShowDupModal] = useState(false);
  const [dupRepertorioId, setDupRepertorioId] = useState<string | null>(null);
  const [dupRepertorioNome, setDupRepertorioNome] = useState("");
  const [novoNome, setNovoNome] = useState("");

  /* carrega missas */
  useEffect(() => {
    supabase
      .from("missas")
      .select("id, nome, tempo")
      .order("ordem", { ascending: true })
      .then(({ data }) => {
        if (data) setMissas(data);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* carrega músicas de uma missa */
  async function loadMusicas(id: string) {
    setLoadingMusicas(true);
    setMensagem(null);

    const missaSelecionada = missas.find((m) => m.id === id);
    const tempoLiturgico = missaSelecionada?.tempo ?? "";

    const [r1, r2, r3] = await Promise.all([
      supabase
        .from("musicas")
        .select("id, titulo, autor_letra, autor_melodia, momento, youtube_url, cifra_pdf_url, partitura_pdf_url, abrangencia")
        .eq("missa_id", id)
        .eq("abrangencia", "data_especifica"),
      supabase
        .from("musicas")
        .select("id, titulo, autor_letra, autor_melodia, momento, youtube_url, cifra_pdf_url, partitura_pdf_url, abrangencia")
        .eq("tempo_liturgico", tempoLiturgico)
        .eq("abrangencia", "tempo_liturgico"),
      supabase
        .from("musicas")
        .select("id, titulo, autor_letra, autor_melodia, momento, youtube_url, cifra_pdf_url, partitura_pdf_url, abrangencia")
        .eq("abrangencia", "todas"),
    ]);

    setLoadingMusicas(false);
    if (r1.error || r2.error || r3.error) {
      setMensagem({ tipo: "erro", texto: r1.error?.message || r2.error?.message || r3.error?.message || "Erro ao carregar músicas." });
      return;
    }
    const todas = [...(r1.data ?? []), ...(r2.data ?? []), ...(r3.data ?? [])];
    const unicas = Array.from(new Map(todas.map((m) => [m.id, m])).values());
    const sorted = unicas.sort(
      (a, b) => ORDEM_MOMENTOS.indexOf(a.momento) - ORDEM_MOMENTOS.indexOf(b.momento)
    );
    setMusicas(sorted);
    setSelecionadas(new Set());
    const primeiroMomento = ORDEM_MOMENTOS.find((mom) =>
      sorted.some((m) => m.momento === mom)
    );
    setMomentoAberto(primeiroMomento ?? null);
  }

  /* tempos litúrgicos únicos */
  const tempos = Array.from(new Set(missas.map((m) => m.tempo)));

  /* missas filtradas pelo tempo selecionado */
  const missasFiltradas = tempoSelecionado
    ? missas.filter((m) => m.tempo === tempoSelecionado)
    : missas;

  /* agrupa músicas por momento */
  const musicasPorMomento = ORDEM_MOMENTOS.reduce<Record<string, Musica[]>>(
    (acc, momento) => {
      const items = musicas.filter((m) => m.momento === momento);
      if (items.length > 0) acc[momento] = items;
      return acc;
    },
    {}
  );

  /* toggle checkbox — com avanço automático */
  function toggleMusica(id: string, momento: string) {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      const wasEmpty = !musicasPorMomento[momento]?.some((m) => prev.has(m.id));

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        // Avança para o próximo momento se é a primeira seleção neste momento
        if (wasEmpty) {
          setTimeout(() => avancarMomento(momento), 400);
        }
      }
      return next;
    });
  }

  /* avança para o próximo momento com músicas */
  function avancarMomento(momentoAtual: string) {
    const momentosComMusicas = ORDEM_MOMENTOS.filter((mom) => musicasPorMomento[mom]);
    const idx = momentosComMusicas.indexOf(momentoAtual);
    if (idx >= 0 && idx < momentosComMusicas.length - 1) {
      setMomentoAberto(momentosComMusicas[idx + 1]);
    } else {
      setMomentoAberto(null); // Todos preenchidos
    }
  }

  /* músicas selecionadas num momento */
  function musicasSelecionadasNoMomento(momento: string): Musica[] {
    const items = musicasPorMomento[momento] ?? [];
    return items.filter((m) => selecionadas.has(m.id));
  }

  /* progresso */
  const momentosComMusicas = ORDEM_MOMENTOS.filter((mom) => musicasPorMomento[mom]);
  const momentosPreenchidos = momentosComMusicas.filter(
    (mom) => musicasSelecionadasNoMomento(mom).length > 0
  );

  /* gerar PDF unificado */
  async function handleGerarPdf() {
    setMensagem(null);

    const campo = tipoExportacao === "cifra" ? "cifra_pdf_url" : "partitura_pdf_url";

    const urls = musicas
      .filter((m) => selecionadas.has(m.id) && m[campo])
      .map((m) => m[campo] as string);

    if (urls.length === 0) {
      setMensagem({
        tipo: "erro",
        texto: `Nenhuma música selecionada possui PDF de ${tipoExportacao === "cifra" ? "cifra" : "partitura"}.`,
      });
      return;
    }

    // Verifica se já existe repertório para esta missa
    const { data: existentes } = await supabase
      .from("repertorios")
      .select("id, nome")
      .eq("missa_id", missaId);

    if (existentes && existentes.length > 0) {
      // Já existe — abre modal perguntando
      setDupRepertorioId(existentes[0].id);
      setDupRepertorioNome(existentes[0].nome);
      setNovoNome("");
      setShowDupModal(true);
      return;
    }

    // Não existe — salva automaticamente e gera PDF
    const missaNome = missas.find((m) => m.id === missaId)?.nome ?? "Repertório";
    const nomeAuto = `${missaNome} — ${new Date().toLocaleDateString("pt-BR")}`;
    await salvarRepertorioEGerarPdf(nomeAuto, null);
  }

  async function handleDupAtualizar() {
    setShowDupModal(false);
    await salvarRepertorioEGerarPdf(dupRepertorioNome, dupRepertorioId);
  }

  async function handleDupCriarNovo() {
    if (!novoNome.trim()) return;
    setShowDupModal(false);
    await salvarRepertorioEGerarPdf(novoNome.trim(), null);
  }

  async function handleDupApenasGerar() {
    setShowDupModal(false);
    await gerarEBaixarPdf();
  }

  async function salvarRepertorioEGerarPdf(nome: string, repertorioIdExistente: string | null) {
    setGerando(true);
    setMensagem(null);

    try {
      const musicaIds = Array.from(selecionadas);

      if (repertorioIdExistente) {
        // Atualiza o existente: atualiza campos e substitui músicas
        await supabase
          .from("repertorios")
          .update({ nome, tipo_exportacao: tipoExportacao, updated_at: new Date().toISOString() })
          .eq("id", repertorioIdExistente);

        await supabase
          .from("repertorio_musicas")
          .delete()
          .eq("repertorio_id", repertorioIdExistente);

        if (musicaIds.length > 0) {
          await supabase.from("repertorio_musicas").insert(
            musicaIds.map((musica_id) => ({
              repertorio_id: repertorioIdExistente,
              musica_id,
            }))
          );
        }
      } else {
        // Cria novo
        const { data: novo, error } = await supabase
          .from("repertorios")
          .insert({
            nome,
            missa_id: missaId,
            tipo_exportacao: tipoExportacao,
          })
          .select("id")
          .single();

        if (error || !novo) {
          setMensagem({ tipo: "erro", texto: `Erro ao salvar repertório: ${error?.message}` });
          setGerando(false);
          return;
        }

        if (musicaIds.length > 0) {
          await supabase.from("repertorio_musicas").insert(
            musicaIds.map((musica_id) => ({
              repertorio_id: novo.id,
              musica_id,
            }))
          );
        }
      }

      await gerarEBaixarPdf();
      setMensagem({ tipo: "sucesso", texto: "PDF gerado e repertório salvo com sucesso!" });
    } catch {
      setMensagem({ tipo: "erro", texto: "Erro ao salvar repertório. Tente novamente." });
    } finally {
      setGerando(false);
    }
  }

  async function gerarEBaixarPdf() {
    const campo = tipoExportacao === "cifra" ? "cifra_pdf_url" : "partitura_pdf_url";
    const urls = musicas
      .filter((m) => selecionadas.has(m.id) && m[campo])
      .map((m) => m[campo] as string);

    setGerando(true);
    try {
      const res = await fetch("/api/merge-pdfs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        setMensagem({
          tipo: "erro",
          texto: err?.error ?? `Erro ao gerar PDF (HTTP ${res.status}).`,
        });
        return;
      }

      const blob = await res.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const missaNome = missas.find((m) => m.id === missaId)?.nome ?? "repertorio";
      const nomeArquivo = `${missaNome.replace(/[^a-zA-Z0-9À-ú\s_-]/g, "").replace(/\s+/g, "_")}_${tipoExportacao === "partitura" ? "partituras" : "cifras"}.pdf`;
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = nomeArquivo;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch {
      setMensagem({ tipo: "erro", texto: "Erro de conexão. Tente novamente." });
    } finally {
      setGerando(false);
    }
  }

  const totalSelecionadas = musicas.filter((m) => selecionadas.has(m.id)).length;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 py-6">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Music className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Repertório para Missa</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Selecione a missa e monte seu repertório
          </p>
        </div>

        {/* Seletor de Tempo Litúrgico */}
        <div className="space-y-2">
          <Label>Tempo Litúrgico</Label>
          <Select
            value={tempoSelecionado}
            onValueChange={(v) => {
              setTempoSelecionado(v);
              setMissaId(""); setMusicas([]); setSelecionadas(new Set());
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos os tempos..." />
            </SelectTrigger>
            <SelectContent>
              {tempos.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {tempoSelecionado && (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground underline"
              onClick={() => { setTempoSelecionado(""); setMissaId(""); setMusicas([]); setSelecionadas(new Set()); }}
            >
              Limpar filtro
            </button>
          )}
        </div>

        {/* Seletor de Missa */}
        <div className="mt-3 space-y-2">
          <Label>Missa</Label>
          <Select value={missaId} onValueChange={(v) => { setMissaId(v); setMusicas([]); setSelecionadas(new Set()); if (v) loadMusicas(v); }}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a missa..." />
            </SelectTrigger>
            <SelectContent>
              {missasFiltradas.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Loading */}
        {loadingMusicas && (
          <div className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando músicas...
          </div>
        )}

        {/* Lista de músicas — Accordion guiado */}
        {!loadingMusicas && musicas.length > 0 && (
          <div className="mt-6 space-y-4">
            {/* Barra de progresso */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{momentosPreenchidos.length} de {momentosComMusicas.length} momentos selecionados</span>
                <span>{totalSelecionadas} música{totalSelecionadas !== 1 ? "s" : ""}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-accent">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${momentosComMusicas.length > 0 ? (momentosPreenchidos.length / momentosComMusicas.length) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Momentos accordion */}
            <div className="space-y-2">
              {momentosComMusicas.map((momento) => {
                const items = musicasPorMomento[momento];
                const selecionadasMomento = musicasSelecionadasNoMomento(momento);
                const isOpen = momentoAberto === momento;
                const temSelecionadas = selecionadasMomento.length > 0;

                return (
                  <div
                    key={momento}
                    className={`rounded-lg border transition-colors ${
                      isOpen
                        ? "border-primary/40 bg-primary/5"
                        : temSelecionadas
                        ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/30"
                        : "border-border"
                    }`}
                  >
                    {/* Header do momento */}
                    <button
                      type="button"
                      onClick={() => setMomentoAberto(isOpen ? null : momento)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left"
                    >
                      {temSelecionadas ? (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500 text-white">
                          <Check className="h-3 w-3" />
                        </span>
                      ) : (
                        <Circle className="h-5 w-5 shrink-0 text-muted-foreground/40" />
                      )}
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-medium">{momento}</span>
                        {!isOpen && temSelecionadas && (
                          <p className="truncate text-xs text-muted-foreground">
                            {selecionadasMomento.map((m) => m.titulo).join(", ")}
                          </p>
                        )}
                      </div>
                      <span className="mr-1 text-xs text-muted-foreground">{items.length}</span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {/* Lista de músicas (expandida) */}
                    {isOpen && (
                      <div className="space-y-1 px-3 pb-3">
                        {items.map((musica) => (
                          <label
                            key={musica.id}
                            className="flex cursor-pointer items-center gap-3 rounded-lg border bg-background p-3 transition-colors hover:bg-accent/50 has-[button[data-state=checked]]:border-primary/30 has-[button[data-state=checked]]:bg-primary/5"
                          >
                            <Checkbox
                              checked={selecionadas.has(musica.id)}
                              onCheckedChange={() => toggleMusica(musica.id, momento)}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{musica.titulo}</p>
                              {(musica.autor_letra || musica.autor_melodia) && (
                                <p className="truncate text-xs text-muted-foreground">
                                  {musica.autor_letra && <>L: {musica.autor_letra}</>}
                                  {musica.autor_letra && musica.autor_melodia && " · "}
                                  {musica.autor_melodia && <>M: {musica.autor_melodia}</>}
                                </p>
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              {musica.cifra_pdf_url && (
                                <a
                                  href={musica.cifra_pdf_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-blue-600"
                                  onClick={(e) => e.stopPropagation()}
                                  aria-label="Abrir cifra"
                                  title="Abrir cifra"
                                >
                                  <BookOpen className="h-4 w-4" />
                                </a>
                              )}
                              {musica.partitura_pdf_url && (
                                <a
                                  href={musica.partitura_pdf_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-purple-600"
                                  onClick={(e) => e.stopPropagation()}
                                  aria-label="Abrir partitura"
                                  title="Abrir partitura"
                                >
                                  <FileMusic className="h-4 w-4" />
                                </a>
                              )}
                              {musica.youtube_url && (
                                <a
                                  href={musica.youtube_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-red-600"
                                  onClick={(e) => e.stopPropagation()}
                                  aria-label="Abrir no YouTube"
                                  title="Abrir no YouTube"
                                >
                                  <CirclePlay className="h-4 w-4" />
                                </a>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Rodapé: tipo de exportação + botão */}
            <div className="space-y-4 border-t pt-4">
              <div className="space-y-2">
                <Label>Tipo de repertório</Label>
                <Select
                  value={tipoExportacao}
                  onValueChange={(v) => setTipoExportacao(v as "cifra" | "partitura")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cifra">
                      Cifras
                    </SelectItem>
                    <SelectItem value="partitura">
                      Partituras
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Mensagem de feedback */}
              {mensagem && (
                <div
                  className={`rounded-md p-3 text-sm ${
                    mensagem.tipo === "sucesso"
                      ? "border border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300"
                      : "border border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
                  }`}
                >
                  {mensagem.texto}
                </div>
              )}

              <Button
                className="w-full"
                size="lg"
                disabled={gerando || totalSelecionadas === 0}
                onClick={handleGerarPdf}
              >
                {gerando ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Gerando PDF...
                  </>
                ) : (
                  <>
                    <FileDown />
                    Gerar PDF Unificado
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Estado vazio */}
        {!loadingMusicas && missaId && musicas.length === 0 && (
          <div className="mt-12 text-center text-sm text-muted-foreground">
            Nenhuma música cadastrada para esta celebração.
          </div>
        )}
      </div>

      {/* Modal de duplicidade */}
      {showDupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
            <h2 className="text-lg font-semibold">Repertório já existe</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Já existe um repertório salvo para esta missa: <strong>{dupRepertorioNome}</strong>
            </p>

            <div className="mt-4 space-y-3">
              <Button className="w-full" onClick={handleDupAtualizar}>
                Atualizar repertório existente
              </Button>

              <div className="space-y-2">
                <Label>Ou crie um novo com outro nome:</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Nome do novo repertório"
                    value={novoNome}
                    onChange={(e) => setNovoNome(e.target.value)}
                  />
                  <Button onClick={handleDupCriarNovo} disabled={!novoNome.trim()}>
                    Criar
                  </Button>
                </div>
              </div>

              <div className="flex gap-2 border-t pt-3">
                <Button variant="outline" className="flex-1" onClick={handleDupApenasGerar}>
                  Apenas gerar PDF
                </Button>
                <Button variant="ghost" className="flex-1" onClick={() => setShowDupModal(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
