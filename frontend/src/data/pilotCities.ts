import pilot from '../../../shared/pilot.json';
import type { CityId, Facility } from '../types';

export interface PilotCity {
  id: CityId;
  name: string;
  center: [number, number];
  bounds: [number, number, number, number];
  zoom: number;
  extentDescription: string;
}

export const PILOT_CITIES = pilot.cities as PilotCity[];
// The pilot.json contract is validated by backend tests; TS cannot narrow the
// JSON-inferred `number[]` coordinates to the [number, number] tuple without help.
export const PILOT_FACILITIES = pilot.facilities as unknown as Facility[];
export const SCORING_VERSION = pilot.scoringVersion;
export const getPilotCity = (id: CityId) => PILOT_CITIES.find((city) => city.id === id)!;
export const isInCity = (coordinates: [number, number], cityId: CityId) => {
  const [west, south, east, north] = getPilotCity(cityId).bounds;
  return coordinates[0] >= west && coordinates[0] <= east && coordinates[1] >= south && coordinates[1] <= north;
};

/**
 * Configured bounds are the canonical city classification: the stored `cityId`
 * is never trusted over geometry, so mislabeled records cannot leak into a
 * city's summaries.
 */
export const facilityBelongsToCity = (facility: Facility, cityId: CityId) =>
  isInCity(facility.coordinates, cityId);
