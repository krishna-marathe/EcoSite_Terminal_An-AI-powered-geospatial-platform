"""Disabled placeholders for sources whose machine contract is not yet verified."""
from __future__ import annotations

from collections.abc import Mapping

from .operational import ConnectorNotConfigured


class _UnverifiedFeedConnector:
    source_id = ""
    endpoint_variable = ""

    @classmethod
    def from_environment(cls, environment: Mapping[str, str]):
        if not environment.get(cls.endpoint_variable):
            raise ConnectorNotConfigured(f"{cls.source_id} is NOT_CONNECTED: {cls.endpoint_variable} is missing")
        raise ConnectorNotConfigured(
            f"{cls.source_id} is NOT_CONNECTED: endpoint is configured but its response contract is not verified"
        )


class ImdPublicFeedConnector(_UnverifiedFeedConnector):
    source_id = "imd_public_api"
    endpoint_variable = "ECOSITE_IMD_ENDPOINT"


class NwdpGroundwaterConnector(_UnverifiedFeedConnector):
    source_id = "nwdp_groundwater"
    endpoint_variable = "ECOSITE_NWDP_ENDPOINT"

