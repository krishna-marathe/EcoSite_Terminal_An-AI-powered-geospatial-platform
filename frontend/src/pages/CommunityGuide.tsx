import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Droplets,
  FileText,
  ListChecks,
  PenTool,
  Recycle,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  Thermometer,
  Volume2,
  Wind,
  Zap,
} from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { PageHeader, PageShell } from '../components/ui/PageHeader';
import { InlineAlert } from '../components/ui/StateViews';
import { CommunityComplaintForm } from '../components/community/CommunityComplaintForm';
import { CommunityPetitionsPanel } from '../components/community/CommunityPetitionsPanel';

/**
 * CommunityGuide — the plain-language public surface.
 *
 * Every concern on this page is paired with either the parameter this platform
 * actually scores, or an explicit statement that it is not collected here and
 * why. Copy rule: never imply a measurement that the risk score does not carry.
 * The parameter names and weights come from
 * `backend/app/services/risk_scoring.py` (SCORE_VERSION risk-env-1.0.0).
 */

interface Concern {
  id: string;
  label: string;
  icon: ReactNode;
  measured: boolean;
  /** What the concern means for the people living near a facility. */
  meaning: string;
  /** What this platform shows for it, or why it cannot. */
  platform: string;
  parameters?: Array<{ name: string; unit: string }>;
}

const CONCERNS: Concern[] = [
  {
    id: 'air',
    label: 'Air quality',
    icon: <Wind className="h-4 w-4" />,
    measured: true,
    meaning:
      'Backup diesel generators, cooling towers and the traffic that serves a campus all add to what the neighbourhood already breathes.',
    platform:
      'Scored from the nearest public air-quality grid for the facility’s location, so the figure describes the surrounding air, not the facility’s own emissions.',
    parameters: [
      { name: 'Air quality index', unit: 'AQI' },
      { name: 'Fine particulate matter', unit: 'µg/m³' },
      { name: 'Coarse particulate matter', unit: 'µg/m³' },
    ],
  },
  {
    id: 'heat',
    label: 'Heat',
    icon: <Thermometer className="h-4 w-4" />,
    measured: true,
    meaning:
      'Cooling load rises steeply with outdoor temperature, so a hot district pays more for the same computing — and rejects more heat into the air around it.',
    platform: 'Scored from the daily maximum air temperature recorded for the facility’s grid cell.',
    parameters: [{ name: 'Daily maximum air temperature', unit: '°C' }],
  },
  {
    id: 'water',
    label: 'Water',
    icon: <Droplets className="h-4 w-4" />,
    measured: true,
    meaning:
      'Evaporative cooling consumes water that is usually drawn from the same aquifer or river the surrounding wards depend on.',
    platform:
      'Two water inputs are scored from public grids. Two more are written into the method but are not yet connected to a live source, and they are reported as unavailable rather than as low risk.',
    parameters: [
      { name: '24-hour rainfall', unit: 'mm' },
      { name: 'River flow vs 12-month climatology', unit: 'percentile' },
      { name: 'Groundwater depth (source not connected)', unit: 'm' },
      { name: 'Surface-water occurrence (candidate sites only)', unit: '%' },
    ],
  },
  {
    id: 'flood',
    label: 'Flood and land',
    icon: <ShieldCheck className="h-4 w-4" />,
    measured: true,
    meaning:
      'A site on a floodplain displaces water that used to go somewhere else, and a facility that floods takes the local grid down with it.',
    platform:
      'Flood exposure is read from modelled river discharge ranked against the previous year at the same grid cell. A low percentile is not treated as risk, and a flat-or-zero river series is reported as missing instead of safe.',
    parameters: [{ name: 'River flow vs 12-month climatology', unit: 'percentile' }],
  },
  {
    id: 'energy',
    label: 'Electricity',
    icon: <Zap className="h-4 w-4" />,
    measured: false,
    meaning:
      'A hyperscale campus can draw more power than a mid-sized town, which shapes local tariffs, peak-hour load shedding and how much new generation is built.',
    platform:
      'Not collected. This platform holds published capacity figures (MW), and capacity is a design rating — it is not consumption, not a load profile and not a share of the local grid. Reading it as energy use would be wrong, so it is not scored.',
  },
  {
    id: 'noise',
    label: 'Noise',
    icon: <Volume2 className="h-4 w-4" />,
    measured: false,
    meaning:
      'Cooling fans, chillers and test-run generators produce a steady low hum that carries further at night than most residents expect.',
    platform:
      'Not collected. Noise is an on-site measurement, and no public grid reports it per facility. This platform will not estimate it from a location.',
  },
  {
    id: 'ewaste',
    label: 'Equipment and e-waste',
    icon: <Recycle className="h-4 w-4" />,
    measured: false,
    meaning:
      'Servers, batteries and cooling plant are replaced on short cycles, and the disposal route for that equipment is rarely public.',
    platform:
      'Not collected. Disposal and take-back records sit with the operator and the state pollution board, not in an open dataset. The registry records what an operator declares; it does not audit it.',
  },
];

