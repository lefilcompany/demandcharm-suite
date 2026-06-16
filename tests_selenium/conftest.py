"""Fixtures pytest: driver Chrome headless + seed lifecycle."""
from __future__ import annotations

import os
import time
from typing import Callable, Iterator

import pytest
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.wait import WebDriverWait

from .auth import goto, prime_browser
from .seed import SeededTeam, cleanup_emails, seed_team

load_dotenv()

BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:8080")


@pytest.fixture(scope="session")
def base_url() -> str:
    return BASE_URL


@pytest.fixture
def driver() -> Iterator[webdriver.Chrome]:
    opts = Options()
    if os.environ.get("HEADED") != "1":
        opts.add_argument("--headless=new")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--window-size=1366,900")
    opts.add_argument("--lang=pt-BR")
    # selenium 4.11+ usa Selenium Manager: chromedriver é resolvido automaticamente.
    drv = webdriver.Chrome(options=opts)
    drv.set_page_load_timeout(60)
    drv.implicitly_wait(0)
    try:
        yield drv
    finally:
        drv.quit()


@pytest.fixture
def wait(driver: webdriver.Chrome) -> WebDriverWait:
    return WebDriverWait(driver, 20, poll_frequency=0.25)


@pytest.fixture
def seeded() -> Iterator[Callable[..., SeededTeam]]:
    created: list[SeededTeam] = []

    def _make(plan, fill=None):  # noqa: ANN001
        t = seed_team(plan, fill)
        created.append(t)
        return t

    yield _make

    emails: list[str] = []
    for t in created:
        emails.append(t.email)
        emails.extend(t.extraEmails)
    if emails:
        cleanup_emails(emails)


@pytest.fixture
def login_as(driver: webdriver.Chrome, base_url: str) -> Callable[[SeededTeam], None]:
    def _do(team: SeededTeam) -> None:
        prime_browser(driver, base_url, team.email, team.password, team.teamId)
        # Pequena pausa pra garantir gravação antes da próxima navegação.
        time.sleep(0.2)

    return _do


@pytest.fixture
def go(driver: webdriver.Chrome, base_url: str) -> Callable[[str], None]:
    def _go(path: str = "/") -> None:
        goto(driver, base_url, path)

    return _go
