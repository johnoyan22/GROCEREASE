import LoginHero from '../../components/auth/loginHero';
import LoginForm from '../../components/auth/loginForm';

function LoginPage() {
  return (
    <div className="shopper-auth min-h-dvh bg-white px-4 py-5 sm:px-6 sm:py-8 lg:p-10">
      <div className="mx-auto grid w-full min-w-0 max-w-7xl gap-6 lg:grid-cols-2 lg:gap-10">
        <LoginHero />
        <LoginForm />
      </div>
    </div>
  );
}

export default LoginPage;
