import { crearClienteSchema, loginSchema, getZodErrorMessage } from "../src/lib/schemas/actions-schemas";

console.log("=== TEST 1: crearCliente CON NOMBRE VACÍO ('   ') ===");
const clienteRawData = { nombre: "   ", identificacion: null, telefono: null, notas: null };
const resCliente = crearClienteSchema.safeParse(clienteRawData);
if (!resCliente.success) {
  console.log("Resultado parseResult.success:", resCliente.success);
  console.log("Mensaje de error Zod retornado:", getZodErrorMessage(resCliente.error));
} else {
  console.log("Error inesperado: se aceptó", resCliente.data);
}

console.log("\n=== TEST 2: loginAction CON EMAIL MAL FORMADO ('no-es-un-email') ===");
const loginRawData = { email: "no-es-un-email", password: "123" };
const resLogin = loginSchema.safeParse(loginRawData);
if (!resLogin.success) {
  console.log("Resultado parseResult.success:", resLogin.success);
  console.log("Mensaje de error Zod retornado:", getZodErrorMessage(resLogin.error));
} else {
  console.log("Error inesperado: se aceptó", resLogin.data);
}
