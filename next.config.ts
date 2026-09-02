import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  logging: {
    // Next imprime los argumentos posicionales de cada Server Function tal
    // cual, sin noción de qué es sensible. autorizarVentaAdmin(email,
    // password, permisos) quedaba con la contraseña en texto plano en la
    // terminal de dev en cada intento de autorización delegada. No existe
    // filtrado selectivo por argumento — solo este interruptor global.
    // Según la doc de Next 16 esto es exclusivo del dev server y no corre en
    // production builds (next build / next start ni el runtime de Vercel).
    serverFunctions: false,
  },
};

export default nextConfig;
