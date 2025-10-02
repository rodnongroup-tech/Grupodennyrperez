import React, { useState, useEffect, useRef } from 'react';
import { Employee, PayrollRun, PayrollRunStatus, ChatMessage } from '../types';
import { IconUsers, IconPayroll, IconCalendar, IconChatBubble, IconPaperAirplane, IconSparkles } from '../constants';
import { geminiService } from '../services/geminiService';
import { LoadingSpinner } from './common/LoadingSpinner';

interface DashboardViewProps {
  employees: Employee[];
  payrollRuns: PayrollRun[];
}

interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  colorClass: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, title, value, colorClass }) => (
  <div className={`bg-white p-6 rounded-xl shadow-lg flex items-center space-x-4 border-l-4 ${colorClass}`}>
    <div className="flex-shrink-0">{icon}</div>
    <div>
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="text-2xl font-semibold text-slate-800">{value}</p>
    </div>
  </div>
);

export const DashboardView: React.FC<DashboardViewProps> = ({ employees, payrollRuns }) => {
  const totalEmployees = employees.length;
  const completedPayrollRuns = payrollRuns.filter(run => run.status === PayrollRunStatus.COMPLETED).length;
  const totalPayrollAmount = payrollRuns
    .filter(run => run.status === PayrollRunStatus.COMPLETED)
    .reduce((sum, run) => sum + run.totalAmount, 0);

  // Payroll Assistant Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Add a welcome message from AI
    setChatMessages([
      { 
        id: 'ai-welcome', 
        text: "¡Hola! Soy tu Asistente de Nómina. ¿Cómo puedo ayudarte hoy con tus consultas generales sobre nómina en República Dominicana?", 
        sender: 'ai', 
        timestamp: new Date() 
      }
    ]);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSendMessage = async () => {
    if (!userInput.trim()) return;

    const newUserMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      text: userInput,
      sender: 'user',
      timestamp: new Date(),
    };
    setChatMessages(prev => [...prev, newUserMessage]);
    setUserInput('');
    setIsAiTyping(true);

    try {
      const aiResponseText = await geminiService.getPayrollAssistance(newUserMessage.text);
      const newAiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        text: aiResponseText,
        sender: 'ai',
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, newAiMessage]);
    } catch (error) {
      console.error("Error getting AI response:", error);
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        text: "Lo siento, tuve problemas para conectarme. Por favor, inténtalo de nuevo.",
        sender: 'ai',
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsAiTyping(false);
    }
  };


  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-bold text-slate-800">Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          icon={<IconUsers className="w-10 h-10 text-indigo-500" />}
          title="Total de Empleados"
          value={totalEmployees}
          colorClass="border-indigo-500"
        />
        <StatCard
          icon={<IconPayroll className="w-10 h-10 text-emerald-500" />}
          title="Nóminas Completadas"
          value={completedPayrollRuns}
          colorClass="border-emerald-500"
        />
        <StatCard
          icon={<IconCalendar className="w-10 h-10 text-amber-500" />}
          title="Monto Total Pagado (DOP)"
          value={totalPayrollAmount.toLocaleString('es-DO', { style: 'currency', currency: 'DOP' })}
          colorClass="border-amber-500"
        />
      </div>

      {/* Payroll Assistant Chat */}
      <div className="bg-white shadow-xl rounded-xl p-6 border border-slate-200">
        <h2 className="text-2xl font-semibold text-slate-700 mb-4 flex items-center">
          <IconSparkles className="w-7 h-7 mr-2 text-indigo-500" />
          Asistente de Nómina IA
        </h2>
        <div className="h-[28rem] sm:h-[32rem] flex flex-col border border-slate-200 rounded-lg">
          <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-slate-50">
            {chatMessages.map(msg => (
              <div key={msg.id} className={`flex items-end gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                 {msg.sender === 'ai' && <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">IA</div>}
                <div
                  className={`max-w-md px-4 py-2.5 rounded-xl shadow ${
                    msg.sender === 'user'
                      ? 'bg-indigo-500 text-white rounded-br-none'
                      : 'bg-slate-200 text-slate-700 rounded-bl-none'
                  }`}
                >
                  <p className="text-sm" style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</p>
                </div>
              </div>
            ))}
            {isAiTyping && (
              <div className="flex items-end gap-2 justify-start">
                 <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">IA</div>
                <div className="bg-slate-200 text-slate-700 px-4 py-2 rounded-xl shadow rounded-bl-none inline-flex items-center">
                  <LoadingSpinner size="sm" className="mr-2" />
                  <span className="text-sm italic">IA está escribiendo...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="p-4 border-t border-slate-200 bg-white">
            <div className="flex items-center space-x-3">
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !isAiTyping && handleSendMessage()}
                placeholder="Escribe tu pregunta sobre nómina aquí..."
                className="flex-1 w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                disabled={isAiTyping}
                aria-label="Mensaje para el asistente de nómina"
              />
              <button
                onClick={handleSendMessage}
                disabled={isAiTyping || !userInput.trim()}
                className="bg-indigo-500 text-white p-2.5 rounded-lg hover:bg-indigo-600 active:bg-indigo-700 transition-colors disabled:bg-indigo-300 disabled:cursor-not-allowed flex items-center justify-center shadow hover:shadow-md"
                aria-label="Enviar mensaje"
              >
                <IconPaperAirplane className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
