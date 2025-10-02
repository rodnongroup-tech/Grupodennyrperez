
import React, { useState } from 'react';
import jsPDF from 'jspdf';
import { PayrollRun, Employee, Payslip, Deduction, PayrollRunStatus } from '../types';
import { IconPayroll, IconSparkles, IconPrint, IconClock, IconShieldCheck, IconMail } from '../constants'; 
import { Modal } from './common/Modal';
import { LoadingSpinner } from './common/LoadingSpinner';
import { geminiService } from '../services/geminiService';

interface PayrollViewProps {
  payrollRuns: PayrollRun[];
  employees: Employee[];
  addPayrollRun: (run: PayrollRun) => void;
  updatePayrollRun: (run: PayrollRun) => void;
}

const AVG_WORKING_DAYS_PER_MONTH = 23.83;
const STD_HOURS_PER_DAY = 8;
const OVERTIME_MULTIPLIER = 1.35;
const AFP_RATE = 0.0287;
const SFS_RATE = 0.0304;

const spanishMonthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

export const PayrollView: React.FC<PayrollViewProps> = ({ payrollRuns, employees, addPayrollRun, updatePayrollRun }) => {
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);
  const [editingRun, setEditingRun] = useState<PayrollRun | null>(null);
  const [isPayslipModalOpen, setIsPayslipModalOpen] = useState(false);
  
  const [runModalYear, setRunModalYear] = useState(currentYear);
  const [runModalMonth, setRunModalMonth] = useState(new Date().getMonth());
  const [runModalFortnight, setRunModalFortnight] = useState<'1st Fortnight' | '2nd Fortnight'>('1st Fortnight');
  
  const [selectedEmployeesForRun, setSelectedEmployeesForRun] = useState<string[]>([]);
  const [overtimeHoursMap, setOvertimeHoursMap] = useState<Record<string, number>>({});
  const [applyTssDeductionsMap, setApplyTssDeductionsMap] = useState<Record<string, boolean>>({});
  const [currentPayslip, setCurrentPayslip] = useState<Payslip | null>(null);
  const [payslipExplanation, setPayslipExplanation] = useState<string | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const [processingPayroll, setProcessingPayroll] = useState(false);
  const [viewingPayslipsForRun, setViewingPayslipsForRun] = useState<Payslip[]>([]);


  const openRunModal = (runToEdit: PayrollRun | null = null) => {
    if (runToEdit) {
      setEditingRun(runToEdit);
      
      const periodParts = runToEdit.payPeriod.replace(' - ', ' ').split(' ');
      const monthName = periodParts[0];
      const year = parseInt(periodParts[1], 10);
      const fortnight = `${periodParts[2]} ${periodParts[3]}` as '1st Fortnight' | '2nd Fortnight';

      const monthIndex = spanishMonthNames.findIndex(m => m.toLowerCase() === monthName.toLowerCase());

      if(monthIndex !== -1 && !isNaN(year)){
          setRunModalMonth(monthIndex);
          setRunModalYear(year);
          setRunModalFortnight(fortnight);
      }
      
      const employeeIds = runToEdit.payslipsGenerated.map(p => p.employeeId);
      setSelectedEmployeesForRun(employeeIds);
      
      const overtimeMap: Record<string, number> = {};
      const tssMap: Record<string, boolean> = {};
      runToEdit.payslipsGenerated.forEach(p => {
        overtimeMap[p.employeeId] = p.overtimeHours;
        const hasTssDeductions = p.deductions.some(d => d.name.includes("AFP") || d.name.includes("SFS"));
        tssMap[p.employeeId] = hasTssDeductions;
      });
      setOvertimeHoursMap(overtimeMap);
      setApplyTssDeductionsMap(tssMap);
    } else {
      setEditingRun(null);
      const now = new Date();
      setRunModalYear(now.getFullYear());
      setRunModalMonth(now.getMonth());
      setRunModalFortnight(now.getDate() <= 15 ? '1st Fortnight' : '2nd Fortnight');
      setSelectedEmployeesForRun([]); 
      setOvertimeHoursMap({}); 
      setApplyTssDeductionsMap({});
    }
    setIsRunModalOpen(true);
  };
  const closeRunModal = () => {
    setIsRunModalOpen(false);
    setEditingRun(null);
  };

  const openPayslipModal = (payslip: Payslip) => {
    setCurrentPayslip(payslip);
    setPayslipExplanation(null); 
    setIsPayslipModalOpen(true);
  };
  
  const openPayslipsListModal = (run: PayrollRun) => {
    setViewingPayslipsForRun(run.payslipsGenerated);
    if (run.payslipsGenerated.length > 0) {
        openPayslipModal(run.payslipsGenerated[0]); 
    }
  };


  const closePayslipModal = () => {
    setIsPayslipModalOpen(false);
    setCurrentPayslip(null);
    setPayslipExplanation(null);
  };

  const handleEmployeeSelection = (employeeId: string) => {
    const isCurrentlySelected = selectedEmployeesForRun.includes(employeeId);
    setSelectedEmployeesForRun(prev =>
      isCurrentlySelected ? prev.filter(id => id !== employeeId) : [...prev, employeeId]
    );
    
    if (isCurrentlySelected) {
        setOvertimeHoursMap(prevMap => {
            const newMap = {...prevMap};
            delete newMap[employeeId];
            return newMap;
        });
        setApplyTssDeductionsMap(prevMap => {
            const newMap = {...prevMap};
            delete newMap[employeeId];
            return newMap;
        });
    } else { 
         setOvertimeHoursMap(prevMap => ({...prevMap, [employeeId]: 0}));
         // Default Laura to have TSS deductions, others not.
         const employee = employees.find(e => e.id === employeeId);
         const shouldApplyTss = employee?.name.toLowerCase().includes('laura') || false;
         setApplyTssDeductionsMap(prevMap => ({...prevMap, [employeeId]: shouldApplyTss}));
    }
  };

  const handleOvertimeHoursChange = (employeeId: string, hours: string) => {
    const parsedHours = parseFloat(hours);
    if (!isNaN(parsedHours) && parsedHours >= 0) {
        setOvertimeHoursMap(prev => ({ ...prev, [employeeId]: parsedHours }));
    } else if (hours === "") {
        setOvertimeHoursMap(prev => ({ ...prev, [employeeId]: 0}));
    }
  };
  
  const handleApplyTssChange = (employeeId: string, apply: boolean) => {
    setApplyTssDeductionsMap(prev => ({ ...prev, [employeeId]: apply }));
  };

  const calculateIsrForFortnight = (totalFortnightlyEarnings: number, totalFortnightlyTSSDeduction: number): number => {
    const annualGrossEarnings = totalFortnightlyEarnings * 24;
    const annualTssDeductions = totalFortnightlyTSSDeduction * 24;
    
    const annualTaxableIncome = annualGrossEarnings - annualTssDeductions;

    if (annualTaxableIncome <= 416220.00) return 0;

    let annualIsr = 0;
    if (annualTaxableIncome <= 624329.00) { 
        annualIsr = (annualTaxableIncome - 416220.00) * 0.15;
    } else if (annualTaxableIncome <= 867123.00) { 
        annualIsr = ((624329.00 - 416220.00) * 0.15) + ((annualTaxableIncome - 624329.00) * 0.20);
    } else { 
        annualIsr = ((624329.00 - 416220.00) * 0.15) + ((867123.00 - 624329.00) * 0.20) + ((annualTaxableIncome - 867123.00) * 0.25);
    }
    
    return Math.max(0, annualIsr / 24); 
  };


  const handleProcessPayroll = async () => {
    if (selectedEmployeesForRun.length === 0) {
      alert("Please select at least one employee.");
      return;
    }
    setProcessingPayroll(true);

    await new Promise(resolve => setTimeout(resolve, 500)); 

    const payPeriod = `${spanishMonthNames[runModalMonth]} ${runModalYear} - ${runModalFortnight}`;
    const runId = editingRun ? editingRun.id : `pr-${Date.now()}`;
    const generatedPayslips: Payslip[] = [];
    let totalPayrollNetAmountForRun = 0;

    selectedEmployeesForRun.forEach(empId => {
      const employee = employees.find(e => e.id === empId);
      if (employee) {
        const monthlySalary = employee.salary;
        const baseSalaryForFortnight = monthlySalary / 2;
        const overtimeHours = overtimeHoursMap[empId] || 0;
        
        const monthlyHourlyRate = monthlySalary / AVG_WORKING_DAYS_PER_MONTH / STD_HOURS_PER_DAY;
        const overtimePay = overtimeHours * monthlyHourlyRate * OVERTIME_MULTIPLIER;
        const totalEarningsForFortnight = baseSalaryForFortnight + overtimePay;
        
        const applyTss = !!applyTssDeductionsMap[empId];
        let afpDeduction = 0;
        let sfsDeduction = 0;
        const payslipDeductions: Deduction[] = [];

        if (applyTss) {
          afpDeduction = totalEarningsForFortnight * AFP_RATE;
          sfsDeduction = totalEarningsForFortnight * SFS_RATE;
          payslipDeductions.push(
            { name: "AFP (Pensión)", amount: parseFloat(afpDeduction.toFixed(2)) },
            { name: "SFS (Salud)", amount: parseFloat(sfsDeduction.toFixed(2)) }
          );
        }
        
        const totalTssDeductionAmount = afpDeduction + sfsDeduction;
        const isrDeduction = calculateIsrForFortnight(totalEarningsForFortnight, totalTssDeductionAmount);
        
        if (isrDeduction > 0) {
            payslipDeductions.push({ name: "ISR (Impuesto Sobre la Renta)", amount: parseFloat(isrDeduction.toFixed(2)) });
        }
        
        const netSalary = totalEarningsForFortnight - totalTssDeductionAmount - isrDeduction;
        
        totalPayrollNetAmountForRun += netSalary;

        generatedPayslips.push({
          id: `ps-${empId}-${runId}`,
          employeeId: empId,
          employeeName: employee.name,
          employeeEmail: employee.email,
          employeeCedula: employee.cedula,
          payrollRunId: runId,
          payPeriod: payPeriod,
          baseSalary: parseFloat(baseSalaryForFortnight.toFixed(2)),
          overtimeHours: overtimeHours,
          overtimePay: parseFloat(overtimePay.toFixed(2)),
          totalEarnings: parseFloat(totalEarningsForFortnight.toFixed(2)),
          deductions: payslipDeductions,
          netSalary: parseFloat(netSalary.toFixed(2)),
          generatedDate: new Date().toISOString(),
        });
      }
    });

    const payrollRunData: PayrollRun = {
      id: runId,
      payPeriod: payPeriod,
      status: PayrollRunStatus.COMPLETED,
      totalAmount: parseFloat(totalPayrollNetAmountForRun.toFixed(2)),
      employeesProcessed: selectedEmployeesForRun.length,
      processingDate: new Date().toISOString(),
      payslipsGenerated: generatedPayslips,
    };

    if (editingRun) {
      updatePayrollRun(payrollRunData);
    } else {
      addPayrollRun(payrollRunData);
    }
    
    setProcessingPayroll(false);
    closeRunModal();
  };
  
  const handleExplainPayslip = async (payslip: Payslip) => {
    setIsExplaining(true);
    setPayslipExplanation(null);
    try {
      const explanation = await geminiService.explainPayslip(payslip);
      setPayslipExplanation(explanation);
    } catch (error) {
      console.error("Error explaining payslip:", error);
      setPayslipExplanation("Lo siento, no pude generar una explicación en este momento.");
    } finally {
      setIsExplaining(false);
    }
  };

  const handlePrintPayslip = (payslip: Payslip | null) => {
    if (!payslip) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let yPos = 20; 

    const logoSize = 15;
    const logoX = pageWidth - margin - logoSize;
    const logoY = margin - 7; 
    const logoColor = '#72C6EF'; 
    const logoRadius = 2;

    doc.setFillColor(logoColor);
    doc.roundedRect(logoX, logoY, logoSize, logoSize, logoRadius, logoRadius, 'F');
    
    doc.setFontSize(9); 
    doc.setFont(undefined,'bold');
    doc.setTextColor(255, 255, 255); 
    const textGDP = "GDP";
    const textWidthGDP = doc.getTextWidth(textGDP); 
    doc.text(textGDP, logoX + (logoSize - textWidthGDP) / 2, logoY + logoSize / 2 + 2.5); 
    
    doc.setTextColor(0, 0, 0); 
    doc.setFont(undefined,'normal');

    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text("Volante de Pago Quincenal", pageWidth / 2, yPos, { align: 'center' });
    yPos += 12;

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text("Grupo Denny R. Perez EIRL", margin, yPos);
    yPos += 5;
    doc.text("RNC: 133129221", margin, yPos);
    yPos += 7;
    doc.text(`Cédula Empleado: ${payslip.employeeCedula || 'N/A'}`, margin, yPos);
    yPos += 7;
    doc.setLineWidth(0.3);
    doc.line(margin, yPos, pageWidth - margin, yPos); 
    yPos += 10;

    doc.setFontSize(12);
    doc.text(`Empleado: ${payslip.employeeName}`, margin, yPos);
    yPos += 7;
    doc.text(`Período de Pago: ${payslip.payPeriod}`, margin, yPos);
    yPos += 7;
    doc.text(`Fecha de Generación: ${new Date(payslip.generatedDate).toLocaleDateString()}`, margin, yPos);
    yPos += 10;
    doc.line(margin, yPos, pageWidth - margin, yPos); 
    yPos += 10;
    
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text("Ingresos de la Quincena", margin, yPos);
    yPos += 8;
    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    doc.text("Salario Base Quincenal:", margin, yPos);
    doc.text(`DOP ${payslip.baseSalary.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits:2})}`, pageWidth - margin, yPos, { align: 'right' });
    yPos += 7;
    if (payslip.overtimeHours > 0) {
        doc.text(`Horas Extras (${payslip.overtimeHours} hrs):`, margin, yPos);
        doc.text(`DOP ${payslip.overtimePay.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits:2})}`, pageWidth - margin, yPos, { align: 'right' });
        yPos += 7;
    }
    doc.setFont(undefined, 'bold');
    doc.text("Total Ingresos Quincenales:", margin, yPos);
    doc.text(`DOP ${payslip.totalEarnings.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits:2})}`, pageWidth - margin, yPos, { align: 'right' });
    yPos += 10;
    doc.setFont(undefined, 'normal');

    const deductionsToShow = payslip.deductions.filter(d => d.amount > 0);
    if (deductionsToShow.length > 0) {
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text("Deducciones Aplicadas", margin, yPos);
        yPos += 8;
        doc.setFontSize(12);
        doc.setFont(undefined, 'normal');
        deductionsToShow.forEach(deduction => {
            doc.text(`- ${deduction.name}:`, margin + 5, yPos);
            doc.text(`(DOP ${deduction.amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits:2})})`, pageWidth - margin, yPos, { align: 'right' });
            yPos += 7;
        });
    }

    yPos += 3; 
    doc.line(margin, yPos, pageWidth - margin, yPos); 
    yPos += 10;

    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text("Salario Neto Quincenal (A Percibir):", margin, yPos);
    doc.text(`DOP ${payslip.netSalary.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits:2})}`, pageWidth - margin, yPos, { align: 'right' });
    yPos += 15;

    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(`Generado por Grupo Denny R. Perez EIRL - ${new Date().toLocaleDateString()}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });

    const filename = `Volante-${payslip.employeeName.replace(/\s+/g, '_')}-${payslip.payPeriod.replace(/\s+/g, '_')}.pdf`;
    doc.save(filename);
  };

  const handlePrepareEmailPayslip = (payslip: Payslip | null) => {
    if (!payslip) return;
    
    const recipientEmail = payslip.employeeEmail;
    const senderEmailForCC = "rondonp79@gmail.com";

    if (!recipientEmail) {
      alert("No se pudo preparar el correo: Correo electrónico del empleado no encontrado en el volante.");
      return;
    }

    const subject = `Volante de Pago - ${payslip.payPeriod} - ${payslip.employeeName}`;
    const bodyLines = [
      `Estimado/a ${payslip.employeeName.split(' ')[0]},`,
      "",
      `Adjunto encontrarás tu volante de pago correspondiente al período: ${payslip.payPeriod}.`,
      "",
      "Por favor, revisa el documento adjunto.",
      "",
      "Saludos cordiales,",
      "Grupo Denny R. Perez EIRL"
    ];
    const body = encodeURIComponent(bodyLines.join('\n'));

    const mailtoLink = `mailto:${recipientEmail}?cc=${senderEmailForCC}&subject=${subject}&body=${body}`;
    
    try {
        window.location.href = mailtoLink;
        alert("Se está abriendo tu cliente de correo electrónico.\n\nIMPORTANTE:\n1. Asegúrate de ADJUNTAR el archivo PDF del volante de pago.\n2. Revisa y envía el correo.");
    } catch (e) {
        console.error("Error opening mailto link:", e);
        alert("No se pudo abrir tu cliente de correo automáticamente.");
    }
  };


  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-4xl font-bold text-gray-800">Nóminas Quincenales</h1>
        <button
          onClick={() => openRunModal()}
          className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 transition-colors shadow-md hover:shadow-lg flex items-center"
        >
          <IconPayroll className="w-5 h-5 mr-2" /> Iniciar Nueva Nómina Quincenal
        </button>
      </div>

      <div className="bg-white shadow-xl rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Período de Pago', 'Estado', 'Empleados', 'Monto Total Neto (DOP)', 'Fecha Proc.', 'Acciones'].map(header => (
                  <th key={header} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {payrollRuns.map((run) => (
                <tr key={run.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{run.payPeriod}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      run.status === PayrollRunStatus.COMPLETED ? 'bg-green-100 text-green-800' : 
                      run.status === PayrollRunStatus.PENDING ? 'bg-yellow-100 text-yellow-800' : 
                      'bg-red-100 text-red-800'
                    }`}>
                      {run.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">{run.employeesProcessed}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">DOP {run.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits:2})}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{run.processingDate ? new Date(run.processingDate).toLocaleDateString() : 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-4">
                     {run.payslipsGenerated.length > 0 && (
                      <button onClick={() => openPayslipsListModal(run)} className="text-indigo-600 hover:text-indigo-900 transition-colors">
                        Ver Volante(s)
                      </button>
                    )}
                    <button onClick={() => openRunModal(run)} className="text-blue-600 hover:text-blue-900 transition-colors">
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {payrollRuns.length === 0 && <p className="p-4 text-center text-gray-500">No se encontraron corridas de nómina.</p>}
        </div>
      </div>

      <Modal isOpen={isRunModalOpen} onClose={closeRunModal} title={editingRun ? 'Editar Corrida de Nómina' : 'Iniciar Nueva Corrida de Nómina'} size="xl">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Período de Pago (Quincena)</label>
            <div className="mt-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                  <label htmlFor="payPeriodYear" className="block text-xs font-medium text-gray-600">Año</label>
                  <select
                      id="payPeriodYear"
                      name="payPeriodYear"
                      value={runModalYear}
                      onChange={(e) => setRunModalYear(parseInt(e.target.value, 10))}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      disabled={!!editingRun}
                  >
                      {yearOptions.map(year => <option key={year} value={year}>{year}</option>)}
                  </select>
              </div>
              <div>
                  <label htmlFor="payPeriodMonth" className="block text-xs font-medium text-gray-600">Mes</label>
                  <select
                      id="payPeriodMonth"
                      name="payPeriodMonth"
                      value={runModalMonth}
                      onChange={(e) => setRunModalMonth(parseInt(e.target.value, 10))}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      disabled={!!editingRun}
                  >
                      {spanishMonthNames.map((month, index) => <option key={index} value={index}>{month}</option>)}
                  </select>
              </div>
              <div>
                  <label htmlFor="payPeriodFortnight" className="block text-xs font-medium text-gray-600">Quincena</label>
                  <select
                      id="payPeriodFortnight"
                      name="payPeriodFortnight"
                      value={runModalFortnight}
                      onChange={(e) => setRunModalFortnight(e.target.value as '1st Fortnight' | '2nd Fortnight')}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      disabled={!!editingRun}
                  >
                      <option value="1st Fortnight">1ra Quincena</option>
                      <option value="2nd Fortnight">2da Quincena</option>
                  </select>
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Seleccionar Empleados e Ingresar Opciones:</h4>
            <div className="max-h-80 overflow-y-auto border border-gray-300 rounded-md p-2 space-y-1 bg-gray-50">
              {employees.map(emp => (
                <div key={emp.id} className="p-3 hover:bg-gray-100 rounded-md border-b border-gray-200 last:border-b-0">
                    <div className="flex items-center space-x-3 mb-1.5">
                        <input
                            type="checkbox"
                            id={`select-emp-${emp.id}`}
                            checked={selectedEmployeesForRun.includes(emp.id)}
                            onChange={() => handleEmployeeSelection(emp.id)}
                            className="form-checkbox h-5 w-5 text-indigo-600 border-gray-400 rounded focus:ring-indigo-500 cursor-pointer"
                        />
                        <label htmlFor={`select-emp-${emp.id}`} className="text-sm text-gray-800 font-medium flex-grow cursor-pointer">{emp.name} <span className="text-xs text-gray-500">({emp.role})</span></label>
                    </div>
                    {selectedEmployeesForRun.includes(emp.id) && (
                        <div className="pl-8 space-y-2">
                            <div className="flex items-center space-x-2">
                                <IconClock className="w-4 h-4 text-gray-500"/>
                                <label htmlFor={`overtime-${emp.id}`} className="text-xs text-gray-600 whitespace-nowrap">Horas Extras:</label>
                                <input 
                                    type="number"
                                    id={`overtime-${emp.id}`}
                                    value={overtimeHoursMap[emp.id] || ''}
                                    onChange={(e) => handleOvertimeHoursChange(emp.id, e.target.value)}
                                    placeholder="0"
                                    min="0"
                                    step="0.5"
                                    className="w-20 px-2 py-1 border border-gray-300 rounded-md shadow-sm text-xs focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>
                            <div className="flex items-center space-x-2">
                                <IconShieldCheck className="w-4 h-4 text-green-500"/>
                                <label htmlFor={`applyTss-${emp.id}`} className="text-xs text-gray-600 whitespace-nowrap cursor-pointer">¿Aplicar deducciones de TSS?</label>
                                 <input
                                    type="checkbox"
                                    id={`applyTss-${emp.id}`}
                                    checked={!!applyTssDeductionsMap[emp.id]}
                                    onChange={(e) => handleApplyTssChange(emp.id, e.target.checked)}
                                    className="form-checkbox h-4 w-4 text-green-600 border-gray-400 rounded focus:ring-green-500 cursor-pointer"
                                />
                            </div>
                        </div>
                    )}
                </div>
              ))}
               {employees.length === 0 && <p className="p-2 text-center text-sm text-gray-500">No hay empleados para seleccionar.</p>}
            </div>
          </div>
          <div className="flex justify-end space-x-3 pt-2">
            <button type="button" onClick={closeRunModal} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200" disabled={processingPayroll}>Cancelar</button>
            <button 
              type="button" 
              onClick={handleProcessPayroll} 
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors disabled:bg-green-300 flex items-center"
              disabled={processingPayroll || selectedEmployeesForRun.length === 0}
            >
              {processingPayroll ? <LoadingSpinner size="sm" className="mr-2" /> : <IconPayroll className="w-4 h-4 mr-2" />}
              {processingPayroll ? 'Procesando...' : (editingRun ? 'Actualizar Nómina' : 'Procesar Nómina')}
            </button>
          </div>
        </div>
      </Modal>

      {currentPayslip && (
        <Modal isOpen={isPayslipModalOpen} onClose={closePayslipModal} title={`Volante de Pago: ${currentPayslip.employeeName} - ${currentPayslip.payPeriod}`} size="lg">
          <div className="space-y-4">
            <div className="p-4 border border-gray-200 rounded-md bg-slate-50 shadow">
                <h3 className="text-lg font-semibold text-gray-800">{currentPayslip.employeeName}</h3>
                 <p className="text-sm text-gray-500">Cédula: {currentPayslip.employeeCedula || 'N/A'}</p>
                <p className="text-sm text-gray-500">Período de Pago: {currentPayslip.payPeriod}</p>
                <p className="text-sm text-gray-500">Generado: {new Date(currentPayslip.generatedDate).toLocaleDateString()}</p>
            </div>
            
            <div className="text-sm mt-3">
                <h4 className="font-semibold text-gray-700 mb-1">Detalle de Ingresos (Quincena):</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <div><span className="text-gray-600">Salario Base Quincenal:</span></div><div className="text-right font-medium text-gray-800">DOP {currentPayslip.baseSalary.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits:2})}</div>
                    {currentPayslip.overtimeHours > 0 && (
                        <>
                        <div><span className="text-gray-600">Horas Extras ({currentPayslip.overtimeHours} hrs):</span></div><div className="text-right font-medium text-gray-800">DOP {currentPayslip.overtimePay.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits:2})}</div>
                        </>
                    )}
                    <hr className="col-span-2 my-1 border-gray-300"/>
                    <div><strong className="text-gray-600">Total Ingresos Quincenales:</strong></div><div className="text-right font-semibold text-gray-800">DOP {currentPayslip.totalEarnings.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits:2})}</div>
                </div>
            </div>

            {currentPayslip.deductions && currentPayslip.deductions.length > 0 && (
                <div className="text-sm mt-3">
                    <h4 className="font-semibold text-gray-700 mb-1">Detalle de Deducciones Aplicadas:</h4>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {currentPayslip.deductions.map(deduction => (
                        <React.Fragment key={deduction.name}>
                            <div><span className="text-gray-600 ml-2">- {deduction.name}:</span></div><div className="text-right text-red-600">(DOP {deduction.amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits:2})})</div>
                        </React.Fragment>
                    ))}
                    </div>
                </div>
            )}
            
            <hr className="my-3 border-gray-400"/>
            <div className="grid grid-cols-2 gap-x-4 text-sm">
                <div><strong className="text-gray-700 text-base">Salario Neto a Recibir (Quincena):</strong></div><div className="text-right font-bold text-green-600 text-lg">DOP {currentPayslip.netSalary.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits:2})}</div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <button
                    onClick={() => handleExplainPayslip(currentPayslip)}
                    disabled={isExplaining}
                    className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors disabled:bg-blue-300 flex items-center justify-center text-sm"
                >
                    {isExplaining ? <LoadingSpinner size="sm" className="mr-2" /> : <IconSparkles className="w-5 h-5 mr-2" />}
                    {isExplaining ? 'Generando Explicación...' : 'Explicar con IA'}
                </button>
                <button
                    onClick={() => handlePrintPayslip(currentPayslip)}
                    className="flex-1 bg-teal-500 text-white px-4 py-2 rounded-md hover:bg-teal-600 transition-colors flex items-center justify-center text-sm"
                >
                    <IconPrint className="w-5 h-5 mr-2" />
                    Imprimir en PDF
                </button>
                 <button
                    onClick={() => handlePrepareEmailPayslip(currentPayslip)}
                    className="flex-1 bg-purple-500 text-white px-4 py-2 rounded-md hover:bg-purple-600 transition-colors flex items-center justify-center text-sm"
                    title="Prepara un correo en tu cliente de email"
                >
                    <IconMail className="w-5 h-5 mr-2" />
                    Preparar Email para Enviar
                </button>
            </div>


            {payslipExplanation && (
                <div className="mt-4 p-4 border border-blue-200 bg-blue-50 rounded-md shadow">
                    <h4 className="text-md font-semibold text-blue-700 mb-2">Explicación IA:</h4>
                    <p className="text-sm text-blue-600 whitespace-pre-wrap">{payslipExplanation}</p>
                </div>
            )}
            
            <div className="flex justify-end pt-3 mt-2">
              <button type="button" onClick={closePayslipModal} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">Cerrar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};