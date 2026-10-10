import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { Dashboard } from '../pages/Dashboard';
import { RiskAnalysis } from '../pages/RiskAnalysis';
import { Forecast } from '../pages/Forecast';
import { SiteAnalysis } from '../pages/SiteAnalysis';
import { Mitigation } from '../pages/Mitigation';
import { Reports } from '../pages/Reports';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <Dashboard />,
      },
      {
        path: 'risk-analysis',
        element: <RiskAnalysis />,
      },
      {
        path: 'forecast',
        element: <Forecast />,
      },
      {
        path: 'site-analysis',
        element: <SiteAnalysis />,
      },
      {
        path: 'mitigation',
        element: <Mitigation />,
      },
      {
        path: 'reports',
        element: <Reports />,
      },
      {
        path: '*',
        element: <Navigate to="/dashboard" replace />,
      },
    ],
  },
]);
