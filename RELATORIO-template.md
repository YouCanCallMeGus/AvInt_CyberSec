# Relatório — Detecção e Bloqueio de Rastreadores (Firefox)

**Aluno:** João Eduardo Luisi
**Disciplina:** Cibersegurança — Avaliação Intermediária (Insper)
**Repositório:** _<link do repositório aqui>_
**Data:** _<data>_

> Exporte este arquivo para PDF ao final (o PDF é o formato de entrega dos entregáveis 2, 3 e 4). Anexe HAR e prints em `evidencias/`.

---

## 1. Resumo da ferramenta

_2–3 parágrafos: o que a extensão faz, arquitetura em uma frase, decisões (MV2, sonda síncrona, PSL). Resuma a partir do README._

---

## 2. Entregável 2 — DuckDuckGo Privacy Test Pages

Para cada linha, anexe o print do popup em execução na página (pasta `evidencias/ddg/`).

| Teste executado | Resultado esperado (pela página) | Resultado do plugin | Divergência e explicação (com referência ao tráfego/HAR) | Print |
|---|---|---|---|---|
| Tracker Reporting |  |  |  | ddg/tracker-reporting.png |
| Storage blocking |  |  |  | ddg/storage-blocking.png |
| Fingerprinting / Canvas |  |  |  | ddg/canvas.png |
| Tracker Blocking |  |  |  | ddg/tracker-blocking.png |
| Storage partitioning |  |  |  | ddg/storage-partitioning.png |
| Bounce tracking |  |  |  | ddg/bounce.png |
| Query parameters (cookie sync) |  |  |  | ddg/query-params.png |
| JS leaks (hijacking) |  |  |  | ddg/js-leaks.png |

**Comentário geral sobre as divergências:** _explique padrões (ex.: detecção comportamental x reportada), citando a evidência._

---

## 3. Entregável 3 — Análise de 3 sites reais

Sites sorteados por matrícula: **_site1_**, **_site2_**, **_site3_**.

### 3.1 <site1>

- HAR: `evidencias/site1/site1.har`
- Blacklight: `evidencias/site1/blacklight.pdf`
- uBlock Origin: `evidencias/site1/ublock.png`
- Print do popup: `evidencias/site1/plugin.png`

**Detecção do plugin (resumo):** domínios de 3ª parte = _N_ (_M_ rastreadores); cookies 1ª/3ª = _.../..._; storage = _...; sinalizadores = _..._.

**Tabela de reconciliação:**

| Rastreador / domínio | Blacklight | uBlock | Plugin | Explicação técnica (entrada do HAR) |
|---|---|---|---|---|
|  | sim/não | sim/não | sim/não |  |

_(repita a subseção 3.1 para site2 e site3)_

---

## 4. Entregável 4 — Pontuação de privacidade

| Site | Score do plugin | Nota | Principais deduções | Blacklight (síntese) | Concordância / divergência |
|---|---|---|---|---|---|
| site1 |  |  |  |  |  |
| site2 |  |  |  |  |  |
| site3 |  |  |  |  |  |

**Metodologia:** ver `docs/METODOLOGIA-SCORE.md` (critérios, pesos, justificativa e mapeamento para o Blacklight). _Cole aqui a tabela de pesos ou referencie o anexo._

**Comparação crítica com o Blacklight:** _onde concordam, onde divergem e por quê — pelo menos um exemplo concreto por site, com evidência._

---

## 5. Conclusão

_O que a ferramenta captura bem, onde as heurísticas falham, e como você validou os resultados. Limitações e trabalhos futuros (PSL completa, EasyPrivacy, MV3)._
