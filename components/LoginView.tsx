
import React, { useState } from 'react';
import { IconGDPLogo } from '../constants';
import { LoadingSpinner } from './common/LoadingSpinner';

interface LoginViewProps {
  onLogin: (username: string, password: string) => Promise<void>;
  loginError: string | null;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin, loginError }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    setIsLoading(true);
    await onLogin(username, password);
    setIsLoading(false);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-100">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-2xl shadow-2xl">
        <div className="flex flex-col items-center">
          <IconGDPLogo className="w-20 h-20 mb-4" />
          <h2 className="text-3xl font-bold text-center text-slate-800">
            Iniciar Sesión
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600">
            Grupo Denny R. Perez - Sistema de Nómina
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <label htmlFor="username" className="sr-only">
                Usuario
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value.toUpperCase())}
                className="relative block w-full px-3 py-3 bg-white text-gray-900 placeholder-slate-500 border border-slate-300 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Usuario"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="relative block w-full px-3 py-3 bg-white text-gray-900 placeholder-slate-500 border border-slate-300 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Contraseña"
              />
            </div>
          </div>

          {loginError && (
            <div className="p-3 text-sm text-center text-red-800 bg-red-100 border border-red-200 rounded-lg">
              {loginError}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="relative flex justify-center w-full px-4 py-3 text-sm font-semibold text-white bg-indigo-600 border border-transparent rounded-lg group hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400"
            >
              {isLoading ? (
                <LoadingSpinner size="sm" />
              ) : (
                "Ingresar"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};