# Detector de Privacidade — extensão Firefox

Extensão para **Firefox** que detecta, na navegação do cliente web, os principais mecanismos de rastreamento e violação de privacidade, e atribui uma **pontuação de privacidade** por página segundo uma metodologia explícita.

Trabalho da Avaliação Intermediária de Cibersegurança (Insper) — João Eduardo Luisi.

---

## O que a ferramenta detecta e apresenta

| Requisito do enunciado | Onde é feito | Como |
|---|---|---|
| Conexões a domínios de **3ª parte** | `background.js` (`webRequest.onBeforeRequest`) | Compara o domínio registrável (eTLD+1) de cada requisição com o da página. |
| **Cookies** injetados: 1ª/3ª parte, sessão/persistente | `background.js` (`onHeadersReceived` → `Set-Cookie`) + sonda `document.cookie` | Classifica por origem da resposta e por presença de `Expires`/`Max-Age`. |
| **Storage HTML5** (localStorage, sessionStorage, IndexedDB) | `content/detector.js` | Inventaria a origem (mesma-origem do content script) e captura escritas via hooks. |
| **Cookie sync** | `background.js` | Mesmo identificador (query param de alta entropia) visto em ≥2 terceiros distintos. |
| **Bounce tracking** | `background.js` (`onBeforeRedirect`) | Cadeia de redirect do `main_frame` que passa por um terceiro. |
| **Canvas fingerprint** | sonda injetada (mundo da página) | Hooks em `toDataURL`/`toBlob`/`getImageData` + `getParameter` de WebGL. |
| **Hijacking / hook** | sonda injetada | WebSocket/polling para 3ª parte, listeners de teclado/mouse, adulteração de nativos, objeto BeEF. |
| **Pontuação de privacidade** | `background.js` (`computeScore`) | Metodologia com critérios, pesos e justificativa (ver `docs/METODOLOGIA-SCORE.md`). |
| **Lista de bloqueio personalizada** + bloqueio | `background.js` + popup | `webRequest` cancela requisições de rastreadores de 3ª parte quando ativado. |

Isso cobre os itens exigidos até o **Conceito A** da rubrica.

---

## Instalação (carregamento temporário via `about:debugging`)

1. Abra o Firefox e vá em `about:debugging#/runtime/this-firefox`.
2. Clique em **Carregar extensão temporária…** (*Load Temporary Add-on*).
3. Selecione o arquivo **`manifest.json`** na raiz desta pasta.
4. O ícone de escudo aparece na barra de ferramentas. Navegue por uma página e clique no ícone para ver o relatório.

Para depurar o `background.js`: em `about:debugging`, clique em **Inspecionar** na extensão.

---

## Arquitetura

```
manifest.json          Manifest V2 (persistente) — ver nota abaixo
background.js          Núcleo: rede, cookies, redirects, bloqueio, score, agregação por aba
data/psl.js            Domínio registrável (eTLD+1) e teste de 1ª/3ª parte
data/trackers.js       Lista embutida de rastreadores conhecidos
content/detector.js    Content script: inventaria storage + injeta a sonda no mundo da página
popup/                 Interface (relatório por página, sinalizadores, score, lista de bloqueio)
icons/                 Ícones 48/96
docs/                  Metodologia do score, guia de execução, template do relatório
evidencias/            HAR e prints dos testes (preencher — ver docs/GUIA-EXECUCAO.md)
```

### Fluxo de dados

```
página (mundo principal)                content script (mundo isolado)         background (persistente)
  sonda: hooks canvas/storage/WS  ──►  window.postMessage  ──►  runtime.sendMessage("pageEvidence")
                                        inventário de storage ─────────────────────────►  agrega por tabId
  requisições de rede  ─────────────────────────────────────────────────────────────►  webRequest listeners
                                                                popup  ◄── getReport ◄──  computeScore
```

A sonda é injetada de forma **síncrona** (`<script>.textContent`) em `document_start`, garantindo que os hooks de canvas/storage/WebSocket sejam instalados **antes** do JavaScript da página executar. Sem isso, um `toDataURL()` chamado logo no carregamento passaria despercebido.

---

## Nota sobre Manifest V2

A extensão usa **Manifest V2** por três motivos técnicos:

1. **Página de fundo persistente**: o núcleo acumula estado por aba (domínios, cookies, evidências). Em MV3 o Firefox usa *event pages* não-persistentes, o que exigiria persistir o estado a cada evento.
2. **`webRequestBlocking`**: o bloqueio síncrono de requisições continua disponível em MV2. (O Firefox mantém suporte a MV2; a migração para MV3 é discutida em `docs/GUIA-EXECUCAO.md`.)
3. **Compatibilidade com os tutoriais MDN** indicados no enunciado.

A migração para MV3 é direta: trocar `background.scripts` por `background.service_worker`/*event page*, persistir `tabData` em `storage.session`, e manter `webRequestBlocking` (suportado no Firefox MV3).

---

## Limitações conhecidas (transparência)

- **PSL simplificada**: `data/psl.js` embute um subconjunto curado de sufixos públicos (foco em `.br` e ccTLDs comuns) + heurística de dois rótulos. Cobre a maioria dos casos reais; para produção, recomenda-se embutir a [Public Suffix List](https://publicsuffix.org/list/) completa.
- **Lista de rastreadores curada**: `data/trackers.js` não substitui EasyPrivacy. Ampliável pela lista personalizada no popup.
- **Heurísticas de fingerprint/hijacking**: por serem baseadas em comportamento, podem gerar falsos positivos (ex.: um site que legitimamente lê `getImageData`). Cada detecção vem acompanhada da **evidência** para inspeção manual — princípio adotado no relatório.
- **CSP restritiva**: em páginas com CSP muito rígida a injeção da sonda pode ser bloqueada; nesse caso o inventário de storage e a análise de rede continuam funcionando.

---

## Documentos

- `docs/METODOLOGIA-SCORE.md` — critérios, pesos e justificativa do score, com mapeamento para o Blacklight.
- `docs/GUIA-EXECUCAO.md` — passo a passo dos testes (DDG Privacy Test Pages, exportação de HAR, Blacklight, uBlock Origin) e plano de commits incrementais.
- `docs/RELATORIO-template.md` — modelo dos entregáveis 2, 3 e 4 para preencher e exportar em PDF.
