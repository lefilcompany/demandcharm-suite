import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!;

    // 1. Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('Missing or invalid Authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - missing authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // 2. Create authenticated client to verify user
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !user) {
      console.error('Auth error:', authError?.message || 'No user found');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Authenticated user: ${user.id}`);

    const { contractId, originalContent } = await req.json();

    if (!contractId || !originalContent) {
      console.error('Missing required fields:', { contractId, hasContent: !!originalContent });
      return new Response(
        JSON.stringify({ error: 'contractId e originalContent são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Use service role client to get contract and verify access
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get contract to find team_id
    const { data: contract, error: contractError } = await supabaseAdmin
      .from('contracts')
      .select('team_id')
      .eq('id', contractId)
      .single();

    if (contractError || !contract) {
      console.error('Contract not found:', contractError?.message);
      return new Response(
        JSON.stringify({ error: 'Contract not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Check if user is admin/moderator of the team
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('team_members')
      .select('role')
      .eq('team_id', contract.team_id)
      .eq('user_id', user.id)
      .in('role', ['admin', 'moderator'])
      .maybeSingle();

    if (membershipError) {
      console.error('Membership check error:', membershipError.message);
      return new Response(
        JSON.stringify({ error: 'Failed to verify permissions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!membership) {
      console.error(`User ${user.id} does not have admin/moderator access to team ${contract.team_id}`);
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions - admin or moderator role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`User ${user.id} authorized as ${membership.role} for team ${contract.team_id}`);
    console.log(`Processing contract ${contractId}, content length: ${originalContent.length}`);

    // Update status to processing
    await supabaseAdmin
      .from('contracts')
      .update({ status: 'processing', original_content: originalContent })
      .eq('id', contractId);

    // Call Google Gemini to process the contract
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
    
    const aiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{
              text: `Você é um especialista em análise e reescrita de contratos. Sua tarefa é:
1. Analisar o contrato fornecido
2. Reescrever de forma clara, organizada e profissional
3. Manter todos os termos e condições originais
4. Estruturar com seções claras e numeradas
5. Adicionar formatação markdown para melhor legibilidade
6. Destacar pontos importantes com negrito
7. Corrigir erros gramaticais se houver

Responda APENAS com o contrato reescrito, sem comentários adicionais.

Por favor, analise e reescreva o seguinte contrato:\n\n${originalContent}`
            }]
          }
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 4000,
        },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      
      // Update status to error
      await supabaseAdmin
        .from('contracts')
        .update({ status: 'error' })
        .eq('id', contractId);
        
      throw new Error(`Erro na API de IA: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const processedContent = aiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

    console.log(`Contract processed successfully, result length: ${processedContent.length}`);

    // Update contract with processed content
    const { error: updateError } = await supabaseAdmin
      .from('contracts')
      .update({ 
        processed_content: processedContent, 
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', contractId);

    if (updateError) {
      console.error('Error updating contract:', updateError);
      throw updateError;
    }

    return new Response(
      JSON.stringify({ success: true, processedContent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error processing contract:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao processar contrato';
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
