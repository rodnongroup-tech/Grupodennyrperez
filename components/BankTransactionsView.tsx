

import React, { useState, useEffect, useMemo } from 'react';
import { BankTransaction, ExpenseCategory } from '../types';
import { IconCreditCard, IconSparkles, IconPaperAirplane, IconCalendar, IconUpload } from '../constants';
import { EXPENSE_CATEGORIES } from '../constants';
import { Modal } from './common/Modal';
import { LoadingSpinner } from './common/LoadingSpinner';
import { geminiService } from '../services/geminiService';

interface BankTransactionsViewProps {
  bankTransactions: BankTransaction[];
  addBankTransaction: (transaction: Omit<BankTransaction, 'id' | 'isDebit'>) => void;
  updateBankTransaction: (transaction: BankTransaction) => void;
}

const initialFormState: Omit<BankTransaction, 'id' | 'isDebit'> = {
  date: new Date().toISOString().split('T')[0],
  referenceNumber: '',
  description: '',
  code: '',
  debit: null,
  credit: null,
  balance: 0,
  comment: '',
  category: undefined,
  customCategory: '',
};

const cleanNumberString = (numStr: string | undefined | null): number | null => {
    if (numStr === null || numStr === undefined || typeof numStr !== 'string' || numStr.trim() === '' || numStr.trim() === '-') {
        return null;
    }
    const cleaned = numStr.replace(/RD\$\s?/g, '').replace(/\.(?=\d{3}(?:,|$))/g, '').replace(',', '.');
    const val = parseFloat(cleaned);
    return isNaN(val) ? null : val;
};


