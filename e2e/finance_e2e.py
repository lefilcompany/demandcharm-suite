"""E2E do módulo financeiro: valores padrão -> projeto -> quadro -> lançamentos -> visualizações -> limpeza.
Uso: python3 e2e/finance_e2e.py  (precisa da sessão do preview injetada; roda contra http://localhost:8080)."""
import asyncio, json, os, sys, time, re
from pathlib import Path
from playwright.async_api import async_playwright, expect

BASE = "http://localhost:8080"
OUT = Path("/tmp/browser/finance-e2e"); OUT.mkdir(parents=True, exist_ok=True)
TAG = f"E2E-FIN-{int(time.time())}"
results = []

def session():
    if os.environ.get("LOVABLE_BROWSER_AUTH_STATUS") == "injected":
        return os.environ["LOVABLE_BROWSER_SUPABASE_STORAGE_KEY"], os.environ["LOVABLE_BROWSER_SUPABASE_SESSION_JSON"]
    m = json.load(open(os.path.expanduser("~/.cache/lovable-auth/session.json")))
    return m["storage_key"], json.dumps(m["session"])

async def step(name, fn, page):
    try:
        await fn()
        results.append((name, "OK", ""))
    except Exception as e:
        results.append((name, "FALHOU", str(e).splitlines()[0][:200]))
    await page.screenshot(path=str(OUT / f"{len(results):02d}_{re.sub(r'[^a-z0-9]+','_',name.lower())[:40]}.png"))

