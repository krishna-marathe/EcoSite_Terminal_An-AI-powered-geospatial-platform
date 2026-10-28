import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { Dashboard } from '../pages/Dashboard';
import { RiskAnalysis } from '../pages/RiskAnalysis';
import { Forecast } from '../pages/Forecast';
import { SiteAnalysis } from '../pages/SiteAnalysis';
import { Mitigation } from '../pages/Mitigation';
import { Projects } from '../pages/Projects';
import { Reports } from '../pages/Reports';
import { DataSources } from '../pages/DataSources';
import { PublicFacilities } from '../pages/PublicFacilities';
import { MinistryDashboardRoute, MinistryReviewRoute, OperatorRegistrationRoute, PublicFacilityDetailRoute } from '../pages/IntegratedRoutes';

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
      { path: 'projects', element: <Projects /> },
      { path: 'data-sources', element: <DataSources /> },
      { path: 'public-facilities', element: <PublicFacilities /> },
      { path: 'public-facilities/:facilityId', element: <PublicFacilityDetailRoute /> },
      { path: 'ministry', element: <MinistryDashboardRoute /> },
      { path: 'operator/register', element: <OperatorRegistrationRoute /> },
      { path: 'ministry/review', element: <MinistryReviewRoute /> },
      {
        path: '*',
        element: <Navigate to="/dashboard" replace />,
      },
    ],
  },
]);
