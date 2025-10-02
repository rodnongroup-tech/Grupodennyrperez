

import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route, Link, NavLink, Navigate } from 'react-router-dom';
import { DashboardView } from './components/DashboardView';
import { EmployeesView } from './components/EmployeesView';
import { PayrollView } from './components/PayrollView';
import { SubagentsView } from './components/SubagentsView';
import { MonthlyReportView } from './components/MonthlyReportView';
import { MiHeladitoReportView } from './components/MiHeladitoReportView';
import { FuelReportView } from './components/FuelReportView';
import { BankTransactionsView } from './components/BankTransactionsView';
import { MiHeladitoPayrollView } from './components/MiHeladitoPayrollView';
import { ReceivablesView } from './components/PendingConducesView';
import { LoginView } from './components/LoginView';
import { LoansView } from './components/LoansView';
import { LoadingSpinner } from './components/common/LoadingSpinner';
import { IconDashboard, IconEmployees, IconPayroll, IconGDPLogo, IconTruck, IconChartBar, IconIceCream, IconFuel, IconCreditCard, IconCash, IconLogout, IconClipboardList, IconReceiptPercent } from './constants';
import { Employee, PayrollRun, Subagent, ConduceDocument, SubagentMonthlyPayment, ManualReportEntry, MiHeladitoReportEntry, FuelLogEntry, BankTransaction, MiHeladitoWorker, MiHeladitoPayrollRun, AppUser, Debtor, Receivable, Loan, LoanPayment } from './types';
import { api } from './services/api';
import { authService } from './services/authService';

const HamburgerIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
  </svg>
);


