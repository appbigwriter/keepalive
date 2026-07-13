# Estágio de dependências
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copiar os arquivos de dependência do Next.js
COPY web/package.json web/package-lock.json* ./
RUN npm ci

# Estágio de build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY web/ .

# Declarar argumentos de build passados pelo Easypanel
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_SUPABASE_ANON_KEY
ARG SUPABASE_SERVICE_ROLE_KEY
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG DATABASE_URL
ARG SUPABASE_SCHEMA

# Definir as variáveis de ambiente necessárias durante o build do Next.js
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_SUPABASE_ANON_KEY=$NEXT_SUPABASE_ANON_KEY
ENV SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV DATABASE_URL=$DATABASE_URL
ENV SUPABASE_SCHEMA=$SUPABASE_SCHEMA
ENV PORT=3000

RUN npm run build

# Estágio de execução (runner)
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# O Next.js coleta telemetria anônima durante o build e execução
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

USER nextjs

EXPOSE 3000

CMD ["npm", "run", "start"]
