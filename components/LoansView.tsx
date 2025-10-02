
import React, { useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import { Loan, LoanPayment } from '../types';
import { IconReceiptPercent, IconPrint, IconCash, IconCalendar, IconCheckCircle, IconPencil } from '../constants';
import { Modal } from './common/Modal';

interface LoansViewProps {
    loans: Loan[];
    loanPayments: LoanPayment[];
    addLoan: (loanData: Omit<Loan, 'id'>) => Promise<void>;
    updateLoan: (loan: Loan) => Promise<void>;
    addLoanPayment: (paymentData: Omit<LoanPayment, 'id'>) => Promise<LoanPayment>;
}

const initialLoanFormState: Omit<Loan, 'id'> = {
    name: '',
    lender: '',
    initialAmount: 0,
    monthlyPaymentAmount: 0,
    monthlyInterestAmount: 0,
    startDate: new Date().toISOString().split('T')[0],
};

export const LoansView: React.FC<LoansViewProps> = ({ loans, loanPayments, addLoan, updateLoan, addLoanPayment }) => {
    const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
    const [isPaymentsModalOpen, setIsPaymentsModalOpen] = useState(false);
    const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
    const [loanFormData, setLoanFormData] = useState<Omit<Loan, 'id'> | Loan>(initialLoanFormState);
    const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);

    const loansWithBalance = useMemo(() => {
        return loans.map(loan => {
            const paymentsForThisLoan = loanPayments.filter(p => p.loanId === loan.id);
            if (paymentsForThisLoan.length === 0) {
                return { ...loan, remainingBalance: loan.initialAmount, paymentsCount: 0 };
            }
            const lastPayment = paymentsForThisLoan.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())[0];
            const remainingBalance = lastPayment ? lastPayment.remainingBalance : loan.initialAmount;
            return { ...loan, remainingBalance, paymentsCount: paymentsForThisLoan.length };
        }).sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    }, [loans, loanPayments]);
    
    const openLoanModal = (loanToEdit: Loan | null = null) => {
        if (loanToEdit) {
            setEditingLoan(loanToEdit);
            setLoanFormData(loanToEdit);
        } else {
            setEditingLoan(null);
            setLoanFormData(initialLoanFormState);
        }
        setIsLoanModalOpen(true);
    };
    
    const closeLoanModal = () => setIsLoanModalOpen(false);

    const handleLoanFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setLoanFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? parseFloat(value) || 0 : value
        }));
    };
    
    const handleLoanSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (loanFormData.monthlyInterestAmount >= loanFormData.monthlyPaymentAmount) {
            alert("El interés fijo mensual no puede ser mayor o igual a la cuota mensual.");
            return;
        }
        if (loanFormData.initialAmount <= 0 || loanFormData.monthlyPaymentAmount <= 0) {
            alert("El monto inicial y la cuota mensual deben ser mayores a cero.");
            return;
        }
        if (editingLoan) {
            updateLoan(loanFormData as Loan);
        } else {
            addLoan(loanFormData as Omit<Loan, 'id'>);
        }
        closeLoanModal();
    };

    const openPaymentsModal = (loan: Loan) => {
        setSelectedLoan(loan);
        setIsPaymentsModalOpen(true);
    };

    const closePaymentsModal = () => {
        setSelectedLoan(null);
        setIsPaymentsModalOpen(false);
    };

    const generatePaymentReceipt = (loan: Loan, payment: LoanPayment) => {
        const doc = new jsPDF();
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text("Recibo de Pago de Préstamo", 105, 22, { align: 'center' });
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(`Préstamo: ${loan.name}`, 15, 40);
        doc.text(`Prestamista: ${loan.lender}`, 15, 48);
        doc.text(`Fecha de Pago: ${new Date(payment.paymentDate).toLocaleDateString('es-DO')}`, 15, 56);
        
        const startY = 75;
        doc.setFont('helvetica', 'bold');
        doc.text("Descripción", 15, startY);
        doc.text("Monto (DOP)", 195, startY, { align: 'right' });
        doc.setLineWidth(0.5);
        doc.line(15, startY + 2, 195, startY + 2);
        
        doc.setFont('helvetica', 'normal');
        let currentY = startY + 10;
        doc.text("Monto Recibido", 15, currentY);
        doc.text(`${payment.amountPaid.toFixed(2)}`, 195, currentY, { align: 'right' });
        
        currentY += 8;
        doc.text("(-) Interés Pagado", 15, currentY);
        doc.text(`${payment.interestPaid.toFixed(2)}`, 195, currentY, { align: 'right' });

        currentY += 8;
        doc.setFont('helvetica', 'bold');
        doc.text("(=) Abono a Capital", 15, currentY);
        doc.text(`${payment.principalPaid.toFixed(2)}`, 195, currentY, { align: 'right' });

        currentY += 8;
        doc.setLineWidth(0.5);
        doc.line(15, currentY, 195, currentY);
        currentY += 10;
        doc.setFontSize(14);
        doc.text("SALDO PENDIENTE:", 15, currentY);
        doc.text(`DOP ${payment.remainingBalance.toFixed(2)}`, 195, currentY, { align: 'right' });

        doc.save(`Recibo_Prestamo_${loan.name.replace(/\s/g, '_')}_${payment.paymentDate}.pdf`);
    };
    
    const handleRecordPayment = async (loan: Loan) => {
        const currentBalance = loansWithBalance.find(l => l.id === loan.id)?.remainingBalance ?? loan.initialAmount;
        if (currentBalance <= 0) {
            alert("Este préstamo ya ha sido saldado.");
            return;
        }

        const confirmPayment = window.confirm(`¿Confirma que desea registrar un pago de DOP ${loan.monthlyPaymentAmount.toFixed(2)} para el préstamo "${loan.name}"?\nSaldo actual: DOP ${currentBalance.toFixed(2)}`);
        if (!confirmPayment) return;
        
        try {
            const interestPaid = Math.min(currentBalance, loan.monthlyInterestAmount);
            const principalPaid = loan.monthlyPaymentAmount - interestPaid;
            const remainingBalance = currentBalance - principalPaid;

            const newPaymentData: Omit<LoanPayment, 'id'> = {
                loanId: loan.id,
                paymentDate: new Date().toISOString().split('T')[0],
                amountPaid: loan.monthlyPaymentAmount,
                interestPaid: interestPaid,
                principalPaid: principalPaid,
                remainingBalance: remainingBalance < 0 ? 0 : remainingBalance, // Cannot go below zero
            };

            const newPayment = await addLoanPayment(newPaymentData);
            alert('Pago registrado exitosamente. Se descargará un recibo en PDF.');
            generatePaymentReceipt(loan, newPayment);
        } catch (error) {
            console.error("Error registrando el pago:", error);
            alert("Ocurrió un error al registrar el pago. Por favor, intente de nuevo.");
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h1 className="text-4xl font-bold text-gray-800 flex items-center">
                    <IconReceiptPercent className="w-10 h-10 mr-3 text-teal-600" />
                    Gestión de Préstamos
                </h1>
                <button onClick={() => openLoanModal()} className="bg-teal-600 text-white px-6 py-3 rounded-lg hover:bg-teal-700 shadow-md flex items-center font-semibold">
                    Agregar Préstamo
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loansWithBalance.map(loan => {
                    const progress = loan.initialAmount > 0 ? ((loan.initialAmount - loan.remainingBalance) / loan.initialAmount) * 100 : 0;
                    return (
                        <div key={loan.id} className="bg-white p-5 rounded-xl shadow-lg border border-gray-200 flex flex-col">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-800">{loan.name}</h3>
                                    <p className="text-sm text-gray-500">{loan.lender}</p>
                                </div>
                                <button onClick={() => openLoanModal(loan)} className="text-blue-500 hover:text-blue-700"><IconPencil className="w-5 h-5"/></button>
                            </div>
                            <div className="my-4">
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="font-medium text-gray-600">Pagado</span>
                                    <span className="font-semibold text-teal-600">{progress.toFixed(1)}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2.5"><div className="bg-teal-500 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div></div>
                            </div>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-gray-600">Saldo Pendiente:</span><span className="font-semibold text-red-600">DOP {loan.remainingBalance.toLocaleString('es-DO', {minimumFractionDigits:2})}</span></div>
                                <div className="flex justify-between"><span className="text-gray-600">Monto Inicial:</span><span className="font-semibold text-gray-800">DOP {loan.initialAmount.toLocaleString('es-DO', {minimumFractionDigits:2})}</span></div>
                                <div className="flex justify-between"><span className="text-gray-600">Cuota Mensual:</span><span className="font-semibold text-gray-800">DOP {loan.monthlyPaymentAmount.toLocaleString('es-DO', {minimumFractionDigits:2})}</span></div>
                            </div>
                            <div className="mt-auto pt-4">
                                <button onClick={() => openPaymentsModal(loan)} className="w-full bg-indigo-500 text-white py-2.5 rounded-lg hover:bg-indigo-600 font-semibold transition-colors">Ver Pagos ({loan.paymentsCount})</button>
                            </div>
                        </div>
                    );
                })}
                 {loans.length === 0 && <p className="text-center text-gray-500 py-4 col-span-full">No hay préstamos registrados.</p>}
            </div>

            <Modal isOpen={isLoanModalOpen} onClose={closeLoanModal} title={editingLoan ? "Editar Préstamo" : "Agregar Nuevo Préstamo"} size="lg" closeOnBackdropClick={false}>
                <form onSubmit={handleLoanSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label htmlFor="name" className="block text-sm font-medium text-gray-700">Nombre del Préstamo</label><input type="text" name="name" id="name" value={loanFormData.name} onChange={handleLoanFormChange} required className="mt-1 w-full p-2 border border-gray-300 rounded-md shadow-sm bg-white text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/></div>
                        <div><label htmlFor="lender" className="block text-sm font-medium text-gray-700">Prestamista</label><input type="text" name="lender" id="lender" value={loanFormData.lender} onChange={handleLoanFormChange} required className="mt-1 w-full p-2 border border-gray-300 rounded-md shadow-sm bg-white text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/></div>
                        <div><label htmlFor="initialAmount" className="block text-sm font-medium text-gray-700">Monto Inicial (DOP)</label><input type="number" name="initialAmount" id="initialAmount" value={loanFormData.initialAmount} onChange={handleLoanFormChange} required min="0.01" step="0.01" className="mt-1 w-full p-2 border border-gray-300 rounded-md shadow-sm bg-white text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/></div>
                        <div><label htmlFor="startDate" className="block text-sm font-medium text-gray-700">Fecha de Inicio</label><input type="date" name="startDate" id="startDate" value={loanFormData.startDate} onChange={handleLoanFormChange} required className="mt-1 w-full p-2 border border-gray-300 rounded-md shadow-sm bg-white text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/></div>
                        <div><label htmlFor="monthlyPaymentAmount" className="block text-sm font-medium text-gray-700">Cuota Fija Mensual (DOP)</label><input type="number" name="monthlyPaymentAmount" id="monthlyPaymentAmount" value={loanFormData.monthlyPaymentAmount} onChange={handleLoanFormChange} required min="0.01" step="0.01" className="mt-1 w-full p-2 border border-gray-300 rounded-md shadow-sm bg-white text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/></div>
                        <div><label htmlFor="monthlyInterestAmount" className="block text-sm font-medium text-gray-700">Interés Fijo por Cuota (DOP)</label><input type="number" name="monthlyInterestAmount" id="monthlyInterestAmount" value={loanFormData.monthlyInterestAmount} onChange={handleLoanFormChange} required min="0" step="0.01" className="mt-1 w-full p-2 border border-gray-300 rounded-md shadow-sm bg-white text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"/></div>
                    </div>
                    <div className="flex justify-end gap-3 pt-4"><button type="button" onClick={closeLoanModal} className="bg-gray-200 px-4 py-2 rounded-lg">Cancelar</button><button type="submit" className="bg-teal-600 text-white px-4 py-2 rounded-lg">{editingLoan ? "Guardar Cambios" : "Agregar Préstamo"}</button></div>
                </form>
            </Modal>
            
            {selectedLoan && (
                <Modal isOpen={isPaymentsModalOpen} onClose={closePaymentsModal} title={`Pagos de: ${selectedLoan.name}`} size="2xl">
                    <div className="space-y-4">
                         <div className="p-4 bg-slate-100 rounded-lg text-center">
                            <p className="text-sm text-slate-600">Saldo Pendiente Actual</p>
                            <p className="text-3xl font-bold text-red-600">
                                DOP {(loansWithBalance.find(l => l.id === selectedLoan.id)?.remainingBalance ?? 0).toLocaleString('es-DO', {minimumFractionDigits:2})}
                            </p>
                        </div>
                        <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                            <h3 className="text-lg font-semibold text-gray-800">Registrar Nuevo Pago de Cuota</h3>
                            <button onClick={() => selectedLoan && handleRecordPayment(selectedLoan)} className="bg-green-500 text-white px-5 py-2 rounded-lg hover:bg-green-600 font-semibold flex items-center justify-center gap-2">
                                <IconCash className="w-5 h-5 flex-shrink-0" />
                                <span>Registrar Pago de DOP {selectedLoan.monthlyPaymentAmount.toFixed(2)}</span>
                            </button>
                        </div>
                        <h3 className="text-lg font-semibold">Historial de Pagos</h3>
                        <div className="max-h-80 overflow-y-auto border rounded-lg">
                            <table className="min-w-full divide-y">
                                <thead className="bg-gray-100 sticky top-0"><tr>{["Fecha", "Monto Pagado", "Interés", "Capital", "Saldo Restante"].map(h => <th key={h} className="px-4 py-2 text-left text-sm font-medium text-gray-600">{h}</th>)}</tr></thead>
                                <tbody className="bg-white divide-y">
                                    {loanPayments.filter(p => p.loanId === selectedLoan.id).sort((a,b) => new Date(b.paymentDate).getTime() - new Date(a.date).getTime()).map(p => (
                                        <tr key={p.id}>
                                            <td className="px-4 py-2 text-sm">{new Date(p.paymentDate).toLocaleDateString('es-DO')}</td>
                                            <td className="px-4 py-2 text-sm font-semibold text-green-700">{p.amountPaid.toFixed(2)}</td>
                                            <td className="px-4 py-2 text-sm text-orange-600">{p.interestPaid.toFixed(2)}</td>
                                            <td className="px-4 py-2 text-sm text-blue-600">{p.principalPaid.toFixed(2)}</td>
                                            <td className="px-4 py-2 text-sm font-bold text-red-700">{p.remainingBalance.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                         <div className="flex justify-end pt-2"><button type="button" onClick={closePaymentsModal} className="bg-gray-200 px-4 py-2 rounded-lg">Cerrar</button></div>
                    </div>
                </Modal>
            )}

        </div>
    );
};