export const BankTransactionsView: React.FC<BankTransactionsViewProps> = ({ bankTransactions, addBankTransaction, updateBankTransaction }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<BankTransaction | null>(null);
  const [formData, setFormData] = useState<Omit<BankTransaction, 'id' | 'isDebit'>>(initialFormState);
  const [isAISuggesting, setIsAISuggesting] = useState(false);
  const [pastedData, setPastedData] = useState('');
  const [parseStatus, setParseStatus] = useState<{success: number, skipped: number, errors: string[] } | null>(null);


  const openModalForAdd = () => {
    setEditingTransaction(null);
    setFormData(initialFormState);
    setIsModalOpen(true);
  };

  const openModalForEdit = (transaction: BankTransaction) => {
    setEditingTransaction(transaction);
    setFormData({
        date: transaction.date,
        referenceNumber: transaction.referenceNumber,
        description: transaction.description,
        code: transaction.code,
        debit: transaction.debit,
        credit: transaction.credit,
        balance: transaction.balance,
        comment: transaction.comment,
        category: transaction.category,
        customCategory: transaction.customCategory,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTransaction(null);
    setParseStatus(null); 
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let newDebit = name === 'debit' ? (value === '' ? null : parseFloat(value)) : formData.debit;
    let newCredit = name === 'credit' ? (value === '' ? null : parseFloat(value)) : formData.credit;

    if (name === "debit" && newDebit !== null && newDebit > 0) {
      newCredit = null;
    } else if (name === "credit" && newCredit !== null && newCredit > 0) {
      newDebit = null;
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: (name === "debit" || name === "credit" || name === "balance") ? (value === '' ? null : parseFloat(value)) : value,
      debit: newDebit,
      credit: newCredit,
      customCategory: name === 'category' && value !== ExpenseCategory.OTRO ? '' : prev.customCategory,
    }));
  };

  const handleSuggestComment = async () => {
    if (!formData.description.trim() || (formData.debit === null && formData.credit === null)) {
      alert("Por favor, ingrese una descripción y un monto de débito o crédito.");
      return;
    }
    setIsAISuggesting(true);
    try {
      const suggestion = await geminiService.suggestBankTransactionComment(formData.description, formData.debit, formData.credit);
      setFormData(prev => ({ ...prev, comment: suggestion }));
    } catch (error) {
      console.error("Error suggesting comment:", error);
      setFormData(prev => ({ ...prev, comment: "Error al obtener sugerencia." }));
    } finally {
      setIsAISuggesting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.debit === null && formData.credit === null) {
      alert("Debe ingresar un valor para Débito o Crédito."); return;
    }
    if (formData.debit !== null && formData.credit !== null && formData.debit > 0 && formData.credit > 0) {
        alert("Solo puede ingresar un valor para Débito o Crédito, no ambos."); return;
    }
    if (!formData.comment.trim()) {
        alert("El comentario de justificación es obligatorio."); return;
    }
    if ((formData.debit || 0) > 0 && !formData.category) {
        alert("Debe seleccionar una categoría para los egresos."); return;
    }
    if (formData.category === ExpenseCategory.OTRO && !formData.customCategory?.trim()) {
        alert("Debe especificar la categoría personalizada si selecciona 'Otro'."); return;
    }

    if (editingTransaction) {
      const updatedTx: BankTransaction = {
        ...editingTransaction,
        ...formData,
        isDebit: (formData.debit || 0) > 0,
      };
      updateBankTransaction(updatedTx);
    } else {
        addBankTransaction(formData);
    }
    closeModal();
  };
  
  const transactionTypeDisplay = (debit: number | null, credit: number | null): string => {
    return (debit || 0) > 0 ? 'Egreso' : (credit || 0) > 0 ? 'Ingreso' : 'Indefinido';
  }
  const typeColorClassDisplay = (debit: number | null, credit: number | null): string => {
     return (debit || 0) > 0 ? 'text-red-600' : (credit || 0) > 0 ? 'text-green-600' : 'text-slate-500';
  }

  const handlePasteData = () => {
    if (!pastedData.trim()) {
        alert("Por favor, pegue los datos de las transacciones en el área de texto."); return;
    }
    const lines = pastedData.trim().split('\n').map(line => line.trim());
    let successCount = 0;
    let skippedCount = 0;
    const errorMessages: string[] = [];

    for (let i = 0; i < lines.length; i += 6) {
        if (i + 5 >= lines.length) {
            if(lines.slice(i).some(l => l.trim() !== '')) {
                 const remainingLines = lines.slice(i);
                 errorMessages.push(`Bloque incompleto al final (líneas ${i + 1}-${i + remainingLines.length}). Se omitió 1 transacción.`);
                 skippedCount++;
            }
            break; 
        }

        const currentTransactionLines = lines.slice(i, i + 6);
        const [dateStr, refStr, descStr, codeStr, montoStr, balanceStr] = currentTransactionLines;

        let date = new Date(dateStr);
        if (isNaN(date.getTime())) {
            const dateParts = dateStr.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
            if (dateParts) {
                let day, month, year;
                const part1 = parseInt(dateParts[1], 10);
                const part2 = parseInt(dateParts[2], 10);
                const yearPart = dateParts[3];
                const part3 = parseInt(yearPart.length === 2 ? `20${yearPart}` : yearPart, 10);
                if (part2 <= 12) { day = part1; month = part2; year = part3; }
                else if (part1 <= 12) { day = part2; month = part1; year = part3; }
                if (day && month && year) date = new Date(year, month - 1, day);
            }
        }

        if (isNaN(date.getTime())) {
            errorMessages.push(`Línea ${i + 1}: Fecha inválida '${dateStr}'.`); skippedCount++; continue;
        }

        const parsedMonto = cleanNumberString(montoStr);
        const parsedBalance = cleanNumberString(balanceStr);

        if (parsedMonto === null) {
            errorMessages.push(`Línea ${i + 5}: Monto inválido '${montoStr}'.`); skippedCount++; continue;
        }
        if (parsedBalance === null) {
            errorMessages.push(`Línea ${i + 6}: Balance inválido '${balanceStr}'.`); skippedCount++; continue;
        }
        
        let debit: number | null = null;
        let credit: number | null = null;
        const lowerDesc = descStr.toLowerCase();

        if (lowerDesc.includes('credito') || lowerDesc.includes('crédito') || lowerDesc.includes('deposito') || lowerDesc.includes('depósito') || lowerDesc.includes('abono')) {
            credit = parsedMonto;
        } else {
            debit = parsedMonto;
        }

        const transaction: Omit<BankTransaction, 'id' | 'isDebit'> = {
            date: date.toISOString().split('T')[0],
            referenceNumber: refStr,
            description: descStr,
            code: codeStr,
            debit: debit,
            credit: credit,
            balance: parsedBalance,
            comment: `Importado de lote: ${descStr}`,
        };
        addBankTransaction(transaction);
        successCount++;
    }
    setParseStatus({ success: successCount, skipped: skippedCount, errors: errorMessages });
  };
  

  return (
    <div className="space-y-8">
        <div className="flex justify-between items-center">
            <h1 className="text-4xl font-bold text-gray-800 flex items-center">
                <IconCreditCard className="w-10 h-10 mr-3 text-blue-600" />
                Transacciones Bancarias
            </h1>
            <div className="flex items-center space-x-3">
                 <button onClick={openModalForAdd} className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 shadow-md flex items-center font-semibold">
                    Agregar Transacción
                </button>
            </div>
        </div>
        
        {/* Bulk Add Section */}
        <div className="p-6 bg-white shadow-xl rounded-lg border border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800 mb-3 flex items-center"><IconUpload className="w-6 h-6 mr-2 text-blue-600"/> Importación Masiva</h2>
            <p className="text-sm text-gray-600 mb-3">Pegue aquí los datos copiados del estado de cuenta del banco. Cada transacción debe ocupar 6 líneas: Fecha, Referencia, Descripción, Código, Monto, y Balance.</p>
            <textarea
                value={pastedData}
                onChange={e => setPastedData(e.target.value)}
                rows={8}
                placeholder="Pegue los datos aquí..."
                className="w-full p-2 border border-gray-300 rounded-md shadow-sm font-mono text-xs"
            />
            <button onClick={handlePasteData} className="mt-3 bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 font-semibold">Procesar Datos Pegados</button>
            {parseStatus && (
                <div className="mt-4 p-3 border rounded-md bg-gray-50 text-sm">
                    <p className="font-semibold">Resultados de la importación:</p>
                    <p className="text-green-600">{parseStatus.success} transacciones agregadas exitosamente.</p>
                    <p className="text-orange-600">{parseStatus.skipped} transacciones omitidas.</p>
                    {parseStatus.errors.length > 0 && (
                        <div className="mt-2">
                            <p className="font-semibold text-red-600">Errores:</p>
                            <ul className="list-disc list-inside text-xs text-red-500 max-h-20 overflow-y-auto">
                                {parseStatus.errors.map((err, i) => <li key={i}>{err}</li>)}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>


        {/* Transactions Table */}
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                <tr>
                    {['Fecha', 'Referencia', 'Descripción', 'Tipo', 'Monto (DOP)', 'Balance (DOP)', 'Comentario/Categoría', 'Acciones'].map(header => (
                    <th key={header} scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        {header}
                    </th>
                    ))}
                </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                {[...bankTransactions].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{new Date(tx.date).toLocaleDateString()}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{tx.referenceNumber}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate" title={tx.description}>{tx.description}</td>
                        <td className={`px-4 py-3 whitespace-nowrap text-sm font-semibold ${typeColorClassDisplay(tx.debit, tx.credit)}`}>{transactionTypeDisplay(tx.debit, tx.credit)}</td>
                        <td className={`px-4 py-3 whitespace-nowrap text-sm font-bold ${typeColorClassDisplay(tx.debit, tx.credit)}`}>{(tx.debit || tx.credit)?.toLocaleString('es-DO', {minimumFractionDigits: 2})}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-800">{tx.balance.toLocaleString('es-DO', {minimumFractionDigits: 2})}</td>
                        <td className="px-4 py-3 text-sm text-gray-500 max-w-sm">
                            <p className="font-medium text-gray-700 truncate" title={tx.comment}>{tx.comment}</p>
                            {tx.category && <span className="text-xs bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded-full">{tx.category === ExpenseCategory.OTRO ? tx.customCategory : tx.category}</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium"><button onClick={() => openModalForEdit(tx)} className="text-indigo-600 hover:text-indigo-900">Editar</button></td>
                    </tr>
                ))}
                </tbody>
            </table>
            {bankTransactions.length === 0 && <p className="p-4 text-center text-gray-500">No hay transacciones registradas.</p>}
            </div>
        </div>

        <Modal isOpen={isModalOpen} onClose={closeModal} title={editingTransaction ? "Editar Transacción" : "Agregar Transacción"} size="2xl">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div><label htmlFor="tx-date" className="block text-sm font-medium text-gray-700">Fecha</label><input type="date" name="date" id="tx-date" value={formData.date} onChange={handleInputChange} required className="mt-1 w-full p-2 border border-gray-300 rounded-md shadow-sm"/></div>
                    <div><label htmlFor="tx-ref" className="block text-sm font-medium text-gray-700">Referencia</label><input type="text" name="referenceNumber" id="tx-ref" value={formData.referenceNumber} onChange={handleInputChange} required className="mt-1 w-full p-2 border border-gray-300 rounded-md shadow-sm"/></div>
                    <div><label htmlFor="tx-code" className="block text-sm font-medium text-gray-700">Código</label><input type="text" name="code" id="tx-code" value={formData.code} onChange={handleInputChange} required className="mt-1 w-full p-2 border border-gray-300 rounded-md shadow-sm"/></div>
                </div>
                <div><label htmlFor="tx-desc" className="block text-sm font-medium text-gray-700">Descripción</label><textarea name="description" id="tx-desc" value={formData.description} onChange={handleInputChange} required rows={2} className="mt-1 w-full p-2 border border-gray-300 rounded-md shadow-sm"/></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div><label htmlFor="tx-debit" className="block text-sm font-medium text-gray-700">Débito (Egreso)</label><input type="number" name="debit" id="tx-debit" value={formData.debit ?? ''} onChange={handleInputChange} step="0.01" className="mt-1 w-full p-2 border border-gray-300 rounded-md shadow-sm"/></div>
                    <div><label htmlFor="tx-credit" className="block text-sm font-medium text-gray-700">Crédito (Ingreso)</label><input type="number" name="credit" id="tx-credit" value={formData.credit ?? ''} onChange={handleInputChange} step="0.01" className="mt-1 w-full p-2 border border-gray-300 rounded-md shadow-sm"/></div>
                    <div><label htmlFor="tx-balance" className="block text-sm font-medium text-gray-700">Balance</label><input type="number" name="balance" id="tx-balance" value={formData.balance} onChange={handleInputChange} step="0.01" required className="mt-1 w-full p-2 border border-gray-300 rounded-md shadow-sm"/></div>
                </div>

                <div>
                    <label htmlFor="tx-comment" className="block text-sm font-medium text-gray-700">Comentario / Justificación</label>
                    <div className="mt-1 flex rounded-md shadow-sm">
                        <textarea name="comment" id="tx-comment" value={formData.comment} onChange={handleInputChange} required rows={2} className="flex-1 w-full p-2 border border-gray-300 rounded-l-md"/>
                        <button type="button" onClick={handleSuggestComment} disabled={isAISuggesting} className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 bg-gray-50 text-sm text-gray-600 hover:bg-gray-100 rounded-r-md">
                            {isAISuggesting ? <LoadingSpinner size="sm"/> : <IconSparkles className="w-5 h-5 text-indigo-500" />}
                        </button>
                    </div>
                </div>
                 {(formData.debit || 0) > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                            <label htmlFor="tx-category" className="block text-sm font-medium text-gray-700">Categoría de Gasto</label>
                            <select name="category" id="tx-category" value={formData.category || ''} onChange={handleInputChange} required className="mt-1 w-full p-2 border border-gray-300 rounded-md shadow-sm">
                                <option value="" disabled>Seleccione una categoría...</option>
                                {EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                        </div>
                        {formData.category === ExpenseCategory.OTRO && (
                            <div>
                                <label htmlFor="tx-custom-category" className="block text-sm font-medium text-gray-700">Especifique "Otro"</label>
                                <input type="text" name="customCategory" id="tx-custom-category" value={formData.customCategory || ''} onChange={handleInputChange} required className="mt-1 w-full p-2 border border-gray-300 rounded-md shadow-sm"/>
                            </div>
                        )}
                    </div>
                 )}

                <div className="flex justify-end space-x-3 pt-4">
                    <button type="button" onClick={closeModal} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200">Cancelar</button>
                    <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-semibold">{editingTransaction ? "Guardar Cambios" : "Agregar Transacción"}</button>
                </div>
            </form>
        </Modal>
    </div>
  );
};