const App: React.FC = () => {
  // Local state for all application data
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [subagents, setSubagents] = useState<Subagent[]>([]);
  const [conduceDocuments, setConduceDocuments] = useState<ConduceDocument[]>([]);
  const [subagentMonthlyPayments, setSubagentMonthlyPayments] = useState<SubagentMonthlyPayment[]>([]);
  const [manualReportEntries, setManualReportEntries] = useState<Record<string, ManualReportEntry>>({});
  const [miHeladitoReportEntries, setMiHeladitoReportEntries] = useState<Record<string, MiHeladitoReportEntry>>({});
  const [fuelLogEntries, setFuelLogEntries] = useState<FuelLogEntry[]>([]);
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
  const [miHeladitoWorkers, setMiHeladitoWorkers] = useState<MiHeladitoWorker[]>([]);
  const [miHeladitoPayrollRuns, setMiHeladitoPayrollRuns] = useState<MiHeladitoPayrollRun[]>([]);
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loanPayments, setLoanPayments] = useState<LoanPayment[]>([]);
  
  // Auth state and loading states
  const [currentUser, setCurrentUser] = useState<AppUser | null>(authService.getCurrentUser());
  const [isLoading, setIsLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);

  // UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Effect to load all data from the "API" when the user is logged in
  useEffect(() => {
    if (currentUser) {
      const loadAppData = async () => {
        setIsLoading(true);
        try {
          const [
            employeesData, payrollRunsData, subagentsData, conduceDocumentsData,
            subagentMonthlyPaymentsData, manualReportEntriesData, miHeladitoReportEntriesData,
            fuelLogEntriesData, bankTransactionsData, miHeladitoWorkersData, miHeladitoPayrollRunsData,
            debtorsData, receivablesData, loansData, loanPaymentsData
          ] = await Promise.all([
            api.fetchAll<Employee>('gdp_employees'),
            api.fetchAll<PayrollRun>('gdp_payrollRuns'),
            api.fetchAll<Subagent>('gdp_subagents'),
            api.fetchAll<ConduceDocument>('gdp_conduceDocuments'),
            api.fetchAll<SubagentMonthlyPayment>('gdp_subagentMonthlyPayments'),
            api.fetchObjectStore<Record<string, ManualReportEntry>>('gdp_manualReportEntries'),
            api.fetchObjectStore<Record<string, MiHeladitoReportEntry>>('gdp_miHeladitoReportEntries'),
            api.fetchAll<FuelLogEntry>('gdp_fuelLogEntries'),
            api.fetchAll<BankTransaction>('gdp_bankTransactions'),
            api.fetchAll<MiHeladitoWorker>('gdp_miHeladitoWorkers'),
            api.fetchAll<MiHeladitoPayrollRun>('gdp_miHeladitoPayrollRuns'),
            api.fetchAll<Debtor>('gdp_debtors'),
            api.fetchAll<Receivable>('gdp_receivables'),
            api.fetchAll<Loan>('gdp_loans'),
            api.fetchAll<LoanPayment>('gdp_loanPayments'),
          ]);

          setEmployees(employeesData);
          setPayrollRuns(payrollRunsData);
          setSubagents(subagentsData);
          setConduceDocuments(conduceDocumentsData);
          setSubagentMonthlyPayments(subagentMonthlyPaymentsData);
          setManualReportEntries(manualReportEntriesData);
          setMiHeladitoReportEntries(miHeladitoReportEntriesData);
          setFuelLogEntries(fuelLogEntriesData);
          setBankTransactions(bankTransactionsData);
          setMiHeladitoWorkers(miHeladitoWorkersData);
          setMiHeladitoPayrollRuns(miHeladitoPayrollRunsData);
          setDebtors(debtorsData);
          setReceivables(receivablesData);
          setLoans(loansData);
          setLoanPayments(loanPaymentsData);

        } catch (error) {
          console.error("Failed to load application data:", error);
          setLoginError("Failed to load application data. Please try again later.");
        } finally {
          setIsLoading(false);
        }
      };
      loadAppData();
    } else {
      setIsLoading(false); // No user, no data to load
    }
  }, [currentUser]);

  // --- Authentication Handlers ---
  const handleLogin = useCallback(async (username: string, password: string) => {
    const user = await authService.login(username, password);
    if (user) {
        setCurrentUser(user);
        setLoginError(null);
    } else {
        setLoginError('Usuario o contraseña incorrectos.');
    }
  }, []);

  const handleLogout = useCallback(() => {
    authService.logout();
    setCurrentUser(null);
    // Clear all state
    setEmployees([]); setPayrollRuns([]); setSubagents([]); setConduceDocuments([]);
    setSubagentMonthlyPayments([]); setManualReportEntries({}); setMiHeladitoReportEntries({});
    setFuelLogEntries([]); setBankTransactions([]); setMiHeladitoWorkers([]); setMiHeladitoPayrollRuns([]);
    setDebtors([]); setReceivables([]); setLoans([]); setLoanPayments([]);
  }, []);

  // --- Data Mutation Handlers ---
  const addEmployee = useCallback(async (employeeData: Omit<Employee, 'id'>) => {
    const newEmployee = await api.saveNew<Employee>('gdp_employees', employeeData);
    setEmployees(prev => [...prev, newEmployee]);
  }, []);

  const updateEmployee = useCallback(async (updatedEmployee: Employee) => {
    const savedEmployee = await api.update('gdp_employees', updatedEmployee);
    setEmployees(prev => prev.map(emp => emp.id === savedEmployee.id ? savedEmployee : emp));
  }, []);
  
  const addPayrollRun = useCallback(async (run: PayrollRun) => {
    await api.update('gdp_payrollRuns', run); // Add/Update logic can be improved in API
    setPayrollRuns(prev => [run, ...prev].filter((v,i,a)=>a.findIndex(t=>(t.id === v.id))===i)); // Avoid duplicates
  }, []);

  const updatePayrollRun = useCallback(async (updatedRun: PayrollRun) => {
    const savedRun = await api.update('gdp_payrollRuns', updatedRun);
    setPayrollRuns(prev => prev.map(r => r.id === savedRun.id ? savedRun : r));
  }, []);

  const addSubagent = useCallback(async (subagentData: Omit<Subagent, 'id'>) => {
    const newSubagent = await api.saveNew<Subagent>('gdp_subagents', subagentData);
    setSubagents(prev => [...prev, newSubagent]);
  }, []);

  const updateSubagent = useCallback(async (updatedSubagent: Subagent) => {
    const savedSubagent = await api.update('gdp_subagents', updatedSubagent);
    setSubagents(prev => prev.map(sub => sub.id === savedSubagent.id ? savedSubagent : sub));
  }, []);

  const addConduceDocument = useCallback(async (
    docData: Omit<ConduceDocument, 'id' | 'calculatedPayment' | 'isPaid'>,
    subagentRate: number
  ) => {
    let finalCalculatedPayment = 0;
    if (docData.paymentType === 'direct' && typeof docData.directPaymentAmount === 'number') {
      finalCalculatedPayment = docData.directPaymentAmount;
    } else if (docData.paymentType === 'calculated' && typeof docData.totalWeightPounds === 'number') {
      finalCalculatedPayment = docData.totalWeightPounds * subagentRate;
    }

    const newDocumentData = {
      ...docData,
      calculatedPayment: parseFloat(finalCalculatedPayment.toFixed(2)),
      isPaid: false,
      totalWeightPounds: docData.totalWeightPounds ?? 0,
    };
    const newDocument = await api.saveNew<ConduceDocument>('gdp_conduceDocuments', newDocumentData);
    setConduceDocuments(prev => [newDocument, ...prev]);
  }, []);

  const deleteConduceDocument = useCallback(async (docId: string) => {
    await api.delete('gdp_conduceDocuments', docId);
    setConduceDocuments(prev => prev.filter(doc => doc.id !== docId && !doc.isPaid));
  }, []);
  
  const updateConduceDocumentStatus = useCallback(async (docIds: string[], isPaid: boolean, paymentRunId?: string) => {
    const updates = docIds.map(id => ({ id, isPaid, paymentRunId: isPaid ? paymentRunId : undefined }));
    await api.batchUpdate<ConduceDocument>('gdp_conduceDocuments', updates);
    setConduceDocuments(prev => 
      prev.map(doc => {
        const foundUpdate = updates.find(u => u.id === doc.id);
        return foundUpdate ? { ...doc, ...foundUpdate } : doc;
      })
    );
  }, []);

  const addSubagentMonthlyPayment = useCallback(async (payment: SubagentMonthlyPayment) => {
    const newPayment = await api.saveNew<SubagentMonthlyPayment>('gdp_subagentMonthlyPayments', payment);
    setSubagentMonthlyPayments(prev => [...prev, newPayment]);
  }, []);

  const deleteSubagentMonthlyPayment = useCallback(async (paymentId: string) => {
    if (!window.confirm("¿Está seguro de que desea anular este pago? Esta acción marcará los conduces asociados como 'Pendientes' de nuevo.")) return;
    const paymentToDelete = subagentMonthlyPayments.find(p => p.id === paymentId);
    if (!paymentToDelete) return;
    
    await api.delete('gdp_subagentMonthlyPayments', paymentId);
    if (paymentToDelete.conduceDocIdsIncluded && paymentToDelete.conduceDocIdsIncluded.length > 0) {
        await updateConduceDocumentStatus(paymentToDelete.conduceDocIdsIncluded, false, undefined);
    }
    setSubagentMonthlyPayments(prev => prev.filter(p => p.id !== paymentId));
  }, [subagentMonthlyPayments, updateConduceDocumentStatus]);

  const addOrUpdateManualReportEntry = useCallback(async (monthYearKey: string, entry: ManualReportEntry) => {
    const currentEntries = await api.fetchObjectStore<Record<string, ManualReportEntry>>('gdp_manualReportEntries');
    const updatedEntries = { ...currentEntries, [monthYearKey]: entry };
    await api.updateObjectStore('gdp_manualReportEntries', updatedEntries);
    setManualReportEntries(updatedEntries);
  }, []);

  const addOrUpdateMiHeladitoReportEntry = useCallback(async (monthYearKey: string, entry: MiHeladitoReportEntry) => {
    const currentEntries = await api.fetchObjectStore<Record<string, MiHeladitoReportEntry>>('gdp_miHeladitoReportEntries');
    const updatedEntries = { ...currentEntries, [monthYearKey]: { ...entry, investmentPurchases: entry.investmentPurchases || [] } };
    await api.updateObjectStore('gdp_miHeladitoReportEntries', updatedEntries);
    setMiHeladitoReportEntries(updatedEntries);
  }, []);

  const addFuelLogEntry = useCallback(async (entryData: Omit<FuelLogEntry, 'id'>) => {
    const newEntry = await api.saveNew<FuelLogEntry>('gdp_fuelLogEntries', entryData);
    setFuelLogEntries(prev => [newEntry, ...prev]);
  }, []);

  const updateFuelLogEntry = useCallback(async (updatedEntry: FuelLogEntry) => {
    const savedEntry = await api.update('gdp_fuelLogEntries', updatedEntry);
    setFuelLogEntries(prev => prev.map(entry => entry.id === savedEntry.id ? savedEntry : entry));
  }, []);

  const deleteFuelLogEntry = useCallback(async (entryId: string) => {
    if (window.confirm("¿Está seguro que desea eliminar este registro de combustible?")) {
      await api.delete('gdp_fuelLogEntries', entryId);
      setFuelLogEntries(prev => prev.filter(entry => entry.id !== entryId));
    }
  }, []);

  const addBankTransaction = useCallback(async (transactionData: Omit<BankTransaction, 'id' | 'isDebit'>) => {
    const dataToSave = { ...transactionData, isDebit: (transactionData.debit || 0) > 0 };
    const newTransaction = await api.saveNew<BankTransaction>('gdp_bankTransactions', dataToSave);
    setBankTransactions(prev => [newTransaction, ...prev]);
  }, []);

  const updateBankTransaction = useCallback(async (updatedTx: BankTransaction) => {
    const savedTx = await api.update('gdp_bankTransactions', updatedTx);
    setBankTransactions(prev => prev.map(tx => tx.id === savedTx.id ? savedTx : tx));
  }, []);

  const addMiHeladitoWorker = useCallback(async (workerData: Omit<MiHeladitoWorker, 'id'>) => {
    const newWorker = await api.saveNew<MiHeladitoWorker>('gdp_miHeladitoWorkers', workerData);
    setMiHeladitoWorkers(prev => [...prev, newWorker]);
  }, []);

  const updateMiHeladitoWorker = useCallback(async (updatedWorker: MiHeladitoWorker) => {
    const savedWorker = await api.update('gdp_miHeladitoWorkers', updatedWorker);
    setMiHeladitoWorkers(prev => prev.map(w => w.id === savedWorker.id ? savedWorker : w));
  }, []);

  const addMiHeladitoPayrollRun = useCallback(async (runData: MiHeladitoPayrollRun) => {
    const newRun = await api.saveNew<MiHeladitoPayrollRun>('gdp_miHeladitoPayrollRuns', runData);
    setMiHeladitoPayrollRuns(prev => [newRun, ...prev]);
  }, []);

  const addDebtor = useCallback(async (debtorData: Omit<Debtor, 'id'>) => {
    const newDebtor = await api.saveNew<Debtor>('gdp_debtors', debtorData);
    setDebtors(prev => [...prev, newDebtor]);
    return newDebtor;
  }, []);

  const addReceivable = useCallback(async (receivableData: Omit<Receivable, 'id'|'isPaid'>) => {
      const newReceivableData = { ...receivableData, isPaid: false };
      const newReceivable = await api.saveNew<Receivable>('gdp_receivables', newReceivableData);
      setReceivables(prev => [...prev, newReceivable]);
  }, []);

  const updateReceivable = useCallback(async (updatedReceivable: Receivable) => {
      const savedReceivable = await api.update<Receivable>('gdp_receivables', updatedReceivable);
      setReceivables(prev => prev.map(r => r.id === savedReceivable.id ? savedReceivable : r));
  }, []);

  const deleteReceivable = useCallback(async (receivableId: string) => {
      await api.delete('gdp_receivables', receivableId);
      setReceivables(prev => prev.filter(r => r.id !== receivableId));
  }, []);

  // Loan Handlers
  const addLoan = useCallback(async (loanData: Omit<Loan, 'id'>) => {
    const newLoan = await api.saveNew<Loan>('gdp_loans', loanData);
    setLoans(prev => [...prev, newLoan]);
  }, []);

  const updateLoan = useCallback(async (updatedLoan: Loan) => {
      const savedLoan = await api.update('gdp_loans', updatedLoan);
      setLoans(prev => prev.map(l => l.id === savedLoan.id ? savedLoan : l));
  }, []);

  const addLoanPayment = useCallback(async (paymentData: Omit<LoanPayment, 'id'>) => {
      const newPayment = await api.saveNew<LoanPayment>('gdp_loanPayments', paymentData);
      setLoanPayments(prev => [...prev, newPayment]);
      return newPayment;
  }, []);

  // --- Render Logic ---
  const navLinks = [
    { to: "/", label: "Dashboard", Icon: IconDashboard, permissions: ['all'] },
    { to: "/employees", label: "Empleados", Icon: IconEmployees, permissions: ['all'] },
    { to: "/payroll", label: "Nómina Empleados", Icon: IconPayroll, permissions: ['all'] },
    { to: "/subagents", label: "Pagos Subagentes", Icon: IconTruck, permissions: ['all'] },
    { to: "/receivables", label: "Cuentas por Cobrar", Icon: IconClipboardList, permissions: ['all'] },
    { to: "/monthly-report", label: "Reporte Mensual GDP", Icon: IconChartBar, permissions: ['all'] },
    { to: "/mi-heladito-report", label: "Reporte Mi Heladito", Icon: IconIceCream, permissions: ['all', 'mi_heladito_only'] },
    { to: "/mi-heladito-payroll", label: "Nómina Mi Heladito", Icon: IconCash, permissions: ['all', 'mi_heladito_only'] },
    { to: "/fuel-report", label: "Reporte Combustible", Icon: IconFuel, permissions: ['all'] },
    { to: "/bank-transactions", label: "Transacciones Bancarias", Icon: IconCreditCard, permissions: ['all'] },
    { to: "/loans", label: "Préstamos", Icon: IconReceiptPercent, permissions: ['all'] },
  ];

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-100">
        <LoadingSpinner size="lg" text="Cargando datos de la aplicación..." />
      </div>
    );
  }

  if (!currentUser) {
    return <LoginView onLogin={handleLogin} loginError={loginError} />;
  }

  const visibleNavLinks = navLinks.filter(link => link.permissions.includes(currentUser.permissions));
  const hasPermission = (requiredPermissions: string[]): boolean => requiredPermissions.includes(currentUser.permissions);
  const defaultRoute = currentUser.permissions === 'mi_heladito_only' ? '/mi-heladito-report' : '/';

  return (
    <HashRouter>
      <div className="flex h-screen bg-slate-100 font-sans">
        {isSidebarOpen && <div className="fixed inset-0 bg-black/60 z-20 lg:hidden" onClick={() => setIsSidebarOpen(false)}></div>}

        <aside className={`fixed lg:relative inset-y-0 left-0 z-30 w-64 bg-slate-900 text-slate-200 p-4 space-y-6 flex flex-col shadow-2xl transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:flex-shrink-0`}>
          <div className="text-xl font-bold text-white flex items-center pt-2 px-2">
            <IconGDPLogo className="w-10 h-10 mr-3" />
            <span className="leading-tight">Grupo Denny R. Perez</span>
          </div>
          <nav className="space-y-1.5 flex-grow">
            {visibleNavLinks.map(({ to, label, Icon }) => (
              <NavLink key={to} to={to} onClick={() => setIsSidebarOpen(false)} className={({ isActive }) => `flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors duration-150 ease-in-out font-medium ${ isActive ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-700/50 hover:text-white' }`} >
                <Icon className="w-6 h-6" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
           <div className="border-t border-slate-700 pt-4 space-y-3">
              <div className="px-3 text-slate-300">
                  <p className="font-semibold text-sm">{currentUser.name}</p>
                  <p className="text-xs text-slate-400">({currentUser.permissions === 'all' ? 'Administrador' : 'Mi Heladito'})</p>
              </div>
              <button
                  onClick={handleLogout}
                  className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors duration-150 ease-in-out font-medium text-slate-300 hover:bg-red-800/50 hover:text-white"
              >
                  <IconLogout className="w-6 h-6" />
                  <span>Cerrar Sesión</span>
              </button>
               <div className="text-xs text-slate-500 text-center pt-2">
                &copy; {new Date().getFullYear()} Grupo Denny R. Perez EIRL
              </div>
          </div>
        </aside>

        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="lg:hidden flex justify-between items-center p-4 bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-10">
              <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-600">
                  <HamburgerIcon className="w-6 h-6" />
              </button>
              <div className="flex items-center gap-2">
                <IconGDPLogo className="w-8 h-8" />
                <span className="font-bold text-slate-700">GDP</span>
              </div>
          </header>
          
          <main className="flex-1 p-6 lg:p-10 overflow-y-auto">
            <Routes>
              <Route path="/" element={hasPermission(['all']) ? <DashboardView employees={employees} payrollRuns={payrollRuns} /> : <Navigate to={defaultRoute} replace />} />
              <Route path="/employees" element={hasPermission(['all']) ? <EmployeesView employees={employees} addEmployee={addEmployee} updateEmployee={updateEmployee} /> : <Navigate to={defaultRoute} replace />} />
              <Route path="/payroll" element={hasPermission(['all']) ? <PayrollView payrollRuns={payrollRuns} employees={employees} addPayrollRun={addPayrollRun} updatePayrollRun={updatePayrollRun} /> : <Navigate to={defaultRoute} replace />} />
              <Route path="/subagents" element={hasPermission(['all']) ? <SubagentsView subagents={subagents} addSubagent={addSubagent} updateSubagent={updateSubagent} conduceDocuments={conduceDocuments} addConduceDocument={addConduceDocument} deleteConduceDocument={deleteConduceDocument} updateConduceDocumentStatus={updateConduceDocumentStatus} subagentMonthlyPayments={subagentMonthlyPayments} addSubagentMonthlyPayment={addSubagentMonthlyPayment} deleteSubagentMonthlyPayment={deleteSubagentMonthlyPayment} /> : <Navigate to={defaultRoute} replace />} />
              <Route path="/receivables" element={hasPermission(['all']) ? <ReceivablesView debtors={debtors} addDebtor={addDebtor} receivables={receivables} addReceivable={addReceivable} updateReceivable={updateReceivable} deleteReceivable={deleteReceivable} /> : <Navigate to={defaultRoute} replace />} />
              <Route path="/monthly-report" element={hasPermission(['all']) ? <MonthlyReportView payrollRuns={payrollRuns} subagentMonthlyPayments={subagentMonthlyPayments} conduceDocuments={conduceDocuments} manualReportEntries={manualReportEntries} addOrUpdateManualReportEntry={addOrUpdateManualReportEntry} /> : <Navigate to={defaultRoute} replace />} />
              <Route path="/mi-heladito-report" element={hasPermission(['all', 'mi_heladito_only']) ? <MiHeladitoReportView miHeladitoReportEntries={miHeladitoReportEntries} addOrUpdateMiHeladitoReportEntry={addOrUpdateMiHeladitoReportEntry} /> : <Navigate to={defaultRoute} replace />} />
              <Route path="/mi-heladito-payroll" element={hasPermission(['all', 'mi_heladito_only']) ? <MiHeladitoPayrollView workers={miHeladitoWorkers} addWorker={addMiHeladitoWorker} updateWorker={updateMiHeladitoWorker} payrollRuns={miHeladitoPayrollRuns} addPayrollRun={addMiHeladitoPayrollRun} /> : <Navigate to={defaultRoute} replace />} />
              <Route path="/fuel-report" element={hasPermission(['all']) ? <FuelReportView fuelLogEntries={fuelLogEntries} addFuelLogEntry={addFuelLogEntry} updateFuelLogEntry={updateFuelLogEntry} deleteFuelLogEntry={deleteFuelLogEntry} /> : <Navigate to={defaultRoute} replace />} />
              <Route path="/bank-transactions" element={hasPermission(['all']) ? <BankTransactionsView bankTransactions={bankTransactions} addBankTransaction={addBankTransaction} updateBankTransaction={updateBankTransaction} /> : <Navigate to={defaultRoute} replace />} />
              <Route path="/loans" element={hasPermission(['all']) ? <LoansView loans={loans} loanPayments={loanPayments} addLoan={addLoan} updateLoan={updateLoan} addLoanPayment={addLoanPayment} /> : <Navigate to={defaultRoute} replace />} />
              <Route path="*" element={<Navigate to={defaultRoute} replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </HashRouter>
  );
};

export default App;
