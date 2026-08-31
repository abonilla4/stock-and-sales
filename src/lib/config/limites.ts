/**
 * Configuración centralizada de límites del sistema.
 */
export const MAX_DESCUENTO_PORCENTAJE_SIN_AUTORIZACION = 5;

/** Filas por página en el panel de auditoría. */
export const AUDITORIA_FILAS_POR_PAGINA = 50;

/**
 * Tope de filas a inspeccionar para armar la lista de acciones del filtro de
 * auditoría. Evita traer la tabla completa a medida que crece.
 */
export const AUDITORIA_MAX_FILAS_MUESTRA_ACCIONES = 1000;
