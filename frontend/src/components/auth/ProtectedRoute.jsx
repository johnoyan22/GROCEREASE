import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { getCurrentUser } from '../../services/api';

function ProtectedRoute({ allowedRoles, requireVerifiedEmail = false }) {
  const [user, setUser] = useState(null);
  const [isChecking, setIsChecking] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [checkVersion, setCheckVersion] = useState(0);

  useEffect(() => {
    let active = true;

    getCurrentUser()
      .then((currentUser) => {
        if (!active) return;

        setUser(currentUser);
        setLoadError('');
      })
      .catch((error) => {
        if (!active) return;

        setUser(null);

        if (error.status === 401) return;

        setLoadError(
          'Could not check your session. Check your connection and try again.'
        );
      })
      .finally(() => {
        if (active) setIsChecking(false);
      });

    return () => {
      active = false;
    };
  }, [checkVersion]);

  function retrySessionCheck() {
    setLoadError('');
    setIsChecking(true);
    setCheckVersion((version) => version + 1);
  }

  if (isChecking) {
    return (
      <p role="status" className="p-6 text-gray-600">
        Checking your session...
      </p>
    );
  }

  if (loadError) {
    return (
      <div className="p-6">
        <p role="alert" className="text-sm text-red-700">
          {loadError}
        </p>
        <button
          type="button"
          onClick={retrySessionCheck}
          className="mt-3 rounded-lg bg-[#006e00] px-4 py-2 text-sm font-semibold text-white hover:bg-green-800"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role?.slug)) {
    return <Navigate to="/" replace />;
  }

  if (requireVerifiedEmail && !user.email_verified_at) {
    return <Navigate to="/verify-email" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;