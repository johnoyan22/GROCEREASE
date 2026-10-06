import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { getCurrentUser } from '../../services/api';


function ProtectedRoute({ allowedRoles }) {
    const [user, setUser] = useState(null);
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        getCurrentUser()
            .then((currentUser) => setUser(currentUser))
            .catch(() => setUser(null))
            .finally(() => setIsChecking(false));
    }, []);

    if (isChecking) {
        return
    }

    if (!user) {
        return <Navigate to ="/login" replace />;
    }

    if (!allowedRoles.includes(user.role?.slug)) {
        return <Navigate to='/' replace />;
    }

    return <Outlet/>
}
export default ProtectedRoute;