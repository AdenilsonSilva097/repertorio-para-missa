"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, Loader2, UserX, UserCheck } from "lucide-react";
import { useRouter } from "next/navigation";

type PerfilUsuario = {
  id: string;
  nome: string | null;
  email: string | null;
  role: string;
  ativo: boolean;
  created_at: string;
};

export default function AdminUsuariosPage() {
  const { isAdmin, loading: authLoading, perfil } = useAuth();
  const [usuarios, setUsuarios] = useState<PerfilUsuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [mensagem, setMensagem] = useState<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);
  const supabase = createSupabaseBrowser();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.replace("/");
    }
  }, [authLoading, isAdmin, router]);

  useEffect(() => {
    if (isAdmin) fetchUsuarios();
  }, [isAdmin]);

  async function fetchUsuarios() {
    setLoading(true);
    const { data } = await supabase
      .from("perfis")
      .select("id, nome, email, role, ativo, created_at")
      .order("created_at", { ascending: true });

    if (data) setUsuarios(data);
    setLoading(false);
  }

  async function handleChangeRole(userId: string, newRole: string) {
    setMensagem(null);
    const { error } = await supabase
      .from("perfis")
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq("id", userId);

    if (error) {
      setMensagem({ tipo: "erro", texto: `Erro: ${error.message}` });
    } else {
      setMensagem({ tipo: "sucesso", texto: "Permissão atualizada." });
      fetchUsuarios();
    }
  }

  async function handleToggleAtivo(usuario: PerfilUsuario) {
    setMensagem(null);
    const { error } = await supabase
      .from("perfis")
      .update({ ativo: !usuario.ativo, updated_at: new Date().toISOString() })
      .eq("id", usuario.id);

    if (error) {
      setMensagem({ tipo: "erro", texto: `Erro: ${error.message}` });
    } else {
      setMensagem({ tipo: "sucesso", texto: `Usuário ${usuario.ativo ? "desativado" : "ativado"}.` });
      fetchUsuarios();
    }
  }

  if (authLoading || (!isAdmin && !authLoading)) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Gerenciar Usuários</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Controle permissões e status dos usuários
        </p>
      </div>

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

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-3">
          {usuarios.map((u) => (
            <div
              key={u.id}
              className={`rounded-lg border bg-card p-4 ${!u.ativo ? "opacity-60" : ""}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium">
                    {u.nome || "Sem nome"}
                    {u.id === perfil?.id && (
                      <span className="ml-2 text-xs text-muted-foreground">(você)</span>
                    )}
                  </h3>
                  <p className="text-sm text-muted-foreground">{u.email}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Cadastrado em {new Date(u.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={u.role}
                    onValueChange={(v) => handleChangeRole(u.id, v)}
                    disabled={u.id === perfil?.id}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="leitor">Leitor</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleAtivo(u)}
                    disabled={u.id === perfil?.id}
                    title={u.ativo ? "Desativar usuário" : "Ativar usuário"}
                    className={u.ativo ? "text-destructive hover:text-destructive" : "text-green-600 hover:text-green-600"}
                  >
                    {u.ativo ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
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
