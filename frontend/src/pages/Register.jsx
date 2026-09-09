import RegisterHero from '../components/Shoppers/registerHero';
import RegisterForm from '../components/Shoppers/registerForm';

function Register() {
  return (
    <div className="w-screen h-screen bg-white flex items-center justify-center">
      <div className="w-full h-full p-12 flex gap-12 overflow-hidden">
        <RegisterHero />
        <RegisterForm />
      </div>
    </div>
  );
}

export default Register;