"use server";

import { createClient } from "@/lib/supabase/server";
import { loginSchema, getZodErrorMessage } from "@/lib/schemas/actions-schemas";

export async function loginAction(formData: FormData) {
  const rawData = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const parseResult = loginSchema.safeParse(rawData);
  if (!parseResult.success) {
    return { error: getZodErrorMessage(parseResult.error) };
  }

  const { email, password } = parseResult.data;

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (error.message === "Invalid login credentials") {
      return { error: "Credenciales inválidas. Verifica tu correo y contraseña." };
    }
    return { error: error.message };
  }

  return { success: true };
}
