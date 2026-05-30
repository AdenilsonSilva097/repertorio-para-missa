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
import { Music, Upload, Loader2 } from "lucide-react";

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

export default function CadastroMusicaPage() {
  const supabase = createSupabaseBrowser();
  const { isEditor } = useAuth();
  const [missas, setMissas] = useState<Missa[]>([]);
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);

  // Form state
  const [abrangencia, setAbrangencia] = useState<"todas" | "tempo_liturgico" | "data_especifica">("data_especifica");
  const [tempoLiturgico, setTempoLiturgico] = useState("");
  const [missaId, setMissaId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [autorLetra, setAutorLetra] = useState("");
  const [autorMelodia, setAutorMelodia] = useState("");
  const [momento, setMomento] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [cifraFile, setCifraFile] = useState<File | null>(null);
  const [partituraFile, setPartituraFile] = useState<File | null>(null);

  const cifraInputRef = useRef<HTMLInputElement>(null);
  const partituraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function fetchMissas() {
      const { data, error } = await supabase
        .from("missas")
        .select("id, nome, tempo")
        .order("ordem", { ascending: true });

      if (!error && data) {
        setMissas(data);
      }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchMissas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForm() {
    setAbrangencia("data_especifica");
    setTempoLiturgico("");
    setMissaId("");
    setTitulo("");
    setAutorLetra("");
    setAutorMelodia("");
    setMomento("");
    setYoutubeUrl("");
    setCifraFile(null);
    setPartituraFile(null);
    if (cifraInputRef.current) cifraInputRef.current.value = "";
    if (partituraInputRef.current) partituraInputRef.current.value = "";
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMensagem(null);

    if (!titulo.trim() || !momento) {
      setMensagem({ tipo: "erro", texto: "Preencha os campos obrigatórios: Título e Momento." });
      return;
    }

    if (abrangencia === "data_especifica" && !missaId) {
      setMensagem({ tipo: "erro", texto: "Selecione a missa para abrangência 'Missa específica'." });
      return;
    }

    if (abrangencia === "tempo_liturgico" && !tempoLiturgico) {
      setMensagem({ tipo: "erro", texto: "Selecione o tempo litúrgico." });
      return;
    }

    setLoading(true);

    try {
      const timestamp = Date.now();
      let cifraUrl: string | null = null;
      let partituraUrl: string | null = null;

      if (cifraFile) {
        const safeName = cifraFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        cifraUrl = await uploadPdf(cifraFile, "cifras", `${timestamp}_${safeName}`);
        if (!cifraUrl) {
          setMensagem({ tipo: "erro", texto: "Falha ao enviar o PDF da cifra." });
          setLoading(false);
          return;
        }
      }

      if (partituraFile) {
        const safeName = partituraFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        partituraUrl = await uploadPdf(partituraFile, "partituras", `${timestamp}_${safeName}`);
        if (!partituraUrl) {
          setMensagem({ tipo: "erro", texto: "Falha ao enviar o PDF da partitura." });
          setLoading(false);
          return;
        }
      }

      const { error } = await supabase.from("musicas").insert({
        abrangencia,
        missa_id: abrangencia === "data_especifica" ? missaId : null,
        tempo_liturgico: abrangencia === "tempo_liturgico" ? tempoLiturgico : null,
        titulo: titulo.trim(),
        autor_letra: autorLetra.trim() || null,
        autor_melodia: autorMelodia.trim() || null,
        momento,
        youtube_url: youtubeUrl.trim() || null,
        cifra_pdf_url: cifraUrl,
        partitura_pdf_url: partituraUrl,
      });

      if (error) {
        setMensagem({ tipo: "erro", texto: `Erro ao salvar: ${error.message}` });
      } else {
        setMensagem({ tipo: "sucesso", texto: "Música cadastrada com sucesso!" });
        resetForm();
      }
    } catch {
      setMensagem({ tipo: "erro", texto: "Erro inesperado. Tente novamente." });
    } finally {
      setLoading(false);
    }
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

  if (!isEditor) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        Você não tem permissão para acessar esta página.
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Music className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Cadastro de Música</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Adicione uma nova música ao repertório da missa
          </p>
        </div>

        {/* Mensagem de feedback */}
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

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Abrangência */}
          <div className="space-y-2">
            <Label htmlFor="abrangencia">
              Abrangência <span className="text-destructive">*</span>
            </Label>
            <Select value={abrangencia} onValueChange={(v) => {
              setAbrangencia(v as "todas" | "tempo_liturgico" | "data_especifica");
              setMissaId("");
              setTempoLiturgico("");
            }}>
              <SelectTrigger id="abrangencia">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as missas</SelectItem>
                <SelectItem value="tempo_liturgico">Tempo litúrgico</SelectItem>
                <SelectItem value="data_especifica">Missa específica</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tempo Litúrgico (se abrangência = tempo_liturgico) */}
          {abrangencia === "tempo_liturgico" && (
            <div className="space-y-2">
              <Label htmlFor="tempo-liturgico">
                Tempo Litúrgico <span className="text-destructive">*</span>
              </Label>
              <Select value={tempoLiturgico} onValueChange={setTempoLiturgico}>
                <SelectTrigger id="tempo-liturgico">
                  <SelectValue placeholder="Selecione o tempo..." />
                </SelectTrigger>
                <SelectContent>
                  {TEMPOS_LITURGICOS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Missa (se abrangência = data_especifica) */}
          {abrangencia === "data_especifica" && (
            <div className="space-y-2">
              <Label htmlFor="missa">
                Missa <span className="text-destructive">*</span>
              </Label>
              <Select value={missaId} onValueChange={setMissaId}>
                <SelectTrigger id="missa">
                  <SelectValue placeholder="Selecione a missa..." />
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

          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="titulo">
              Título da Música <span className="text-destructive">*</span>
            </Label>
            <Input
              id="titulo"
              placeholder="Ex: Acolhe, Senhor"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </div>

          {/* Autor da Letra */}
          <div className="space-y-2">
            <Label htmlFor="autor-letra">Autor da Letra</Label>
            <Input
              id="autor-letra"
              placeholder="Ex: Pe. José Weber"
              value={autorLetra}
              onChange={(e) => setAutorLetra(e.target.value)}
            />
          </div>

          {/* Autor da Melodia */}
          <div className="space-y-2">
            <Label htmlFor="autor-melodia">Autor da Melodia</Label>
            <Input
              id="autor-melodia"
              placeholder="Ex: Pe. José Weber"
              value={autorMelodia}
              onChange={(e) => setAutorMelodia(e.target.value)}
            />
          </div>

          {/* Momento da Missa */}
          <div className="space-y-2">
            <Label htmlFor="momento">
              Momento da Missa <span className="text-destructive">*</span>
            </Label>
            <Select value={momento} onValueChange={setMomento}>
              <SelectTrigger id="momento">
                <SelectValue placeholder="Selecione o momento..." />
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

          {/* YouTube URL */}
          <div className="space-y-2">
            <Label htmlFor="youtube">Link do YouTube</Label>
            <Input
              id="youtube"
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
            />
          </div>

          {/* Upload Cifra */}
          <div className="space-y-2">
            <Label>Cifra (PDF)</Label>
            <label
              className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-input p-4 transition-colors hover:border-primary hover:bg-accent/50"
            >
              <Upload className="h-5 w-5 shrink-0 text-muted-foreground" />
              <span className="truncate text-sm text-muted-foreground">
                {cifraFile ? cifraFile.name : "Clique para selecionar o PDF da cifra"}
              </span>
              <input
                ref={cifraInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => handleFileChange(e, setCifraFile)}
              />
            </label>
          </div>

          {/* Upload Partitura */}
          <div className="space-y-2">
            <Label>Partitura (PDF)</Label>
            <label
              className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-input p-4 transition-colors hover:border-primary hover:bg-accent/50"
            >
              <Upload className="h-5 w-5 shrink-0 text-muted-foreground" />
              <span className="truncate text-sm text-muted-foreground">
                {partituraFile ? partituraFile.name : "Clique para selecionar o PDF da partitura"}
              </span>
              <input
                ref={partituraInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => handleFileChange(e, setPartituraFile)}
              />
            </label>
          </div>

          {/* Submit */}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="animate-spin" />
                Salvando...
              </>
            ) : (
              "Cadastrar Música"
            )}
          </Button>
        </form>
      </div>
    </main>
  );
}
