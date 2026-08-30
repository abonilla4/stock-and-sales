---
paths:
  - "app/**/*.tsx"
  - "components/**/*.tsx"
  - "app/**/*.css"
---

# Interfaz

## Antes de escribir

Lee `.agents/Docs/04-UIUX-Brief.md`. Para pantallas que forman parte de un flujo
(venta, presupuesto, cobro), lee también `.agents/Docs/03-Flujo-App.md`: la
pantalla aislada casi nunca es la unidad correcta de decisión.

## Identidad de cliente

Ningún dato de un cliente concreto se escribe en un componente. Nombre, logo,
RIF, dirección, teléfono y colores salen de las variables `NEXT_PUBLIC_NEGOCIO_*`,
con valores por defecto neutros cuando la variable no está definida.

Antes de dar por terminada una pantalla que muestre identidad del negocio,
verifica que se vea correcta **sin ninguna** variable definida. Si aparece el
nombre de un cliente real, es un defecto que se filtrará a los demás despliegues.

## Condiciones de operación reales

El contexto de uso es un mostrador en Venezuela: conexión intermitente,
hardware modesto, y a menudo un solo operador con prisa.

- Ningún control destructivo o irreversible sin confirmación explícita.
- Todo estado de carga y de error debe ser visible; una acción que parece no
  hacer nada provoca que el cajero la repita, y una venta duplicada es dinero
  real.
- La UI puede ocultar un control por rol, pero eso **no es** control de acceso.
  La autorización se valida siempre en el servidor. No trates un botón oculto
  como una restricción.
- El stock negativo es un estado válido y esperado tras una autorización. Las
  vistas, reportes y el dashboard deben renderizarlo sin romperse ni tratarlo
  como error.

## Precios

La interfaz muestra precios; no los decide. Todo importe que llegue a
persistirse se recalcula en el servidor. Un precio editado en el cliente es una
entrada no confiable.
