import { z } from "zod";

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

// 2. Schema para Crear/Editar Producto (crearProducto)
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
