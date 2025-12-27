import { useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { isAdminAuthenticated } from '@/lib/api/admin-service';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const navigate = useNavigate();
  const isAuthenticated = isAdminAuthenticated();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/settings', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  if (!isAuthenticated) {
    return <Navigate to="/settings" replace />;
  }

  return <>{children}</>;
}
