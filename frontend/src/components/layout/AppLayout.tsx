import { PlanningBar } from './PlanningBar';
import { Outlet, useLocation } from 'react-router-dom';
import { WorldMonitorHeader } from '../worldmonitor/WorldMonitorHeader';
import { StatusBar } from './StatusBar';

export const AppLayout: React.FC = () => {
  const location = useLocation();
  const showPlanningContext = location.pathname.startsWith('/site-analysis') || location.pathname.startsWith('/projects');
  return (
    <div className="flex flex-col h-screen w-screen bg-eco-bg text-eco-text overflow-hidden select-none">
      <WorldMonitorHeader />
      {showPlanningContext && <PlanningBar />}
      <main className="flex-1 relative overflow-hidden flex">
        <Outlet />
      </main>
      <StatusBar />
    </div>
  );
};
