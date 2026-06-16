"""Cliente da edge function `e2e-seed` (espelha e2e/fixtures/seed.ts)."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any, Literal, Optional

import requests

SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL", "https://dcojvsftpzwfhgvamdgm.supabase.co")
E2E_SECRET = os.environ.get("E2E_SEED_SECRET", "")
ANON_KEY = os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY", "")

PlanSlug = Literal["starter", "profissional", "business", "enterprise"]
Resource = Literal["boards", "members", "demands", "services", "notes"]


@dataclass
class SeededTeam:
    email: str
    password: str
    userId: str
    teamId: str
    boardId: str
    accessCode: str
    planName: str
    planSlug: str
    firstStatusId: Optional[str] = None
    extraEmails: list[str] = field(default_factory=list)


def _call(op: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    if not E2E_SECRET:
        raise RuntimeError("E2E_SEED_SECRET não configurado")
    url = f"{SUPABASE_URL}/functions/v1/e2e-seed"
    body = {"op": op, **(payload or {})}
    r = requests.post(
        url,
        json=body,
        headers={
            "Content-Type": "application/json",
            "x-e2e-secret": E2E_SECRET,
            "apikey": ANON_KEY,
            "Authorization": f"Bearer {ANON_KEY}",
        },
        timeout=60,
    )
    if not r.ok:
        raise RuntimeError(f"e2e-seed {op} falhou ({r.status_code}): {r.text}")
    return r.json()


def seed_team(plan: PlanSlug, fill: Resource | None = None) -> SeededTeam:
    data = _call("seed", {"plan": plan, "fill": fill})
    return SeededTeam(
        email=data["email"],
        password=data["password"],
        userId=data["userId"],
        teamId=data["teamId"],
        boardId=data["boardId"],
        accessCode=data["accessCode"],
        planName=data["planName"],
        planSlug=data["planSlug"],
        firstStatusId=data.get("firstStatusId"),
        extraEmails=list(data.get("extraEmails") or []),
    )


def seed_extra_user() -> dict[str, str]:
    return _call("extra_user")


def cleanup_emails(emails: list[str]) -> None:
    emails = [e for e in emails if e]
    if not emails:
        return
    try:
        _call("cleanup", {"emails": emails})
    except Exception as exc:  # noqa: BLE001
        print(f"⚠️ cleanup falhou: {exc}")


# --- Supabase REST helpers (sem dependência do supabase-py) ---


def signin_password(email: str, password: str) -> dict[str, Any]:
    """POST /auth/v1/token?grant_type=password -> retorna session payload."""
    r = requests.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        headers={"apikey": ANON_KEY, "Content-Type": "application/json"},
        json={"email": email, "password": password},
        timeout=30,
    )
    if not r.ok:
        raise RuntimeError(f"signIn falhou ({r.status_code}): {r.text}")
    return r.json()


def rpc(access_token: str, fn: str, params: dict[str, Any]) -> requests.Response:
    """POST /rest/v1/rpc/<fn> autenticado."""
    return requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/{fn}",
        headers={
            "apikey": ANON_KEY,
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
        json=params,
        timeout=30,
    )
