import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { configuracoesSchema } from '@/lib/validation';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('configuracoes_loja')
    .select('*')
    .eq('usuario_id', user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }

  // Fallback para contas antigas que ainda não têm linha de configuração
  return NextResponse.json({
    configuracao: data ?? {
      usuario_id: user.id,
      nome_loja: null,
      percentual_bonus: 20,
      dias_validade_bonus: 60,
      dias_gatilho_retorno: 365,
    },
  });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const parsed = configuracoesSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ erro: 'Dados inválidos', detalhes: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('configuracoes_loja')
    .upsert({ usuario_id: user.id, ...parsed.data, atualizado_em: new Date().toISOString() })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }

  return NextResponse.json({ configuracao: data });
}
