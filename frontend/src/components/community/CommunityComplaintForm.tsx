import { useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Check,
  Clock,
  Copy,
  Download,
  Droplets,
  FileText,
  Scale,
  Send,
  ShieldAlert,
  Volume2,
  Wind,
  Zap,
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

export interface DataCenterOption {
  id: string;
  name: string;
  operator: string;
  locality: string;
  city: string;
  stateCode: 'IN-MH' | 'IN-TG' | 'IN-KA' | 'IN-TN';
  stateName: string;
  spcb: string;
}

export const KNOWN_DATA_CENTRES: DataCenterOption[] = [
  { id: 'iron-mountain-mum-1', name: 'MUM-1', operator: 'Iron Mountain', locality: 'Navi Mumbai', city: 'Navi Mumbai', stateCode: 'IN-MH', stateName: 'Maharashtra', spcb: 'Maharashtra Pollution Control Board (MPCB)' },
  { id: 'iron-mountain-mum-2', name: 'MUM-2', operator: 'Iron Mountain', locality: 'Navi Mumbai', city: 'Navi Mumbai', stateCode: 'IN-MH', stateName: 'Maharashtra', spcb: 'Maharashtra Pollution Control Board (MPCB)' },
  { id: 'ctrls-mumbai-dc-1-2', name: 'Mumbai DC1 & DC2', operator: 'CtrlS', locality: 'Navi Mumbai', city: 'Navi Mumbai', stateCode: 'IN-MH', stateName: 'Maharashtra', spcb: 'Maharashtra Pollution Control Board (MPCB)' },
  { id: 'ctrls-mumbai-dc-3', name: 'Mumbai DC3', operator: 'CtrlS', locality: 'Navi Mumbai', city: 'Navi Mumbai', stateCode: 'IN-MH', stateName: 'Maharashtra', spcb: 'Maharashtra Pollution Control Board (MPCB)' },
  { id: 'ctrls-mumbai-dc-4', name: 'Mumbai DC4', operator: 'CtrlS', locality: 'Navi Mumbai', city: 'Navi Mumbai', stateCode: 'IN-MH', stateName: 'Maharashtra', spcb: 'Maharashtra Pollution Control Board (MPCB)' },
  { id: 'ctrls-mumbai-dc-5', name: 'Mumbai DC5', operator: 'CtrlS', locality: 'Navi Mumbai', city: 'Navi Mumbai', stateCode: 'IN-MH', stateName: 'Maharashtra', spcb: 'Maharashtra Pollution Control Board (MPCB)' },
  { id: 'stt-mumbai-dc-2', name: 'STT Mumbai DC2', operator: 'STT GDC', locality: 'Andheri East', city: 'Mumbai', stateCode: 'IN-MH', stateName: 'Maharashtra', spcb: 'Maharashtra Pollution Control Board (MPCB)' },
  { id: 'stt-pune-5', name: 'STT Pune 5', operator: 'STT GDC', locality: 'Pune', city: 'Pune', stateCode: 'IN-MH', stateName: 'Maharashtra', spcb: 'Maharashtra Pollution Control Board (MPCB)' },
  { id: 'stt-hyderabad-1', name: 'STT Hyderabad 1', operator: 'STT GDC', locality: 'HITEC City', city: 'Hyderabad', stateCode: 'IN-TG', stateName: 'Telangana', spcb: 'Telangana State Pollution Control Board (TSPCB)' },
  { id: 'ctrls-hyderabad-dc-1', name: 'Hyderabad DC1', operator: 'CtrlS', locality: 'Gachibowli', city: 'Hyderabad', stateCode: 'IN-TG', stateName: 'Telangana', spcb: 'Telangana State Pollution Control Board (TSPCB)' },
  { id: 'ctrls-hyderabad-dc-2', name: 'Hyderabad DC2', operator: 'CtrlS', locality: 'Gachibowli', city: 'Hyderabad', stateCode: 'IN-TG', stateName: 'Telangana', spcb: 'Telangana State Pollution Control Board (TSPCB)' },
  { id: 'ctrls-hyderabad-dc-3', name: 'Hyderabad DC3', operator: 'CtrlS', locality: 'Financial District', city: 'Hyderabad', stateCode: 'IN-TG', stateName: 'Telangana', spcb: 'Telangana State Pollution Control Board (TSPCB)' },
  { id: 'ctrls-bangalore-dc-1', name: 'Bangalore DC1', operator: 'CtrlS', locality: 'Electronic City', city: 'Bengaluru', stateCode: 'IN-KA', stateName: 'Karnataka', spcb: 'Karnataka State Pollution Control Board (KSPCB)' },
  { id: 'ntt-bengaluru-2', name: 'Bengaluru 2', operator: 'NTT', locality: 'Whitefield', city: 'Bengaluru', stateCode: 'IN-KA', stateName: 'Karnataka', spcb: 'Karnataka State Pollution Control Board (KSPCB)' },
  { id: 'ntt-bengaluru-3', name: 'Bengaluru 3', operator: 'NTT', locality: 'Whitefield', city: 'Bengaluru', stateCode: 'IN-KA', stateName: 'Karnataka', spcb: 'Karnataka State Pollution Control Board (KSPCB)' },
  { id: 'adaniconnex-chennai-1', name: 'Chennai 1', operator: 'AdaniConneX', locality: 'Siruseri', city: 'Chennai', stateCode: 'IN-TN', stateName: 'Tamil Nadu', spcb: 'Tamil Nadu Pollution Control Board (TNPCB)' },
  { id: 'stt-chennai-2', name: 'STT Chennai 2', operator: 'STT GDC', locality: 'Ambattur', city: 'Chennai', stateCode: 'IN-TN', stateName: 'Tamil Nadu', spcb: 'Tamil Nadu Pollution Control Board (TNPCB)' },
  { id: 'stt-chennai-7', name: 'STT Chennai 7', operator: 'STT GDC', locality: 'Siruseri', city: 'Chennai', stateCode: 'IN-TN', stateName: 'Tamil Nadu', spcb: 'Tamil Nadu Pollution Control Board (TNPCB)' },
  { id: 'ctrls-chennai-datacenter-park', name: 'Chennai Datacenter Park', operator: 'CtrlS', locality: 'Ambattur', city: 'Chennai', stateCode: 'IN-TN', stateName: 'Tamil Nadu', spcb: 'Tamil Nadu Pollution Control Board (TNPCB)' },
  { id: 'unlisted-proposal', name: 'Unlisted / Proposed Data Centre Project', operator: 'Unknown / Under Evaluation', locality: 'Local Municipal Area', city: 'Metropolitan Area', stateCode: 'IN-MH', stateName: 'All States', spcb: 'Central Pollution Control Board (CPCB) / Relevant SPCB' },
];

export const GRIEVANCE_CATEGORIES = [
  {
    id: 'noise_hum',
    label: 'Acoustic Noise & Nocturnal Low-Frequency Hum',
    icon: Volume2,
    statute: 'Noise Pollution (Regulation and Control) Rules 2000 (Rule 3 & 5)',
    description: 'Relentless low-frequency drone or vibration from rooftop chillers, air-handling units, or unbaffled cooling fan arrays (especially during 22:00 – 06:00 quiet hours).',
    cpcbLimit: 'Residential nighttime ceiling: 40 dB(A) / Daytime: 50 dB(A)',
  },
  {
    id: 'dg_emissions',
    label: 'Diesel Generator Smoke, Soot & Odor',
    icon: Wind,
    statute: 'Air (Prevention and Control of Pollution) Act 1981 & CPCB DG Emission Norms',
    description: 'Dark exhaust plumes, toxic diesel particulate matter (PM2.5/PM10), or chemical odor during routine or unscheduled emergency generator test runs.',
    cpcbLimit: 'Requires acoustic enclosure (minimum 25 dB(A) insertion loss) & stack height H = h + 0.2*sqrt(kVA)',
  },
  {
    id: 'groundwater_depletion',
    label: 'Groundwater Depletion & Borewell Abstraction',
    icon: Droplets,
    statute: 'Central Ground Water Authority (CGWA) Guidelines 2020 / State Water Act',
    description: 'Heavy unauthorized extraction of local groundwater for cooling towers, drying out neighborhood residential borewells or illegal tanker replenishment.',
    cpcbLimit: 'Mandatory digital water telemetry & NOC from CGWA; commercial abstraction restricted in over-exploited blocks',
  },
  {
    id: 'thermal_island',
    label: 'Microclimate Heat Rejection & Grid Strain',
    icon: Zap,
    statute: 'State Electricity Regulatory Commission Standards & Municipal Environmental By-Laws',
    description: 'Intense warm air plumes rejected into adjacent residential colonies, or local distribution grid voltage sags during peak summer chiller pull.',
    cpcbLimit: 'Industrial siting regulations require adequate ambient thermal dissipation buffers',
  },
  {
    id: 'buffer_violation',
    label: 'Siting & Inadequate Buffer Distance',
    icon: Building2,
    statute: 'Town and Country Planning Act & National Building Code (Part IV)',
    description: 'High-density industrial compute facility situated closer than 1 km from schools, hospitals, or dense residential colonies without mandatory green belts.',
    cpcbLimit: 'Requires 33% green canopy cover & acoustic buffer barriers at boundary perimeter',
  },
];

export function CommunityComplaintForm() {
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('iron-mountain-mum-1');
  const [category, setCategory] = useState<string>('noise_hum');
  const [timing, setTiming] = useState<string>('nocturnal');
  const [distance, setDistance] = useState<string>('500m');
  const [description, setDescription] = useState<string>('');
  const [residentName, setResidentName] = useState<string>('');
  const [rwaOrWard, setRwaOrWard] = useState<string>('');
  const [contactEmail, setContactEmail] = useState<string>('');
  const [keepAnonymous, setKeepAnonymous] = useState<boolean>(true);
  
  const [generatedLetter, setGeneratedLetter] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [submissionStatus, setSubmissionStatus] = useState<string | null>(null);

  const facility = KNOWN_DATA_CENTRES.find((f) => f.id === selectedFacilityId) || KNOWN_DATA_CENTRES[0];
  const catObj = GRIEVANCE_CATEGORIES.find((c) => c.id === category) || GRIEVANCE_CATEGORIES[0];

  const handleGenerateLetter = () => {
    const today = new Date().toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const timingMap: Record<string, string> = {
      nocturnal: 'During nocturnal quiet hours (22:00 hrs – 06:00 hrs), causing acute sleep disruption',
      daytime: 'During daytime working hours (06:00 hrs – 22:00 hrs)',
      continuous: 'Continuous 24-hour uninterrupted operation',
      testing: 'During periodic high-load backup generator or chiller ramp-up testing',
    };

    const letter = `FORMAL ENVIRONMENTAL GRIEVANCE & CITIZEN COMPLAINT
Under the provisions of:
- Noise Pollution (Regulation and Control) Rules 2000 (Rules 3, 5 & 8)
- Air (Prevention and Control of Pollution) Act 1981 (Section 21)
- Environment (Protection) Act 1986 & Article 21 of the Constitution of India

DATE: ${today}

TO:
1. The Member Secretary / Regional Officer,
   ${facility.spcb}
   ${facility.locality}, ${facility.city}, ${facility.stateName}
2. The District Magistrate / Municipal Commissioner,
   Municipal Corporation of ${facility.city}

FROM:
Complainant: ${residentName || (keepAnonymous ? 'Concerned Local Resident / Ward Citizen' : 'Neighborhood Representative')}
${rwaOrWard ? `Resident Welfare Association / Ward: ${rwaOrWard}\n` : ''}Locality: In close proximity (~${distance}) to ${facility.name} (${facility.locality}, ${facility.city})
Contact: ${contactEmail || 'Confidential Citizen Representation'}

SUBJECT: Formal complaint regarding severe ${catObj.label.toLowerCase()} originating from data center facility: "${facility.name}" operated by ${facility.operator}.

RESPECTED AUTHORITIES,

I am writing as an affected resident residing within ${distance} of the commercial data center campus known as "${facility.name}" (Facility ID: ${facility.id}), located in ${facility.locality}, ${facility.city}, ${facility.stateName}.

1. NATURE OF ENVIRONMENTAL & PUBLIC HEALTH GRIEVANCE:
Category: ${catObj.label}
Statutory Reference: ${catObj.statute}
Operating Timeframe: ${timingMap[timing] || timing}

2. SPECIFIC IMPACTS OBSERVED:
${description || 'The facility operates large-scale industrial heat-rejection chillers, cooling fan banks, and/or auxiliary diesel generators without adequate acoustic attenuation louvers, resulting in persistent disturbance penetrating nearby residences.'}

3. STATUTORY NON-COMPLIANCE & LEGAL BASIS:
Under Rule 3(1) of the Noise Pollution Rules 2000, the ambient noise standard for residential zones is strictly limited to 50 dB(A) Leq during daytime and 40 dB(A) Leq during nighttime. Industrial compute facilities sited near residential clusters must not cause continuous nocturnal ambient sound levels to exceed these statutory ceilings.
Furthermore, under the Air (Prevention and Control of Pollution) Act 1981, backup generators must maintain mandatory acoustic enclosures with minimum 25 dB(A) insertion loss and verified stack height formula H = h + 0.2*sqrt(kVA).

4. RELIEF & STATUTORY ACTIONS REQUESTED:
In accordance with your statutory powers under Section 5 of the Environment (Protection) Act 1986:
a) Conduct an unannounced nocturnal and daytime ambient sound and emissions inspection at the boundary perimeter of ${facility.name}.
b) Mandate that the facility operator (${facility.operator}) install acoustic silencer baffles, evergreen vegetative perimeter buffers, and low-frequency noise attenuators.
c) Verify whether valid Consent to Operate (CTO) and Central Ground Water Authority (CGWA) abstraction clearances are held and fully compliant.
d) Provide written acknowledgement and inspection findings to the undersigned within 30 days.

Respectfully submitted,

___________________________________
${residentName || (keepAnonymous ? 'Local Citizen Representative (Identity Protected)' : 'Authorized Resident')}
Verified via EcoSite Terminal Community Portal (ecosite.gov.in / learn)`;

    setGeneratedLetter(letter);
    setSubmissionStatus('letter_generated');
  };

  const handleCopyLetter = async () => {
    if (!generatedLetter) return;
    try {
      await navigator.clipboard.writeText(generatedLetter);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  const handleDownloadLetter = () => {
    if (!generatedLetter) return;
    const blob = new Blob([generatedLetter], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `grievance_${facility.id}_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleLogGrievance = () => {
    const refId = `GRV-2026-${facility.stateCode.replace('IN-', '')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const record = {
      refId,
      facilityId: facility.id,
      facilityName: facility.name,
      category,
      categoryLabel: catObj.label,
      timing,
      distance,
      spcb: facility.spcb,
      date: new Date().toISOString(),
      status: 'LOGGED_LOCALLY',
    };

    try {
      const existing = JSON.parse(localStorage.getItem('eco-community-grievances') || '[]');
      existing.unshift(record);
      localStorage.setItem('eco-community-grievances', JSON.stringify(existing.slice(0, 50)));
    } catch {
      // storage unavailable
    }

    setSubmissionStatus(`logged_${refId}`);
  };

  return (
    <Card
      title="File a Community Environmental Grievance"
      subtitle="Structured statutory representation routed to State Pollution Control Boards & Municipal Authorities"
      icon={<ShieldAlert className="h-4 w-4 text-eco-warning" />}
      actions={
        <Badge variant="outline" size="xs">
          Article 21 & CPCB Noise Rules 2000
        </Badge>
      }
    >
      <div className="space-y-4">
        <p className="text-meta text-eco-muted">
          Living near a hyperscale data centre? If continuous chiller hum, diesel test-run plumes, or groundwater extraction are impacting your quality of life, use this official drafting engine to generate an evidence-backed statutory complaint for your State Pollution Control Board.
        </p>

        {/* Step 1: Select Facility */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="facility-select" className="block text-meta font-medium text-eco-text">
              1. Select Target Data Centre Facility
            </label>
            <select
              id="facility-select"
              value={selectedFacilityId}
              onChange={(e) => setSelectedFacilityId(e.target.value)}
              className="mt-1 w-full rounded border border-eco-border bg-eco-surface px-3 py-2 text-body text-eco-text focus:border-eco-primary focus:outline-none"
            >
              {KNOWN_DATA_CENTRES.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.operator}) — {f.locality}, {f.city} ({f.stateCode})
                </option>
              ))}
            </select>
            <p className="mt-1 flex items-center gap-1 text-micro text-eco-muted">
              <Building2 className="h-3 w-3 text-eco-primary" />
              Routing oversight: <span className="font-semibold text-eco-text">{facility.spcb}</span>
            </p>
          </div>

          <div>
            <label htmlFor="grievance-category" className="block text-meta font-medium text-eco-text">
              2. Nature of Environmental Grievance
            </label>
            <select
              id="grievance-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full rounded border border-eco-border bg-eco-surface px-3 py-2 text-body text-eco-text focus:border-eco-primary focus:outline-none"
            >
              {GRIEVANCE_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-micro text-eco-warning font-mono">
              {catObj.cpcbLimit}
            </p>
          </div>
        </div>

        {/* Category Context Banner */}
        <div className="rounded border border-eco-border bg-eco-surface-secondary/40 p-3">
          <div className="flex items-start gap-2">
            <catObj.icon className="mt-0.5 h-4 w-4 shrink-0 text-eco-primary" />
            <div>
              <p className="text-meta font-medium text-eco-text">{catObj.label}</p>
              <p className="text-micro text-eco-muted">{catObj.description}</p>
              <p className="mt-1 text-micro text-eco-primary font-mono">
                Statute: {catObj.statute}
              </p>
            </div>
          </div>
        </div>

        {/* Step 2: Observation Timing & Distance */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="timing-select" className="block text-meta font-medium text-eco-text">
              3. Timing of Disturbance
            </label>
            <select
              id="timing-select"
              value={timing}
              onChange={(e) => setTiming(e.target.value)}
              className="mt-1 w-full rounded border border-eco-border bg-eco-surface px-3 py-2 text-body text-eco-text focus:border-eco-primary focus:outline-none"
            >
              <option value="nocturnal">Nocturnal Quiet Hours (22:00 – 06:00) [Most Severe]</option>
              <option value="daytime">Daytime Hours (06:00 – 22:00)</option>
              <option value="continuous">Continuous 24/7 Uninterrupted</option>
              <option value="testing">Generator / Load Bank Test Runs</option>
            </select>
          </div>

          <div>
            <label htmlFor="distance-select" className="block text-meta font-medium text-eco-text">
              4. Distance from Facility Perimeter
            </label>
            <select
              id="distance-select"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              className="mt-1 w-full rounded border border-eco-border bg-eco-surface px-3 py-2 text-body text-eco-text focus:border-eco-primary focus:outline-none"
            >
              <option value="< 250 metres">Immediate Boundary (&lt; 250 metres)</option>
              <option value="250m – 500m">Near Vicinity (250m – 500m)</option>
              <option value="500m – 1 km">1 km Core Buffer (500m – 1,000m)</option>
              <option value="1 km – 3 km">Municipal Catchment (1 km – 3 km)</option>
            </select>
          </div>
        </div>

        {/* Step 3: Specific Impacts Narrative */}
        <div>
          <label htmlFor="narrative-description" className="block text-meta font-medium text-eco-text">
            5. Specific Details & Observable Impact
          </label>
          <textarea
            id="narrative-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what you hear, smell, or experience (e.g. 'A deep low-frequency vibration and fan whining penetrates bedroom walls between midnight and 5 AM. Windows rattle slightly and sleep is disrupted. Decibel app registers 52 dBA at window sill.')..."
            className="mt-1 w-full rounded border border-eco-border bg-eco-surface p-2.5 text-body text-eco-text placeholder:text-eco-muted/60 focus:border-eco-primary focus:outline-none"
          />
        </div>

        {/* Step 4: Resident / Ward Info */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="resident-name" className="block text-meta font-medium text-eco-text">
              Name or Title (Optional)
            </label>
            <input
              id="resident-name"
              type="text"
              value={residentName}
              onChange={(e) => setResidentName(e.target.value)}
              placeholder="e.g. S. Ramanathan"
              className="mt-1 w-full rounded border border-eco-border bg-eco-surface px-3 py-2 text-body text-eco-text focus:border-eco-primary focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="rwa-ward" className="block text-meta font-medium text-eco-text">
              RWA / Colony / Ward No.
            </label>
            <input
              id="rwa-ward"
              type="text"
              value={rwaOrWard}
              onChange={(e) => setRwaOrWard(e.target.value)}
              placeholder="e.g. Sector 2, Mahape RWA"
              className="mt-1 w-full rounded border border-eco-border bg-eco-surface px-3 py-2 text-body text-eco-text focus:border-eco-primary focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="contact-email" className="block text-meta font-medium text-eco-text">
              Email / Phone (Confidential)
            </label>
            <input
              id="contact-email"
              type="text"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="e.g. citizen@domain.in"
              className="mt-1 w-full rounded border border-eco-border bg-eco-surface px-3 py-2 text-body text-eco-text focus:border-eco-primary focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="anonymity-check"
            type="checkbox"
            checked={keepAnonymous}
            onChange={(e) => setKeepAnonymous(e.target.checked)}
            className="h-4 w-4 rounded border-eco-border bg-eco-surface text-eco-primary focus:ring-0"
          />
          <label htmlFor="anonymity-check" className="text-meta text-eco-muted cursor-pointer">
            Keep identity protected in public copy (marked as Citizen Representative)
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Button variant="primary" onClick={handleGenerateLetter}>
            <FileText className="mr-1.5 h-4 w-4" />
            Generate Statutory Representation
          </Button>

          <Button variant="secondary" onClick={handleLogGrievance}>
            <Send className="mr-1.5 h-4 w-4" />
            Log Grievance Locally
          </Button>
        </div>

        {/* Submission notification */}
        {submissionStatus?.startsWith('logged_') && (
          <div className="rounded border border-eco-primary/30 bg-eco-primary/10 p-3 text-meta text-eco-text">
            <p className="font-semibold text-eco-primary flex items-center gap-1.5">
              <Check className="h-4 w-4" />
              Grievance logged with reference #{submissionStatus.replace('logged_', '')}
            </p>
            <p className="mt-1 text-micro text-eco-muted">
              Your grievance has been stored in your local terminal ledger. You can now copy or download the statutory letter below to submit directly to {facility.spcb} and the {facility.city} District Magistrate.
            </p>
          </div>
        )}

        {/* Generated Letter Display */}
        {generatedLetter && (
          <div className="mt-4 space-y-3 rounded border border-eco-border bg-eco-surface-secondary/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-eco-border pb-3">
              <div>
                <span className="font-mono text-micro uppercase tracking-wider text-eco-primary font-semibold">
                  Official Statutory Draft
                </span>
                <p className="text-meta font-medium text-eco-text">
                  Formal Representation to {facility.spcb}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={handleCopyLetter}>
                  {copied ? (
                    <>
                      <Check className="mr-1 h-3.5 w-3.5 text-eco-primary" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1 h-3.5 w-3.5" />
                      Copy Letter
                    </>
                  )}
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadLetter}>
                  <Download className="mr-1 h-3.5 w-3.5" />
                  Download .txt
                </Button>
              </div>
            </div>

            <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded bg-eco-surface p-3 font-mono text-micro text-eco-text/90 leading-relaxed border border-eco-border">
              {generatedLetter}
            </pre>

            <div className="rounded bg-eco-surface-secondary p-3 text-micro text-eco-muted flex items-start gap-2">
              <Scale className="h-4 w-4 shrink-0 text-eco-primary mt-0.5" />
              <p>
                <strong className="text-eco-text">Statutory Rights Under Indian Law:</strong> Under Section 15 of the Noise Rules 2000 and the Environment (Protection) Act 1986, citizens have the legal standing to demand immediate inspection and abatement from the designated authority. Send this letter via Registered Post / Email to the Member Secretary of {facility.spcb} or submit via the national grievance portal (CPGRAMS / pgportal.gov.in).
              </p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

