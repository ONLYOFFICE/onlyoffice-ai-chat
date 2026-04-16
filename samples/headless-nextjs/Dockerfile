FROM node:22-alpine AS base

# --- deps ---
FROM base AS deps
WORKDIR /app

# Copy root library (needed for file:../../ dependency)
COPY package.json /lib/package.json
COPY dist /lib/dist

# Copy sample
COPY samples/headless-nextjs/package.json ./
COPY samples/headless-nextjs/prisma ./prisma/

# Rewrite file:../../ → file:/lib for Docker context
RUN sed -i 's|file:../../|file:/lib|g' package.json
RUN npm install --ignore-scripts --install-links
RUN npx prisma generate

# --- builder ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./
COPY samples/headless-nextjs/ .
RUN npm run next:build

# --- runner ---
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
