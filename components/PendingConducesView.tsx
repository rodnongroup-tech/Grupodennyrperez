

import React, { useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import { Debtor, Receivable } from '../types';
import { IconClipboardList, IconUsers, IconPrint, IconTrash, IconCash } from '../constants';
import { Modal } from './common/Modal';

interface ReceivablesViewProps {
  debtors: Debtor[];
  addDebtor: (debtor: Omit<Debtor, 'id'>) => Promise<Debtor>;
  receivables: Receivable[];
  addReceivable: (receivable: Omit<Receivable, 'id' | 'isPaid'>) => void;
  updateReceivable: (receivable: Receivable) => void;
  deleteReceivable: (receivableId: string) => void;
}

export const ReceivablesView: React.FC<ReceivablesViewProps> = ({ 
    debtors, addDebtor, receivables, addReceivable, updateReceivable, deleteReceivable 
}) => {
  const [selectedDebtorId, setSelectedDebtorId] = useState<string | null>(null);
  const [isDebtorModalOpen, setIsDebtorModalOpen] = useState(false);
  const [newDebtorName, setNewDebtorName] = useState('');
  
  const [newReceivableDate, setNewReceivableDate] = useState(new Date().toISOString().split('T')[0]);
  const [newReceivableAmount, setNewReceivableAmount] = useState<number | ''>('');
  const [showPaid, setShowPaid] = useState(false);

  const debtorTotals = useMemo(() => {
    const totals: Record<string, { pending: number, count: number }> = {};
    debtors.forEach(d => {
        totals[d.id] = { pending: 0, count: 0 };
    });
    receivables.forEach(r => {
        if (!r.isPaid && totals[r.debtorId]) {
            totals[r.debtorId].pending += r.amount;
            totals[r.debtorId].count += 1;
        }
    });
    return totals;
  }, [debtors, receivables]);

  const selectedDebtor = useMemo(() => {
    return debtors.find(d => d.id === selectedDebtorId) || null;
  }, [selectedDebtorId, debtors]);

  const receivablesForSelectedDebtor = useMemo(() => {
    if (!selectedDebtorId) return [];
    return receivables
      .filter(r => r.debtorId === selectedDebtorId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedDebtorId, receivables]);

  const unpaidReceivables = useMemo(() => {
    return receivablesForSelectedDebtor.filter(r => !r.isPaid);
  }, [receivablesForSelectedDebtor]);

  const filteredReceivables = showPaid ? receivablesForSelectedDebtor : unpaidReceivables;

  const handleAddDebtor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newDebtorName.trim()) {
      const newDebtor = await addDebtor({ name: newDebtorName });
      setSelectedDebtorId(newDebtor.id);
      setNewDebtorName('');
      setIsDebtorModalOpen(false);
    }
  };

  const handleAddReceivable = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedDebtorId && typeof newReceivableAmount === 'number' && newReceivableAmount > 0) {
      addReceivable({
        debtorId: selectedDebtorId,
        date: newReceivableDate,
        amount: newReceivableAmount,
      });
      setNewReceivableAmount('');
      setNewReceivableDate(new Date().toISOString().split('T')[0]);
    } else {
        alert("Por favor ingrese un monto válido.");
    }
  };

  const handleTogglePaidStatus = (receivable: Receivable) => {
    updateReceivable({ ...receivable, isPaid: !receivable.isPaid });
  };
  
  const handleDelete = (receivableId: string) => {
    if(window.confirm("¿Está seguro de que desea eliminar este cobro? Esta acción no se puede deshacer.")) {
        deleteReceivable(receivableId);
    }
  }

  const handleGeneratePdf = () => {
    if (!selectedDebtor) return;
    if (unpaidReceivables.length === 0) {
        alert("No hay cobros pendientes para generar un volante.");
        return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let yPos = 25;

    // Title
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(`Volante de Conduces: ${selectedDebtor.name.toUpperCase()}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;
    
    // Sub-title (Generated date)
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const generatedDate = `Generado el: ${new Date().toLocaleDateString('es-DO', { day: '2-digit', month: 'long', year: 'numeric' })}`;
    doc.text(generatedDate, pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;

    // Table Header
    const tableHeaderY = yPos;
    const tableHeaderColor = '#0d9488'; // teal-600
    doc.setFillColor(tableHeaderColor);
    doc.rect(margin, tableHeaderY, pageWidth - margin * 2, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text("Fecha", margin + 5, tableHeaderY + 7);
    doc.text("Monto", pageWidth - margin - 5, tableHeaderY + 7, { align: 'right' });
    yPos += 10;
    
    // Table Rows
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    unpaidReceivables.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).forEach((item, index) => {
        doc.setFillColor(index % 2 === 0 ? 255 : 247, 247, 247); // alternate row color
        doc.rect(margin, yPos, pageWidth - margin * 2, 10, 'F');
        doc.text(new Date(item.date).toLocaleDateString('es-DO'), margin + 5, yPos + 7);
        doc.text(`$${item.amount.toLocaleString('es-DO', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, pageWidth - margin - 5, yPos + 7, { align: 'right' });
        yPos += 10;
    });

    // Subtotal
    const subtotal = unpaidReceivables.reduce((sum, item) => sum + item.amount, 0);
    yPos += 5;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text("Subtotal:", pageWidth - margin - 50, yPos, { align: 'right' });
    doc.text(`$${subtotal.toLocaleString('es-DO', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, pageWidth - margin - 5, yPos, { align: 'right' });

    doc.save(`Volante_Conduces_${selectedDebtor.name.replace(/\s/g, '_')}.pdf`);
  };


  return (
    <div className="flex flex-col lg:flex-row h-full gap-6">
      {/* Left Panel: Debtors List */}
      <div className="w-full lg:w-1/3 bg-white p-6 rounded-xl shadow-lg border flex flex-col">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-slate-800">Deudores</h2>
            <button onClick={() => setIsDebtorModalOpen(true)} className="bg-blue-500 text-white px-3 py-1.5 rounded-lg hover:bg-blue-600 shadow text-sm font-semibold">Agregar Deudor</button>
        </div>
        <div className="flex-grow overflow-y-auto -mr-3 pr-3 space-y-2">
            {debtors.map(debtor => (
                <div key={debtor.id} onClick={() => setSelectedDebtorId(debtor.id)}
                    className={`p-4 rounded-lg cursor-pointer transition-all border-l-4 ${selectedDebtorId === debtor.id ? 'bg-indigo-100 border-indigo-500 shadow-md' : 'bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-400'}`}>
                    <p className="font-semibold text-slate-800">{debtor.name}</p>
                    <p className="text-sm text-red-600 font-medium">
                        Pendiente: DOP {debtorTotals[debtor.id]?.pending.toLocaleString('es-DO', {minimumFractionDigits: 2}) || '0.00'}
                        <span className="text-xs text-slate-500 ml-2">({debtorTotals[debtor.id]?.count || 0} items)</span>
                    </p>
                </div>
            ))}
            {debtors.length === 0 && <p className="text-center text-slate-500 py-4">No hay deudores registrados.</p>}
        </div>
      </div>
      
      {/* Right Panel: Details View */}
      <div className="w-full lg:w-2/3 bg-white p-6 rounded-xl shadow-lg border flex flex-col">
        {selectedDebtor ? (
            <>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 pb-4 border-b gap-3">
                    <h2 className="text-2xl font-bold text-slate-800">{selectedDebtor.name}</h2>
                    <button onClick={handleGeneratePdf} disabled={!unpaidReceivables.length} className="bg-teal-500 text-white px-4 py-2 rounded-lg hover:bg-teal-600 shadow disabled:bg-slate-300 flex items-center gap-2">
                        <IconPrint className="w-5 h-5"/> Generar Volante PDF
                    </button>
                </div>

                <form onSubmit={handleAddReceivable} className="p-4 mb-4 bg-slate-50 border rounded-lg flex flex-col sm:flex-row items-end gap-4">
                    <div className="flex-grow w-full">
                        <label htmlFor="rec-date" className="text-sm font-medium text-slate-700">Fecha</label>
                        <input type="date" id="rec-date" value={newReceivableDate} onChange={e => setNewReceivableDate(e.target.value)} required className="w-full mt-1 p-2 border border-slate-300 rounded-md shadow-sm"/>
                    </div>
                    <div className="w-full sm:w-auto">
                        <label htmlFor="rec-amount" className="text-sm font-medium text-slate-700">Monto (DOP)</label>
                        <input type="number" id="rec-amount" value={newReceivableAmount} onChange={e => setNewReceivableAmount(e.target.value === '' ? '' : parseFloat(e.target.value))} required min="0.01" step="0.01" placeholder="0.00" className="w-full mt-1 p-2 border border-slate-300 rounded-md shadow-sm"/>
                    </div>
                    <button type="submit" className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 shadow h-[42px] w-full sm:w-auto">Agregar Cobro</button>
                </form>

                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-semibold text-slate-700">Historial de Cobros</h3>
                    <div className="flex items-center gap-2">
                        <label htmlFor="show-paid" className="text-sm text-slate-600">Mostrar pagados</label>
                        <input type="checkbox" id="show-paid" checked={showPaid} onChange={e => setShowPaid(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"/>
                    </div>
                </div>

                <div className="flex-grow overflow-y-auto -mr-3 pr-3">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-100 sticky top-0"><tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Fecha</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Monto</th>
                                <th className="px-4 py-2 text-center text-xs font-medium text-slate-500 uppercase">Estado</th>
                                <th className="px-4 py-2 text-center text-xs font-medium text-slate-500 uppercase">Acciones</th>
                            </tr></thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {filteredReceivables.length > 0 ? filteredReceivables.map(item => (
                                    <tr key={item.id} className={item.isPaid ? 'bg-green-50' : ''}>
                                        <td className="px-4 py-3 text-sm text-slate-700">{new Date(item.date).toLocaleDateString('es-DO')}</td>
                                        <td className="px-4 py-3 text-sm text-right font-medium text-slate-800">DOP {item.amount.toLocaleString('es-DO', {minimumFractionDigits: 2})}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${item.isPaid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                {item.isPaid ? 'Pagado' : 'Pendiente'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center text-sm space-x-3">
                                            <button onClick={() => handleTogglePaidStatus(item)} className="text-blue-600 hover:text-blue-900" title={item.isPaid ? 'Marcar como Pendiente' : 'Marcar como Pagado'}>
                                                <IconCash className="w-5 h-5"/>
                                            </button>
                                            <button onClick={() => handleDelete(item.id)} className="text-red-500 hover:text-red-700" title="Eliminar">
                                                <IconTrash className="w-5 h-5"/>
                                            </button>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={4} className="text-center text-slate-500 py-6">No hay registros para mostrar.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </>
        ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-slate-500">
                <IconClipboardList className="w-20 h-20 mb-4 text-slate-300"/>
                <h3 className="text-xl font-semibold">Seleccione un deudor</h3>
                <p className="max-w-xs">Seleccione un deudor de la lista de la izquierda para ver sus cuentas por cobrar o agregue un nuevo deudor.</p>
            </div>
        )}
      </div>

      <Modal isOpen={isDebtorModalOpen} onClose={() => setIsDebtorModalOpen(false)} title="Agregar Nuevo Deudor">
        <form onSubmit={handleAddDebtor} className="space-y-4">
            <div>
                <label htmlFor="debtor-name" className="block text-sm font-medium text-slate-700">Nombre del Deudor</label>
                <input type="text" id="debtor-name" value={newDebtorName} onChange={e => setNewDebtorName(e.target.value)} required className="mt-1 w-full p-2 border border-slate-300 rounded-md shadow-sm" placeholder="Ej: JAMAO"/>
            </div>
            <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsDebtorModalOpen(false)} className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-200">Cancelar</button>
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Guardar Deudor</button>
            </div>
        </form>
      </Modal>
    </div>
  );
};
