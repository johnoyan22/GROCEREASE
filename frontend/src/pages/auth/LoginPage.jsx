import LoginHero from '../../components/auth/loginHero';
import LoginForm from '../../components/auth/loginForm';

function LoginPage() {
  return (
    <div className="w-screen h-screen bg-white flex items-center justify-center">
      <div className="w-full h-full p-12 flex gap-12 overflow-hidden">
        <LoginHero />
        <LoginForm />
      </div>
    </div>
  );
}

export default LoginPage;
