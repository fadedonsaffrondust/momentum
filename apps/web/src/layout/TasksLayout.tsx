import { NavLink, Outlet } from 'react-router-dom';
import clsx from 'clsx';
import { TaskAssigneeFilter } from '../components/TaskAssigneeFilter';

interface TabProps {
  to: string;
  label: string;
  end?: boolean;
}

function Tab({ to, label, end }: TabProps) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        clsx(
          'relative px-4 py-2 text-sm rounded-md transition',
          isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span>{label}</span>
          {isActive && (
            <span className="absolute left-3 right-3 -bottom-px h-[2px] rounded-full bg-primary" />
          )}
        </>
      )}
    </NavLink>
  );
}

export function TasksLayout() {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-6 pt-4 pb-3 border-b border-border/60 flex items-center gap-1">
        <h1 className="text-xs uppercase tracking-widest text-muted-foreground/70 font-semibold mr-3">
          Tasks
        </h1>
        <Tab to="/" label="Today" end />
        <Tab to="/backlog" label="Backlog" />
        <div className="ml-auto">
          <TaskAssigneeFilter />
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
