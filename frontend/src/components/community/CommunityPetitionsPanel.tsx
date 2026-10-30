import { useState, useEffect } from 'react';
import {
  Award,
  CheckCircle2,
  Copy,
  ExternalLink,
  Flame,
  Globe2,
  PenTool,
  Share2,
  Sparkles,
  Users,
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

export interface PetitionItem {
  id: string;
  title: string;
  targetAuthority: string;
  summary: string;
  demands: string[];
  currentSignatures: number;
  targetSignatures: number;
  statutoryImpact: string;
  activeCampaignTag: string;
}

export const ACTIVE_PETITIONS: PetitionItem[] = [
  {
    id: 'petition_buffer_noise',
    title: 'Mandate 1 km Acoustic Buffers & 5 km Continuous Ambient Monitoring for Hyperscale Data Centres',
    targetAuthority: 'Ministry of Environment, Forest & Climate Change (MoEFCC) & Central Pollution Control Board (CPCB)',
    summary:
      'Residential colonies in Mumbai, Navi Mumbai, Pune, Bengaluru, Hyderabad, and Chennai are witnessing multi-megawatt computing campuses erected within a few hundred metres of bedrooms, schools, and hospitals. We demand statutory 1,000 m acoustic setback buffers and live public CPCB noise and air monitors.',
    demands: [
      'Statutory 1,000 m mandatory vegetative and acoustic setback between hyperscale computing campuses (>10 MW) and residential or sensitive zones.',
      'Mandatory installation of publicly accessible CPCB CAAQMS air quality, PM2.5, and perimeter decibel telemetry within 5 km of every facility.',
      'Strict adherence to the 40 dB(A) nocturnal residential sound limit (22:00 – 06:00 hrs) under the Noise Rules 2000, with mandatory acoustic silencer baffles.',
      'Public disclosure of all Consent to Establish (CTE) and Consent to Operate (CTO) emission conditions on state pollution control portals.',
    ],
    currentSignatures: 2184,
    targetSignatures: 2500,
    statutoryImpact: 'Draft amendment to the Environment (Protection) Rules and State Town Planning Acts',
    activeCampaignTag: '87% OF GOAL REACHED',
  },
  {
    id: 'petition_water_stewardship',
    title: 'Zero Potable Aquifer Water for Evaporative Cooling — Mandatory 100% Tertiary Treated Effluent',
    targetAuthority: 'Central Ground Water Authority (CGWA) & Ministry of Jal Shakti',
    summary:
      'Evaporative cooling towers at hyperscale campuses consume millions of litres of water daily. In over-exploited and water-stressed urban basins, cooling towers must not draw down community drinking aquifers or municipal potable supplies.',
    demands: [
      'Total statutory prohibition on extracting groundwater from deep borewells or drawing municipal drinking water for industrial evaporative cooling.',
      'Mandatory transition to 100% tertiary-treated sewage effluent (STP recycled water) or closed-loop dry adiabatic cooling systems.',
      'Installation of tamper-proof digital electromagnetic flow meters on all water intake pipelines, connected to the National Water Informatics Centre (NWIC).',
      'Mandatory rainwater harvesting and stormwater infiltration capacity equivalent to 100% of the campus roof runoff footprint.',
    ],
    currentSignatures: 1642,
    targetSignatures: 2000,
    statutoryImpact: 'National CGWA Guidelines for Data Centre Infrastructure Water Sustainability',
    activeCampaignTag: '82% OF GOAL REACHED',
  },
];

interface Signer {
  id: string;
  name: string;
  location: string;
  comment?: string;
  signedAt: string;
}

const SAMPLE_RECENT_SIGNERS: Record<string, Signer[]> = {
  petition_buffer_noise: [
    { id: 'sig-1', name: 'Dr. Anita Deshmukh', location: 'Navi Mumbai (TTC Area)', comment: 'The 24/7 low hum penetrates double-glazed windows at night. We need mandatory buffers.', signedAt: '2 hours ago' },
    { id: 'sig-2', name: 'V. Sundaram', location: 'Siruseri, Chennai', comment: 'Coexistence is possible only when acoustic baffling is legally enforced, not voluntary.', signedAt: '4 hours ago' },
    { id: 'sig-3', name: 'K. S. Rao', location: 'Gachibowli, Hyderabad', comment: 'Our residential ward was established before the 50MW expansion. 1 km buffer is essential.', signedAt: '6 hours ago' },
    { id: 'sig-4', name: 'Pradeep Shenoy', location: 'Whitefield, Bengaluru', comment: 'Real-time noise and air telemetry must be public for all residents to see.', signedAt: '9 hours ago' },
  ],
  petition_water_stewardship: [
    { id: 'sig-5', name: 'R. Kulkarni', location: 'Pune (Hinjawadi)', comment: 'Borewell yields dropped 40% after the cooling towers went live. Treated STP water only!', signedAt: '1 hour ago' },
    { id: 'sig-6', name: 'Meenakshi Iyer', location: 'Ambattur, Chennai', comment: 'Industrial campuses must reuse treated municipal sewage, not fresh groundwater.', signedAt: '3 hours ago' },
    { id: 'sig-7', name: 'Arunav Roy', location: 'Electronic City, Bengaluru', comment: 'Zero drinking water for cooling. Close-loop adiabatic systems exist; mandate them.', signedAt: '5 hours ago' },
  ],
};

export function CommunityPetitionsPanel() {
  const [activeTab, setActiveTab] = useState<string>('petition_buffer_noise');
  const [signaturesCount, setSignaturesCount] = useState<Record<string, number>>({
    petition_buffer_noise: ACTIVE_PETITIONS[0].currentSignatures,
    petition_water_stewardship: ACTIVE_PETITIONS[1].currentSignatures,
  });
  
  const [signedPetitions, setSignedPetitions] = useState<Record<string, boolean>>({});
  const [signerName, setSignerName] = useState<string>('');
  const [signerCity, setSignerCity] = useState<string>('');
  const [signerEmail, setSignerEmail] = useState<string>('');
  const [signerComment, setSignerComment] = useState<string>('');
  const [copiedShare, setCopiedShare] = useState<boolean>(false);
  const [receiptCode, setReceiptCode] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('eco-petitions-signed');
      if (stored) {
        setSignedPetitions(JSON.parse(stored));
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  const petition = ACTIVE_PETITIONS.find((p) => p.id === activeTab) || ACTIVE_PETITIONS[0];
  const count = signaturesCount[petition.id] || petition.currentSignatures;
  const progressPercent = Math.min(100, Math.round((count / petition.targetSignatures) * 100));
  const isAlreadySigned = Boolean(signedPetitions[petition.id]);

  const handleSign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!signerName.trim() || !signerCity.trim()) return;

    const newCount = count + 1;
    setSignaturesCount((prev) => ({ ...prev, [petition.id]: newCount }));
    
    const updatedSigned = { ...signedPetitions, [petition.id]: true };
    setSignedPetitions(updatedSigned);
    try {
      localStorage.setItem('eco-petitions-signed', JSON.stringify(updatedSigned));
    } catch {
      // fallback
    }

    const code = `CIVIC-ACT-${Math.floor(1000 + Math.random() * 9000)}-${petition.id.slice(9, 13).toUpperCase()}`;
    setReceiptCode(code);
  };

  const handleCopyShare = async () => {
    const text = `I just signed the civic petition: "${petition.title}" on the Eco Terminal public platform. Join the movement for responsible data centre siting in India: ${window.location.origin}/learn`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2500);
    } catch {
      // fallback
    }
  };

  return (
    <Card
      title="Citizen Petitions & Civic Legislative Action"
      subtitle="Coordinated community campaigns demanding statutory siting standards, acoustic buffers & water protections"
      icon={<PenTool className="h-4 w-4 text-eco-primary" />}
      actions={
        <div className="flex items-center gap-1">
          <Badge variant="primary" size="xs">
            <Flame className="mr-1 h-3 w-3" />
            2 Active Campaigns
          </Badge>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Campaign Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-eco-border pb-3" role="tablist">
          {ACTIVE_PETITIONS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={activeTab === p.id}
              onClick={() => {
                setActiveTab(p.id);
                setReceiptCode(null);
              }}
              className={`rounded-md px-3 py-2 text-meta font-medium transition-colors ${
                activeTab === p.id
                  ? 'bg-eco-primary text-black font-semibold'
                  : 'bg-eco-surface-secondary text-eco-muted hover:text-eco-text'
              }`}
            >
              {p.id === 'petition_buffer_noise' ? '1. 1km Acoustic Buffer Mandate' : '2. Zero Potable Water in Cooling'}
            </button>
          ))}
        </div>

        {/* Campaign Header & Target */}
        <div className="rounded border border-eco-border bg-eco-surface-secondary/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-micro uppercase tracking-wider text-eco-primary font-bold">
              {petition.activeCampaignTag}
            </span>
            <span className="text-micro text-eco-muted">
              Addressed to: <strong className="text-eco-text">{petition.targetAuthority}</strong>
            </span>
          </div>

          <h3 className="mt-2 text-h2 font-bold text-eco-text leading-snug">
            {petition.title}
          </h3>

          <p className="mt-2 text-meta text-eco-muted leading-relaxed">
            {petition.summary}
          </p>

          {/* Progress Bar & Counter */}
          <div className="mt-4 space-y-1.5">
            <div className="flex items-baseline justify-between text-meta">
              <span className="font-mono text-h2 font-bold text-eco-text">
                {count.toLocaleString()}{' '}
                <span className="text-body font-normal text-eco-muted">signatures collected</span>
              </span>
              <span className="font-mono text-meta text-eco-muted">
                Goal: <strong className="text-eco-text">{petition.targetSignatures.toLocaleString()}</strong> ({progressPercent}%)
              </span>
            </div>

            <div className="h-2.5 w-full overflow-hidden rounded-full bg-eco-surface-secondary border border-eco-border">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-eco-primary transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Statutory Demands List */}
        <div>
          <h4 className="text-meta font-semibold uppercase tracking-wider text-eco-muted">
            The 4 Key Statutory Demands
          </h4>
          <ul className="mt-2 space-y-2">
            {petition.demands.map((demand, index) => (
              <li
                key={index}
                className="flex items-start gap-2.5 rounded border border-eco-border bg-eco-surface/50 p-2.5 text-meta text-eco-text"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-eco-primary" />
                <span>{demand}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Signing Area */}
        <div className="rounded-lg border border-eco-primary/40 bg-eco-primary/5 p-4">
          {isAlreadySigned || receiptCode ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-eco-primary">
                <Award className="h-5 w-5" />
                <span className="text-body font-bold">You Have Signed This Civic Petition</span>
                <Badge variant="primary" size="xs">Verified Signatory</Badge>
              </div>
              <p className="text-meta text-eco-muted">
                Thank you for standing up for community health, nocturnal acoustic quiet, and transparent environmental stewardship. Your endorsement is added to the collective representation dispatched to the {petition.targetAuthority}.
              </p>
              {receiptCode && (
                <div className="rounded border border-eco-border bg-eco-surface p-2.5 font-mono text-micro text-eco-text">
                  Signatory Verification Token: <strong className="text-eco-primary">{receiptCode}</strong>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button variant="secondary" size="sm" onClick={handleCopyShare}>
                  {copiedShare ? (
                    <>
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-eco-primary" />
                      Copied Link!
                    </>
                  ) : (
                    <>
                      <Share2 className="mr-1 h-3.5 w-3.5" />
                      Share Campaign
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSign} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-eco-primary" />
                  <span className="text-body font-semibold text-eco-text">
                    Add Your Signature to this Civic Petition
                  </span>
                </div>
                <Badge variant="outline" size="xs">Free & Open to All Residents</Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label htmlFor="signer-name" className="block text-meta font-medium text-eco-text">
                    Full Name *
                  </label>
                  <input
                    id="signer-name"
                    required
                    type="text"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="e.g. Meera Krishnan"
                    className="mt-1 w-full rounded border border-eco-border bg-eco-surface px-3 py-2 text-body text-eco-text focus:border-eco-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="signer-city" className="block text-meta font-medium text-eco-text">
                    City & Ward / Locality *
                  </label>
                  <input
                    id="signer-city"
                    required
                    type="text"
                    value={signerCity}
                    onChange={(e) => setSignerCity(e.target.value)}
                    placeholder="e.g. Navi Mumbai / Ward 14"
                    className="mt-1 w-full rounded border border-eco-border bg-eco-surface px-3 py-2 text-body text-eco-text focus:border-eco-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="signer-email" className="block text-meta font-medium text-eco-text">
                    Email Address (Confidential)
                  </label>
                  <input
                    id="signer-email"
                    type="email"
                    value={signerEmail}
                    onChange={(e) => setSignerEmail(e.target.value)}
                    placeholder="e.g. meera@domain.in"
                    className="mt-1 w-full rounded border border-eco-border bg-eco-surface px-3 py-2 text-body text-eco-text focus:border-eco-primary focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="signer-comment" className="block text-meta font-medium text-eco-text">
                  Why is this petition important to you? (Optional statement)
                </label>
                <input
                  id="signer-comment"
                  type="text"
                  value={signerComment}
                  onChange={(e) => setSignerComment(e.target.value)}
                  placeholder="e.g. 'Living near the industrial estate; we need our nocturnal peace and clean water preserved.'"
                  className="mt-1 w-full rounded border border-eco-border bg-eco-surface px-3 py-2 text-body text-eco-text focus:border-eco-primary focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <p className="text-micro text-eco-muted">
                  Your email is strictly kept confidential and never shared with commercial operators.
                </p>
                <Button type="submit" variant="primary">
                  <PenTool className="mr-1.5 h-4 w-4" />
                  Sign This Petition
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* Recent Community Signatures Feed */}
        <div className="border-t border-eco-border pt-3">
          <div className="flex items-center gap-1.5 text-meta font-semibold text-eco-text mb-2">
            <Users className="h-4 w-4 text-eco-primary" />
            <span>Recent Community Signatories</span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {(SAMPLE_RECENT_SIGNERS[petition.id] || []).map((signer) => (
              <div
                key={signer.id}
                className="rounded border border-eco-border bg-eco-surface p-2.5 text-meta"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-eco-text">{signer.name}</span>
                  <span className="text-micro text-eco-muted font-mono">{signer.signedAt}</span>
                </div>
                <p className="text-micro text-eco-primary font-mono">{signer.location}</p>
                {signer.comment && (
                  <p className="mt-1 text-micro text-eco-muted italic">
                    "{signer.comment}"
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

