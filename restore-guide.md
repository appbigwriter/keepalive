# Guia de Restauração (Restore) - Supabase KeepAlive

Este documento descreve o procedimento passo-a-passo para a restauração completa de um projeto Supabase a partir dos backups gerados pelo sistema **KeepAlive**.

> [!WARNING]
> A restauração completa no ecossistema Supabase nunca deve sobrescrever a mesma infraestrutura caso ela ainda exista (a menos que seja apenas `public`). O ideal é criar um **novo projeto vazio** no dashboard da Supabase e restaurar os dados nele para evitar conflitos com metadados internos não backapeados.

## 1. Preparação do Novo Projeto
1. Crie um novo projeto no Dashboard da Supabase.
2. Salve a nova string de conexão do banco de dados (ex.: `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`).
3. Anote o novo Project Reference ID e os tokens.
4. Desative ou pause quaisquer conexões e serviços da sua aplicação que estejam apontando para o banco.

## 2. Restauração do Postgres Schema (`public` e outros customizados)
O dump do Postgres foi gerado via `pg_dump` com a tag `-Fc` (compressed) ignorando `auth` e `storage`.
Utilize o `pg_restore` localmente ou através de um container Docker configurado com PostgreSQL 17.

```bash
# Exemplo de comando
pg_restore -d "postgresql://postgres.[ref]:[password]@host:5432/postgres" \
  -1 -c -x -O --role=postgres \
  /caminho/para/arquivo_postgres_timestamp.dump
```
> [!NOTE]
> A flag `-O` ignora ownership e `-x` ignora grants originais. Isso evita erros de privilégios com as roles internas gerenciadas pela plataforma Supabase.

## 3. Restauração de Autenticação (`auth` data-only)
Os dados de Auth foram gerados como `-a` (data-only) em texto SQL puro, focado na tabela `auth.users` e `auth.identities`. 
Isso garante que hashes de senha e UIDs sejam os mesmos.

```bash
# Exemplo de comando via psql
psql -d "postgresql://postgres.[ref]:[password]@host:5432/postgres" \
  -f /caminho/para/arquivo_auth_timestamp.sql
```
> [!IMPORTANT]
> Caso a tabela `auth.users` não esteja perfeitamente vazia no novo projeto, você pode receber conflitos de chave primária. Você pode precisar realizar um TRUNCATE (ou DELETE) na tabela `auth.users` do projeto novo via SQL Editor antes de rodar este dump.

## 4. Restauração de Storage
Os arquivos brutos do storage estão compactados em `.tar.gz`. A estrutura reflete as pastas (buckets) do seu projeto original.
1. Extraia o pacote `tar.gz`.
2. Assegure-se de que o schema `public` já foi restaurado (o passo 2 garante que a tabela de metadados do Storage esteja presente).
3. Use a Supabase CLI para fazer o upload inverso.

```bash
# Upload via CLI do diretório extraído para cada bucket
supabase storage cp -r ./bucket_name/ ss://[new-project-ref]/[bucket_name]/
```

## 5. Restauração de Edge Functions
O código e as chaves de ambiente foram exportados no arquivo de backup das funções.
1. Extraia o `tar.gz` correspondente. Você encontrará o código e um arquivo `secrets.json`.
2. Restaure os secrets manualmente ou via script:
   ```bash
   # Iterar sobre as chaves no JSON e setá-las (requer bash/jq)
   cat secrets.json | jq -c '.[]' | while read i; do
      NAME=$(echo $i | jq -r '.secret_name')
      VALUE=$(echo $i | jq -r '.secret_value')
      supabase secrets set "$NAME=$VALUE" --project-ref [new-project-ref]
   done
   ```
3. Faça o deploy de todas as functions usando a CLI:
   ```bash
   supabase functions deploy --project-ref [new-project-ref]
   ```

## 6. Atualização no Painel KeepAlive
- O projeto antigo deve ter o seu status movido para inativo ou pode ser apagado do Config DB após a validação do novo projeto.
- Cadastre o **novo projeto** no Dashboard do KeepAlive gerando novas credenciais (Bootstrap SQL) para dar início imediato às rotinas de backup e keep-alive da nova infraestrutura.
