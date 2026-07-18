import React, { useState } from 'react';
import useAuthStore from '../store/useAuthStore';
import { Activity, Mail, Lock, ShieldCheck } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from "jwt-decode";

export default function AuthPage() {
  const { login, register, loading, error } = useAuthStore();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLogin) {
      await login(email, password, rememberMe);
    } else {
      await register(email, password, pin);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const decoded = jwtDecode(credentialResponse.credential);
      const email = decoded.email;
      await useAuthStore.getState().googleLogin(email, rememberMe);
    } catch (err) {
      console.error("Google Auth Error", err);
    }
  };

  return (
    <div className="min-h-screen bg-obsidian flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative BG */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-molten/10 blur-[100px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-md bg-card backdrop-blur-xl border border-molten/30 rounded-2xl p-8 shadow-2xl z-10">
        <div className="flex items-center justify-center gap-3 mb-8">
          <Activity size={32} className="text-molten" />
          <h2 className="text-2xl font-extrabold text-white tracking-widest">QUANT<span className="text-molten">TRADING</span></h2>
        </div>

        <div className="flex gap-4 mb-8 border-b border-white/10 pb-4">
          <button onClick={() => setIsLogin(true)} className={`flex-1 text-center font-bold tracking-widest uppercase transition-colors ${isLogin ? 'text-molten' : 'text-gray-500 hover:text-gray-300'}`}>Sign In</button>
          <button onClick={() => setIsLogin(false)} className={`flex-1 text-center font-bold tracking-widest uppercase transition-colors ${!isLogin ? 'text-molten' : 'text-gray-500 hover:text-gray-300'}`}>Create ID</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <div className="p-3 bg-danger/20 border border-danger/50 text-danger rounded-lg text-sm text-center font-bold">{error}</div>}
          
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-black/50 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:border-molten transition-colors" placeholder="user@gmail.com" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full bg-black/50 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:border-molten transition-colors" placeholder="••••••••" />
            </div>
          </div>

          {!isLogin && (
            <div className="animate-in slide-in-from-top-2 duration-300">
              <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest">Security PIN (Optional)</label>
              <div className="relative">
                <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <input type="password" maxLength={4} value={pin} onChange={e => setPin(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:border-molten transition-colors font-mono" placeholder="4-Digit PIN" />
              </div>
            </div>
          )}

          {isLogin && (
            <div className="flex items-center gap-2">
              <input type="checkbox" id="remember" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} className="w-4 h-4 accent-molten" />
              <label htmlFor="remember" className="text-sm text-gray-400 font-semibold cursor-pointer">Remember me on this device</label>
            </div>
          )}

          <button type="submit" disabled={loading} className="w-full py-3 bg-molten text-obsidian rounded-lg font-extrabold uppercase tracking-widest hover:bg-yellow-500 transition-colors shadow-[0_0_20px_rgba(212,175,55,0.3)] flex justify-center items-center h-[50px]">
            {loading ? <span className="w-5 h-5 border-2 border-obsidian border-t-transparent rounded-full animate-spin"></span> : (isLogin ? 'Access Terminal' : 'Initialize Account')}
          </button>
        </form>

        <div className="mt-8 relative">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
          <div className="relative flex justify-center text-sm"><span className="px-2 bg-card text-gray-500 font-bold uppercase tracking-widest">Or connect with</span></div>
        </div>

        <div className="mt-6 flex justify-center w-full">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => {
              console.error('Google Login Failed');
            }}
            theme="filled_black"
            size="large"
            width="100%"
            text="continue_with"
          />
        </div>
      </div>
    </div>
  );
}
