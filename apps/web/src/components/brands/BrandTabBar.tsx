import clsx from 'clsx';

export type BrandTab = 'overview' | 'work' | 'feature-requests';

interface BadgeConfig {
  count: number;
  tabId: BrandTab;
}

interface Props {
  activeTab: BrandTab;
  onChangeTab: (tab: BrandTab) => void;
  openItemCount: number;
  openFeatureRequestCount: number;
  featureRequestsStale?: boolean;
}

const TABS: { id: BrandTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'work', label: 'Action Items & Meetings' },
  { id: 'feature-requests', label: 'Feature Requests' },
];

export function BrandTabBar({ activeTab, onChangeTab, openItemCount, openFeatureRequestCount, featureRequestsStale }: Props) {
  const badges: BadgeConfig[] = [
    { tabId: 'work', count: openItemCount },
    { tabId: 'feature-requests', count: openFeatureRequestCount },
  ];

  return (
    <nav className="sticky top-[57px] z-10 flex items-center gap-6 px-6 border-b border-border/60 bg-background/90 backdrop-blur">
      {TABS.map((tab) => {
        const badge = badges.find((b) => b.tabId === tab.id);
        return (
          <button
            key={tab.id}
            onClick={() => onChangeTab(tab.id)}
            className={clsx(
              'relative py-3 text-sm transition',
              activeTab === tab.id
                ? 'text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
            {badge && badge.count > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold bg-primary/15 text-primary">
                {badge.count}
              </span>
            )}
            {tab.id === 'feature-requests' && featureRequestsStale && (
              <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-amber-400" title="Data may be stale" />
            )}
            {activeTab === tab.id && (
              <span className="absolute left-0 right-0 -bottom-px h-[2px] rounded-full bg-primary" />
            )}
          </button>
        );
      })}
    </nav>
  );
}
