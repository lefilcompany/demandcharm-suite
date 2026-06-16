"""Plan limits — Boards (Starter): bloqueia 'Novo Quadro' quando já há 1 quadro."""
from __future__ import annotations

from tests_selenium.helpers import (
    find_button_by_text,
    find_text,
    force_click,
    text_visible,
    wait_for_app,
)


def test_starter_blocks_new_board(driver, seeded, login_as, go):
    team = seeded("starter", "boards")
    login_as(team)
    go("/boards")
    wait_for_app(driver)

    cta = find_button_by_text(driver, "novo quadro", "criar primeiro quadro")
    force_click(driver, cta)

    find_text(driver, r"permite até 1 quadro", timeout=10)
    find_text(driver, r"ver planos", timeout=5)
    # wizard NÃO deve abrir
    assert not text_visible(driver, r"criar novo quadro", timeout=2)
