# Metodologia da Pontuação de Privacidade

Este documento descreve os **critérios, pesos e justificativa** do score, atendendo ao entregável 4 e ao Conceito A. A implementação está em `computeScore()` no `background.js`.

## Princípio

Cada página começa com **100 pontos** (privacidade máxima) e sofre deduções por evidência observada. O score final é limitado ao intervalo 0–100 e convertido em nota. Os pesos são maiores para técnicas **persistentes ou difíceis de evitar** (fingerprint, cookie sync, hijacking) do que para conexões de terceira parte isoladas, porque as primeiras derrotam as defesas usuais do usuário (limpar cookies, modo privativo).

## Critérios e pesos

| # | Critério | Peso | Teto | Justificativa |
|---|---|---|---|---|
| 1 | Rastreadores de 3ª parte conhecidos | −6 por domínio | −36 | Domínios na lista de rastreadores têm finalidade declarada de rastreio; é o sinal mais direto. |
| 2 | Outros domínios de 3ª parte | −1 por domínio | −10 | Toda 3ª parte amplia a superfície de exposição, mesmo sem ser rastreador conhecido. Peso baixo para não punir CDNs benignos. |
| 3 | Cookies de 3ª parte | −3 por cookie | −18 | Cookies de 3ª parte são o mecanismo clássico de rastreio entre sites. |
| 4 | Cookies **persistentes** de 3ª parte | −2 extra por cookie | −10 | Persistência permite reidentificação em visitas futuras — pior que cookies de sessão. |
| 5 | Storage HTML5 usado por 3ª parte | −8 (se houver) | −8 | localStorage/IndexedDB de 3ª parte é vetor de *supercookie*, sobrevive à limpeza de cookies. |
| 6 | Canvas fingerprint | −15 | −15 | Identificação sem estado no cliente; não é mitigada por limpar cookies. |
| 7 | Cookie sync | −12 | −12 | Compartilhamento de identificadores entre terceiros multiplica o alcance do rastreio. |
| 8 | Bounce tracking | −12 | −12 | Contorna o bloqueio de cookies de 3ª parte usando redirecionamentos de 1ª parte. |
| 9 | Indicadores de hijacking/hook | −20 | −20 | Maior severidade: sugere controle ativo do cliente (BeEF, canal persistente, key-logging). |

Dedução máxima teórica: −141, saturada em 0.

## Conversão em nota

| Nota | Faixa de score |
|---|---|
| A | 85–100 |
| B | 70–84 |
| C | 55–69 |
| D | 40–54 |
| F | 0–39 |

## Comparação com o Blacklight (The Markup)

O Blacklight reporta categorias específicas. O mapeamento para os critérios acima permite a comparação crítica exigida no entregável 4:

| Categoria do Blacklight | Critério(s) correspondente(s) aqui |
|---|---|
| Ad trackers / third-party cookies | 1, 3, 4 |
| Third-party cookies | 3, 4 |
| Canvas fingerprinting | 6 |
| Session recording / key logging | 9 (listeners de teclado/mouse) |
| Facebook/Google presence | 1 (domínios da lista) |
| Cookie syncing (quando reportado) | 7 |

**Como discutir divergências no relatório** (obrigatório para nota A):

- *Onde concordam*: normalmente na presença de rastreadores de anúncios e cookies de 3ª parte, porque ambos observam o mesmo tráfego.
- *Onde divergem*:
  - O Blacklight faz uma visita única e automatizada; a extensão observa a navegação **real** do usuário, então pode ver rastreadores que só disparam após interação (e vice-versa).
  - O Blacklight pode reportar *session recording* por assinatura de scripts conhecidos; a extensão infere por comportamento (nº de listeners), podendo divergir em ambos os sentidos.
  - Fingerprint: o Blacklight detecta o script; a extensão detecta a **chamada** ao canvas. Um script presente mas não executado aparece só no Blacklight.
- *Por quê*: metodologia estática/assinatura (Blacklight) x dinâmica/comportamental (esta extensão). Cada divergência no relatório deve citar a evidência do HAR ou o log da extensão, conforme o "Ponto de atenção" do enunciado.

## Reprodutibilidade

O painel do popup exibe a seção **"Como o score foi calculado"** com a dedução linha a linha, tornando o número auditável para cada página analisada.
