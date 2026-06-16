"""Injeta sessão Supabase no localStorage do browser antes do app montar."""
from __future__ import annotations

import json
import os
import time
from typing import Any

from selenium.webdriver.remote.webdriver import WebDriver

from .seed import SUPABASE_URL, signin_password

PROJECT_REF = os.environ.get("VITE_SUPABASE_PROJECT_ID", "dcojvsftpzwfhgvamdgm")
STORAGE_KEY = f"sb-{PROJECT_REF}-auth-token"


def prime_browser(driver: WebDriver, base_url: str, email: str, password: str, team_id: str) -> dict[str, Any]:
    """Faz signin via REST, abre baseURL e seta localStorage. Retorna a session."""
    session = signin_password(email, password)
    payload = {
        "access_token": session["access_token"],
        "refresh_token": session["refresh_token"],
        "expires_at": session.get("expires_at") or int(time.time()) + 3600,
        "expires_in": session.get("expires_in", 3600),
        "token_type": session.get("token_type", "bearer"),
        "user": session["user"],
    }
    user_id = session["user"]["id"]

    # 1) Carrega origin para conseguir escrever no localStorage.
    driver.get(base_url + "/")
    # Aguarda o JS estar disponível.
    for _ in range(20):
        try:
            driver.execute_script("return !!window.localStorage")
            break
        except Exception:
            time.sleep(0.1)

    driver.execute_script(
        """
        const [key, value, teamId, userId] = arguments;
        window.localStorage.setItem(key, value);
        window.localStorage.setItem("selectedTeamId", teamId);
        window.localStorage.setItem("onboarding_completed", "true");
        window.localStorage.setItem("onboarding_completed_" + userId, "true");
        """,
        STORAGE_KEY,
        json.dumps(payload),
        team_id,
        user_id,
    )
    return session


def goto(driver: WebDriver, base_url: str, path: str = "/") -> None:
    driver.get(base_url.rstrip("/") + path)