const STEPS = [
  {
    icon: <Search className="h-4 w-4" />,
    title: 'Find the facility',
    body: 'Search the registry by name, operator, city or state.',
    to: '/public-facilities',
    cta: 'Open the registry',
  },
  {
    icon: <ListChecks className="h-4 w-4" />,
    title: 'Read the score and its coverage',
    body: 'Each profile shows a 0–100 screening score, the parameters behind it, and how much of the method could actually be measured.',
    to: '/public-facilities',
    cta: 'See a facility profile',
  },
  {
    icon: <Server className="h-4 w-4" />,
    title: 'Check the source',
    body: 'Every record names its publisher, when it was checked, and when that check expires. Nothing on a profile is unattributed.',
    to: '/data-sources',
    cta: 'Browse data sources',
  },
  {
    icon: <ShieldAlert className="h-4 w-4" />,
    title: 'Take community action',
    body: 'Draft a statutory representation letter for your SPCB or sign citizen petitions demanding 1 km acoustic setbacks.',
    to: '#community-actions',
    cta: 'Lodge grievance & sign petitions',
  },
];

export function CommunityGuide() {
  const measured = CONCERNS.filter((concern) => concern.measured).length;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Public guide"
        title="What a data centre asks of your area"
        purpose="The resources a data centre draws on, which of them this platform actually measures for a named facility, and where each figure comes from."
        meta={
          <>
            <Badge variant="outline" size="xs">No sign-in required</Badge>
            <Badge variant="outline" size="xs">
              {measured} of {CONCERNS.length} concerns measured
            </Badge>
          </>
        }
      />

      <InlineAlert title="What this page is, and what it is not">
        This is a screening guide, not a compliance finding and not an on-site measurement. It explains the
        parameters behind the facility risk score so that a resident, a ward councillor or an operator can
        read the same number the same way.
      </InlineAlert>

      <Card title="How to use this guide" subtitle="Four steps, from public screening to statutory citizen action">
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="rounded-sm border border-eco-border bg-eco-surface-secondary/40 p-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-micro text-eco-muted">{String(index + 1).padStart(2, '0')}</span>
                <span className="text-eco-primary">{step.icon}</span>
                <h3 className="text-body font-semibold text-eco-text">{step.title}</h3>
              </div>
              <p className="mt-1.5 text-meta text-eco-muted">{step.body}</p>
              {step.to.startsWith('#') ? (
                <a
                  href={step.to}
                  className="mt-2 inline-flex items-center gap-1 text-meta font-medium text-eco-primary hover:underline"
                >
                  {step.cta}
                  <ArrowRight className="h-3 w-3" />
                </a>
              ) : (
                <Link
                  to={step.to}
                  className="mt-2 inline-flex items-center gap-1 text-meta font-medium text-eco-primary hover:underline"
                >
                  {step.cta}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </li>
          ))}
        </ol>
      </Card>

      <section aria-labelledby="concerns-heading" className="space-y-3">
        <div>
          <h2 id="concerns-heading" className="text-h2 font-semibold text-eco-text">
            The concerns people raise
          </h2>
          <p className="mt-1 max-w-3xl text-meta text-eco-muted">
            Seven issues come up again and again in public consultation. Four of them can be read from open
            environmental grids for a specific location; three cannot be read from any open dataset, and are
            listed here as gaps rather than quietly left out.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {CONCERNS.map((concern) => (
            <Card
              key={concern.id}
              title={concern.label}
              icon={concern.icon}
              status={concern.measured ? 'Measured' : 'Not measured'}
              statusTone={concern.measured ? 'neutral' : 'warning'}
            >
              <p className="text-meta text-eco-text">{concern.meaning}</p>
              <p className="mt-2 text-meta text-eco-muted">{concern.platform}</p>
              {concern.parameters && (
                <ul className="mt-3 space-y-1 border-t border-eco-border pt-2">
                  {concern.parameters.map((parameter) => (
                    <li key={parameter.name} className="flex items-baseline justify-between gap-2 text-meta">
                      <span className="text-eco-text">{parameter.name}</span>
                      <span className="shrink-0 font-mono text-micro text-eco-muted">{parameter.unit}</span>
                    </li>
                  ))}
                </ul>
              )}
              {concern.id === 'water' && (
                <p className="mt-2 text-micro text-eco-warning">
                  Unavailable parameters lower coverage on the score. A facility is never scored as low risk
                  because a source is missing.
                </p>
              )}
            </Card>
          ))}
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Reading a risk score" subtitle="0–100, screening only">
          <ul className="space-y-2 text-meta text-eco-text">
            <li>
              <span className="font-medium">0–25 low · 26–50 moderate · 51–75 high · 76–100 critical.</span> The
              bands describe environmental exposure at the site, not the facility’s conduct.
            </li>
            <li>
              Each parameter is mapped through a published curve and combined by weight, so the score is
              arithmetic, not a model. The method is versioned; a report names the version it used.
            </li>
            <li>
              <span className="font-medium">Coverage</span> is the share of the method that could be measured. A
              score of 40 at 50% coverage is not comparable to a 40 at 100% coverage, and the profile says so.
            </li>
            <li>
              Bands are advisory. They are not a clearance, a licence condition or a substitute for the
              environmental impact assessment a project still requires.
            </li>
          </ul>
        </Card>

        <Card title="What this platform cannot tell you" subtitle="Stated once, here, so no page implies otherwise">
          <ul className="space-y-2 text-meta text-eco-muted">
            <li>Facility-level consumption of electricity or water. Only published capacity is held, and capacity is not consumption.</li>
            <li>Noise, e-waste, land-use change or employment effects.</li>
            <li>Groundwater depth per facility — the source is not connected; the parameter is reported unavailable.</li>
            <li>Facilities that are proposed, permitted or under construction. The public registry is operational facilities only, so an absence from it is not evidence that nothing is being built.</li>
            <li>Exact addresses. Public map points are generalised to locality or district level by design.</li>
            <li>Operator compliance or audit findings. A record reflects what a source published, nothing more.</li>
          </ul>
        </Card>
      </div>

      <Card
        title="If a record looks wrong"
        subtitle="The correction route, for every audience"
        footer={
          <span className="font-mono text-micro uppercase tracking-[0.06em]">
            Public registry · operator declarations reviewed by the ministry workspace
          </span>
        }
      >
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <h3 className="text-body font-semibold text-eco-text">You are the operator</h3>
            <p className="mt-1 text-meta text-eco-muted">
              Submit or revise a facility declaration, including the published capacity figure and its measurement
              boundary. A declaration enters the review queue; it does not publish itself.
            </p>
            <Link to="/operator/register" className="mt-2 inline-flex items-center gap-1 text-meta font-medium text-eco-primary hover:underline">
              Register or revise a facility <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div>
            <h3 className="text-body font-semibold text-eco-text">You are a resident or a ward office</h3>
            <p className="mt-1 text-meta text-eco-muted">
              If an adjacent data centre causes nocturnal sleep disruption, unbaffled chiller hum, or groundwater depletion,
              use our community grievance tool below to draft a formal representation under CPCB Noise Rules 2000, or join our
              active civic petitions for mandatory 1 km buffer zones.
            </p>
            <a href="#community-actions" className="mt-2 inline-flex items-center gap-1 text-meta font-medium text-eco-primary hover:underline">
              Draft statutory grievance & view petitions <ArrowRight className="h-3 w-3" />
            </a>
          </div>
        </div>
      </Card>

      {/* Community Action & Citizen Empowerment Section */}
      <section id="community-actions" aria-labelledby="community-actions-heading" className="space-y-6 pt-2">
        <div className="border-t border-eco-border pt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-mono text-micro uppercase tracking-wider text-eco-primary font-bold">
                Civil Action & Community Advocacy
              </p>
              <h2 id="community-actions-heading" className="text-h1 font-bold text-eco-text">
                Hold Data Centres Accountable to Your Community
              </h2>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="primary" size="sm">
                <ShieldAlert className="mr-1 h-3.5 w-3.5" />
                Statutory Grievance Engine
              </Badge>
              <Badge variant="outline" size="sm">
                <PenTool className="mr-1 h-3.5 w-3.5 text-eco-primary" />
                Citizen Petitions
              </Badge>
            </div>
          </div>
          <p className="mt-2 max-w-3xl text-meta text-eco-muted leading-relaxed">
            Data centres rely on enormous electrical and water infrastructure while rejecting heat and continuous low-frequency acoustic hum into surrounding wards. Inspired by community accountability models, these tools empower residents, Resident Welfare Associations (RWAs), and ward committees to formally assert their statutory rights under Indian environmental law.
          </p>
        </div>

        {/* Component 1: Grievance Lodging Form */}
        <CommunityComplaintForm />

        {/* Component 2: Active Petitions Panel */}
        <CommunityPetitionsPanel />
      </section>
    </PageShell>
  );
}
