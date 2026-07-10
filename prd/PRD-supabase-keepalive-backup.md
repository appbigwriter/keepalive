# PRD — Sistema de Keep-Alive e Backup para Contas Supabase Free

**Versão:** 1.0 (base para início de desenvolvimento)
**Data:** 02/07/2026
**Status:** Escopo travado — pendências listadas na seção 17

---

## 1. Contexto e problema

A empresa mantém **~40 projetos Supabase no plano Free**, criados sob **múltiplas organizações** e em **fases diferentes** de desenvolvimento e implementação.

O plano Free impõe duas restrições que ameaçam esses projetos:

1. **Pausa por inatividade:** um projeto Free é pausado após **7 dias sem atividade de banco** (a métrica é atividade no Postgres, não visita ao dashboard nem chamadas que retornam cache).
2. **Sem backup configurável:** o plano Free tem retenção de backup zero. Não há snapshot automático recuperável.

Há ainda um **segundo abismo, mais grave que a pausa:** um projeto pausado tem uma janela de **90 dias** para ser restaurado pelo Studio. Passados os 90 dias, o botão de restaurar desaparece, a infraestrutura (inclusive a URL da API) é liberada e o projeto — junto com quaisquer backups nativos — é **permanentemente apagado**. Como há projetos em fases variadas, é provável que alguns já estejam pausados e que algum esteja perto do precipício.

## 2. Objetivo

Construir um sistema, hospedado em **VPS própria**, que:

- Mantenha todos os projetos cadastrados **ativos** (evitando a pausa por inatividade).
- Realize **backups diários e restauráveis** de: **Postgres** (schemas de aplicação), **Auth**, **Storage buckets** (quando houver) e **Edge Functions** (nos poucos projetos que usam).
- Faça uma **triagem inicial** do estado atual dos 40 projetos, identificando os já pausados e os em risco de deleção.
- Ofereça um **painel de controle** com cards por conta mostrando última movimentação (keep-alive), data do último backup e saúde geral.
- **Alerte o suporte** de forma confiável quando algo falhar.

## 3. Objetivos de negócio e métricas de sucesso

