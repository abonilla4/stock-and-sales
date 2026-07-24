"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("Service Worker registrado con éxito en scope:", reg.scope);
        })
        .catch((err) => {
          console.error("Error al registrar Service Worker:", err);
        });
    }
  }, []);

  return null;
}
