# Guia de Execução dos Entregáveis

Passo a passo para produzir os entregáveis 2, 3 e 4. **As evidências (prints e HAR) precisam ser geradas por você**, na sua máquina, com a extensão carregada — o código já faz a detecção, mas os artefatos de comprovação vêm da sua execução real. Um relatório sem HAR e sem prints não pontua (entregáveis 2 e 3), conforme o enunciado.

---

## Entregável 2 — DuckDuckGo Privacy Test Pages

Fonte: https://github.com/duckduckgo/privacy-test-pages (versão hospedada em https://privacy-test-pages.site/).

Para **cada** página abaixo:

1. Carregue a extensão (`about:debugging` → *Carregar extensão temporária* → `manifest.json`).
2. Abra a página de teste. A própria página reporta o **resultado esperado**.
3. Abra o popup da extensão e registre o **resultado do plugin**.
4. Tire um **print do popup em execução na página** (obrigatório por linha).
5. Preencha a tabela do `RELATORIO-template.md` e, em cada divergência, explique referenciando o tráfego (HAR) ou o que a página de teste reportou.

Páginas mínimas por conceito:

| Página de teste | Conceito | O que valida na extensão |
|---|---|---|
| Tracker Reporting | C | Domínios de 3ª parte listados |
| Storage blocking | C | Inventário localStorage/sessionStorage/IndexedDB |
| Fingerprinting / Canvas | C | Sinalizador "Canvas FP" |
| Tracker Blocking | B | Bloqueio ativado cancela requisições (contador "bloqueados") |
| Storage partitioning | B | Storage atribuído à 1ª/3ª parte |
| Bounce tracking | B | Sinalizador "Bounce" |
| Query parameters | B | Sinalizador "Cookie sync" |
| JS leaks (`js-leaks`) | A | Indicadores de hijacking/hook |

> Dica: mantenha o *bloqueio desligado* ao medir detecção e *ligado* ao validar o bloqueio, para não confundir os resultados.

---

## Entregável 3 — 3 sites reais

Sites sorteados por matrícula (lista do professor). Para cada site:

### a) Exportar o HAR

1. Abra o **DevTools** (F12) → aba **Rede** (*Network*).
2. Marque **Preservar log** e recarregue a página com o DevTools aberto.
3. Após o carregamento, clique com o botão direito na lista → **Salvar tudo como HAR** (*Save All As HAR*).
4. Salve em `evidencias/<site>/<site>.har`.

### b) Rodar o Blacklight

1. Acesse https://themarkup.org/blacklight e informe a URL do site.
2. Salve o resultado (print/PDF) em `evidencias/<site>/blacklight.pdf`.

### c) Rodar o uBlock Origin

1. Instale o uBlock Origin, abra o site e veja em **"O painel"** (ícone) a lista de domínios/requisições bloqueadas.
2. Print da tela do uBlock em `evidencias/<site>/ublock.png`.

### d) Reconciliação (obrigatória para B/A)

Para cada rastreador que **o Blacklight ou o uBlock identificaram e o plugin não** (ou vice-versa), escreva uma explicação técnica **referenciando o HAR**. Exemplos de causas legítimas de divergência:

- Rastreador em iframe de 3ª parte com storage particionado → aparece no HAR mas classificado por origem diferente.
- Requisição só disparada após interação/scroll → presente em uma execução e não na outra.
- uBlock bloqueia por regra de path/query que a lista embutida não cobre → o plugin vê como domínio de 3ª parte não-rastreador.
- Blacklight reporta por assinatura de script; o plugin por chamada em runtime.

Cada linha da tabela de reconciliação (no template) deve citar a **URL/entrada do HAR** correspondente. Divergências genéricas não são consideradas.

---

## Entregável 4 — Pontuação de privacidade

1. Aplique o score aos **3 sites** (o popup mostra o valor e a dedução linha a linha).
2. Descreva a metodologia (já em `METODOLOGIA-SCORE.md` — cite/anexe).
3. Compare criticamente com o Blacklight: onde concordam, onde divergem, por quê (ver seção de mapeamento na metodologia).

---

## Plano de commits incrementais (evita desconto por commit único)

O enunciado penaliza histórico concentrado no último dia. Sugestão de divisão ao longo da semana — faça commits **à medida que entende e adapta cada parte**:

1. `feat: esqueleto da WebExtension (manifest + popup vazio) carregando em about:debugging`
2. `feat: deteccao de dominios de 3a parte via webRequest + eTLD+1 (psl)`
3. `feat: contagem e classificacao de cookies via Set-Cookie`
4. `feat: inventario de storage HTML5 (content script)`
5. `feat: sonda de canvas fingerprint no mundo da pagina`
6. `feat: cookie sync e bounce tracking`
7. `feat: indicadores de hijacking/hook (websocket, polling, listeners)`
8. `feat: score de privacidade + interface do relatorio`
9. `feat: lista de bloqueio personalizada + bloqueio de rastreadores`
10. `docs: relatorio DDG + analise dos 3 sites + evidencias`

> **Importante (honestidade acadêmica):** este repositório é uma implementação de referência. Entenda cada trecho, adapte ao seu estilo e **rode os testes você mesmo** — os entregáveis 2–4 dependem de execução e análise reais, que são justamente o que a avaliação mede. Use o código como base de aprendizado, não como entrega cega.

---

## Migração para Manifest V3 (opcional, discussão)

Se quiser discutir/portar para MV3 no relatório: o Firefox mantém `webRequestBlocking` em MV3 (diferente do Chrome, que exige `declarativeNetRequest`). O principal ajuste é o *background* virar *event page* não-persistente, exigindo persistir `tabData` em `browser.storage.session`. A detecção via content script e a sonda permanecem idênticas.
