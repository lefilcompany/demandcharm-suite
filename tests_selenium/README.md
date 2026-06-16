# E2E — Selenium (Python + pytest)

Suite end-to-end que valida as guardas de limites de plano (boards, demands, members, services) e o happy-path em Enterprise.

## Stack

- **selenium 4** (Selenium Manager resolve o chromedriver automaticamente)
- **pytest** como runner
- **requests** para invocar a edge function `e2e-seed` e a REST do Supabase

> O spec antigo de **notes** foi removido — a feature está oculta do deploy.

## O que é o happy-path?

Os specs de `boards/demands/members/services` validam o **bloqueio** ao estourar o limite do plano. O `happy_path` valida o oposto: num plano **Enterprise (ilimitado)**, criar quadro e demanda **não dispara** o toast de limite. Funciona como sanity check para garantir que a guarda não bloqueia indevidamente quem tem plano sem restrição.

## Pré-requisitos

Variáveis de ambiente (locais via `.env` ou exportadas):

```
E2E_SEED_SECRET=<secret da edge e2e-seed>
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key>
VITE_SUPABASE_PROJECT_ID=<ref>
E2E_BASE_URL=http://localhost:8080   # opcional
```

E os mesmos quatro como **secrets do GitHub** para o workflow rodar.

## Rodar localmente

```bash
# 1) deps
python -m pip install -r tests_selenium/requirements.txt

# 2) dev server (em outro terminal)
bun run dev

# 3) suíte completa
python -m pytest

# 4) um spec só
python -m pytest tests_selenium/tests/test_plan_limits_boards.py

# 5) ver o browser (sem headless)
HEADED=1 python -m pytest tests_selenium/tests/test_plan_limits_happy_path.py
```

## CI

`.github/workflows/ci.yml` tem 3 jobs:

- **lint-and-typecheck** — `eslint .` + `tsc --noEmit`
- **unit** — `vitest run`
- **e2e** — matrix com 5 specs (`boards`, `demands`, `members`, `services`, `happy_path`) rodando em paralelo. Sobe o Vite localmente e executa Selenium contra `http://localhost:8080`.

JUnit XML é publicado como artifact por spec.
