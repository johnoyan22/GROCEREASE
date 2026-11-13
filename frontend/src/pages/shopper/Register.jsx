import RegisterHero from '../../components/Shoppers/registerHero';
import RegisterForm from '../../components/Shoppers/registerForm';

function Register() {
  return (
    <div className="min-h-dvh bg-white flex items-center justify-center">
      <div className="w-full max-w-7xl p-4 sm:p-8 lg:p-12 flex gap-8">
        <RegisterHero />
        <RegisterForm />
      </div>
    </div>
  );
}

export default Register;
