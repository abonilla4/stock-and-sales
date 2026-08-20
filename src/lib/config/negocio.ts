/**
 * Configuración centralizada de la identidad del negocio.
 * Se alimenta de variables de entorno NEXT_PUBLIC_NEGOCIO_* (o alias sin prefijo) con fallbacks neutros.
 */

export const NEGOCIO_CONFIG = {
  nombre:
    process.env.NEXT_PUBLIC_NEGOCIO_NOMBRE ||
    process.env.NEGOCIO_NOMBRE ||
    "⚠️ Negocio sin configurar",
  rif: process.env.NEXT_PUBLIC_NEGOCIO_RIF || process.env.NEGOCIO_RIF || "",
  telefono:
    process.env.NEXT_PUBLIC_NEGOCIO_TELEFONO ||
    process.env.NEGOCIO_TELEFONO ||
    "",
  direccion:
    process.env.NEXT_PUBLIC_NEGOCIO_DIRECCION ||
    process.env.NEGOCIO_DIRECCION ||
    "",
  subtitulo:
    process.env.NEXT_PUBLIC_NEGOCIO_SUBTITULO ||
    process.env.NEGOCIO_SUBTITULO ||
    "",
  logoUrl:
    process.env.NEXT_PUBLIC_NEGOCIO_LOGO_URL ||
    process.env.NEGOCIO_LOGO_URL ||
    "",
  sistemaVersion: "v1.0",
} as const;