async def main():
    key, sess = session()
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        ctx = await b.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        await page.goto(BASE); await page.evaluate("([k,v]) => localStorage.setItem(k,v)", [key, sess])
        S = {}

        async def tab(name):
            await page.get_by_role("tab", name=name, exact=True).click(); await page.wait_for_timeout(1500)

        async def goto_finance(aba):
            await page.goto(f"{BASE}/app/finance?aba={aba}", wait_until="domcontentloaded"); await page.wait_for_timeout(3500)

        # 1. Valores padrão
        async def defaults():
            await goto_finance("manage")
            sec = page.locator("details", has_text="Valores padrão").first
            await expect(sec).to_be_visible(timeout=15000)
            await expect(sec).to_contain_text("Hora/homem da equipe")
            for label, v in [("Impostos %", "10"), ("Custos variáveis %", "5"), ("Rateio %", "8"), ("Meta de margem %", "17"), ("Desconto máximo %", "10")]:
                await sec.get_by_label(label, exact=True).fill(v)
            await sec.get_by_role("button", name="Salvar").click()
            await expect(sec).to_contain_text("Meta 17", timeout=10000)
        await step("Valores padrão salvos", defaults, page)

        # 2. Criar projeto
        async def create_project():
            await page.goto(f"{BASE}/app/projects", wait_until="domcontentloaded"); await page.wait_for_timeout(3000)
            await page.get_by_role("button", name="Novo projeto").first.click()
            await page.get_by_placeholder("Ex: Projeto Website").fill(TAG)
            await page.get_by_role("dialog").get_by_role("button", name=re.compile("Criar|Salvar")).click()
            await page.wait_for_timeout(2500)
            await page.get_by_text(TAG).first.click()
            await page.wait_for_url(re.compile(r"/app/projects/[0-9a-f-]+"), timeout=15000)
            S["project_url"] = page.url
            await expect(page.get_by_text("Base financeira do projeto")).to_be_visible(timeout=15000)
        await step("Projeto criado e aberto", create_project, page)

        # 3. Ativar controle financeiro + vincular quadro
        async def enable_and_link():
            sw = page.get_by_role("switch").first
            if await sw.get_attribute("aria-checked") != "true": await sw.click()
            await expect(page.get_by_text("Controle financeiro ativo")).to_be_visible(timeout=10000)
            await tab("Quadros e pendências")
            panel = page.get_by_role("tabpanel")
            await panel.get_by_role("combobox").first.click()
            opt = page.get_by_role("option").first
            S["board"] = (await opt.inner_text()).strip(); await opt.click()
            await panel.get_by_role("button", name=re.compile("Vincular|Adicionar")).first.click()
            await page.wait_for_timeout(2500)
            await expect(panel).to_contain_text(S["board"])
        await step("Controle ativo e quadro vinculado", enable_and_link, page)

        # 4. Configuração copiada dos padrões
        async def config_copied():
            await tab("Configuração")
            await expect(page.get_by_role("tabpanel")).to_contain_text(re.compile(r"Em vigor: impostos 10[,.]0?%"), timeout=10000)
        await step("Projeto herdou valores padrão", config_copied, page)

        # 5. Preço mínimo
        async def min_price():
            await tab("Preço mínimo")
            await expect(page.get_by_role("tabpanel")).to_contain_text("Preço mínimo a cobrar", timeout=10000)
        await step("Aba Preço mínimo", min_price, page)

        # 6. Lançamentos
        async def launch(section, fills, button, board=True, extra=None):
            await goto_finance("manage")
            sec = page.locator("details", has_text=section).first
            await expect(sec).to_be_visible(timeout=15000)
            if board:
                await sec.get_by_role("combobox").first.click(); await page.get_by_role("option", name=S["board"], exact=True).click()
            for label, v in fills: await sec.get_by_label(label, exact=True).first.fill(v)
            if extra: await extra(sec)
            await sec.get_by_role("button", name=button).click()
            await expect(page.get_by_text(re.compile("lançad|salv", re.I)).first).to_be_visible(timeout=10000)

        await step("Faturamento lançado", lambda: launch("Faturamento", [("Valor (R$)", "20000")], "Lançar"), page)
        await step("Despesa direta lançada", lambda: launch("Despesas diretas", [("Descrição", TAG + " licença"), ("Valor (R$)", "500")], "Lançar"), page)

        async def pct_method(sec):
            await sec.get_by_role("combobox").nth(1).click()
            await page.get_by_role("option", name="% fixo da receita").click()
            await sec.get_by_label("% da receita de cada quadro").fill("8")
            await expect(sec).to_contain_text(re.compile("Folga de rateio|Custo não absorvido|Prévia"))
        await step("Despesa compartilhada % fixo", lambda: launch("Despesas compartilhadas", [("Descrição", TAG + " aluguel"), ("Valor (R$)", "1000")], "Lançar despesa compartilhada", board=False, extra=pct_method), page)

        # 7. Visualizações
        for aba, txt in [("overview", None), ("byProject", TAG), ("projects", None), ("people", None), ("allocation", TAG + " aluguel"), ("simulator", None), ("closing", None)]:
            async def view(aba=aba, txt=txt):
                await goto_finance(aba)
                panel = page.get_by_role("tabpanel")
                await expect(panel).to_be_visible(timeout=15000)
                await expect(panel).not_to_contain_text("Não foi possível carregar")
                if txt: await expect(panel).to_contain_text(txt, timeout=15000)
            await step(f"Visualização {aba}", view, page)

        async def project_result():
            await page.goto(S["project_url"], wait_until="domcontentloaded"); await page.wait_for_timeout(4000)
            await expect(page.get_by_role("tabpanel")).to_contain_text(re.compile(r"20\.000"), timeout=15000)
        await step("Resultado do projeto mostra faturamento", project_result, page)

        S["errors"] = errors
        await b.close()
    return S

S = asyncio.run(main())
json.dump({"tag": TAG, **{k: v for k, v in S.items()}}, open(OUT / "state.json", "w"))
for n, st, m in results: print(f"[{st}] {n} {m}")
print("erros de página:", len(S.get("errors", [])), S.get("errors", [])[:3])
sys.exit(0 if all(r[1] == "OK" for r in results) else 1)
