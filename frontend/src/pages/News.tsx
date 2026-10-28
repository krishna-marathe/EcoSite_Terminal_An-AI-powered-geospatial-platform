import { PageHeader, PageShell } from '../components/ui/PageHeader';
import { Badge } from '../components/ui/Badge';
import { NewsFeedPanel } from '../components/news/NewsFeedPanel';

export function News() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Media context"
        title="Data-centre news"
        purpose="India and world coverage of data-centre policy, power, water, environment and investment. Media reports are context, never verified evidence."
        meta={
          <>
            <Badge variant="outline" size="xs">Media reports</Badge>
            <Badge variant="outline" size="xs">Not verified evidence</Badge>
          </>
        }
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <NewsFeedPanel defaultRegion="india" />
        <NewsFeedPanel defaultRegion="world" />
      </div>
    </PageShell>
  );
}
