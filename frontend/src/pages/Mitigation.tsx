import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Clock,
  UserCheck,
  ShieldCheck,
  Download,
  Filter,
} from 'lucide-react';
import { DEMO_FACILITIES } from '../data/demo/facilities';
import {
  generateAIMitigationPlan,
  getMitigationRecommendations,
  type MitigationPlanRequest,
} from '../services/mitigation';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import type { Facility, MitigationRecommendation } from '../types';

export const Mitigation: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const facilityIdParam = searchParams.get('facility');

  const [selectedFacility, setSelectedFacility] = useState<Facility>(
    DEMO_FACILITIES.find((f) => f.id === facilityIdParam) || DEMO_FACILITIES[0]
  );

  const [recommendations, setRecommendations] = useState<MitigationRecommendation[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [customConstraints, setCustomConstraints] = useState('');
  const [generating, setGenerating] = useState(false);

  // Load recommendations when selected facility changes
  useEffect(() => {
    getMitigationRecommendations(selectedFacility.type).then((recs) => {
      setRecommendations(recs);
    });
  }, [selectedFacility]);

  // Handle facility dropdown selection
  const handleFacilitySelect = (id: string) => {
    const found = DEMO_FACILITIES.find((f) => f.id === id);
    if (found) {
      setSelectedFacility(found);
      setSearchParams({ facility: found.id });
    }
  };

  // Generate tailored AI mitigation strategy using Gemini endpoint simulation
  const handleGenerateAIStrategy = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);

    const req: MitigationPlanRequest = {
      facility_id: selectedFacility.id,
      facility_type: selectedFacility.type,
      constraints: customConstraints,
    };

    try {
      const res = await generateAIMitigationPlan(req, selectedFacility);
      setRecommendations(res);
    } finally {
      setGenerating(false);
    }
  };

  const categories = [
    'all',
    'Water Conservation',
    'Renewable Energy',
    'Energy Efficiency',
    'Waste & Emissions',
    'Ecology & Community',
  ];

  const filteredRecs = recommendations.filter((r) => {
    if (selectedCategory === 'all') return true;
    return r.category === selectedCategory;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080D16] overflow-y-auto p-4 md:p-6 space-y-6 select-none font-sans">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#263447]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-mono tracking-wider text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800">
              Module 05
            </span>
            <div className="flex items-center gap-3">
              <h1 className="text-lg md:text-xl font-bold text-slate-100 font-mono tracking-tight flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <span>AI-Assisted Environmental Mitigation Planner</span>
              </h1>
              <span className="text-[10px] text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 rounded font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Gemini 3.7 Flash Connected</span>
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Structured sustainability and environmental engineering intervention roadmaps derived from site-specific vulnerability indicators and statutory compliance norms.
          </p>
        </div>

        {/* Facility Selector */}
        <div className="flex items-center gap-3 shrink-0">
          <label className="text-xs text-slate-400 font-mono">Select Facility:</label>
          <select
            value={selectedFacility.id}
            onChange={(e) => handleFacilitySelect(e.target.value)}
            className="bg-[#111827] border border-[#263447] text-slate-100 rounded-sm px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-sky-500 max-w-xs"
          >
            {DEMO_FACILITIES.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.state} - {f.type.replace('_', ' ')})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Facility Vulnerabilities Summary Banner */}
      <div className="bg-[#111827] border border-[#263447] rounded-sm p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-[#263447]/60 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-slate-200">
              Identified Environmental Vulnerabilities: {selectedFacility.name}
            </span>
            <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-[#172131] text-sky-400 border border-[#263447]">
              {selectedFacility.type.replace('_', ' ')}
            </span>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Compound Risk: <strong className="text-amber-400">{selectedFacility.overallRiskScore}/100</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 text-xs font-mono">
          {selectedFacility.keyRiskFactors.map((factor, i) => (
            <div key={i} className="p-2 bg-[#172131]/60 rounded border border-[#263447] text-slate-300 leading-relaxed text-[11px] flex items-start gap-1.5">
              <span className="text-amber-400 mt-0.5">•</span>
              <span>{factor}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Gemini AI Custom Constraints Generator */}
      <Card
        title="Gemini AI Engineering Intervention Assistant"
        subtitle="Prompt the AI with site constraints (e.g. CAPEX budget, water recycling mandates, target PUE)"
        icon={<Sparkles className="w-4 h-4 text-amber-400" />}
      >
        <form onSubmit={handleGenerateAIStrategy} className="space-y-3 font-mono text-xs">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="e.g. Implement zero-liquid discharge, transition to tertiary treated municipal water, target PUE < 1.30 within ₹12 Cr..."
              value={customConstraints}
              onChange={(e) => setCustomConstraints(e.target.value)}
              className="flex-1 bg-[#172131] border border-[#263447] rounded-sm px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 font-sans"
            />
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={generating}
              icon={<Sparkles className="w-4 h-4 text-slate-950" />}
              className="shrink-0 font-mono"
            >
              Generate Live Gemini Plan
            </Button>
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span className="flex items-center gap-1 text-emerald-400">
              <Sparkles className="w-3 h-3" />
              <span>Live inference via Google Gemini 3.7 Flash</span>
            </span>
            <span className="font-mono">Model: gemini-3.7-flash</span>
          </div>
        </form>
      </Card>

      {/* Category Tabs */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-slate-400 font-mono flex items-center gap-1 mr-2">
          <Filter className="w-3.5 h-3.5 text-sky-400" />
          <span>Filter Action Domain:</span>
        </span>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1 rounded-sm text-xs font-mono capitalize transition-colors ${
              selectedCategory === cat
                ? 'bg-[#1E2C42] text-sky-400 border border-sky-500 font-bold'
                : 'bg-[#111827] text-slate-400 border border-[#263447] hover:text-slate-200'
            }`}
          >
            {cat === 'all' ? 'All Intervention Domains' : cat}
          </button>
        ))}
      </div>

      {/* Actionable Recommendations List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-slate-400">
            Displaying {filteredRecs.length} Actionable Engineering Interventions
          </span>
          <Button
            variant="outline"
            size="xs"
            icon={<Download className="w-3.5 h-3.5 text-slate-400" />}
            onClick={() => navigate(`/reports?facility=${selectedFacility.id}`)}
          >
            Export Action Plan to CSV
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredRecs.map((rec) => (
            <div
              key={rec.id}
              className="bg-[#111827] border border-[#263447] rounded-sm p-4 space-y-3 hover:border-slate-600 transition-colors flex flex-col justify-between"
            >
              <div className="space-y-2">
                {/* Header Badges */}
                <div className="flex items-start justify-between gap-2 border-b border-[#263447]/60 pb-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-sky-950 text-sky-400 border border-sky-800">
                        {rec.category}
                      </span>
                      <span
                        className={`text-[10px] font-mono uppercase px-1.5 py-0.2 rounded font-bold ${
                          rec.priority === 'High'
                            ? 'bg-rose-950 text-rose-400 border border-rose-800'
                            : rec.priority === 'Medium'
                            ? 'bg-amber-950 text-amber-400 border border-amber-800'
                            : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        }`}
                      >
                        {rec.priority} Priority
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-100">{rec.title}</h3>
                  </div>
                </div>

                {/* Expected Environmental Benefit */}
                <div className="p-2.5 bg-[#172131]/60 rounded border border-[#263447] space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-semibold block">
                    Quantifiable Environmental Benefit
                  </span>
                  <p className="text-xs text-slate-200 leading-relaxed font-sans">
                    {rec.expectedBenefit}
                  </p>
                </div>

                {/* Implementation Attributes */}
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400 pt-1">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-sky-400" />
                    <span>Timeframe: <strong className="text-slate-200">{rec.timeframe}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-purple-400" />
                    <span className="truncate">Lead: <strong className="text-slate-200">{rec.responsibleStakeholder}</strong></span>
                  </div>
                </div>

                {/* Supporting Scientific Evidence */}
                <div className="space-y-1 text-xs">
                  <span className="text-[10px] font-mono text-slate-500 uppercase block">
                    Statutory & Technical Benchmark Reference
                  </span>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {rec.supportingEvidence}
                  </p>
                </div>
              </div>

              {/* Site-Specific Verification Requirements */}
              <div className="pt-2 border-t border-[#263447]/60 text-[11px] text-slate-400 font-mono flex items-start gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span>Verification: {rec.verificationRequirements}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
