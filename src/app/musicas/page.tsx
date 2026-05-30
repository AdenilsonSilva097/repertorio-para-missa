"use client";

import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Trash2, Loader2, Search, Save, X, Eye, FileX, SlidersHorizontal, ChevronDown } from "lucide-react";

const MOMENTOS_MISSA = [
  "Entrada",
  "Ato Penitencial",
  "Glória",
  "Salmo",
  "Aclamação",
  "Ofertório",
  "Santo",
  "Cordeiro",
  "Comunhão",
  "Ação de Graças",
  "Final",
] as const;

const TEMPOS_LITURGICOS = [
  "Tempo do Natal",
  "Tempo Comum",
  "Quaresma",
  "Páscoa",
  "Advento",
] as const;

type Missa = {
  id: string;
  nome: string;
  tempo: string;
};

type Musica = {
  id: string;
  titulo: string;
  autor_letra: string | null;
  autor_melodia: string | null;
  momento: string;
  youtube_url: string | null;
  cifra_pdf_url: string | null;
  partitura_pdf_url: string | null;
  missa_id: string | null;
  abrangencia: "todas" | "tempo_liturgico" | "data_especifica";
  tempo_liturgico: string | null;
  missas: { nome: string; tempo: string } | null;
};

export default function EditarMusicasPage() {
  const supabase = createSupabaseBrowser();
  const { isEditor } = useAuth();
  const [missas, setMissas] = useState<Missa[]>([]);
  const [musicas, setMusicas] = useState<Musica[]>([]);
  const [filtroData, setFiltroData] = useState("");
  const [filtroBusca, setFiltroBusca] = useState("");
  const [filtroAbrangencia, setFiltroAbrangencia] = useState("");
  const [filtroMomento, setFiltroMomento] = useState("");
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);

  // Edit state
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    titulo: "",
    autor_letra: "",
    autor_melodia: "",
    momento: "",
    youtube_url: "",
    abrangencia: "data_especifica" as "todas" | "tempo_liturgico" | "data_especifica",
    tempo_liturgico: "",
    missa_id: "",
  });
  const [editCifraFile, setEditCifraFile] = useState<File | null>(null);
  const [editPartituraFile, setEditPartituraFile] = useState<File | null>(null);
  const [removeCifra, setRemoveCifra] = useState(false);
  const [removePartitura, setRemovePartitura] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const cifraInputRef = useRef<HTMLInputElement>(null);
  const partituraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase
      .from("missas")
      .select("id, nome, tempo")
      .order("ordem", { ascending: true })
      .then(({ data }) => {
        if (data) setMissas(data);
      });
  }, []);

  useEffect(() => {
    fetchMusicas();
  }, []);

  async function fetchMusicas() {
    setLoading(true);
    const { data, error } = await supabase
      .from("musicas")
      .select("id, titulo, autor_letra, autor_melodia, momento, youtube_url, cifra_pdf_url, partitura_pdf_url, missa_id, abrangencia, tempo_liturgico, missas(nome, tempo)")
      .order("titulo", { ascending: true });
    if (!error && data) {
      setMusicas(data as unknown as Musica[]);
    }
    setLoading(false);
  }

  function startEdit(musica: Musica) {
    setEditandoId(musica.id);
    setEditForm({
      titulo: musica.titulo,
      autor_letra: musica.autor_letra || "",
      autor_melodia: musica.autor_melodia || "",
      momento: musica.momento,
      youtube_url: musica.youtube_url || "",
      abrangencia: musica.abrangencia,
      tempo_liturgico: musica.tempo_liturgico || "",
      missa_id: musica.missa_id || "",
    });
    setEditCifraFile(null);
    setEditPartituraFile(null);
    setRemoveCifra(false);
    setRemovePartitura(false);
    if (cifraInputRef.current) cifraInputRef.current.value = "";
    if (partituraInputRef.current) partituraInputRef.current.value = "";
    setMensagem(null);
  }

  function cancelEdit() {
    setEditandoId(null);
    setEditCifraFile(null);
    setEditPartituraFile(null);
    setRemoveCifra(false);
    setRemovePartitura(false);
  }

  async function uploadPdf(file: File, bucket: string, path: string): Promise<string | null> {
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (error) {
      console.error(`Erro ao fazer upload para ${bucket}:`, error.message);
      return null;
    }
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
    return urlData.publicUrl;
  }

  async function handleSave(musicaId: string) {
    setSaving(true);
    setMensagem(null);

    try {
      const updates: Record<string, string | null> = {
        titulo: editForm.titulo.trim(),
        autor_letra: editForm.autor_letra.trim() || null,
        autor_melodia: editForm.autor_melodia.trim() || null,
        momento: editForm.momento,
        youtube_url: editForm.youtube_url.trim() || null,
        abrangencia: editForm.abrangencia,
        missa_id: editForm.abrangencia === "data_especifica" ? editForm.missa_id : null,
        tempo_liturgico: editForm.abrangencia === "tempo_liturgico" ? editForm.tempo_liturgico : null,
      };

      const timestamp = Date.now();

      if (removeCifra) {
        updates.cifra_pdf_url = null;
      } else if (editCifraFile) {
        const safeName = editCifraFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const url = await uploadPdf(editCifraFile, "cifras", `${timestamp}_${safeName}`);
        if (!url) {
          setMensagem({ tipo: "erro", texto: "Falha ao enviar o PDF da cifra." });
          setSaving(false);
          return;
        }
        updates.cifra_pdf_url = url;
      }

      if (removePartitura) {
        updates.partitura_pdf_url = null;
      } else if (editPartituraFile) {
        const safeName = editPartituraFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const url = await uploadPdf(editPartituraFile, "partituras", `${timestamp}_${safeName}`);
        if (!url) {
          setMensagem({ tipo: "erro", texto: "Falha ao enviar o PDF da partitura." });
          setSaving(false);
          return;
        }
        updates.partitura_pdf_url = url;
      }

      const { error } = await supabase.from("musicas").update(updates).eq("id", musicaId);

      if (error) {
        setMensagem({ tipo: "erro", texto: `Erro ao salvar: ${error.message}` });
      } else {
        setMensagem({ tipo: "sucesso", texto: "Música atualizada com sucesso!" });
        setEditandoId(null);
        fetchMusicas();
      }
    } catch {
      setMensagem({ tipo: "erro", texto: "Erro inesperado. Tente novamente." });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(musica: Musica) {
    if (!confirm(`Tem certeza que deseja excluir "${musica.titulo}"?`)) return;

    setDeletingId(musica.id);
    setMensagem(null);

    const { error } = await supabase.from("musicas").delete().eq("id", musica.id);

    if (error) {
      setMensagem({ tipo: "erro", texto: `Erro ao excluir: ${error.message}` });
    } else {
      setMensagem({ tipo: "sucesso", texto: `"${musica.titulo}" excluída com sucesso.` });
      fetchMusicas();
    }
    setDeletingId(null);
  }

  function handleFileChange(
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (f: File | null) => void
  ) {
    const file = e.target.files?.[0] ?? null;
    if (file && file.type !== "application/pdf") {
      setMensagem({ tipo: "erro", texto: "Apenas arquivos PDF são aceitos." });
      e.target.value = "";
      return;
    }
    setter(file);
  }

  const musicasFiltradas = musicas.filter((m) => {
    if (filtroBusca && !m.titulo.toLowerCase().includes(filtroBusca.toLowerCase())) return false;
    if (filtroAbrangencia && m.abrangencia !== filtroAbrangencia) return false;
    if (filtroMomento && m.momento !== filtroMomento) return false;
    if (filtroData) {
      const missaSel = missas.find((ms) => ms.id === filtroData);
      if (m.abrangencia === "data_especifica" && m.missa_id !== filtroData) return false;
      if (m.abrangencia === "tempo_liturgico" && (!missaSel || m.tempo_liturgico !== missaSel.tempo)) return false;
    }
    return true;
  });

  const hasFilters = !!(filtroData || filtroBusca || filtroAbrangencia || filtroMomento);
  const activeFilterCount = [filtroAbrangencia, filtroMomento, filtroData].filter(Boolean).length;

  function clearFilters() {
    setFiltroData("");
    setFiltroBusca("");
    setFiltroAbrangencia("");
    setFiltroMomento("");
  }

  if (!isEditor) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        Você não tem permissão para acessar esta página.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Pencil className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Editar Músicas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visualize, edite ou exclua músicas cadastradas
        </p>
      </div>

      {/* Mensagem */}
      {mensagem && (
        <div
          className={`mb-6 rounded-md p-3 text-sm ${
            mensagem.tipo === "sucesso"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {mensagem.texto}
        </div>
      )}

      {/* Filtros */}
      <div className="mb-6 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por título..."
              value={filtroBusca}
              onChange={(e) => setFiltroBusca(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant={activeFilterCount > 0 ? "default" : "outline"}
            size="icon"
            className="relative shrink-0 sm:hidden"
            onClick={() => setFiltrosAbertos((v) => !v)}
            aria-label="Filtros"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {activeFilterCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>

        <div className={`grid grid-cols-1 gap-2 sm:grid sm:grid-cols-3 ${filtrosAbertos ? "grid" : "hidden sm:grid"}`}>
          <Select value={filtroAbrangencia} onValueChange={setFiltroAbrangencia}>
            <SelectTrigger>
              <SelectValue placeholder="Abrangência" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as missas</SelectItem>
              <SelectItem value="tempo_liturgico">Tempo litúrgico</SelectItem>
              <SelectItem value="data_especifica">Missa específica</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filtroMomento} onValueChange={setFiltroMomento}>
            <SelectTrigger>
              <SelectValue placeholder="Momento" />
            </SelectTrigger>
            <SelectContent>
              {MOMENTOS_MISSA.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filtroData} onValueChange={setFiltroData}>
            <SelectTrigger>
              <SelectValue placeholder="Missa" />
            </SelectTrigger>
            <SelectContent>
              {missas.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.nome} — {m.tempo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {musicasFiltradas.length} música{musicasFiltradas.length !== 1 ? "s" : ""} encontrada{musicasFiltradas.length !== 1 ? "s" : ""}
          </span>
          {hasFilters && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearFilters}>
              <X className="mr-1 h-3 w-3" /> Limpar filtros
            </Button>
          )}
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : musicasFiltradas.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          {filtroData || filtroBusca
            ? "Nenhuma música encontrada com os filtros aplicados."
            : "Nenhuma música cadastrada ainda."}
        </div>
      ) : (
        <div className="space-y-3">
          {musicasFiltradas.map((musica) => (
            <div key={musica.id} className="rounded-lg border bg-card p-4">
              {editandoId === musica.id ? (
                /* ---- Modo edição ---- */
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Abrangência</Label>
                    <Select
                      value={editForm.abrangencia}
                      onValueChange={(v) => setEditForm({ ...editForm, abrangencia: v as "todas" | "tempo_liturgico" | "data_especifica", missa_id: "", tempo_liturgico: "" })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todas">Todas as missas</SelectItem>
                        <SelectItem value="tempo_liturgico">Tempo litúrgico</SelectItem>
                        <SelectItem value="data_especifica">Missa específica</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {editForm.abrangencia === "tempo_liturgico" && (
                    <div className="space-y-2">
                      <Label>Tempo Litúrgico</Label>
                      <Select
                        value={editForm.tempo_liturgico}
                        onValueChange={(v) => setEditForm({ ...editForm, tempo_liturgico: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tempo..." />
                        </SelectTrigger>
                        <SelectContent>
                          {TEMPOS_LITURGICOS.map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {editForm.abrangencia === "data_especifica" && (
                    <div className="space-y-2">
                      <Label>Missa</Label>
                      <Select
                        value={editForm.missa_id}
                        onValueChange={(v) => setEditForm({ ...editForm, missa_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {missas.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.nome} — {m.tempo}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Título</Label>
                    <Input
                      value={editForm.titulo}
                      onChange={(e) => setEditForm({ ...editForm, titulo: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Autor da Letra</Label>
                    <Input
                      value={editForm.autor_letra}
                      onChange={(e) => setEditForm({ ...editForm, autor_letra: e.target.value })}
                      placeholder="Ex: Pe. José Weber"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Autor da Melodia</Label>
                    <Input
                      value={editForm.autor_melodia}
                      onChange={(e) => setEditForm({ ...editForm, autor_melodia: e.target.value })}
                      placeholder="Ex: Pe. José Weber"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Momento</Label>
                    <Select
                      value={editForm.momento}
                      onValueChange={(v) => setEditForm({ ...editForm, momento: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MOMENTOS_MISSA.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>YouTube URL</Label>
                    <Input
                      value={editForm.youtube_url}
                      onChange={(e) => setEditForm({ ...editForm, youtube_url: e.target.value })}
                      placeholder="https://youtube.com/watch?v=..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Cifra (PDF)</Label>
                    {musica.cifra_pdf_url && !removeCifra ? (
                      <div className="flex items-center gap-2 rounded-md border p-2">
                        <span className="flex-1 truncate text-sm text-muted-foreground">Cifra cadastrada</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(musica.cifra_pdf_url!, "_blank")}
                        >
                          <Eye className="mr-1 h-3.5 w-3.5" /> Visualizar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => { setRemoveCifra(true); setEditCifraFile(null); if (cifraInputRef.current) cifraInputRef.current.value = ""; }}
                        >
                          <FileX className="mr-1 h-3.5 w-3.5" /> Remover
                        </Button>
                      </div>
                    ) : (
                      <div>
                        {removeCifra && (
                          <div className="mb-2 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                            <span className="flex-1">Cifra será removida ao salvar.</span>
                            <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setRemoveCifra(false)}>Desfazer</Button>
                          </div>
                        )}
                        <Input
                          ref={cifraInputRef}
                          type="file"
                          accept="application/pdf"
                          onChange={(e) => handleFileChange(e, setEditCifraFile)}
                        />
                        <p className="mt-1 text-xs text-muted-foreground">{removeCifra ? "Envie um novo arquivo ou salve para remover." : "Nenhuma cifra cadastrada. Envie um PDF."}</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Partitura (PDF)</Label>
                    {musica.partitura_pdf_url && !removePartitura ? (
                      <div className="flex items-center gap-2 rounded-md border p-2">
                        <span className="flex-1 truncate text-sm text-muted-foreground">Partitura cadastrada</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(musica.partitura_pdf_url!, "_blank")}
                        >
                          <Eye className="mr-1 h-3.5 w-3.5" /> Visualizar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => { setRemovePartitura(true); setEditPartituraFile(null); if (partituraInputRef.current) partituraInputRef.current.value = ""; }}
                        >
                          <FileX className="mr-1 h-3.5 w-3.5" /> Remover
                        </Button>
                      </div>
                    ) : (
                      <div>
                        {removePartitura && (
                          <div className="mb-2 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                            <span className="flex-1">Partitura será removida ao salvar.</span>
                            <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setRemovePartitura(false)}>Desfazer</Button>
                          </div>
                        )}
                        <Input
                          ref={partituraInputRef}
                          type="file"
                          accept="application/pdf"
                          onChange={(e) => handleFileChange(e, setEditPartituraFile)}
                        />
                        <p className="mt-1 text-xs text-muted-foreground">{removePartitura ? "Envie um novo arquivo ou salve para remover." : "Nenhuma partitura cadastrada. Envie um PDF."}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={() => handleSave(musica.id)} disabled={saving}>
                      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Salvar
                    </Button>
                    <Button variant="outline" onClick={cancelEdit} disabled={saving}>
                      <X className="mr-2 h-4 w-4" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                /* ---- Modo visualização ---- */
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium">{musica.titulo}</h3>
                    {(musica.autor_letra || musica.autor_melodia) && (
                      <p className="text-xs text-muted-foreground">
                        {musica.autor_letra && <>L: {musica.autor_letra}</>}
                        {musica.autor_letra && musica.autor_melodia && " · "}
                        {musica.autor_melodia && <>M: {musica.autor_melodia}</>}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        musica.abrangencia === "todas"
                          ? "bg-green-50 text-green-700"
                          : musica.abrangencia === "tempo_liturgico"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-amber-50 text-amber-700"
                      }`}>
                        {musica.abrangencia === "todas"
                          ? "Todas as missas"
                          : musica.abrangencia === "tempo_liturgico"
                          ? musica.tempo_liturgico
                          : musica.missas
                          ? `${musica.missas.nome} — ${musica.missas.tempo}`
                          : "—"}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {musica.momento}
                      </span>
                      {musica.cifra_pdf_url && (
                        <a
                          href={musica.cifra_pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                        >
                          <Eye className="h-3 w-3" /> Cifra
                        </a>
                      )}
                      {musica.partitura_pdf_url && (
                        <a
                          href={musica.partitura_pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700 hover:bg-purple-100"
                        >
                          <Eye className="h-3 w-3" /> Partitura
                        </a>
                      )}
                      {musica.youtube_url && (
                        <a
                          href={musica.youtube_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 hover:bg-red-100"
                        >
                          YouTube
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEdit(musica)}
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(musica)}
                      disabled={deletingId === musica.id}
                      title="Excluir"
                      className="text-destructive hover:text-destructive"
                    >
                      {deletingId === musica.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
