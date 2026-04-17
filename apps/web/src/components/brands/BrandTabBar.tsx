import clsx from 'clsx';

export type BrandTab = 'overview' | 'work';

interface Props {
  activeTab: BrandTab;
  onChangeTab: (tab: BrandTab) => void;
  openItemCount: number;
}

const TABS: { id: BrandTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'work', label: 'Action Items & Meetings' },
];

export function BrandTabBar({ activeTab, onChangeTab, openItemCount }: Props) {
  return (
    <nav className="sticky top-[57px] z-10 flex items-center gap-6 px-6 border-b border-m-border-subtle bg-m-bg/90 backdrop-blur">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChangeTab(tab.id)}
          className={clsx(
            'relative py-3 text-sm transition',
            activeTab === tab.id
              ? 'text-m-fg font-medium'
              : 'text-m-fg-muted hover:text-m-fg-secondary',
          )}
        >
          {tab.label}
          {tab.id === 'work' && openItemCount > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold bg-accent/15 text-accent">
              {openItemCount}
            </span>
          )}
          {activeTab === tab.id && (
            <span className="absolute left-0 right-0 -bottom-px h-[2px] rounded-full bg-accent" />
          )}
        </button>
      ))}
    </nav>
  );
}
