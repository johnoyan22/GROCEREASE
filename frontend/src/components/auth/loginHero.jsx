import { Link } from 'react-router-dom';
import grocerease from '../../assets/images/grocerease.png';
import Logo from '../../assets/images/Logo.png';

function LoginHero() {
  return (
    <div className="flex min-w-0 flex-col justify-between">
      <Link to="/" aria-label="GrocerEase home" className="flex w-fit items-center gap-2">
        <img src={Logo} alt="GrocerEase Logo" className="h-10 w-10 object-contain sm:h-14 sm:w-14" />
        <span className="text-2xl font-black sm:text-3xl text-black tracking-tight">
          Grocer<span className="text-[#006e00]">Ease</span>
        </span>
      </Link>

      <div className="hidden w-full flex-1 items-center justify-center p-4 lg:flex">
        <img 
          src={grocerease} 
          alt="Fresh Produce Shelves" 
          className="max-h-[70dvh] w-full object-contain"
        />
      </div>
    </div>
  );
}

export default LoginHero;