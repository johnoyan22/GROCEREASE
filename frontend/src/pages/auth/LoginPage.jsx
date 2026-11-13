import LoginHero from '../../components/auth/loginHero';
import LoginForm from '../../components/auth/loginForm';

function LoginPage() {
  return (
    <div className="min-h-dvh bg-white flex items-center justify-center">
      <div className="w-full max-w-7xl p-4 sm:p-8 lg:p-12 flex gap-8">
        <LoginHero />
        <LoginForm />
      </div>
    </div>
  );
}

export default LoginPage;
