# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim

WORKDIR /app

ENV CI=1
ENV PNPM_HOME=/pnpm
ENV PORT=3000
ENV WRANGLER_SEND_METRICS=false
ENV PATH="${PNPM_HOME}:${PATH}"

RUN corepack enable && corepack prepare pnpm@10.25.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod=false

COPY . .
RUN pnpm build

ENV NODE_ENV=production

EXPOSE 3000
VOLUME ["/data"]

CMD ["sh", "-c", "cd /app/dist/server && pnpm exec wrangler dev --config wrangler.json --ip 0.0.0.0 --port ${PORT:-3000} --persist-to /data/wrangler --log-level warn --show-interactive-dev-session=false"]
