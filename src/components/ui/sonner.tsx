"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          // richColors mapeado a los tokens del sistema (no usar la paleta default de sonner).
          // OJO: para border se referencia el alias --color-* — var(--success-border) sería
          // autorreferencia cíclica (mismo nombre que la var de sonner) → invalid at computed-value time.
          "--success-bg": "var(--success-subtle)",
          "--success-border": "var(--color-success-border)",
          "--success-text": "var(--success)",
          "--warning-bg": "var(--warning-subtle)",
          "--warning-border": "var(--color-warning-border)",
          "--warning-text": "var(--warning)",
          // El sistema no define destructive-subtle: se deriva del token vía color-mix (mismo hue, sin colores nuevos)
          "--error-bg": "color-mix(in oklch, var(--destructive) 8%, var(--background))",
          "--error-border": "color-mix(in oklch, var(--destructive) 30%, var(--background))",
          "--error-text": "var(--destructive)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
