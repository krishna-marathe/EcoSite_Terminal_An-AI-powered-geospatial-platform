import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { Dashboard } from '../pages/Dashboard';
import { SiteAnalysis } from '../pages/SiteAnalysis';
import { Projects } from '../pages/Projects';
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
      { path: 'dashboard', element: <Dashboard /> },
      {
        path: 'site-analysis',
        element: <SiteAnalysis />,
      },
      { path: 'projects', element: <Projects /> },
      { path: 'data-sources', element: <DataSources /> },
      { path: 'public-facilities', element: <PublicFacilities /> },
      { path: 'public-facilities/:facilityId', element: <PublicFacilityDetailRoute /> },
      { path: 'ministry', element: <MinistryDashboardRoute /> },
      { path: 'operator/register', element: <OperatorRegistrationRoute /> },
      { path: 'ministry/review', element: <MinistryReviewRoute /> },
      { path: 'risk-analysis', element: <Navigate to="/ministry" replace /> },
      { path: 'forecast', element: <Navigate to="/ministry" replace /> },
      { path: 'mitigation', element: <Navigate to="/ministry" replace /> },
      { path: 'reports', element: <Navigate to="/public-facilities" replace /> },
      {
        path: '*',
        element: <Navigate to="/dashboard" replace />,
      },
    ],
  },
]);
