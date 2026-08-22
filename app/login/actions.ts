'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function entrar(formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const senha = String(formData.get('senha') ?? '');

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });

  if (error) {
    redirect(`/login?erro=${encodeURIComponent(error.message)}`);
  }

  revalidatePath('/', 'layout');
  redirect('/');
}

export async function criarConta(formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const senha = String(formData.get('senha') ?? '');
  const nomeLoja = String(formData.get('nomeLoja') ?? '');

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password: senha,
    options: { data: { nome_loja: nomeLoja } },
  });

  if (error) {
    redirect(`/login?erro=${encodeURIComponent(error.message)}`);
  }

  redirect('/login?mensagem=Verifique+seu+e-mail+para+confirmar+o+cadastro');
}

export async function sair() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}

export async function esqueciSenha(formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/confirm?next=/reset-senha`,
  });

  if (error) {
    redirect(`/login?erro=${encodeURIComponent(error.message)}`);
  }

  redirect('/login?mensagem=Se+esse+e-mail+estiver+cadastrado,+enviamos+um+link+de+redefinição');
}

export async function redefinirSenha(formData: FormData) {
  const novaSenha = String(formData.get('senha') ?? '');

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: novaSenha });

  if (error) {
    redirect(`/reset-senha?erro=${encodeURIComponent(error.message)}`);
  }

  revalidatePath('/', 'layout');
  redirect('/');
}
