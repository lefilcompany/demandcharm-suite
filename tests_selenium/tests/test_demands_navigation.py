"""E2E — navigation through Demands and Demand Requests should render without blank screen."""
from __future__ import annotations

from tests_selenium.helpers import find_text, force_click, wait_for_app


def test_demands_and_request_detail_open_without_blank_screen(driver, seeded, login_as, go):
    team = seeded("enterprise", "demands")
    login_as(team)

    go("/demands")
    wait_for_app(driver)
    demand_title = find_text(driver, r"categoria oculta", timeout=15)
    force_click(driver, demand_title)
    find_text(driver, r"entregue com atraso|subdemandas|anexos", timeout=15)

    go("/demand-requests")
    wait_for_app(driver)
    request_title = find_text(driver, r"lekpis - incluir análise cohort", timeout=15)
    force_click(driver, request_title)
    find_text(driver, r"aprovar e criar demanda|devolver para revisão", timeout=15)