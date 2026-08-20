import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_NEGOCIO_LOGO_URL:
      process.env.NEXT_PUBLIC_NEGOCIO_LOGO_URL ||
      process.env.NEGOCIO_LOGO_URL ||
      "",
    NEXT_PUBLIC_NEGOCIO_NOMBRE:
      process.env.NEXT_PUBLIC_NEGOCIO_NOMBRE ||
      process.env.NEGOCIO_NOMBRE ||
      "",
    NEXT_PUBLIC_NEGOCIO_RIF:
      process.env.NEXT_PUBLIC_NEGOCIO_RIF ||
      process.env.NEGOCIO_RIF ||
      "",
    NEXT_PUBLIC_NEGOCIO_TELEFONO:
      process.env.NEXT_PUBLIC_NEGOCIO_TELEFONO ||
      process.env.NEGOCIO_TELEFONO ||
      "",
    NEXT_PUBLIC_NEGOCIO_DIRECCION:
      process.env.NEXT_PUBLIC_NEGOCIO_DIRECCION ||
      process.env.NEGOCIO_DIRECCION ||
      "",
    NEXT_PUBLIC_NEGOCIO_SUBTITULO:
      process.env.NEXT_PUBLIC_NEGOCIO_SUBTITULO ||
      process.env.NEGOCIO_SUBTITULO ||
      "",
  },
};

export default nextConfig;
