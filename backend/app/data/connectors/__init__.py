"""Source connectors that are actually implemented.

Only sources listed here may be run by the environmental-analysis endpoint. A
source that exists in the registry but not here is ``NOT_CONNECTED``.
"""
from __future__ import annotations

from .copernicus_stac import CopernicusStacConnector
from .jrc_gsw import JrcGswConnector
from .nasa_power import NasaPowerConnector
from .srtm import SrtmGl1Connector

CONNECTORS = {
    "jrc_gsw": JrcGswConnector(),
    "nasa_srtmgl1": SrtmGl1Connector(),
    "copernicus_stac": CopernicusStacConnector(),
    "nasa_power": NasaPowerConnector(),
}

try:
    from .osm_substation import OsmSubstationConnector
    CONNECTORS["osm_overpass"] = OsmSubstationConnector()
except Exception:
    pass

try:
    from .worldpop import WorldPopConnector
    CONNECTORS["worldpop"] = WorldPopConnector()
except Exception:
    pass

__all__ = ["CONNECTORS"]
