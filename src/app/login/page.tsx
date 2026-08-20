"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock, Mail, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { loginAction } from "./actions";
import { createClient } from "@/lib/supabase/client";
import { NEGOCIO_CONFIG } from "@/lib/config/negocio";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // 1. Intentar autenticación primero en cliente
      const supabase = createClient();
      const { error: clientAuthError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (clientAuthError) {
        // Fallback a Server Action en caso de restricciones de cliente
        const formData = new FormData();
        formData.append("email", email);
        formData.append("password", password);
        const serverResult = await loginAction(formData);

        if (serverResult?.error) {
          setError(serverResult.error);
          setLoading(false);
          return;
        }
      }

      // 2. Redirección completa garantizada para red local (IP) y localhost
      window.location.href = "/dashboard";
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error inesperado al iniciar sesión";
      setError(msg);
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-sm border-border shadow-lg">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center">
            {NEGOCIO_CONFIG.logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={NEGOCIO_CONFIG.logoUrl}
                alt={NEGOCIO_CONFIG.nombre}
                className="h-12 max-w-[180px] object-contain"
              />
            ) : (
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary shadow-sm">
                <Package className="size-6 text-primary-foreground" />
              </div>
            )}
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold tracking-tight">
              {NEGOCIO_CONFIG.nombre}
            </CardTitle>
            <CardDescription>
              {NEGOCIO_CONFIG.subtitulo || "Ingresa con tu cuenta para continuar"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                  className="pl-9"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="pl-9 pr-10"
                />
                <button
                  type="button"
                  aria-label="Mantén presionado para ver la contraseña"
                  title="Mantén presionado para ver la contraseña"
                  onMouseDown={() => setShowPassword(true)}
                  onMouseUp={() => setShowPassword(false)}
                  onMouseLeave={() => setShowPassword(false)}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    setShowPassword(true);
                  }}
                  onTouchEnd={() => setShowPassword(false)}
                  onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") {
                      e.preventDefault();
                      setShowPassword(true);
                    }
                  }}
                  onKeyUp={(e) => {
                    if (e.key === " " || e.key === "Enter") {
                      setShowPassword(false);
                    }
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none transition-colors select-none p-1 rounded-md"
                >
                  {showPassword ? (
                    <EyeOff className="size-4 text-primary animate-pulse" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-destructive font-medium text-center bg-destructive/10 p-2 rounded-md" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full mt-2 font-semibold" disabled={loading}>
              {loading ? "Iniciando sesión..." : "Ingresar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
