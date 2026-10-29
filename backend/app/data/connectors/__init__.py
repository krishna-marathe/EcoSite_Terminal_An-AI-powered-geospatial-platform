"""Source connectors that are actually implemented.

Only sources listed here may be run by the environmental-analysis endpoint. A
source that exists in the registry but not here is ``NOT_CONNECTED``.
"""
from __future__ import annotations

try:
    from .copernicus_stac import CopernicusStacConnector
    from .jrc_gsw import JrcGswConnector
    from .srtm import SrtmGl1Connector
    from .osm_substation import OsmSubstationConnector
    from .worldpop import WorldPopConnector
    CONNECTORS = {
        "jrc_gsw": JrcGswConnector(),
        "nasa_srtmgl1": SrtmGl1Connector(),
        "copernicus_stac": CopernicusStacConnector(),
        "osm_overpass": OsmSubstationConnector(),
        "worldpop": WorldPopConnector(),
    }
except ModuleNotFoundError:
    try:
        from .copernicus_stac import CopernicusStacConnector
        from .osm_substation import OsmSubstationConnector
        from .worldpop import WorldPopConnector
        CONNECTORS = {
            "copernicus_stac": CopernicusStacConnector(),
            "osm_overpass": OsmSubstationConnector(),
            "worldpop": WorldPopConnector(),
        }
    except Exception:
        CONNECTORS = {}

__all__ = ["CONNECTORS"]
