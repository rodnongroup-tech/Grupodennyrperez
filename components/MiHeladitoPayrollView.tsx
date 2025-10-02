import React, { useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import { MiHeladitoWorker, MiHeladitoWorkerType, MiHeladitoPayrollRun, MiHeladitoPayslip, PayrollRunStatus } from '../types';
import { IconCash, IconUsers, IconPencil, IconPrint, IconCalendar, IconCheckCircle } from '../constants';
import { Modal } from './common/Modal';
import { LoadingSpinner } from './common/LoadingSpinner';

interface MiHeladitoPayrollViewProps {
  workers: MiHeladitoWorker[];
  addWorker: (worker: Omit<MiHeladitoWorker, 'id'>) => void;
  updateWorker: (worker: MiHeladitoWorker) => void;
  payrollRuns: MiHeladitoPayrollRun[];
  addPayrollRun: (run: MiHeladitoPayrollRun) => void;
}

const initialWorkerFormState: Omit<MiHeladitoWorker, 'id'> = {
  name: '',
  workerType: MiHeladitoWorkerType.PART_TIME,
  baseAmount: 0,
};

const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const currentYearStatic = new Date().getFullYear();
const availableYears = Array.from({ length: 5 }, (_, i) => currentYearStatic - i);

export const MiHeladitoPayrollView: React.FC<MiHeladitoPayrollViewProps> = ({
  workers,
  addWorker,
  updateWorker,
  payrollRuns,
  addPayrollRun,
}) => {
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);
  const [isWorkerModalOpen, setIsWorkerModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const [editingWorker, setEditingWorker] = useState<MiHeladitoWorker | null>(null);
  const [workerFormData, setWorkerFormData] = useState<Omit<MiHeladitoWorker, 'id'> | MiHeladitoWorker>(initialWorkerFormState);
  
  const [viewingRun, setViewingRun] = useState<MiHeladitoPayrollRun | null>(null);
  const [processing, setProcessing] = useState(false);
  
  // State for new payroll run
  const [runMonth, setRunMonth] = useState(new Date().getMonth());
  const [runYear, setRunYear] = useState(new Date().getFullYear());
  const [payrollInputs, setPayrollInputs] = useState<Record<string, { included: boolean; daysWorked?: number }>>({});

  const openWorkerModal = (worker: MiHeladitoWorker | null = null) => {
    if (worker) {
      setEditingWorker(worker);
      setWorkerFormData(worker);
    } else {
      setEditingWorker(null);
      setWorkerFormData(initialWorkerFormState);
    }
    setIsWorkerModalOpen(true);
  };

  const closeWorkerModal = () => {
    setIsWorkerModalOpen(false);
    setEditingWorker(null);
  };

  const handleWorkerFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setWorkerFormData(prev => ({
        ...prev,
        [name]: name === 'baseAmount' ? parseFloat(value) || 0 : value,
    }));
  };

  const handleWorkerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingWorker) {
      updateWorker(workerFormData as MiHeladitoWorker);
    } else {
      addWorker(workerFormData as Omit<MiHeladitoWorker, 'id'>);
    }
    closeWorkerModal();
  };

  const openRunModal = () => {
    const initialInputs: Record<string, { included: boolean; daysWorked?: number }> = {};
    workers.forEach(w => {
      initialInputs[w.id] = { included: false, daysWorked: w.workerType === MiHeladitoWorkerType.PART_TIME ? 30 : undefined };
    });
    setPayrollInputs(initialInputs);
    setIsRunModalOpen(true);
  };
  
  const closeRunModal = () => {
    setIsRunModalOpen(false);
  };
  
  const handlePayrollInputChange = (workerId: string, field: 'included' | 'daysWorked', value: boolean | number) => {
    setPayrollInputs(prev => ({
        ...prev,
        [workerId]: {
            ...prev[workerId],
            [field]: value,
        }
    }));
  };

  const calculatePayment = (worker: MiHeladitoWorker, inputs: { included: boolean; daysWorked?: number }): number => {
    if (!inputs.included) return 0;
    if (worker.workerType === MiHeladitoWorkerType.CONTRACTOR) {
        return worker.baseAmount;
    }
    if (worker.workerType === MiHeladitoWorkerType.PART_TIME) {
        const days = inputs.daysWorked || 0;
        // Using 30 as a standard month length for simplicity as requested
        return (worker.baseAmount / 30) * days;
    }
    return 0;
  };

  const totalPayrollAmount = useMemo(() => {
    return workers.reduce((total, worker) => {
        const inputs = payrollInputs[worker.id];
        if (inputs) {
            return total + calculatePayment(worker, inputs);
        }
        return total;
    }, 0);
  }, [workers, payrollInputs]);

  const handleProcessPayroll = async () => {
    setProcessing(true);
    const payPeriod = `${monthNames[runMonth]} ${runYear}`;
    const runId = `mh-pr-${Date.now()}`;
    const payslips: MiHeladitoPayslip[] = [];
    
    workers.forEach(worker => {
      const inputs = payrollInputs[worker.id];
      if (inputs && inputs.included) {
        const payment = calculatePayment(worker, inputs);
        payslips.push({
          id: `mh-ps-${worker.id}-${runId}`,
          payrollRunId: runId,
          workerId: worker.id,
          workerName: worker.name,
          workerType: worker.workerType,
          payPeriod: payPeriod,
          daysWorked: inputs.daysWorked,
          baseMonthlySalary: worker.workerType === MiHeladitoWorkerType.PART_TIME ? worker.baseAmount : undefined,
          netPayment: parseFloat(payment.toFixed(2)),
        });
      }
    });

    const newRun: MiHeladitoPayrollRun = {
      id: runId,
      payPeriod: payPeriod,
      status: PayrollRunStatus.COMPLETED,
      totalAmountPaid: parseFloat(totalPayrollAmount.toFixed(2)),
      payslips: payslips,
      processingDate: new Date().toISOString(),
    };
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 500));
    addPayrollRun(newRun);
    
    setProcessing(false);
    closeRunModal();
  };
  
  const openDetailsModal = (run: MiHeladitoPayrollRun) => {
    setViewingRun(run);
    setIsDetailsModalOpen(true);
  };
  
  const closeDetailsModal = () => {
    setIsDetailsModalOpen(false);
    setViewingRun(null);
  };
  
  const generateRunPDF = (run: MiHeladitoPayrollRun | null) => {
    if (!run) return;
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let yPos = 20;

    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text(`Comprobante de Nómina - Mi Heladito`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;
    doc.setFontSize(14);
    doc.setFont(undefined, 'normal');
    doc.text(`Período: ${run.payPeriod}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 12;

    doc.setFontSize(10);
    doc.text(`Fecha de Emisión: ${new Date(run.processingDate).toLocaleDateString()}`, margin, yPos);
    yPos += 10;
    
    const tableHeaders = ["Nombre", "Tipo", "Detalle (Días Trab.)", "Monto Pagado (DOP)"];
    const colWidths = [80, 40, 30, 35]; 
    let xPos = margin;

    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    tableHeaders.forEach((header, i) => { doc.text(header, xPos, yPos); xPos += colWidths[i]; });
    yPos += 2;
    doc.setLineWidth(0.3);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 6;

    doc.setFont(undefined, 'normal');
    run.payslips.forEach(slip => {
        xPos = margin;
        doc.text(slip.workerName, xPos, yPos, {maxWidth: colWidths[0]-2}); xPos += colWidths[0];
        doc.text(slip.workerType, xPos, yPos, {maxWidth: colWidths[1]-2}); xPos += colWidths[1];
        doc.text(slip.daysWorked?.toString() || 'N/A', xPos + colWidths[2]/2, yPos, {align: 'center'}); xPos += colWidths[2];
        doc.text(slip.netPayment.toLocaleString('es-DO', {minimumFractionDigits:2}), xPos + colWidths[3]-2, yPos, {align: 'right'});
        yPos += 8;
    });

    doc.setLineWidth(0.3);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;

    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text("TOTAL PAGADO:", pageWidth - margin - 40, yPos, { align: 'right' });
    doc.text(`DOP ${run.totalAmountPaid.toLocaleString('es-DO', {minimumFractionDigits:2})}`, pageWidth - margin, yPos, { align: 'right' });
    
    doc.save(`Nomina_MiHeladito_${run.payPeriod.replace(/\s/g, '_')}.pdf`);
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h1 className="text-4xl font-bold text-gray-800 flex items-center">
          <IconCash className="w-10 h-10 mr-3 text-pink-500" />
          Nómina - Mi Heladito
        </h1>
        <button onClick={openRunModal} className="bg-pink-500 text-white px-6 py-3 rounded-lg hover:bg-pink-600 shadow-md flex items-center">
          <IconCalendar className="w-5 h-5 mr-2" /> Iniciar Nueva Nómina
        </button>
      </div>
      
      {/* Worker Management */}
      <div className="p-6 bg-white shadow-xl rounded-lg border border-gray-200">
        <div className="flex justify-between items-center mb-3">
            <h2 className="text-xl font-semibold text-gray-800">Personal de Mi Heladito</h2>
            <button onClick={() => openWorkerModal()} className="text-sm bg-blue-500 text-white px-4 py-1.5 rounded-md hover:bg-blue-600">Agregar Personal</button>
        </div>
        <div className="space-y-2">
            {workers.map(worker => (
                <div key={worker.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-md border">
                    <div>
                        <p className="font-semibold text-gray-700">{worker.name}</p>
                        <p className="text-xs text-gray-500">{worker.workerType} - DOP {worker.baseAmount.toFixed(2)} {worker.workerType === MiHeladitoWorkerType.PART_TIME ? '/ mes' : 'pago fijo'}</p>
                    </div>
                    <button onClick={() => openWorkerModal(worker)} className="text-blue-600 hover:text-blue-800 p-1"><IconPencil className="w-5 h-5"/></button>
                </div>
            ))}
             {workers.length === 0 && <p className="text-center text-gray-500 text-sm py-3">No hay personal registrado.</p>}
        </div>
      </div>
      
      {/* Payroll Runs History */}
      <div className="bg-white shadow-xl rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Período', 'Monto Total Pagado', 'Personal Incluido', 'Fecha de Pago', 'Acciones'].map(h => <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>)}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {payrollRuns.map(run => (
                <tr key={run.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{run.payPeriod}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-semibold">DOP {run.totalAmountPaid.toLocaleString('es-DO', {minimumFractionDigits: 2})}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{run.payslips.length}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(run.processingDate).toLocaleDateString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button onClick={() => openDetailsModal(run)} className="text-indigo-600 hover:text-indigo-900">Ver Detalles</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {payrollRuns.length === 0 && <p className="text-center text-gray-500 p-4">No hay nóminas registradas.</p>}
        </div>
      </div>
      
      <Modal isOpen={isWorkerModalOpen} onClose={closeWorkerModal} title={editingWorker ? "Editar Personal" : "Agregar Personal"}>
        <form onSubmit={handleWorkerSubmit} className="space-y-4">
          <div><label htmlFor="w-name" className="block text-sm font-medium text-gray-700">Nombre</label><input type="text" name="name" id="w-name" value={workerFormData.name} onChange={handleWorkerFormChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"/></div>
          <div><label htmlFor="w-type" className="block text-sm font-medium text-gray-700">Tipo</label><select name="workerType" id="w-type" value={workerFormData.workerType} onChange={handleWorkerFormChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm">{Object.values(MiHeladitoWorkerType).map(t => <option key={t} value={t}>{t}</option>)}</select></div>
          <div><label htmlFor="w-amount" className="block text-sm font-medium text-gray-700">{workerFormData.workerType === MiHeladitoWorkerType.PART_TIME ? 'Salario Mensual (DOP)' : 'Monto Fijo (DOP)'}</label><input type="number" name="baseAmount" id="w-amount" value={workerFormData.baseAmount} onChange={handleWorkerFormChange} required min="0" step="100" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"/></div>
          <div className="flex justify-end space-x-3 pt-2">
            <button type="button" onClick={closeWorkerModal} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">Cancelar</button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">{editingWorker ? "Guardar Cambios" : "Agregar"}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isRunModalOpen} onClose={closeRunModal} title="Procesar Nueva Nómina - Mi Heladito" size="xl">
        <div className="space-y-4">
            <div className="flex items-center space-x-3 bg-gray-100 p-3 rounded-md">
                <label className="text-sm font-medium text-gray-700">Período de Pago:</label>
                <select value={runMonth} onChange={e => setRunMonth(parseInt(e.target.value))} className="px-2 py-1 border border-gray-300 rounded-md text-sm">{monthNames.map((n, i) => <option key={i} value={i}>{n}</option>)}</select>
                <select value={runYear} onChange={e => setRunYear(parseInt(e.target.value))} className="px-2 py-1 border border-gray-300 rounded-md text-sm">{availableYears.map(y => <option key={y} value={y}>{y}</option>)}</select>
            </div>
            <div className="space-y-3 max-h-80 overflow-y-auto p-2 border rounded-md">
                {workers.map(worker => (
                    <div key={worker.id} className="p-3 border rounded-lg bg-white shadow-sm">
                        <div className="flex items-start space-x-3">
                            <input type="checkbox" id={`inc-${worker.id}`} checked={payrollInputs[worker.id]?.included} onChange={e => handlePayrollInputChange(worker.id, 'included', e.target.checked)} className="h-5 w-5 mt-1 text-pink-600 border-gray-300 rounded focus:ring-pink-500"/>
                            <div className="flex-grow">
                                <label htmlFor={`inc-${worker.id}`} className="font-semibold text-gray-800 cursor-pointer">{worker.name}</label>
                                <p className="text-xs text-gray-500">{worker.workerType}</p>
                                {worker.workerType === MiHeladitoWorkerType.PART_TIME && payrollInputs[worker.id]?.included && (
                                    <div className="flex items-center space-x-2 mt-2">
                                        <label htmlFor={`days-${worker.id}`} className="text-sm text-gray-600">Días Trabajados:</label>
                                        <input type="number" id={`days-${worker.id}`} value={payrollInputs[worker.id]?.daysWorked || ''} onChange={e => handlePayrollInputChange(worker.id, 'daysWorked', parseInt(e.target.value) || 0)} className="w-20 px-2 py-1 border-gray-300 rounded-md shadow-sm text-sm"/>
                                    </div>
                                )}
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-semibold text-gray-700">DOP {calculatePayment(worker, payrollInputs[worker.id] || {included: false}).toFixed(2)}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <div className="text-right font-bold text-lg p-3 bg-gray-100 rounded-md">Total a Pagar: <span className="text-green-600">DOP {totalPayrollAmount.toFixed(2)}</span></div>
            <div className="flex justify-end space-x-3 pt-2">
                <button type="button" onClick={closeRunModal} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200" disabled={processing}>Cancelar</button>
                <button type="button" onClick={handleProcessPayroll} className="px-6 py-2 text-sm font-medium text-white bg-pink-600 rounded-md hover:bg-pink-700 flex items-center" disabled={processing || totalPayrollAmount <= 0}>
                    {processing ? <LoadingSpinner size="sm" className="mr-2"/> : <IconCheckCircle className="w-5 h-5 mr-2"/>}
                    {processing ? 'Procesando...' : 'Procesar Nómina'}
                </button>
            </div>
        </div>
      </Modal>

      <Modal isOpen={isDetailsModalOpen} onClose={closeDetailsModal} title={`Detalles de Nómina - ${viewingRun?.payPeriod}`} size="lg">
        {viewingRun && (
            <div className="space-y-4">
                <div className="p-4 border rounded-md bg-gray-50">
                    {viewingRun.payslips.map(slip => (
                        <div key={slip.id} className="flex justify-between items-center py-2 border-b last:border-b-0">
                            <div>
                                <p className="font-semibold">{slip.workerName}</p>
                                <p className="text-xs text-gray-500">{slip.workerType}{slip.workerType === MiHeladitoWorkerType.PART_TIME && ` (${slip.daysWorked || 0} días)`}</p>
                            </div>
                            <p className="font-semibold text-green-600">DOP {slip.netPayment.toFixed(2)}</p>
                        </div>
                    ))}
                </div>
                <div className="text-right font-bold text-lg p-3 bg-gray-100 rounded-md">Total Pagado: <span className="text-green-600">DOP {viewingRun.totalAmountPaid.toFixed(2)}</span></div>
                <div className="flex justify-end space-x-3 pt-2">
                    <button type="button" onClick={() => generateRunPDF(viewingRun)} className="px-4 py-2 text-sm font-medium text-white bg-teal-500 rounded-md hover:bg-teal-600 flex items-center"><IconPrint className="w-4 h-4 mr-2"/>Imprimir</button>
                    <button type="button" onClick={closeDetailsModal} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">Cerrar</button>
                </div>
            </div>
        )}
      </Modal>
    </div>
  );
};
