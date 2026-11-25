import asyncio, sys
from playwright.async_api import async_playwright
from lovable_playwright_defaults import signed_in_context
tag=sys.argv[1]
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(headless=True); c=await signed_in_context(b); pg=await c.new_page()
    await pg.goto("http://localhost:8080/app/projects",wait_until="networkidle"); await pg.wait_for_timeout(4000)
    await pg.screenshot(path=f"/tmp/browser/projvis/{tag}_list.png")
    for n in ["Projeto Teste Alfa","Projeto Teste Beta","projeto-teste-fin"]:
      print(n, await pg.get_by_text(n).count())
    await pg.goto("http://localhost:8080/app/projects/a1f0c0de-0000-4000-8000-00000000b002",wait_until="networkidle"); await pg.wait_for_timeout(3000)
    btn=pg.get_by_role("button",name="Acesso")
    if await btn.count():
      await btn.first.click(); await pg.wait_for_timeout(1500)
      print("externo no modal:", await pg.get_by_text("Compartilhamento externo").count())
      await pg.screenshot(path=f"/tmp/browser/projvis/{tag}_modal.png")
    await b.close()
asyncio.run(main())
