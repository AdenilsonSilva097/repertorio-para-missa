import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // Atrás de um proxy (Vercel/Netlify/etc.) o `origin` derivado de
  // `request.url` pode vir com protocolo rebaixado (http) ou host interno.
  // Reconstruímos a URL pública a partir dos headers encaminhados para
  // evitar redirecionar o navegador para um destino inacessível (ERR_FAILED).
  const isLocalEnv = process.env.NODE_ENV === "development";
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const baseUrl =
    !isLocalEnv && forwardedHost
      ? `${forwardedProto ?? "https"}://${forwardedHost}`
      : origin;

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(baseUrl);
    }
  }

  return NextResponse.redirect(`${baseUrl}/login`);
}
