import type { PromptArticle } from './store.ts';

export const SYSTEM_PROMPT = `Você é o editor-chefe de um boletim financeiro brasileiro premium. Seu trabalho é transformar uma pilha de manchetes em um editorial INVESTIGATIVO e EXPLICATIVO — não um agregador.

REGRAS:
- Responda APENAS com JSON válido, sem markdown, sem texto antes ou depois.
- O LEAD deve conectar o tema dominante do período em 3-5 frases (manchete + abertura).
- Cada SEÇÃO deve EXPLICAR o que está acontecendo na categoria, não só listar — busque relações causais entre manchetes (ex: "queda do petróleo pressiona PETR4 e arrasta PRIO3"), contexto macro, leitura de mercado.
- Use português brasileiro formal-jornalístico, evite jargão raso, evite generalidades vazias ("o mercado se moveu").
- Cite tickers concretos quando relevante.
- Use sourceArticleIds para fundamentar cada seção (mínimo 1, máximo 4 ids por seção, escolhidos da lista fornecida).
- NUNCA invente fatos: baseie-se SÓ nas manchetes fornecidas.
- Se uma categoria tiver poucas/nenhuma notícia, omita-a (não force seção vazia).`;

const MAX_ARTICLES_PER_CATEGORY = 12;

export function buildEditorialPrompt(articles: PromptArticle[], periodLabel: string): string {
  const byCategory = new Map<string, PromptArticle[]>();
  for (const a of articles) {
    const cat = a.category ?? 'outros';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(a);
  }

  const lines: string[] = [
    `=== EDIÇÃO: ${periodLabel} ===`,
    `Total de manchetes no período: ${articles.length}`,
    '',
  ];

  for (const [cat, list] of byCategory) {
    lines.push(`### Categoria: ${cat} (${list.length} notícias)`);
    list.slice(0, MAX_ARTICLES_PER_CATEGORY).forEach(a => {
      const tickers = a.tickers.length > 0 ? ` [${a.tickers.join(', ')}]` : '';
      const src = a.source ?? 'fonte desconhecida';
      lines.push(`- (id=${a.id}) ${a.title} — ${src}${tickers}`);
    });
    lines.push('');
  }

  lines.push('=== FORMATO DE RESPOSTA OBRIGATÓRIO ===');
  lines.push(`{
  "leadTitle": "<manchete síntese, máximo 90 caracteres>",
  "leadBody": "<3-5 frases conectando o tema dominante do período>",
  "sections": [
    {
      "category": "financeiro" | "commodities" | "varejo" | "energia" | "saneamento" | "tecnologia" | "saude",
      "title": "<título da seção, máximo 70 caracteres>",
      "body": "<2-4 frases investigativas/explicativas>",
      "highlightTickers": ["TICK1", "TICK2"],
      "sourceArticleIds": [<id1>, <id2>]
    }
  ]
}`);

  return lines.join('\n');
}
