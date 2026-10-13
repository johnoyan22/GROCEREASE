import { useEffect, useState } from 'react';
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import {
  getCurrentUser,
  logout,
  resendVerificationEmail,
} from '../../services/api';

const dashboardByRole = {
  shopper: '/shopper/dashboard',
  inventory_worker: '/inventory/dashboard',
  supervisor: '/supervisor',
  admin: '/admin/dashboard',
};

function VerifyEmailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const registration = location.state?.registration;

  const [user, setUser] = useState(null);
  const [isChecking, setIsChecking] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadUser() {
      try {
        const currentUser = await getCurrentUser();

        if (active) {
          setUser(currentUser);
          setLoadError('');
        }
      } catch (error) {
        if (active) {
          setUser(null);
          setLoadError(
            error.status === 401
              ? ''
              : error.message ||
                  'We could not check your account. Please try again.'
          );
        }
      } finally {
        if (active) setIsChecking(false);
      }
    }

    loadUser();

    return () => {
      active = false;
    };
  }, [refreshVersion]);

  useEffect(() => {
    if (resendSeconds <= 0) return;

    const timer = window.setTimeout(() => {
      setResendSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  function handleCheckStatus() {
    setActionError('');
    setNotice('');
    setIsChecking(true);
    setRefreshVersion((version) => version + 1);
  }

  async function handleResend() {
    if (isResending || isLoggingOut || resendSeconds > 0) return;

    setActionError('');
    setNotice('');
    setIsResending(true);

    try {
      const result = await resendVerificationEmail();

      if (result.email_verified) {
        handleCheckStatus();
        return;
      }

      setNotice(
        'A new verification email was generated. Open the newest link.'
      );
      setResendSeconds(60);
    } catch (error) {
      if (error.status === 401) {
        navigate('/login?verification=required', { replace: true });
        return;
      }

      if (error.status === 429) {
        setResendSeconds(60);
        setActionError(
          'Please wait before requesting another verification email.'
        );
      } else {
        if (error.status === 503) setResendSeconds(60);

        setActionError(
          error.message || 'Could not resend the verification email.'
        );
      }
    } finally {
      setIsResending(false);
    }
  }

  async function handleLogout() {
    if (isLoggingOut || isResending) return;

    setActionError('');
    setIsLoggingOut(true);

    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (error) {
      if (error.status === 401) {
        navigate('/login', { replace: true });
        return;
      }

      setActionError(error.message || 'Could not log out. Please try again.');
    } finally {
      setIsLoggingOut(false);
    }
  }

  let isNonShopper = false;

  if (user && user.role) {
    isNonShopper = user.role.slug !== 'shopper';
  }

  const isVerified = Boolean(user?.email_verified_at);
  const dashboardPath = dashboardByRole[user?.role?.slug];

  const differentAccount = Boolean(
    registration?.email && user && registration.email !== user.email
  );

  const isBusy = isResending || isLoggingOut;
  const linkStatus = searchParams.get('status');

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-12 flex items-center justify-center">
      <section className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 sm:p-10 shadow-sm">
        <Link to="/" className="text-xl font-black text-[#006e00]">
          GrocerEase
        </Link>

        {isChecking ? (
          <p role="status" className="mt-6 text-gray-600">
            Checking your account...
          </p>
        ) : loadError ? (
          <div className="mt-6 space-y-4">
            <p role="alert" className="text-red-700">
              {loadError}
            </p>
            <button
              type="button"
              onClick={handleCheckStatus}
              className="font-semibold text-[#006e00]"
            >
              Try again
            </button>
          </div>
        ) : !user ? (
          <div className="mt-6 space-y-4">
            <h1 className="text-2xl font-bold">Verify your email</h1>

            {registration?.email && (
              <p className="text-gray-600">
                Account created for{' '}
                <span className="font-semibold">{registration.email}</span>.
              </p>
            )}

            {registration?.verificationEmailSent === false && (
              <p
                role="alert"
                className="rounded-lg bg-amber-50 p-3 text-amber-800"
              >
                Your account was created, but the email could not be generated.
                Sign in, then request another link.
              </p>
            )}

            <p className="text-gray-600">
              Sign in with the account you want to verify. Then open its
              verification link again in this same browser.
            </p>

            <Link
              to="/login?verification=required"
              className="inline-block rounded-lg bg-[#006e00] px-4 py-3 font-semibold text-white"
            >
              Sign in to continue
            </Link>
          </div>
        ) : differentAccount ? (
          <div className="mt-6 space-y-4">
            <h1 className="text-2xl font-bold">
              You are signed in to another account
            </h1>
            <p className="text-gray-600">
              Sign out below, then sign in with {registration.email} to verify
              the account you just registered.
            </p>
          </div>
                ) : isNonShopper ? (
          <div className="mt-6 space-y-4">
            <h1 className="text-2xl font-bold">Account access</h1>

            <p className="text-gray-600">
              Email verification is required for Shopper accounts.
              You can continue to your dashboard.
            </p>

            <Link
              to={dashboardPath}
              className="inline-block rounded-lg bg-[#006e00] px-4 py-3 font-semibold text-white"
            >
              Continue to dashboard
            </Link>
          </div>
        ) : isVerified ? (
          <div className="mt-6 space-y-4">
            <h1 className="text-2xl font-bold text-[#006e00]">
              Email verified
            </h1>

            <p className="text-gray-600">
              Laravel confirms that {user.email} is verified.
            </p>

            {dashboardPath ? (
              <Link
                to={dashboardPath}
                className="inline-block rounded-lg bg-[#006e00] px-4 py-3 font-semibold text-white"
              >
                Continue to dashboard
              </Link>
            ) : (
              <p role="alert" className="text-red-700">
                This account does not have a supported dashboard.
              </p>
            )}
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <h1 className="text-2xl font-bold">Check your email</h1>

            <p className="text-gray-600">
              Open the verification link for{' '}
              <span className="font-semibold">{user.email}</span> in this
              browser.
            </p>

            {linkStatus === 'invalid' && (
              <p
                role="alert"
                className="rounded-lg bg-red-50 p-3 text-red-700"
              >
                That link was rejected. Use the correct account and request a
                new link if needed.
              </p>
            )}

            {linkStatus === 'verified' && (
              <p
                role="alert"
                className="rounded-lg bg-amber-50 p-3 text-amber-800"
              >
                We could not confirm verification for this signed-in account.
                The URL message alone does not verify an account.
              </p>
            )}

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleCheckStatus}
                disabled={isBusy}
                className="rounded-lg bg-[#006e00] px-4 py-3 font-semibold text-white disabled:opacity-50"
              >
                I've opened the link — check status
              </button>

              <button
                type="button"
                onClick={handleResend}
                disabled={isBusy || resendSeconds > 0}
                className="rounded-lg border border-[#006e00] px-4 py-3 font-semibold text-[#006e00] disabled:opacity-50"
              >
                {isResending
                  ? 'Requesting email...'
                  : resendSeconds > 0
                    ? `Resend available in ${resendSeconds}s`
                    : 'Resend verification email'}
              </button>
            </div>
          </div>
        )}

        {!isChecking && !loadError && user && (
          <button
            type="button"
            onClick={handleLogout}
            disabled={isBusy}
            className="mt-6 text-sm font-semibold text-gray-600 underline disabled:opacity-50"
          >
            {isLoggingOut ? 'Logging out...' : 'Log out'}
          </button>
        )}

        {notice && (
          <p role="status" className="mt-4 text-sm text-[#006e00]">
            {notice}
          </p>
        )}

        {actionError && (
          <p role="alert" className="mt-4 text-sm text-red-700">
            {actionError}
          </p>
        )}

        {import.meta.env.DEV && (
          <p className="mt-6 border-t border-gray-200 pt-4 text-xs text-gray-500">
            Local testing: if Laravel uses MAIL_MAILER=log, find the email in
            backend/laravel/storage/logs/laravel.log instead of an inbox.
          </p>
        )}
      </section>
    </main>
  );
}

export default VerifyEmailPage;