| Métrica | Alvo |
|---|---|
| Pausas não planejadas em projetos cadastrados | 0 |
| Projetos cadastrados com backup válido de menos de 24h | 100% |
| Falha de keep-alive ou backup que gera alerta | 100%, dentro de ≤ 30 min |
| Detecção de projeto morto/sistema fora do ar (dead-man's switch) | ≤ 1 ciclo perdido |
| Restauração de teste bem-sucedida | ≥ 1 por projeto crítico por trimestre |

## 4. Escopo

### Dentro do escopo (v1)
- Keep-alive de todos os projetos ativos cadastrados.
- Backup de Postgres + Auth + Storage + Edge Functions.
- Triagem/auditoria de estado (ativo / pausado / risco de deleção).
- Painel de controle com cards, filtros e ações manuais.
- Alertas por e-mail (SMTP próprio configurável) + dead-man's switch externo.
- Cofre de credenciais criptografado.
- Ferramenta de bootstrap (SQL) para preparar cada projeto no cadastro.

### Fora do escopo (v1)
- **Religar (unpause) projetos automaticamente.** Não há endpoint confirmado da Management API para "unpause"; a restauração de projeto pausado (<90 dias) é uma ação manual no dashboard. O sistema **detecta e alerta**, mas o religamento é manual.
- Upgrade automático para planos pagos.
- Ferramenta completa de migração/IaC.
- Substituir o Supabase como backend de produção.

## 5. Restrições e fatos de plataforma (base técnica)

Estes fatos moldam a arquitetura e devem ser validados no início do desenvolvimento (a Supabase muda políticas periodicamente):

- **Pausa:** 7 dias de inatividade de banco. Poucas queries reais por dia já evitam.
- **Pausa → deleção:** janela de 90 dias para restaurar; depois, deleção permanente.
- **Keep-alive só funciona em projeto ativo.** Projeto pausado não aceita conexão; precisa de religamento manual antes de entrar no ciclo.
- **Data API (PostgREST) grants:** mudança em curso — novos projetos após 30/05/2026 exigem grants explícitos; projetos Free existentes afetados a partir de 30/10/2026. **Decisão:** usar **conexão Postgres direta** (connection string), não a REST API, para keep-alive e backup.
- **Lacunas de backup:**
  - Os **bytes dos arquivos do Storage** vivem num backend S3 separado; só os metadados estão no Postgres.
  - O **código** das Edge Functions é baixável (CLI/dashboard), mas os **valores dos secrets não são recuperáveis** pela plataforma — dá para listar nomes, não ler valores.
  - Dump do banco inteiro incluindo `auth`/`storage` gera erros de *"must be owner"* e conflito de versão no restore.
- **Management API** é escopada por **organização** (personal access token). O token **pode deletar projetos** — é o secret mais sensível do sistema.
- **Versão do cliente:** `pg_dump` precisa ser ≥ versão do servidor (projetos ficam em PG 15 ou 17). Fixar cliente **PG 17**.
- Limite de **2 projetos ativos por organização** (relevante para operações de restore, não para o keep-alive).

**Referências para validação:**
- https://supabase.com/docs/guides/platform/free-project-pausing
- https://supabase.com/docs/guides/troubleshooting/restore-project-after-90-days-pause
- https://supabase.com/docs/reference/cli/supabase-functions
- https://supabase.com/docs/guides/functions/secrets

## 6. Usuários

- **Operador de suporte/ops:** cadastra projetos, monitora o painel, recebe alertas, dispara ações manuais (rodar backup agora, testar conexão), executa restauração quando necessário.
- **Administrador:** gerencia usuários do painel, tokens de organização e configurações globais (SMTP, retenção, storage offsite).

## 7. Arquitetura

Tudo roda na **VPS própria**, o que elimina limites de cron/serverless e permite rodar `pg_dump` e a Supabase CLI nativamente. As connection strings nunca saem do ambiente da empresa.

### Componentes
1. **Painel (Next.js + React + Tailwind):** UI de cadastro, cards, filtros, detalhe de projeto, configurações, histórico de alertas.
2. **Worker/Agendador (Node + TypeScript):** processo persistente (systemd/PM2 ou docker-compose) que executa keep-alive, backups, auditoria e envio de alertas. Faz loop sobre todos os projetos com pool de concorrência.
3. **Banco de configuração (Postgres local na VPS — recomendado):** guarda projetos, credenciais criptografadas, histórico de execuções, metadados de backup, alertas e auditoria. Rodar local elimina a ironia de o próprio sistema depender de um Supabase Free que pausaria. *(Alternativa: Supabase, mantido vivo pelo próprio worker — ver seção 17.)*
4. **Armazenamento de backups:** cópia **local** na VPS (restore rápido) + cópia **offsite** obrigatória (R2/B2/S3) com retenção. Backup na mesma máquina que o app não é backup.
5. **Dead-man's switch externo:** serviço de heartbeat (ex.: healthchecks.io) que alerta quando o "estou vivo" do worker **não** chega — cobre o cenário de VPS/worker/SMTP fora do ar.

### Fluxo resumido
```
Worker (loop agendado)
 ├─ Keep-alive: conecta em cada projeto ativo → INSERT + DELETE na tabela de ping
 ├─ Backup: pg_dump (public) + dump data-only (auth) + storage (metadados + bytes) + edge functions (código + secrets do cofre)
 │           → comprime → grava local → replica offsite → registra metadados no config DB
 ├─ Auditoria: via token de organização, enumera projetos, detecta pausados e risco de 90 dias
 └─ Observabilidade: heartbeat ao dead-man's switch; em falha, e-mail SMTP ao suporte
Painel (Next.js) → lê config DB → cards, filtros, ações manuais
```

## 8. Modelo de segurança (seção crítica)

### Princípio: privilégio mínimo por função
Cada projeto recebe **dois roles Postgres dedicados**, criados por um snippet de bootstrap idempotente:

- **`keepalive_role`** — apenas `INSERT` e `DELETE` numa única tabela de ping. É a credencial mais exposta (roda o tempo todo, aparece em logs/memória); mantê-la quase inofensiva é a proteção de maior alavancagem. Se vazar, o atacante só escreve/apaga linhas numa tabela de ping.
- **`backup_role`** — **read-only** (`SELECT`) nos schemas alvo. Como o backup inclui Auth, esse role lê PII e hashes de senha; não dá para reduzir a superfície de leitura, mas dá para eliminar escrita/destruição. Um `backup_role` vazado é exposição de dados (recuperável); uma service-role vazada é read+write+DROP (catástrofe irreversível).

**Decisão:** **não** usar service-role para operação normal.

### Tokens de organização
- Um **personal access token de Management por organização**, necessário para: enumerar projetos, detectar status de pausa, baixar Edge Functions e listar secrets.
- Tratamento reforçado: **pode deletar projetos**. Guardado criptografado, **carregado sob demanda** apenas quando auditoria/backup de functions rodam; nunca mantido "quente" no processo.

### Criptografia e cofre
- Todas as credenciais (connection strings, tokens, valores de secrets de Edge Functions) **criptografadas em repouso** (simétrica app-level, ex.: libsodium/age).
- **Chave-mestra fora do banco de config** (variável de ambiente/secret lido no boot do worker). Nunca em texto puro.

### Painel
- Autenticação obrigatória, papéis (operador/admin) e **log de auditoria** (quem cadastrou/removeu projeto, quem disparou restore, quem alterou config).

## 9. Requisitos funcionais

### FR-A — Cadastro e onboarding de projetos
- A-1. Cadastrar projeto com: organização, nome/apelido, fase (dev/homolog/produção), criticidade, connection string (direta), project-ref, flags de escopo de backup (buckets? edge functions?).
- A-2. Gerar **snippet SQL de bootstrap** (idempotente, re-executável) para o operador colar no SQL Editor do projeto: cria a tabela de ping e os roles `keepalive_role`/`backup_role` com os grants corretos.
- A-3. **Testar conexão** e validar grants dos dois roles antes de concluir o cadastro.
- A-4. Capturar, no cadastro, os **valores dos secrets** das Edge Functions (quando aplicável) para o cofre — a plataforma não os devolve depois.
- A-5. Cadastro em lote / importação para acelerar os 40 projetos.

### FR-B — Motor de keep-alive
- B-1. Para cada projeto **ativo**, conectar via `keepalive_role` e executar `INSERT` seguido de `DELETE` numa tabela de ping (auto-limpante).
- B-2. Cadência configurável, com **margem de segurança** (padrão sugerido: 2×/dia; a janela é de 7 dias).
- B-3. Registrar cada execução (timestamp, sucesso/falha, latência, erro).
- B-4. Em falha de conexão, marcar o projeto como "inalcançável" (possível pausa/queda) e disparar alerta.
- B-5. Concorrência controlada; lock por projeto para evitar sobreposição.

### FR-C — Motor de backup
Sub-jobs distintos por camada:
- **C-1 Postgres:** `pg_dump` dos schemas de aplicação (`public` + configuráveis), formato comprimido, cliente PG 17.
- **C-2 Auth:** dump **data-only** das tabelas de auth (`auth.users`, `auth.identities`, etc.) — preserva logins/hashes sem os erros de ownership do dump de schema completo.
- **C-3 Storage:** metadados (vêm no Postgres) **+ bytes dos arquivos** baixados por bucket via Storage API/CLI. Item mais pesado — concorrência própria.
- **C-4 Edge Functions:** baixar **código** (`supabase functions download`), listar **nomes dos secrets** (checklist) e recuperar **valores dos secrets do cofre** (não da plataforma).
- C-5. Frequência diária; janela configurável; concorrência 4–8 para dumps.
- C-6. Gravar local + replicar offsite; registrar metadados (tamanho, duração, checksum, status) no config DB.
- C-7. **Verificação de integridade:** confirmar dump não-vazio, validar checksum, registrar resultado.

### FR-D — Auditoria/triagem (fase 1 — prioritária)
- D-1. Via token de organização, enumerar todos os projetos de cada org e cruzar com os cadastrados.
- D-2. Classificar estado: **ativo / pausado / risco de deleção (perto dos 90 dias) / desconhecido**.
- D-3. Destacar projetos que precisam de **religamento manual** imediato.
- D-4. Verificar periodicamente o **acesso do `backup_role`** — se uma mudança de schema da Supabase quebrar o acesso, vira alerta claro em vez de buraco silencioso.
- D-5. Rodar em cadência (ex.: diária) e sob demanda.

### FR-E — Painel de controle
- E-1. **Cabeçalho-resumo:** contagem por status (ativos / com falha / pausados / em risco).
- E-2. **Filtro e agrupamento** por organização, fase e status (40 cards soltos são inviáveis de vigiar).
- E-3. **Card por projeto:** nome, org, fase, indicador de saúde (verde/amarelo/vermelho), última movimentação (keep-alive), data/hora do último backup, tamanho do último backup, e — quando pausado — contagem regressiva até o risco de 90 dias.
- E-4. **Detalhe do projeto:** histórico de keep-alive e backups, artefatos de backup por camada, log de alertas.
- E-5. **Ações manuais:** rodar keep-alive agora, rodar backup agora, testar conexão, revalidar grants.
- E-6. Assistente de onboarding com gerador do snippet SQL e teste de conexão.

### FR-F — Alertas e observabilidade
- F-1. **E-mail via SMTP próprio configurável** (host, porta, TLS, usuário, senha — criptografada), com botão **"enviar e-mail de teste"**.
- F-2. **Dead-man's switch:** heartbeat a cada ciclo para serviço externo; alerta quando o ping **não** chega (cobre VPS/worker/SMTP fora do ar).
- F-3. **Níveis de severidade:** crítico (projeto pausado indo para os 90 dias), urgente (keep-alive falhando perto dos 7 dias), aviso (backup perdido isolado com backup bom anterior).
- F-4. **Anti-enxurrada:** dedupe + digest; alertar na **transição de estado** (saudável→falhando) + lembrete periódico enquanto persistir, não a cada ciclo.
- F-5. Histórico de alertas persistido no config DB e visível no painel.

### FR-G — Suporte a restauração
- G-1. Procedimento documentado e **script de restore** por camada (Postgres, Auth data-only, Storage bytes, Edge Functions código+secrets).
- G-2. Cadência de **teste de restore** para projetos críticos.
- G-3. Alertar sobre incompatibilidades conhecidas (ownership de `auth`/`storage`, versão do PG).

### FR-H — Retenção e storage
- H-1. Política de retenção configurável (padrão sugerido: **7 diários + 4 semanais**).
- H-2. Rotação automática local e offsite.
- H-3. Preferência por storage offsite com **egress zero** (ex.: Cloudflare R2) para baratear restores.

## 10. Modelo de dados (config DB — esboço)

- **organizations** — id, nome, management_token (cripto), criado_em.
- **projects** — id, org_id, apelido, fase, criticidade, project_ref, conn_string (cripto), escopo_buckets (bool), escopo_edge (bool), status (ativo/pausado/risco/desconhecido), criado_em.
- **project_credentials** — id, project_id, tipo (keepalive/backup), material (cripto).
- **edge_function_secrets** — id, project_id, function_name, secret_name, secret_value (cripto), atualizado_em.
- **keepalive_runs** — id, project_id, executado_em, sucesso, latencia_ms, erro.
- **backups** — id, project_id, iniciado_em, concluido_em, status, tamanho_total, checksum.
- **backup_artifacts** — id, backup_id, camada (postgres/auth/storage/edge), caminho_local, caminho_offsite, tamanho, checksum, verificado (bool).
- **alerts** — id, project_id (nullable), severidade, tipo, mensagem, estado (aberto/resolvido), criado_em.
- **audit_log** — id, user_id, ação, alvo, detalhes, criado_em.
- **users** — id, e-mail, papel (operador/admin), auth.

## 11. Agendamento e concorrência

- **Keep-alive:** 2×/dia (margem sobre os 7 dias). Execução rápida; 40 projetos em segundos.
- **Backup:** 1×/dia em janela configurável; pool de 4–8 dumps simultâneos; Storage com pool próprio.
- **Auditoria:** 1×/dia + sob demanda.
- **Locks por projeto** para impedir sobreposição de jobs.
- **Heartbeat** enviado ao fim de cada ciclo bem-sucedido.

## 12. Requisitos não-funcionais

- **Confiabilidade:** supervisão de processo (systemd/PM2 com restart), retries com backoff, idempotência dos jobs.
- **Segurança:** privilégio mínimo, criptografia em repouso, chave-mestra fora do DB, tokens carregados sob demanda, painel autenticado com auditoria.
- **Desempenho/escala:** suportar 40 projetos hoje, arquitetura pronta para ~200 sem redesenho.
- **Portabilidade:** empacotar com **docker-compose** para fixar versão do `pg_dump`/CLI e simplificar deploy.
- **Observabilidade:** logs estruturados, histórico no painel, dois canais de alerta (e-mail + heartbeat).
- **Custo:** storage offsite estimado em dezenas de GB comprimidos (poucos dólares/mês).

## 13. Stack técnica

- **Painel:** Next.js (App Router) + React + Tailwind.
- **Worker:** Node + TypeScript, `pg` (node-postgres) para conexão direta, `nodemailer` para SMTP.
- **Ferramentas de sistema:** `pg_dump`/`pg_restore` PG 17, Supabase CLI (para Edge Functions e Storage), empacotados em Docker.
- **Config DB:** Postgres local na VPS.
- **Storage offsite:** R2/B2/S3.
- **Heartbeat:** healthchecks.io (ou equivalente).

## 14. Roadmap por fases

- **Fase 0 — Triagem (URGENTE):** ferramenta de auditoria que varre os 40 projetos, identifica já-pausados e os perto dos 90 dias, para resgate manual imediato. *Prioridade máxima por risco de deleção.*
- **Fase 1 — Keep-alive + base:** config DB, cofre de credenciais, onboarding com bootstrap SQL, motor de keep-alive, painel mínimo, núcleo de alertas (SMTP + heartbeat).
- **Fase 2 — Backup Postgres + Auth:** motor de backup C-1/C-2, storage local+offsite, retenção, verificação de integridade.
- **Fase 3 — Storage + Edge Functions:** backup C-3/C-4, captura de secrets no onboarding.
- **Fase 4 — Painel completo + restore:** cards ricos, filtros, ações manuais, scripts e testes de restore, integração dos tokens de organização na auditoria.

## 15. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Falha silenciosa (sistema morto sem avisar) | Dead-man's switch externo + supervisão de processo |
| Mudança de schema da Supabase quebra `backup_role` | Bootstrap idempotente re-executável + checagem de acesso na auditoria (FR-D-4) |
| Comprometimento de credencial | Privilégio mínimo (2 roles), criptografia, token de org sob demanda |
| Projeto atinge 90 dias e é deletado | Fase 0 (triagem) prioritária + alerta crítico com contagem regressiva |
| Valores de secrets de Edge Function não recuperáveis | Captura no onboarding e a cada mudança (FR-A-4) |
| `pg_dump` mais antigo que o servidor | Cliente PG 17 fixado em Docker |
| Mudança de grants da Data API | Conexão Postgres direta, sem depender da REST API |
| Backup só na VPS | Réplica offsite obrigatória |
| Enxurrada de alertas | Dedupe/digest + alerta por transição de estado |

## 16. Critérios de aceite (alto nível)

- Um projeto cadastrado e ativo permanece ativo indefinidamente sem intervenção manual.
- Todo projeto cadastrado possui, a cada dia, um backup verificado das camadas configuradas, com cópia offsite.
- Qualquer falha de keep-alive, backup ou queda do sistema gera alerta (e-mail e/ou heartbeat) em ≤ 30 min.
- A triagem lista corretamente projetos pausados e em risco de deleção.
- Um restore de teste reconstrói Postgres + Auth (e Storage/Edge quando aplicável) num projeto novo.
- Nenhuma credencial é armazenada em texto puro; painel exige autenticação.

## 17. Pendências / decisões em aberto

1. **Config DB:** Postgres local (recomendado) vs. Supabase mantido vivo pelo próprio worker?
2. **Provedor offsite:** R2 (egress zero, recomendado) vs. B2 vs. S3?
3. **Cadência exata** de keep-alive e **janela** do backup diário.
4. **Retenção** definitiva (sugestão: 7 diários + 4 semanais).
5. **Cadência de teste de restore** e quais projetos entram como "críticos".
6. **Papéis do painel:** basta operador/admin ou há mais níveis?
7. **Auto-resume:** confirmar se a Management API oferece caminho programático de religamento; se não, permanece manual na v1.
