import grocerease from '../../assets/images/grocerease.png';
import Logo from '../../assets/images/Logo.png';

function LoginHero() {
  return (
    <div className="w-1/2 flex flex-col justify-between">
      <div className="flex items-center gap-3">
        <img src={Logo} alt="GrocerEase Logo" className="w-14 h-14 object-contain" />
        <span className="text-3xl font-black text-black tracking-tight">
          Grocer<span className="text-[#006e00]">Ease</span>
        </span>
      </div>

      <div className="w-full flex-1 flex items-center justify-center p-4 bg-transparent">
        <img 
          src={grocerease} 
          alt="Fresh Produce Shelves" 
          className="w-full h-full object-contain"
        />
      </div>
    </div>
  );
}

export default LoginHero;