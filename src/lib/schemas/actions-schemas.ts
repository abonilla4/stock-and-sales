import { z } from "zod";
import { esUnidadEntera } from "@/lib/precision";

export function getZodErrorMessage(error: z.ZodError): string {
  return error.issues[0]?.message || "Datos de formulario inválidos.";
}

// 1. Schema para Venta POS (confirmarVentaPOS)
export const itemVentaSchema = z.object({
  producto_id: z.string().uuid("ID de producto inválido"),
  cantidad: z.number().positive("La cantidad debe ser mayor a 0"),
  precio_unitario_usd: z.number().min(0, "El precio unitario no puede ser negativo"),
  subtotal_usd: z.number().min(0, "El subtotal no puede ser negativo"),
});

export const confirmarVentaSchema = z.object({
  cliente_id: z.string().uuid("ID de cliente inválido").nullable().optional(),
  subtotal_usd: z.number().min(0, "El subtotal no puede ser negativo"),
  descuento_usd: z.number().min(0, "El descuento no puede ser negativo"),
  total_usd: z.number().min(0, "El total no puede ser negativo"),
  tasa_cambio_aplicada: z.number().positive("La tasa de cambio debe ser mayor a 0"),
  total_bs: z.number().min(0, "El total en Bolívares no puede ser negativo"),
  metodo_pago: z.enum([
    "efectivo_usd",
    "efectivo_bs",
    "pago_movil",
    "transferencia",
    "tarjeta",
    "fiado",
  ], { message: "Método de pago inválido" }),
  items: z.array(itemVentaSchema).min(1, "El carrito de venta no contiene ningún producto"),
  permitir_stock_negativo: z.boolean().optional(),
  client_tx_id: z.string().nullable().optional(),
  autorizado_por: z.string().uuid("ID de administrador autorizador inválido").nullable().optional(),
  origen_autorizacion: z.enum(["admin_online", "offline_diferido"]).nullable().optional(),
  presupuesto_id: z.string().uuid("ID de presupuesto inválido").nullable().optional(),
});

// 1.1 Schema para Presupuestos (crearPresupuesto)
export const itemPresupuestoSchema = z.object({
  producto_id: z.string().uuid("ID de producto inválido"),
  cantidad: z.number().positive("La cantidad debe ser mayor a 0"),
});

export const crearPresupuestoSchema = z.object({
  cliente_id: z.string().uuid("ID de cliente inválido").nullable().optional(),
  descuento_usd: z.number().min(0, "El descuento no puede ser negativo").default(0),
  moneda_mostrada: z.enum(["usd", "bs"], { message: "Moneda inválida" }).default("usd"),
  notas: z.string().trim().nullable().optional(),
  items: z.array(itemPresupuestoSchema).min(1, "El presupuesto debe incluir al menos un producto"),
});

// 2. Schema para Crear Producto (crearProducto)
export const crearProductoSchema = z.object({
  sku: z.string().trim().min(1, "El SKU es obligatorio"),
  codigo_barras: z.string().trim().nullable().optional(),
  nombre: z.string().trim().min(1, "El nombre del producto es obligatorio"),
  descripcion: z.string().trim().nullable().optional(),
  categoria_id: z.string().uuid("Categoría seleccionada inválida"),
  proveedor_id: z.string().uuid("Proveedor seleccionado inválido").nullable().optional(),
  unidad_medida: z.enum(["unidad", "caja", "metro", "kilo", "litro", "par"], {
    message: "Unidad de medida inválida",
  }),
  precio_costo_usd: z.number().min(0, "El precio de costo debe ser mayor o igual a $0.00"),
  precio_venta_usd: z.number().min(0, "El precio de venta debe ser mayor o igual a $0.00"),
  stock_actual: z.number().default(0),
  stock_minimo: z.number().min(0, "El stock mínimo no puede ser negativo").default(5),
  activo: z.boolean().default(true),
}).superRefine((data, ctx) => {
  if (esUnidadEntera(data.unidad_medida)) {
    if (!Number.isInteger(data.stock_actual)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Para la unidad de medida seleccionada, el stock inicial debe ser un número entero (sin decimales).",
        path: ["stock_actual"],
      });
    }
    if (!Number.isInteger(data.stock_minimo)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Para la unidad de medida seleccionada, el stock mínimo debe ser un número entero (sin decimales).",
        path: ["stock_minimo"],
      });
    }
  }
});

// 2.1 Schema para Actualizar Producto (actualizarProducto)
export const actualizarProductoSchema = z.object({
  sku: z.string().trim().min(1, "El SKU es obligatorio"),
  codigo_barras: z.string().trim().nullable().optional(),
  nombre: z.string().trim().min(1, "El nombre del producto es obligatorio"),
  descripcion: z.string().trim().nullable().optional(),
  categoria_id: z.string().uuid("Categoría seleccionada inválida"),
  proveedor_id: z.string().uuid("Proveedor seleccionado inválido").nullable().optional(),
  unidad_medida: z.enum(["unidad", "caja", "metro", "kilo", "litro", "par"], {
    message: "Unidad de medida inválida",
  }),
  precio_costo_usd: z.number().min(0, "El precio de costo debe ser mayor o igual a $0.00"),
  precio_venta_usd: z.number().min(0, "El precio de venta debe ser mayor o igual a $0.00"),
  stock_minimo: z.number().min(0, "El stock mínimo no puede ser negativo").default(5),
}).superRefine((data, ctx) => {
  if (esUnidadEntera(data.unidad_medida)) {
    if (!Number.isInteger(data.stock_minimo)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Para la unidad de medida seleccionada, el stock mínimo debe ser un número entero (sin decimales).",
        path: ["stock_minimo"],
      });
    }
  }
});

