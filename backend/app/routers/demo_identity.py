"""Explicit local-demo identity dependency.

This is not production authentication. It accepts only two fixed prototype
identities and is always disabled when ECOSITE_ENV=production.
"""
from __future__ import annotations

import os
from dataclasses import dataclass

from fastapi import Depends, Header

from ..services.submission_workflow import WorkflowActor


class DemoAuthenticationError(PermissionError):
    def __init__(self, code: str, message: str, status_code: int) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


DEMO_IDENTITIES = {
    "demo-operator": WorkflowActor("demo-operator", "operator", "org-demo-operator"),
    "demo-ministry-reviewer": WorkflowActor("demo-ministry-reviewer", "ministry_reviewer", None),
}


def demo_actor(
    actor_id: str | None = Header(default=None, alias="X-EcoSite-Demo-Actor"),
    role: str | None = Header(default=None, alias="X-EcoSite-Demo-Role"),
) -> WorkflowActor:
    enabled = os.getenv("ECOSITE_DEMO_AUTH_ENABLED", "1") == "1"
    production = os.getenv("ECOSITE_ENV", "development").casefold() == "production"
    if not enabled or production:
        raise DemoAuthenticationError("authentication_required", "Demo identity is disabled.", 401)
    if not actor_id or not role:
        raise DemoAuthenticationError("authentication_required", "A demo actor and role are required.", 401)
    actor = DEMO_IDENTITIES.get(actor_id)
    if actor is None or actor.role != role:
        raise DemoAuthenticationError("access_denied", "The demo identity is not permitted.", 403)
    return actor


def operator_actor(actor: WorkflowActor = Depends(demo_actor)) -> WorkflowActor:
    if actor.role != "operator":
        raise DemoAuthenticationError("access_denied", "Operator role is required.", 403)
    return actor


def ministry_actor(actor: WorkflowActor = Depends(demo_actor)) -> WorkflowActor:
    if actor.role != "ministry_reviewer":
        raise DemoAuthenticationError("access_denied", "Ministry reviewer role is required.", 403)
    return actor
