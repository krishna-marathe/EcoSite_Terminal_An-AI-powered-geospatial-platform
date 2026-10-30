path = r'c:\Users\Sid\eco-terminal\EcoTerminal\frontend\src\pages\Dashboard.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove PageHeader and TimeRangeControl imports if no longer needed
content = content.replace("import { TimeRangeControl } from '../components/layout/TimeRangeControl';\r\n", "")
content = content.replace("import { TimeRangeControl } from '../components/layout/TimeRangeControl';\n", "")
content = content.replace("import { PageHeader } from '../components/ui/PageHeader';\r\n", "")
content = content.replace("import { PageHeader } from '../components/ui/PageHeader';\n", "")

old_panels = """  const railPanels = <>{registryPanel}{distributionPanel}{newsPanel}</>;
  const gridPanels = <>{registryPanel}{distributionPanel}
    <EnvironmentalCoveragePanel
      states={environmentalData}
      isLoading={environmentalLoading}
      error={environmentalData.length === 0 ? errorMessage(environmentalError) : undefined}
      warning={environmentalData.length > 0 && failedEnvironmentalStates > 0 ? `${failedEnvironmentalStates} state summary could not be loaded; available states are shown.` : undefined}
    />
    {newsPanel}
  </>;"""

new_panels = """  const ministryLink = (
    <div className="flex items-center justify-between rounded-lg border border-eco-border bg-eco-surface/50 px-3 py-2 text-meta">
      <span className="text-eco-muted truncate pr-2">{coverageLine} · {sourcesLine}</span>
      <Link to="/ministry" className="shrink-0 font-medium text-eco-primary hover:underline">Ministry workspace →</Link>
    </div>
  );

  const railPanels = <>{registryPanel}{distributionPanel}{ministryLink}{newsPanel}</>;
  const gridPanels = <>{registryPanel}{distributionPanel}
    <EnvironmentalCoveragePanel
      states={environmentalData}
      isLoading={environmentalLoading}
      error={environmentalData.length === 0 ? errorMessage(environmentalError) : undefined}
      warning={environmentalData.length > 0 && failedEnvironmentalStates > 0 ? `${failedEnvironmentalStates} state summary could not be loaded; available states are shown.` : undefined}
    />
    {ministryLink}
    {newsPanel}
  </>;"""

content = content.replace(old_panels.replace('\n', '\r\n'), new_panels.replace('\n', '\r\n'))
content = content.replace(old_panels, new_panels)

# Replace the top orientation strip
import re
pattern_header = r'\s*<div className="flex shrink-0 flex-wrap items-start justify-between gap-x-6 gap-y-2 border-b border-eco-border bg-eco-bg px-4 py-1\.5">[\s\S]*?</div>\s*</div>'
content = re.sub(pattern_header, '', content, count=1)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated Dashboard.tsx")

