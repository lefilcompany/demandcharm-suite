"""Plan limits — Members: valida o trigger `enforce_team_member_limit` via RPC.

A regra de bloqueio vive no banco; testamos no nível REST (sem precisar do browser)
para evitar o round-trip de aprovação na UI. Ainda é um teste end-to-end real
contra o Supabase de produção.
"""
from __future__ import annotations

import pytest

from tests_selenium.seed import cleanup_emails, rpc, seed_extra_user, signin_password


def test_starter_rejects_fourth_member(seeded):
    team = seeded("starter", "members")  # 3 membros já dentro
    extra = seed_extra_user()
    try:
        session = signin_password(extra["email"], extra["password"])
        r = rpc(session["access_token"], "join_team_with_code", {"p_code": team.accessCode})
        assert not r.ok, f"esperava erro, recebi {r.status_code}: {r.text}"
        body = r.text
        assert "PLAN_LIMIT_MEMBERS" in body, body
        assert "3 membro" in body, body
    finally:
        cleanup_emails([extra["email"]])
