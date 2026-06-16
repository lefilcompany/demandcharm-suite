"""Plan limits — Services (Starter): bloqueia 'Novo Serviço' quando a cota está cheia."""
from __future__ import annotations

from tests_selenium.helpers import (
    find_button_by_text,
    find_text,
    force_click,
    wait_for_app,
)


def test_starter_blocks_new_service(driver, seeded, login_as, go):
    team = seeded("starter", "services")
    login_as(team)
    go(f"/teams/{team.teamId}/services")
    wait_for_app(driver)

    cta = find_button_by_text(driver, "novo serviço", "adicionar serviço")
    force_click(driver, cta)

    find_text(driver, r"permite até 5 serviço", timeout=10)
    find_text(driver, r"ver planos", timeout=5)
