"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import type { User } from "@supabase/supabase-js";

type Perfil = {
  id: string;
  nome: string | null;
  email: string | null;
  role: "admin" | "editor" | "leitor";
  ativo: boolean;
};

type AuthContextType = {
  user: User | null;
  perfil: Perfil | null;
  loading: boolean;
  isAdmin: boolean;
  isEditor: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  perfil: null,
  loading: true,
  isAdmin: false,
  isEditor: false,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createSupabaseBrowser();
  const router = useRouter();

  async function fetchPerfil(userId: string) {
    const { data } = await supabase
      .from("perfis")
      .select("id, nome, email, role, ativo")
      .eq("id", userId)
      .single();

    setPerfil(data as Perfil | null);
    setLoading(false);
  }

  useEffect(() => {
    // Carrega sessão atual
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchPerfil(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Escuta mudanças de auth
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchPerfil(session.user.id);
      } else {
        setPerfil(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setPerfil(null);
    router.push("/login");
  }

  const isAdmin = perfil?.role === "admin";
  const isEditor = perfil?.role === "editor" || isAdmin;

  return (
    <AuthContext.Provider value={{ user, perfil, loading, isAdmin, isEditor, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
