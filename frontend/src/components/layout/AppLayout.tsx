import { Outlet } from 'react-router-dom';
import { WorldMonitorHeader } from '../worldmonitor/WorldMonitorHeader';
import { StatusBar } from './StatusBar';

export const AppLayout: React.FC = () => {
  return (
    <div className="flex flex-col h-screen w-screen bg-[#060A10] text-[#F1F5F9] overflow-hidden select-none">
      <WorldMonitorHeader />
      <main className="flex-1 relative overflow-hidden flex">
        <Outlet />
      </main>
      <StatusBar />
    </div>
  );
};
