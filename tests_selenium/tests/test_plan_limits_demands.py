"""Plan limits — Demands (Starter): bloqueia 'Nova Demanda' ao atingir cota mensal."""
from __future__ import annotations

from tests_selenium.helpers import (
    find_button_by_text,
    find_text,
    force_click,
    text_visible,
    wait_for_app,
)


def test_starter_blocks_new_demand(driver, seeded, login_as, go):
    team = seeded("starter", "demands")
    login_as(team)
    go("/")
    wait_for_app(driver)

    cta = find_button_by_text(driver, "nova demanda")
    force_click(driver, cta)

    find_text(driver, r"permite até 30 demanda", timeout=10)
    find_text(driver, r"ver planos", timeout=5)
    assert not text_visible(driver, r"criar.*demanda", timeout=2)
