import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FileSpreadsheet,
  Download,
  Printer,
  Search,
  Database,
  Building2,
  Sparkles,
} from 'lucide-react';
import { DEMO_FACILITIES } from '../data/demo/facilities';
import { DATA_PROVENANCE_CATALOG } from '../data/demo/provenance';
import { DEMO_MITIGATION_CATALOG } from '../data/demo/mitigations';
import { downloadCsv } from '../utils/csvExport';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { RiskBadge } from '../components/ui/Badge';

export const Reports: React.FC = () => {
  const [searchParams] = useSearchParams();
  const facilityIdParam = searchParams.get('facility');

  const [activeTab, setActiveTab] = useState<'directory' | 'dossier' | 'provenance' | 'mitigation'>('directory');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFacilityId, setSelectedFacilityId] = useState(
    facilityIdParam || DEMO_FACILITIES[0].id
  );

  const selectedFacility =
    DEMO_FACILITIES.find((f) => f.id === selectedFacilityId) || DEMO_FACILITIES[0];

  // CSV Export Handlers
  const handleExportFacilitiesCsv = () => {
    const headers = [
      'Facility ID',
      'Name',
      'Type',
      'State',
      'District',
      'Latitude',
      'Longitude',
      'Capacity (MW)',
      'Operator',
      'Overall Risk Score',
      'Risk Level',
      'Water Stress Score',
      'Grid Pressure Score',
      'Air Pollution Score',
      'Heat Exposure Score',
      'Flood Hazard Score',
      'Population (5km)',
      'Data Confidence (%)',
      'Source Organization',
    ];

    const rows = DEMO_FACILITIES.map((f) => [
      f.id,
      f.name,
      f.type,
      f.state,
      f.district,
      f.coordinates[1],
      f.coordinates[0],
      f.capacityMw || '',
      f.operator || '',
      f.overallRiskScore,
      f.riskLevel,
      f.indicators.waterStress,
      f.indicators.gridPressure,
      f.indicators.airPollution,
      f.indicators.heatExposure,
      f.indicators.floodHazard,
      f.nearbyPopulation.radius5km,
      f.provenance.confidenceScore,
      f.provenance.sourceOrganization,
    ]);

    downloadCsv(`ecosite_facilities_${new Date().toISOString().split('T')[0]}.csv`, [
      headers,
      ...rows,
    ]);
  };

  const handleExportProvenanceCsv = () => {
    const headers = [
      'Dataset ID',
      'Dataset Name',
      'Category',
      'Organization',
      'Organization Type',
      'Portal URL',
      'Update Frequency',
      'Last Updated',
      'Spatial Resolution',
      'Confidence Score (%)',
      'Data Status',
      'Statutory Basis',
    ];

    const rows = DATA_PROVENANCE_CATALOG.map((p) => [
      p.id,
      p.datasetName,
      p.category,
      p.organization,
      p.organizationType,
      p.portalUrl,
      p.updateFrequency,
      p.lastUpdated,
      p.spatialResolution,
      p.confidenceScore,
      p.dataStatus,
      p.statutoryBasis,
    ]);

    downloadCsv(`ecosite_provenance_catalog_${new Date().toISOString().split('T')[0]}.csv`, [
      headers,
      ...rows,
    ]);
  };

  const handleExportMitigationCsv = () => {
    const headers = [
      'Recommendation ID',
      'Title',
      'Category',
      'Applicable Facility Type',
      'Priority',
      'Complexity',
      'Timeframe',
      'Responsible Stakeholder',
      'Expected Benefit',
      'Supporting Evidence',
      'Verification Requirements',
    ];

    const rows = DEMO_MITIGATION_CATALOG.map((m) => [
      m.id,
      m.title,
      m.category,
      m.facilityType,
      m.priority,
      m.implementationComplexity,
      m.timeframe,
      m.responsibleStakeholder,
      m.expectedBenefit,
      m.supportingEvidence,
      m.verificationRequirements,
    ]);

    downloadCsv(`ecosite_mitigation_plan_${new Date().toISOString().split('T')[0]}.csv`, [
      headers,
      ...rows,
    ]);
  };

  const filteredFacilities = DEMO_FACILITIES.filter((f) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      f.name.toLowerCase().includes(q) ||
      f.state.toLowerCase().includes(q) ||
      f.district.toLowerCase().includes(q) ||
      f.type.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080D16] overflow-y-auto p-4 md:p-6 space-y-6 select-none font-sans print:bg-white print:text-black print:p-2">
      {/* Page Header (Hidden on print) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#263447] print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-mono tracking-wider text-sky-400 bg-sky-950/80 px-2 py-0.5 rounded border border-sky-800">
              Module 06
            </span>
            <h1 className="text-lg md:text-xl font-bold text-slate-100 font-mono tracking-tight flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-sky-400" />
              <span>Environmental Intelligence Reports & Data Explorer</span>
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Export validated spatial intelligence summaries, statutory data provenance registers, and structured mitigation roadmaps with full source attribution.
          </p>
        </div>

        {/* Global Print & CSV Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="xs"
            icon={<Printer className="w-3.5 h-3.5 text-slate-300" />}
            onClick={() => window.print()}
          >
            Print Dossier (PDF)
          </Button>
        </div>
      </div>

      {/* Tabs Navigation (Hidden on print) */}
      <div className="flex items-center gap-2 border-b border-[#263447] pb-2 print:hidden font-mono text-xs">
        {[
          { id: 'directory', label: 'Facility Assessment Directory' },
          { id: 'dossier', label: 'Executive Intelligence Dossier' },
          { id: 'provenance', label: 'Dataset Provenance Catalog (14 Sources)' },
          { id: 'mitigation', label: 'Mitigation Action Master Register' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-3 py-1.5 rounded-sm transition-colors ${
              activeTab === tab.id
                ? 'bg-[#172131] text-sky-400 border border-[#263447] font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: Facility Assessment Directory Table */}
      {activeTab === 'directory' && (
        <Card
          title="Pan-India Infrastructure Environmental Register"
          subtitle="Tabular inventory of mapped facilities, risk screening scores, and data confidence ratings"
          icon={<Building2 className="w-4 h-4 text-sky-400" />}
          headerAction={
            <div className="flex items-center gap-2 print:hidden">
              <div className="relative w-44">
                <Search className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter table..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#172131] border border-[#263447] rounded-sm pl-6 pr-2 py-1 text-xs text-slate-200 focus:outline-none font-mono"
                />
              </div>
              <Button
                variant="primary"
                size="xs"
                icon={<Download className="w-3.5 h-3.5 text-slate-950" />}
                onClick={handleExportFacilitiesCsv}
              >
                Export CSV
              </Button>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#263447] text-slate-400 text-[10px] uppercase bg-[#172131]/50">
                  <th className="p-2.5">Facility Name</th>
                  <th className="p-2.5">Category</th>
                  <th className="p-2.5">State & District</th>
                  <th className="p-2.5">Capacity</th>
                  <th className="p-2.5">Screening Risk</th>
                  <th className="p-2.5">Water Stress</th>
                  <th className="p-2.5">Grid Pressure</th>
                  <th className="p-2.5">Air Pollution</th>
                  <th className="p-2.5">Confidence</th>
                  <th className="p-2.5 text-right">Dossier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#263447]/60">
                {filteredFacilities.map((f) => (
                  <tr key={f.id} className="hover:bg-[#172131]/40">
                    <td className="p-2.5 font-bold text-slate-100 font-sans">{f.name}</td>
                    <td className="p-2.5 uppercase text-slate-400 text-[11px]">
                      {f.type.replace('_', ' ')}
                    </td>
                    <td className="p-2.5 text-slate-300">
                      {f.district}, {f.state}
                    </td>
                    <td className="p-2.5 text-emerald-400 font-semibold">
                      {f.capacityMw ? `${f.capacityMw} MW` : 'N/A'}
                    </td>
                    <td className="p-2.5">
                      <RiskBadge level={f.riskLevel} score={f.overallRiskScore} />
                    </td>
                    <td className="p-2.5">{f.indicators.waterStress}%</td>
                    <td className="p-2.5">{f.indicators.gridPressure}%</td>
                    <td className="p-2.5">{f.indicators.airPollution} µg/m³</td>
                    <td className="p-2.5">
                      <span className="text-sky-400">{f.provenance.confidenceScore}%</span>
                    </td>
                    <td className="p-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFacilityId(f.id);
                          setActiveTab('dossier');
                        }}
                        className="text-sky-400 hover:text-sky-300 text-xs hover:underline"
                      >
                        View Report
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 2: Generated Executive Dossier (Printable View) */}
      {activeTab === 'dossier' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between print:hidden">
            <div className="flex items-center gap-3">
              <label className="text-xs text-slate-400 font-mono">Select Facility for Dossier:</label>
              <select
                value={selectedFacilityId}
                onChange={(e) => setSelectedFacilityId(e.target.value)}
                className="bg-[#111827] border border-[#263447] text-slate-100 rounded-sm px-3 py-1.5 text-xs font-mono"
              >
                {DEMO_FACILITIES.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.state})
                  </option>
                ))}
              </select>
            </div>
            <Button
              variant="primary"
              size="xs"
              icon={<Printer className="w-3.5 h-3.5 text-slate-950" />}
              onClick={() => window.print()}
            >
              Print / Save as PDF
            </Button>
          </div>

          {/* Printable Report Sheet */}
          <div className="bg-[#111827] border border-[#263447] p-6 rounded-sm space-y-6 print:bg-white print:border-none print:p-0 print:text-black">
            {/* Header */}
            <div className="border-b-2 border-[#263447] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:border-black">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-bold block print:text-black">
                  ECOSITE TERMINAL • ENVIRONMENTAL INTELLIGENCE DOSSIER
                </span>
                <h2 className="text-xl font-bold font-mono text-slate-100 print:text-black">
                  {selectedFacility.name}
                </h2>
                <p className="text-xs font-mono text-slate-400 print:text-gray-600">
                  Coordinates: [{selectedFacility.coordinates[1].toFixed(4)}°N, {selectedFacility.coordinates[0].toFixed(4)}°E] • {selectedFacility.district}, {selectedFacility.state}
                </p>
              </div>
              <div className="text-right">
                <RiskBadge level={selectedFacility.riskLevel} score={selectedFacility.overallRiskScore} />
                <span className="text-[10px] font-mono text-slate-500 block mt-1 print:text-gray-500">
                  Report Generated: {new Date().toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Metadata Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#172131]/60 p-3 rounded border border-[#263447] font-mono text-xs print:bg-gray-100 print:border-gray-300">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase">Infrastructure Type</span>
                <span className="font-bold text-slate-200 uppercase print:text-black">
                  {selectedFacility.type.replace('_', ' ')}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase">Installed Capacity</span>
                <span className="font-bold text-emerald-400 print:text-black">
                  {selectedFacility.capacityMw ? `${selectedFacility.capacityMw} MW` : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase">Operator</span>
                <span className="font-bold text-slate-200 truncate block print:text-black">
                  {selectedFacility.operator}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase">Surrounding Population (5km)</span>
                <span className="font-bold text-slate-200 print:text-black">
                  {selectedFacility.nearbyPopulation.radius5km.toLocaleString()} persons
                </span>
              </div>
            </div>

            {/* Risk Indicator Breakdown Table */}
            <div className="space-y-2">
              <h3 className="text-xs font-mono uppercase font-bold text-slate-300 tracking-wider print:text-black">
                Multispectral Indicator Screening Scores
              </h3>
              <table className="w-full text-left font-mono text-xs border border-[#263447] print:border-gray-300">
                <thead>
                  <tr className="bg-[#172131] border-b border-[#263447] text-slate-400 text-[10px] uppercase print:bg-gray-200 print:text-black">
                    <th className="p-2">Indicator Domain</th>
                    <th className="p-2">Screening Score</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Statutory Dataset Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#263447] print:divide-gray-300">
                  <tr>
                    <td className="p-2">Groundwater Stress</td>
                    <td className="p-2 font-bold">{selectedFacility.indicators.waterStress}/100</td>
                    <td className="p-2">
                      <RiskBadge level={selectedFacility.indicators.waterStress >= 80 ? 'critical' : selectedFacility.indicators.waterStress >= 65 ? 'high' : 'moderate'} />
                    </td>
                    <td className="p-2 text-slate-400 print:text-gray-600">Central Ground Water Board (CGWB) Dynamic Assessment</td>
                  </tr>
                  <tr>
                    <td className="p-2">Energy & Grid Pressure</td>
                    <td className="p-2 font-bold">{selectedFacility.indicators.gridPressure}/100</td>
                    <td className="p-2">
                      <RiskBadge level={selectedFacility.indicators.gridPressure >= 80 ? 'critical' : selectedFacility.indicators.gridPressure >= 65 ? 'high' : 'moderate'} />
                    </td>
                    <td className="p-2 text-slate-400 print:text-gray-600">CEA Transmission Telemetry & NLDC Load Register</td>
                  </tr>
                  <tr>
                    <td className="p-2">Ambient Air Pollution</td>
                    <td className="p-2 font-bold">{selectedFacility.indicators.airPollution}/100</td>
                    <td className="p-2">
                      <RiskBadge level={selectedFacility.indicators.airPollution >= 80 ? 'critical' : selectedFacility.indicators.airPollution >= 65 ? 'high' : 'moderate'} />
                    </td>
                    <td className="p-2 text-slate-400 print:text-gray-600">CPCB CAAQMS Station Monitoring (PM2.5 / PM10)</td>
                  </tr>
                  <tr>
                    <td className="p-2">Heat Island Exposure</td>
                    <td className="p-2 font-bold">{selectedFacility.indicators.heatExposure}/100</td>
                    <td className="p-2">
                      <RiskBadge level={selectedFacility.indicators.heatExposure >= 80 ? 'critical' : selectedFacility.indicators.heatExposure >= 65 ? 'high' : 'moderate'} />
                    </td>
                    <td className="p-2 text-slate-400 print:text-gray-600">ISRO Bhuvan / NASA MODIS Land Surface Temp</td>
                  </tr>
                  <tr>
                    <td className="p-2">Flood Inundation Hazard</td>
                    <td className="p-2 font-bold">{selectedFacility.indicators.floodHazard}/100</td>
                    <td className="p-2">
                      <RiskBadge level={selectedFacility.indicators.floodHazard >= 80 ? 'critical' : selectedFacility.indicators.floodHazard >= 65 ? 'high' : 'moderate'} />
                    </td>
                    <td className="p-2 text-slate-400 print:text-gray-600">NDMA Flood Risk Contour & River Basin Atlas</td>
                  </tr>
                  <tr>
                    <td className="p-2">Biodiversity Constraints</td>
                    <td className="p-2 font-bold">{selectedFacility.indicators.biodiversityConstraint}/100</td>
                    <td className="p-2">
                      <RiskBadge level={selectedFacility.indicators.biodiversityConstraint >= 80 ? 'critical' : selectedFacility.indicators.biodiversityConstraint >= 65 ? 'high' : 'moderate'} />
                    </td>
                    <td className="p-2 text-slate-400 print:text-gray-600">Wildlife Institute of India (WII) Gazetted ESZ 10km Buffer</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Key Risk Drivers */}
            <div className="space-y-1.5">
              <h3 className="text-xs font-mono uppercase font-bold text-slate-300 tracking-wider print:text-black">
                Primary Contributing Risk Drivers
              </h3>
              <ul className="list-disc list-inside text-xs text-slate-300 space-y-1 print:text-gray-800">
                {selectedFacility.keyRiskFactors.map((k, idx) => (
                  <li key={idx}>{k}</li>
                ))}
              </ul>
            </div>

            {/* Disclaimer */}
            <div className="border-t border-[#263447] pt-3 text-[10px] font-mono text-slate-500 leading-relaxed print:border-gray-400 print:text-gray-500">
              Disclaimer: This executive intelligence report is generated by EcoSite Terminal for regional screening and pre-feasibility infrastructure assessment. It does not replace a statutory Environmental Impact Assessment (EIA) required under the Environment (Protection) Act, 1986.
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Dataset Provenance Catalog */}
      {activeTab === 'provenance' && (
        <Card
          title="Statutory & Scientific Dataset Provenance Catalog"
          subtitle="Complete register of all 14 official Indian and global environmental and energy data feeds"
          icon={<Database className="w-4 h-4 text-emerald-400" />}
          headerAction={
            <Button
              variant="primary"
              size="xs"
              icon={<Download className="w-3.5 h-3.5 text-slate-950" />}
              onClick={handleExportProvenanceCsv}
            >
              Export Provenance CSV
            </Button>
          }
        >
          <div className="space-y-3 font-mono text-xs">
            {DATA_PROVENANCE_CATALOG.map((p) => (
              <div
                key={p.id}
                className="p-3.5 bg-[#172131]/60 border border-[#263447] rounded-sm space-y-2"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#263447]/60 pb-2">
                  <div>
                    <span className="text-[10px] text-sky-400 uppercase tracking-wider block">
                      {p.category} • {p.organizationType}
                    </span>
                    <h3 className="text-sm font-bold text-slate-100 font-sans">{p.datasetName}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold">
                      {p.confidenceScore}% Confidence
                    </span>
                    <span className="px-2 py-0.5 rounded bg-[#111827] text-slate-300 border border-[#263447] text-[10px] uppercase">
                      {p.dataStatus}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                  {p.description}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] text-slate-400 pt-1">
                  <div>
                    <span className="text-slate-500 block uppercase">Organization</span>
                    <span className="text-slate-300 truncate block">{p.organization}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block uppercase">Update Cycle</span>
                    <span className="text-slate-300">{p.updateFrequency} ({p.lastUpdated})</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block uppercase">Spatial Resolution</span>
                    <span className="text-slate-300">{p.spatialResolution}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block uppercase">Statutory Basis</span>
                    <span className="text-slate-300 truncate block">{p.statutoryBasis}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* TAB 4: Mitigation Action Master Register */}
      {activeTab === 'mitigation' && (
        <Card
          title="Sustainability Mitigation Actions Master Register"
          subtitle="Engineering interventions catalog with responsible stakeholders, timelines, and quantified benefits"
          icon={<Sparkles className="w-4 h-4 text-amber-400" />}
          headerAction={
            <Button
              variant="primary"
              size="xs"
              icon={<Download className="w-3.5 h-3.5 text-slate-950" />}
              onClick={handleExportMitigationCsv}
            >
              Export Mitigations CSV
            </Button>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#263447] text-slate-400 text-[10px] uppercase bg-[#172131]/50">
                  <th className="p-2.5">Intervention Action</th>
                  <th className="p-2.5">Domain</th>
                  <th className="p-2.5">Sector</th>
                  <th className="p-2.5">Priority</th>
                  <th className="p-2.5">Timeframe</th>
                  <th className="p-2.5">Lead Stakeholder</th>
                  <th className="p-2.5">Expected Environmental Benefit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#263447]/60">
                {DEMO_MITIGATION_CATALOG.map((m) => (
                  <tr key={m.id} className="hover:bg-[#172131]/40">
                    <td className="p-2.5 font-bold text-slate-100 font-sans">{m.title}</td>
                    <td className="p-2.5 text-slate-300 text-[11px]">{m.category}</td>
                    <td className="p-2.5 uppercase text-slate-400 text-[10px]">
                      {m.facilityType.replace('_', ' ')}
                    </td>
                    <td className="p-2.5">
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                          m.priority === 'High'
                            ? 'text-rose-400 bg-rose-950 border border-rose-800'
                            : 'text-amber-400 bg-amber-950 border border-amber-800'
                        }`}
                      >
                        {m.priority}
                      </span>
                    </td>
                    <td className="p-2.5 text-slate-300">{m.timeframe}</td>
                    <td className="p-2.5 text-slate-400 truncate max-w-[150px]">{m.responsibleStakeholder}</td>
                    <td className="p-2.5 text-slate-300 font-sans text-[11px] leading-snug">
                      {m.expectedBenefit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
