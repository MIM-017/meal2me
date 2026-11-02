"use server";
 
import { redirect } from "next/navigation";
import { checkLogin, ConflictError, getRequestDb, registerUser, ValidationError } from "@/lib/db";
import { endSession, safeNextPath, startSession } from "@/lib/auth";
 
export type AuthFormState = {
  error: string;
  // Typed values are sent back so a failed submit doesn't wipe the form.
  // The password never is.
  values: { email: string; username: string };
} | null;
 
const text = (formData: FormData, key: string) => formData.get(key)?.toString().trim() ?? "";
 
export async function logIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = text(formData, "email");
  const username = text(formData, "username");
  const password = formData.get("password")?.toString() ?? ""; // not trimmed: spaces count
  const values = { email, username };
 
  if (!email || !username || !password) {
    return { error: "Enter your email, username and password.", values };
  }
 
  const user = await checkLogin(await getRequestDb(), { email, username, password });
  if (!user) {
    // Deliberately vague: don't reveal which of the three was wrong.
    return { error: "That email, username and password don't match an account.", values };
  }
 
  await startSession(user.id);
  redirect(safeNextPath(formData.get("next"))); // outside any try/catch
}
 
export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = text(formData, "email");
  const username = text(formData, "username");
  const password = formData.get("password")?.toString() ?? "";
  const confirm = formData.get("confirmPassword")?.toString() ?? "";
  const values = { email, username };
 
  if (password !== confirm) return { error: "The two passwords don't match.", values };
 
  let userId: number;
  try {
    userId = (await registerUser(await getRequestDb(), { email, username, password })).id;
  } catch (err) {
    if (err instanceof ValidationError) {
      return { error: err.issues.map((i) => `${capitalize(i.field)} ${i.message}.`).join(" "), values };
    }
    if (err instanceof ConflictError) return { error: `${err.message}.`, values };
    throw err;
  }
 
  await startSession(userId);
  redirect(safeNextPath(formData.get("next")));
}
 
export async function logOut(): Promise<void> {
  await endSession();
  redirect("/");
}
 
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);