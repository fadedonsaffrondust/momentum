import clsx from 'clsx';
import { useRoles } from '../api/hooks';
import { useUiStore } from '../store/ui';

export function RoleFilterBar() {
  const rolesQ = useRoles();
  const roleFilter = useUiStore((s) => s.roleFilter);
  const setRoleFilter = useUiStore((s) => s.setRoleFilter);

  const roles = rolesQ.data ?? [];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={() => setRoleFilter(null)}
        className={clsx(
          'px-3 py-1 rounded-full text-xs border transition',
          roleFilter === null
            ? 'border-primary text-primary bg-primary/10'
            : 'border-border text-muted-foreground hover:text-foreground',
        )}
      >
        All
        <span className="ml-1 opacity-50">0</span>
      </button>
      {roles.map((r, idx) => {
        const active = roleFilter === r.id;
        return (
          <button
            key={r.id}
            onClick={() => setRoleFilter(active ? null : r.id)}
            className={clsx(
              'px-3 py-1 rounded-full text-xs border transition',
              active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
            style={{
              borderColor: active ? r.color : 'hsl(var(--border))',
              backgroundColor: active ? r.color + '22' : 'transparent',
            }}
          >
            <span
              className="inline-block w-2 h-2 rounded-full mr-2 align-middle"
              style={{ backgroundColor: r.color }}
            />
            {r.name}
            {idx < 9 && <span className="ml-1 opacity-50">{idx + 1}</span>}
          </button>
        );
      })}
    </div>
  );
}
