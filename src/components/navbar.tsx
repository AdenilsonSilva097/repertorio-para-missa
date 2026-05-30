"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Music, BookOpen, Pencil, FolderOpen, Shield,
  Menu, X, LogOut, ChevronDown, Sun, Moon,
} from "lucide-react";
import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { useTheme } from "next-themes";

type NavLink = {
  href: string;
  label: string;
  mobileLabel?: string;
  icon: typeof BookOpen;
  minRole: "leitor" | "editor" | "admin";
  group?: "musicas" | "main";
};

const allLinks: NavLink[] = [
  { href: "/", label: "Repertório", icon: BookOpen, minRole: "leitor", group: "main" },
  { href: "/cadastro/musica", label: "Cadastrar", mobileLabel: "Cadastrar Música", icon: Music, minRole: "editor", group: "musicas" },
  { href: "/musicas", label: "Editar", mobileLabel: "Editar Músicas", icon: Pencil, minRole: "editor", group: "musicas" },
  { href: "/repertorios", label: "Repertórios Salvos", icon: FolderOpen, minRole: "leitor", group: "main" },
  { href: "/admin/usuarios", label: "Usuários", icon: Shield, minRole: "admin" },
];

const ROLE_LEVEL: Record<string, number> = { leitor: 1, editor: 2, admin: 3 };

function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    function listener(e: MouseEvent) {
      if (!ref.current || ref.current.contains(e.target as Node)) return;
      handler();
    }
    document.addEventListener("mousedown", listener);
    return () => document.removeEventListener("mousedown", listener);
  }, [ref, handler]);
}

export function Navbar() {
  const pathname = usePathname();
  const { perfil, signOut, loading } = useAuth();
  const { theme, setTheme } = useTheme();

  function toggleTheme() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [musicasOpen, setMusicasOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const musicasRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useClickOutside(musicasRef, () => setMusicasOpen(false));
  useClickOutside(userMenuRef, () => setUserMenuOpen(false));

  const openMenu = useCallback(() => {
    setVisible(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setAnimating(true));
    });
  }, []);

  const closeMenu = useCallback(() => {
    setAnimating(false);
    setTimeout(() => setVisible(false), 300);
  }, []);

  function handleToggle() {
    if (visible) closeMenu();
    else openMenu();
  }

  const userRole = perfil?.role ?? "leitor";
  const userLevel = ROLE_LEVEL[userRole] ?? 1;

  const links = useMemo(
    () => allLinks.filter((l) => userLevel >= ROLE_LEVEL[l.minRole]),
    [userLevel]
  );

  const mainLinks = links.filter((l) => l.group === "main");
  const musicasLinks = links.filter((l) => l.group === "musicas");
  const userLinks = links.filter((l) => !l.group);
  const musicasActive = musicasLinks.some((l) => pathname === l.href);
  const userInitial = (perfil?.nome?.[0] ?? perfil?.email?.[0] ?? "U").toUpperCase();

  if (pathname === "/login" || loading) return null;

  return (
    <>
    <nav className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="flex h-14 items-center justify-between">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            🎵 Repertório para Missa
          </Link>

          {/* ─── Desktop ─── */}
          <div className="hidden sm:flex sm:items-center sm:gap-1">
            {mainLinks.map((link) => {
              const Icon = link.icon;
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}

            {/* Dropdown Músicas */}
            {musicasLinks.length > 0 && (
              <div ref={musicasRef} className="relative">
                <button
                  onClick={() => setMusicasOpen((v) => !v)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    musicasActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  <Music className="h-4 w-4" />
                  Músicas
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${musicasOpen ? "rotate-180" : ""}`} />
                </button>
                {musicasOpen && (
                  <div className="absolute right-0 mt-1 w-44 rounded-md border bg-popover py-1 shadow-md z-50">
                    {musicasLinks.map((link) => {
                      const Icon = link.icon;
                      const active = pathname === link.href;
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setMusicasOpen(false)}
                          className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                            active
                              ? "bg-accent font-medium text-accent-foreground"
                              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          {link.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Dropdown Usuário */}
            <div className="ml-2 border-l pl-2">
              <div ref={userMenuRef} className="relative">
                <button
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  title={perfil?.email ?? "Menu do usuário"}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {userInitial}
                  </span>
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${userMenuOpen ? "rotate-180" : ""}`} />
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 mt-1 w-52 rounded-md border bg-popover shadow-md z-50">
                    <div className="border-b px-3 py-2">
                      <p className="text-sm font-medium truncate">{perfil?.nome || "Usuário"}</p>
                      <p className="text-xs text-muted-foreground truncate">{perfil?.email}</p>
                    </div>
                    {userLinks.length > 0 && (
                      <div className="py-1">
                        {userLinks.map((link) => {
                          const Icon = link.icon;
                          return (
                            <Link
                              key={link.href}
                              href={link.href}
                              onClick={() => setUserMenuOpen(false)}
                              className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                                pathname === link.href
                                  ? "bg-accent font-medium text-accent-foreground"
                                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                              }`}
                            >
                              <Icon className="h-4 w-4" />
                              {link.label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                    <div className="border-t py-1">
                      <button
                        onClick={toggleTheme}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        <Moon className="h-4 w-4 dark:hidden" />
                        <Sun className="hidden h-4 w-4 dark:block" />
                        <span className="dark:hidden">Tema escuro</span>
                        <span className="hidden dark:block">Tema claro</span>
                      </button>
                      <button
                        onClick={() => { setUserMenuOpen(false); signOut(); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        <LogOut className="h-4 w-4" />
                        Sair
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ─── Mobile toggle ─── */}
          <button
            className="sm:hidden rounded-md p-2 text-muted-foreground hover:bg-accent"
            onClick={handleToggle}
            aria-label="Abrir menu"
          >
            {visible ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </nav>

      {/* ─── Mobile menu ─── */}
        {visible && (
          <>
            <div
              className={`sm:hidden fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${
                animating ? "opacity-100" : "opacity-0"
              }`}
              onClick={closeMenu}
            />
            <div
              className={`sm:hidden fixed inset-y-0 right-0 z-50 w-64 bg-background shadow-lg border-l flex flex-col transition-transform duration-300 ease-in-out ${
                animating ? "translate-x-0" : "translate-x-full"
              }`}
            >
              <div className="flex h-14 items-center justify-between px-4 border-b">
                <div>
                  <span className="text-sm font-semibold">{perfil?.nome || "Menu"}</span>
                  {perfil?.email && (
                    <p className="text-xs text-muted-foreground truncate">{perfil.email}</p>
                  )}
                </div>
                <button
                  className="rounded-md p-2 text-muted-foreground hover:bg-accent"
                  onClick={closeMenu}
                  aria-label="Fechar menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-1">
                {links.map((link) => {
                  const Icon = link.icon;
                  const active = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => closeMenu()}
                      className={`flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium transition-colors ${
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {link.mobileLabel || link.label}
                    </Link>
                  );
                })}
              </div>
              <div className="border-t p-3 space-y-1">
                <button
                  onClick={toggleTheme}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Moon className="h-4 w-4 dark:hidden" />
                  <Sun className="hidden h-4 w-4 dark:block" />
                  <span className="dark:hidden">Tema escuro</span>
                  <span className="hidden dark:block">Tema claro</span>
                </button>
                <button
                  onClick={() => { closeMenu(); signOut(); }}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <LogOut className="h-4 w-4" />
                  Sair
                </button>
              </div>
            </div>
          </>
        )}
    </>
  );
}
