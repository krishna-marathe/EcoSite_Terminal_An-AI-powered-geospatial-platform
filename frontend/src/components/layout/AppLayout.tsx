import { Outlet } from 'react-router-dom';
import { WorldMonitorHeader } from '../worldmonitor/WorldMonitorHeader';
import { StatusBar } from './StatusBar';

export const AppLayout: React.FC = () => {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-eco-bg text-eco-text">
      <WorldMonitorHeader />
      <main className="flex-1 relative overflow-hidden flex">
        <Outlet />
      </main>
      <StatusBar />
    </div>
  );
};
