import { describe, it, expect } from 'vitest';
import { calculateEnergyWaterScenario } from './scenarios';

describe('calculateEnergyWaterScenario', () => {
  it('correctly calculates IT energy and facility energy matching OpenDC-LCA physics', () => {
    // 50 MW IT, 80% CF, Evaporative Hybrid (default PUE 1.28)
    const result = calculateEnergyWaterScenario({
      it_capacity_mw: 50,
      capacity_factor: 0.8,
      cooling_architecture: 'EVAPORATIVE_HYBRID',
    });

    // E_IT = 50 * 0.8 * 8760 = 350,400 MWh
    expect(result.annual_it_energy_mwh).toBe(350400);
    // E_facility = 350,400 * 1.28 = 448,512 MWh
    expect(result.annual_facility_energy_mwh).toBe(448512);
    // Overhead = 448,512 - 350,400 = 98,112 MWh
    expect(result.annual_overhead_energy_mwh).toBe(98112);
    expect(result.effective_pue).toBe(1.28);
  });

  it('correctly computes water consumption and summer surge', () => {
    // 50 MW IT, 80% CF, Evaporative Hybrid (WUE 1.20 L/kWh)
    const result = calculateEnergyWaterScenario({
      it_capacity_mw: 50,
      capacity_factor: 0.8,
      cooling_architecture: 'EVAPORATIVE_HYBRID',
    });

    // Annual water = 350,400 MWh * 1.20 L/kWh = 420,480 m3
    expect(result.annual_water_consumption_m3).toBe(420480);
    // Daily average = 420,480 / 365 = ~1,152 KLD
    expect(result.daily_average_water_kld).toBe(1152);
    // Peak summer = 1152 * 1.45 = ~1,670 KLD
    expect(result.peak_summer_water_kld).toBe(1670);
  });

  it('demonstrates near-zero water consumption under air-cooled and immersion architectures', () => {
    const airCooled = calculateEnergyWaterScenario({
      it_capacity_mw: 50,
      capacity_factor: 0.8,
      cooling_architecture: 'AIR_COOLED_DRY',
    });
    // WUE 0.05
    expect(airCooled.wue_liters_per_kwh).toBe(0.05);
    expect(airCooled.daily_average_water_kld).toBe(48);

    const immersion = calculateEnergyWaterScenario({
      it_capacity_mw: 50,
      capacity_factor: 0.8,
      cooling_architecture: 'IMMERSION_COOLING',
    });
    // WUE 0.02
    expect(immersion.wue_liters_per_kwh).toBe(0.02);
    expect(immersion.daily_average_water_kld).toBe(19);
  });

  it('calculates on-site rainwater harvesting potential based on the Rational Method', () => {
    // 10 ha parcel, 1000 mm rainfall
    // Catchment = 10 * 10,000 * 0.40 = 40,000 m2
    // Runoff = 1000 mm * 40,000 m2 * 0.85 = 34,000,000 litres = 34,000 m3
    // Daily RWH = 34,000 / 365 = ~93 KLD
    const result = calculateEnergyWaterScenario({
      it_capacity_mw: 50,
      capacity_factor: 0.8,
      cooling_architecture: 'EVAPORATIVE_HYBRID',
      parcel_area_ha: 10.0,
      annual_rainfall_mm: 1000,
    });

    expect(result.rainwater_harvest_potential_kld).toBe(93);
    expect(result.rainwater_offset_percentage).toBeGreaterThan(0);
  });

  it('includes explicit formulas and sensitivity ranges for transparency', () => {
    const result = calculateEnergyWaterScenario({
      it_capacity_mw: 30,
      cooling_architecture: 'LIQUID_DLC',
    });

    expect(result.formulas.it_energy).toContain('P_IT');
    expect(result.formulas.facility_energy).toContain('PUE');
    expect(result.sensitivity.pue_min).toBeLessThan(result.effective_pue);
    expect(result.sensitivity.pue_max).toBeGreaterThan(result.effective_pue);
    expect(result.assumptions.length).toBeGreaterThan(3);
  });
});