// 3. Schema para Movimiento de Inventario (registrarMovimiento)
export const registrarMovimientoSchema = z.object({
  producto_id: z.string().uuid("ID de producto inválido"),
  tipo: z.enum(["entrada", "salida", "ajuste", "venta"], {
    message: "Tipo de movimiento inválido",
  }),
  cantidad: z.number().positive("La cantidad debe ser mayor a cero"),
  motivo: z.string().trim().nullable().optional(),
  proveedor_id: z.string().uuid("ID de proveedor inválido").nullable().optional(),
}).refine(
  (data) => {
    if ((data.tipo === "salida" || data.tipo === "ajuste") && (!data.motivo || data.motivo.trim() === "")) {
      return false;
    }
    return true;
  },
  {
    message: "El motivo es obligatorio para salidas y ajustes.",
    path: ["motivo"],
  }
);

// 4. Schema para Crear Proveedor (crearProveedor)
export const crearProveedorSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre del proveedor es obligatorio"),
  codigo: z.string().trim().nullable().optional(),
  telefono: z.string().trim().nullable().optional(),
  contacto: z.string().trim().nullable().optional(),
  notas: z.string().trim().nullable().optional(),
});

// 5. Schema para Crear Cliente (crearCliente)
export const crearClienteSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre del cliente es obligatorio"),
  identificacion: z.string().trim().nullable().optional(),
  telefono: z.string().trim().nullable().optional(),
  notas: z.string().trim().nullable().optional(),
});

// 6. Schema para Registrar Abono Cliente (registrarAbonoCliente)
export const registrarAbonoClienteSchema = z.object({
  cliente_id: z.string().uuid("ID de cliente inválido"),
  monto_usd: z.number().positive("El monto del abono debe ser mayor a $0.00 USD"),
  monto_bs: z.number().positive("El monto en Bolívares debe ser mayor a 0").nullable().optional(),
  metodo_pago: z.enum([
    "efectivo_usd",
    "efectivo_bs",
    "pago_movil",
    "transferencia",
    "tarjeta",
    "fiado",
  ], { message: "Método de pago inválido" }),
  venta_id: z.string().uuid("ID de venta inválido").nullable().optional(),
  notas: z.string().trim().nullable().optional(),
});

// 7. Schema para Login (loginAction)
export const loginSchema = z.object({
  email: z.string().trim().email("Ingresa un correo electrónico válido"),
  password: z.string().min(1, "La contraseña es obligatoria"),
});

// 8. Schema para configurar permisos por rol (configurarPermiso)
// Nota: valida la FORMA del payload, no la autorización. Quién puede otorgar
// qué permiso a qué rol lo decide el kernel de la RPC asignar_permiso
// (migración 00028), que rechaza aunque la petición se manipule.
export const configurarPermisoSchema = z.object({
  rol: z.enum(["desarrollador", "admin", "cajero"], {
    message: "Rol inválido",
  }),
  permiso_codigo: z
    .string()
    .trim()
    .min(1, "El código de permiso es obligatorio"),
  activo: z.boolean(),
});

// 9. Schema para revisar una autorización offline (revisarAutorizacionOffline)
// La autorización la valida la RPC revisar_autorizacion_offline vía
// tiene_permiso('ventas.autorizar_stock_negativo'); esto solo valida la forma.
//
// La exigencia de notas para 'irregular' refleja el CHECK
// notas_requeridas_si_irregular (migración 00030). Se valida aquí para que el
// usuario reciba un mensaje en el formulario y no un error crudo de constraint.
// La base sigue siendo la autoridad: esto es conveniencia, no la garantía.

/** Compartido entre el schema y el formulario para que no se desincronicen. */
export const MENSAJE_NOTAS_IRREGULAR =
  "Marcar una venta como irregular exige explicar por qué: las notas son obligatorias.";

export const revisarAutorizacionOfflineSchema = z
  .object({
    venta_id: z.string().uuid("ID de venta inválido"),
    resultado: z.enum(["confirmada", "irregular"], {
      message: "El resultado debe ser 'confirmada' o 'irregular'",
    }),
    notas: z.string().trim().max(1000, "Las notas no pueden exceder 1000 caracteres").nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.resultado === "irregular" && !data.notas) {
      ctx.addIssue({
        code: "custom",
        path: ["notas"],
        message: MENSAJE_NOTAS_IRREGULAR,
      });
    }
  });

// 10. Schemas para gestión de usuarios (Fase 3)
// El rol 'desarrollador' NO aparece en ningún enum de asignación: la RPC
// asignar_permiso lo rechaza (migración 00028) porque ese rol solo se otorga
// por SQL manual con acceso directo al proyecto. Es el ancla de confianza del
// modelo y no debe poder crearse desde la aplicación.
export const ROLES_ASIGNABLES = ["admin", "cajero"] as const;

/** Mínimo de Supabase Auth por defecto. Compartido con el formulario. */
export const MIN_LONGITUD_PASSWORD = 8;

export const crearUsuarioSchema = z.object({
  email: z.string().trim().toLowerCase().email("Ingresa un correo electrónico válido"),
  password: z
    .string()
    .min(MIN_LONGITUD_PASSWORD, `La contraseña debe tener al menos ${MIN_LONGITUD_PASSWORD} caracteres`),
  rol: z.enum(ROLES_ASIGNABLES, { message: "El rol debe ser 'admin' o 'cajero'" }),
});

export const cambiarRolUsuarioSchema = z.object({
  usuario_id: z.string().uuid("ID de usuario inválido"),
  rol: z.enum(ROLES_ASIGNABLES, { message: "El rol debe ser 'admin' o 'cajero'" }),
});

export const cambiarEstadoUsuarioSchema = z.object({
  usuario_id: z.string().uuid("ID de usuario inválido"),
  activo: z.boolean(),
});
