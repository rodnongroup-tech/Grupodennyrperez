
import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import { ReportExpenseItem, ReportIncomeItem, MiHeladitoReportEntry } from '../types';
import { IconIceCream, IconTrash, IconPrint, IconCalendar, IconCash, IconSave, IconPencil, IconCheck, IconX } from '../constants';
import { 
    MI_HELADITO_PARTNER_DENNY, 
    MI_HELADITO_PARTNER_GISAN, 
    MI_HELADITO_BUSINESS_ACCOUNT, 
    MI_HELADITO_MIN_REINVESTMENT, 
    MI_HELADITO_PRIMARY_DIST_SHARE_DG_COMBINED, 
    MI_HELADITO_PRIMARY_DIST_SHARE_MH_ADDITIONAL 
} from '../constants';

interface MiHeladitoReportViewProps {
  miHeladitoReportEntries: Record<string, MiHeladitoReportEntry>; // Key: "YYYY-MM"
  addOrUpdateMiHeladitoReportEntry: (monthYearKey: string, entry: MiHeladitoReportEntry) => void;
}

const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const currentYearStatic = new Date().getFullYear();
const availableYears = Array.from({ length: 10 }, (_, i) => currentYearStatic - 5 + i);

export const MiHeladitoReportView: React.FC<MiHeladitoReportViewProps> = ({
  miHeladitoReportEntries,
  addOrUpdateMiHeladitoReportEntry,
}) => {
  const currentDt = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDt.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(currentDt.getFullYear());

  const [currentExpenses, setCurrentExpenses] = useState<ReportExpenseItem[]>([]);
  const [newExpenseRemark, setNewExpenseRemark] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState<number | ''>('');

  const [currentIncomes, setCurrentIncomes] = useState<ReportIncomeItem[]>([]);
  const [newIncomeSource, setNewIncomeSource] = useState('');
  const [newIncomeAmount, setNewIncomeAmount] = useState<number | ''>('');

  const [currentInvestmentPurchases, setCurrentInvestmentPurchases] = useState<ReportExpenseItem[]>([]);
  const [newInvestmentPurchaseRemark, setNewInvestmentPurchaseRemark] = useState('');
  const [newInvestmentPurchaseAmount, setNewInvestmentPurchaseAmount] = useState<number | ''>('');
  
  const [isDirty, setIsDirty] = useState(false);
  const [pristineData, setPristineData] = useState<{ expenses: ReportExpenseItem[], incomes: ReportIncomeItem[], investments: ReportExpenseItem[] } | null>(null);

  const [editingItem, setEditingItem] = useState<{ id: string; type: 'expense' | 'income' | 'investment' } | null>(null);
  const [editedData, setEditedData] = useState<{ remarkOrSource: string; amount: number | '' }>({ remarkOrSource: '', amount: '' });

  const monthYearKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;

  useEffect(() => {
    const entry = miHeladitoReportEntries[monthYearKey];
    const initialData = {
        expenses: entry?.expenses || [],
        incomes: entry?.incomes || [],
        investments: entry?.investmentPurchases || []
    };

    setCurrentExpenses(initialData.expenses);
    setCurrentIncomes(initialData.incomes);
    setCurrentInvestmentPurchases(initialData.investments);
    
    setPristineData(initialData);
    setIsDirty(false);
  }, [selectedMonth, selectedYear, miHeladitoReportEntries, monthYearKey]);

  useEffect(() => {
    if (!pristineData) return;

    const isExpensesDirty = JSON.stringify(currentExpenses) !== JSON.stringify(pristineData.expenses);
    const isIncomesDirty = JSON.stringify(currentIncomes) !== JSON.stringify(pristineData.incomes);
    const isInvestmentsDirty = JSON.stringify(currentInvestmentPurchases) !== JSON.stringify(pristineData.investments);

    setIsDirty(isExpensesDirty || isIncomesDirty || isInvestmentsDirty);

  }, [currentExpenses, currentIncomes, currentInvestmentPurchases, pristineData]);


  // Calculation Logic
  const totalGastos = currentExpenses.reduce((sum, item) => sum + item.amount, 0);
  const totalIngresos = currentIncomes.reduce((sum, item) => sum + item.amount, 0);
  const totalGanancias = totalIngresos - totalGastos;
  const totalInvestmentPurchases = currentInvestmentPurchases.reduce((sum, item) => sum + item.amount, 0);

  // Profit Distribution
  let shareDenny = 0;
  let shareGisan = 0;
  let initialShareMiHeladito = 0; // Share for Mi Heladito BEFORE deducting its own investments

  if (totalGanancias <= 0) {
    initialShareMiHeladito = totalGanancias; // Mi Heladito absorbs loss or gets 0
  } else if (totalGanancias <= MI_HELADITO_MIN_REINVESTMENT) {
    initialShareMiHeladito = totalGanancias; // All profit up to 50k goes to Mi Heladito
  } else {
    // totalGanancias > MI_HELADITO_MIN_REINVESTMENT
    const miHeladitoFixedPortion = MI_HELADITO_MIN_REINVESTMENT;
    const profitRemainingForPercentageSplit = totalGanancias - miHeladitoFixedPortion;
    
    const amountForDennyAndGisan = profitRemainingForPercentageSplit * MI_HELADITO_PRIMARY_DIST_SHARE_DG_COMBINED;
    shareDenny = amountForDennyAndGisan / 2;
    shareGisan = amountForDennyAndGisan / 2;
    
    const miHeladitoAdditionalAmount = profitRemainingForPercentageSplit * MI_HELADITO_PRIMARY_DIST_SHARE_MH_ADDITIONAL;
    initialShareMiHeladito = miHeladitoFixedPortion + miHeladitoAdditionalAmount;
  }

  const finalShareMiHeladito = initialShareMiHeladito - totalInvestmentPurchases;

  // Handlers
  const handleAddExpense = () => {
    if (newExpenseRemark.trim() && typeof newExpenseAmount === 'number' && newExpenseAmount !== 0) {
      const newExpense: ReportExpenseItem = {
        id: `mh-exp-${Date.now()}`,
        remark: newExpenseRemark,
        amount: newExpenseAmount,
        isAutomatic: false, 
        category: 'manual',
      };
      setCurrentExpenses(prev => [...prev, newExpense]);
      setNewExpenseRemark(''); setNewExpenseAmount('');
    } else {
      alert("Por favor, ingrese una descripción y un monto válido para el gasto.");
    }
  };
  const handleDeleteExpense = (expenseId: string) => setCurrentExpenses(prev => prev.filter(e => e.id !== expenseId));

  const handleAddIncome = () => {
    if (newIncomeSource.trim() && typeof newIncomeAmount === 'number' && newIncomeAmount !== 0) {
        const newIncome: ReportIncomeItem = {
            id: `mh-inc-${Date.now()}`,
            source: newIncomeSource,
            amount: newIncomeAmount,
        };
        setCurrentIncomes(prev => [...prev, newIncome]);
        setNewIncomeSource(''); setNewIncomeAmount('');
    } else {
        alert("Por favor, ingrese una fuente y un monto válido para el ingreso.");
    }
  };
  const handleDeleteIncome = (incomeId: string) => setCurrentIncomes(prev => prev.filter(i => i.id !== incomeId));

  const handleAddInvestmentPurchase = () => {
    if (newInvestmentPurchaseRemark.trim() && typeof newInvestmentPurchaseAmount === 'number' && newInvestmentPurchaseAmount > 0) {
        const newPurchase: ReportExpenseItem = { // Reusing ReportExpenseItem for simplicity
            id: `mh-inv-${Date.now()}`,
            remark: newInvestmentPurchaseRemark,
            amount: newInvestmentPurchaseAmount,
        };
        setCurrentInvestmentPurchases(prev => [...prev, newPurchase]);
        setNewInvestmentPurchaseRemark(''); setNewInvestmentPurchaseAmount('');
    } else {
        alert("Por favor, ingrese una descripción y un monto válido para la compra de inversión.");
    }
  };
  const handleDeleteInvestmentPurchase = (purchaseId: string) => {
    setCurrentInvestmentPurchases(prev => prev.filter(p => p.id !== purchaseId));
  };
  
    const handleStartEdit = (item: ReportExpenseItem | ReportIncomeItem, type: 'expense' | 'income' | 'investment') => {
    setEditingItem({ id: item.id, type });
    if ('remark' in item) {
        setEditedData({ remarkOrSource: item.remark, amount: item.amount });
    } else {
        setEditedData({ remarkOrSource: item.source, amount: item.amount });
    }
  };

  const handleCancelEdit = () => {
      setEditingItem(null);
      setEditedData({ remarkOrSource: '', amount: '' });
  };

  const handleSaveEdit = () => {
      if (!editingItem) return;
      if (editedData.remarkOrSource.trim() === '' || editedData.amount === '' || Number(editedData.amount) <= 0) {
          alert("La descripción y el monto son obligatorios y el monto debe ser mayor a cero.");
          return;
      }
      const numericAmount = Number(editedData.amount);

      switch (editingItem.type) {
          case 'expense':
              setCurrentExpenses(prev => prev.map(item =>
                  item.id === editingItem.id ? { ...item, remark: editedData.remarkOrSource, amount: numericAmount } : item
              ));
              break;
          case 'income':
              setCurrentIncomes(prev => prev.map(item =>
                  item.id === editingItem.id ? { ...item, source: editedData.remarkOrSource, amount: numericAmount } : item
              ));
              break;
          case 'investment':
              setCurrentInvestmentPurchases(prev => prev.map(item =>
                  item.id === editingItem.id ? { ...item, remark: editedData.remarkOrSource, amount: numericAmount } : item
              ));
              break;
      }
      handleCancelEdit(); // Reset editing state
  };


  const handleSaveChanges = () => {
     addOrUpdateMiHeladitoReportEntry(monthYearKey, {
        expenses: currentExpenses,
        incomes: currentIncomes,
        investmentPurchases: currentInvestmentPurchases,
    });
    alert("¡Reporte guardado exitosamente!");
    
    // Manually update pristine data to reflect the new saved state
    setPristineData({
        expenses: currentExpenses,
        incomes: currentIncomes,
        investments: currentInvestmentPurchases,
    });
    setIsDirty(false); 
  };


  const generateMiHeladitoPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let yPos = 20;
    const lineSpacing = 6; // Adjusted for better spacing in PDF
    const sectionSpacing = 10;

    // Header
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text(`REPORTE MENSUAL - MI HELADITO ARTESANALES`, pageWidth / 2, yPos, { align: 'center' });
    yPos += lineSpacing + 2;
    doc.setFontSize(14);
    doc.setFont(undefined, 'normal');
    doc.text(`${monthNames[selectedMonth]} ${selectedYear}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += sectionSpacing;

    // Incomes
    doc.setFontSize(13);
    doc.setFont(undefined, 'bold');
    doc.text("INGRESOS DEL MES", margin, yPos);
    yPos += lineSpacing;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    if (currentIncomes.length > 0) {
        currentIncomes.forEach(item => {
            doc.text(item.source, margin + 2, yPos, {maxWidth: pageWidth - margin * 2 - 60});
            doc.text(item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), pageWidth - margin, yPos, { align: 'right' });
            yPos += lineSpacing;
        });
    } else {
        doc.text("No se registraron ingresos.", margin + 2, yPos);
        yPos += lineSpacing;
    }
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text("TOTAL INGRESOS", margin, yPos);
    doc.text(`DOP ${totalIngresos.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth - margin, yPos, { align: 'right' });
    yPos += sectionSpacing;

    // Expenses
    doc.setFontSize(13);
    doc.setFont(undefined, 'bold');
    doc.text("GASTOS DEL MES", margin, yPos);
    yPos += lineSpacing;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    if (currentExpenses.length > 0) {
        currentExpenses.forEach(item => {
            doc.text(item.remark, margin + 2, yPos, {maxWidth: pageWidth - margin * 2 - 60});
            doc.text(item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), pageWidth - margin, yPos, { align: 'right' });
            yPos += lineSpacing;
        });
    } else {
        doc.text("No se registraron gastos.", margin + 2, yPos);
        yPos += lineSpacing;
    }
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text("TOTAL GASTOS", margin, yPos);
    doc.text(`DOP ${totalGastos.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth - margin, yPos, { align: 'right' });
    yPos += sectionSpacing;
    
    // Net Profit
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setFillColor(totalGanancias >= 0 ? 230 : 255, totalGanancias >= 0 ? 245 : 230, totalGanancias >= 0 ? 230 : 230); 
    doc.rect(margin, yPos - (lineSpacing -1) , pageWidth - (margin * 2), lineSpacing + 1, 'F');
    doc.setTextColor(totalGanancias >= 0 ? 0 : 200, totalGanancias >= 0 ? 100 : 0, 0); 
    doc.text("GANANCIA NETA DEL MES:", margin + 2, yPos);
    doc.text(`DOP ${totalGanancias.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth - margin, yPos, { align: 'right' });
    yPos += sectionSpacing;
    doc.setTextColor(0,0,0); 

    // Investment Purchases
    if (currentInvestmentPurchases.length > 0) {
        doc.setFontSize(13);
        doc.setFont(undefined, 'bold');
        doc.text("COMPRAS DE INVERSIÓN (MI HELADITO)", margin, yPos);
        yPos += lineSpacing;
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        currentInvestmentPurchases.forEach(item => {
            doc.text(item.remark, margin + 2, yPos, {maxWidth: pageWidth - margin * 2 - 60});
            doc.text(item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), pageWidth - margin, yPos, { align: 'right' });
            yPos += lineSpacing;
        });
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.text("TOTAL COMPRAS DE INVERSIÓN", margin, yPos);
        doc.text(`DOP ${totalInvestmentPurchases.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth - margin, yPos, { align: 'right' });
        yPos += sectionSpacing;
    }


    // Profit Distribution
    doc.setFontSize(13);
    doc.setFont(undefined, 'bold');
    doc.text("DISTRIBUCIÓN DE GANANCIAS", margin, yPos);
    yPos += lineSpacing;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    
    doc.text(`${MI_HELADITO_PARTNER_DENNY}:`, margin + 2, yPos);
    doc.text(`DOP ${shareDenny.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth - margin, yPos, { align: 'right' });
    yPos += lineSpacing;

    doc.text(`${MI_HELADITO_PARTNER_GISAN}:`, margin + 2, yPos);
    doc.text(`DOP ${shareGisan.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth - margin, yPos, { align: 'right' });
    yPos += lineSpacing;
    
    doc.setFont(undefined, 'bold');
    doc.text(`${MI_HELADITO_BUSINESS_ACCOUNT} (Participación Calculada):`, margin + 2, yPos);
    doc.text(`DOP ${initialShareMiHeladito.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth - margin, yPos, { align: 'right' });
    yPos += lineSpacing;

    if (totalInvestmentPurchases > 0) {
        doc.setFontSize(9);
        doc.setFont(undefined, 'italic');
        doc.setTextColor(150, 0, 0); 
        doc.text(`Menos Compras de Inversión:`, margin + 4, yPos);
        doc.text(`(DOP ${totalInvestmentPurchases.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`, pageWidth - margin, yPos, { align: 'right' });
        yPos += lineSpacing;
        doc.setTextColor(0,0,0);
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text(`${MI_HELADITO_BUSINESS_ACCOUNT} (Monto Final Neto):`, margin + 2, yPos);
        doc.text(`DOP ${finalShareMiHeladito.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth - margin, yPos, { align: 'right' });
        yPos += lineSpacing;
    } else {
         doc.setFont(undefined, 'bold');
         doc.text(`${MI_HELADITO_BUSINESS_ACCOUNT} (Monto Final Neto):`, margin + 2, yPos);
         doc.text(`DOP ${finalShareMiHeladito.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth - margin, yPos, { align: 'right' });
         yPos += lineSpacing;
    }
    doc.setFont(undefined, 'normal');


    // Footer
    const finalPageCount = doc.getNumberOfPages ? doc.getNumberOfPages() : (doc.internal as any).getNumberOfPages();
    for (let i = 1; i <= finalPageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8); doc.setTextColor(100, 100, 100);
      doc.text(`Página ${i} de ${finalPageCount}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
      doc.text(`Generado por Mi Heladito Artesanales - ${new Date().toLocaleDateString()}`, margin, pageHeight - 7);
    }
    doc.save(`Reporte_MiHeladito_${monthNames[selectedMonth]}_${selectedYear}.pdf`);
  };

  const renderEditableItem = (
    item: ReportExpenseItem | ReportIncomeItem,
    type: 'expense' | 'income' | 'investment'
  ) => {
    const isEditing = editingItem?.id === item.id;
    const itemColor = type === 'expense' ? 'text-red-600' : type === 'income' ? 'text-green-600' : 'text-cyan-700';
    const deleteHandler = () => {
        if (type === 'expense') handleDeleteExpense(item.id);
        if (type === 'income') handleDeleteIncome(item.id);
        if (type === 'investment') handleDeleteInvestmentPurchase(item.id);
    }

    if (isEditing) {
      return (
        <div key={`${item.id}-editing`} className="flex justify-between items-center p-2 border-b last:border-b-0 bg-blue-50 animate-pulse">
          <input
            type="text"
            value={editedData.remarkOrSource}
            onChange={(e) => setEditedData(prev => ({ ...prev, remarkOrSource: e.target.value }))}
            className="text-sm border-gray-300 rounded px-1 py-0.5 flex-grow mr-2 shadow-inner"
          />
          <div className="flex items-center">
            <input
              type="number"
              value={editedData.amount}
              onChange={(e) => setEditedData(prev => ({ ...prev, amount: e.target.value === '' ? '' : parseFloat(e.target.value) }))}
              className="text-sm border-gray-300 rounded px-1 py-0.5 w-24 mr-2 shadow-inner"
            />
            <button onClick={handleSaveEdit} className="text-green-600 hover:text-green-800 mr-2" title="Guardar"><IconCheck className="w-5 h-5"/></button>
            <button onClick={handleCancelEdit} className="text-gray-600 hover:text-gray-800" title="Cancelar"><IconX className="w-5 h-5"/></button>
          </div>
        </div>
      );
    }

    return (
      <div key={item.id} className="flex justify-between items-center p-2 border-b last:border-b-0 bg-white group">
        <span className="text-sm text-gray-700 truncate" title={'remark' in item ? item.remark : item.source}>
          {'remark' in item ? item.remark : item.source}
        </span>
        <div className="flex items-center">
          <span className={`text-sm font-medium mr-3 ${itemColor} whitespace-nowrap`}>
            DOP {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <button onClick={() => handleStartEdit(item, type)} className="text-blue-500 hover:text-blue-700 mr-1 opacity-0 group-hover:opacity-100 transition-opacity" title="Editar">
            <IconPencil className="w-4 h-4" />
          </button>
          <button onClick={deleteHandler} className="text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity" title="Eliminar">
            <IconTrash className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
};


  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h1 className="text-4xl font-bold text-gray-800 flex items-center">
          <IconIceCream className="w-10 h-10 mr-3 text-pink-500" />
          Reporte Mensual - Mi Heladito Artesanales
        </h1>
        <div className="flex items-center space-x-3">
            <button
                onClick={handleSaveChanges}
                disabled={!isDirty}
                className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors shadow-md hover:shadow-lg flex items-center disabled:bg-blue-300 disabled:cursor-not-allowed"
            >
                <IconSave className="w-5 h-5 mr-2" /> Guardar Cambios
            </button>
            <button
            onClick={generateMiHeladitoPDF}
            className="bg-pink-500 text-white px-6 py-3 rounded-lg hover:bg-pink-600 transition-colors shadow-md hover:shadow-lg flex items-center"
            >
            <IconPrint className="w-5 h-5 mr-2" /> Generar Reporte PDF
            </button>
        </div>
      </div>

      {/* Period Selection */}
      <div className="p-4 bg-white shadow-lg rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-700 mb-3 border-b pb-2">Seleccionar Período del Reporte</h3>
        <div className="flex items-center space-x-3">
            <IconCalendar className="w-5 h-5 text-gray-500" />
            <div>
                <label htmlFor="report-month-mh" className="block text-sm font-medium text-gray-600">Mes:</label>
                <select id="report-month-mh" value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))} className="mt-1 px-3 py-2 w-full border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                    {monthNames.map((name, index) => <option key={index} value={index}>{name}</option>)}
                </select>
            </div>
            <div>
                <label htmlFor="report-year-mh" className="block text-sm font-medium text-gray-600">Año:</label>
                <select id="report-year-mh" value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} className="mt-1 px-3 py-2 w-full border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                    {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
                </select>
            </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Expenses Section */}
        <div className="p-6 bg-white shadow-xl rounded-lg border border-gray-200 lg:col-span-1">
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Gastos del Mes</h2>
            <div className="max-h-60 overflow-y-auto mb-3 border rounded-md p-2 bg-slate-50">
                {currentExpenses.length > 0 ? (
                    currentExpenses.map(item => renderEditableItem(item, 'expense'))
                ) : <p className="text-sm text-gray-500 text-center py-2">No hay gastos registrados.</p>}
            </div>
            <div className="flex items-end space-x-2 p-3 border border-blue-200 rounded-md bg-blue-50">
                <div className="flex-grow">
                    <label htmlFor="newExpenseRemark-mh" className="block text-xs font-medium text-gray-600">Nuevo Gasto (Descripción):</label>
                    <input type="text" id="newExpenseRemark-mh" value={newExpenseRemark} onChange={e => setNewExpenseRemark(e.target.value)} placeholder="Ej: Ingredientes" className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm sm:text-sm"/>
                </div>
                <div className="w-32"> {/* Adjusted width */}
                    <label htmlFor="newExpenseAmount-mh" className="block text-xs font-medium text-gray-600">Monto (DOP):</label>
                    <input type="number" id="newExpenseAmount-mh" value={newExpenseAmount} onChange={e => setNewExpenseAmount(e.target.value === '' ? '' : parseFloat(e.target.value))} placeholder="0.00" className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm sm:text-sm"/>
                </div>
                <button onClick={handleAddExpense} className="bg-blue-500 text-white px-3 py-1.5 rounded-md hover:bg-blue-600 text-sm whitespace-nowrap self-end">Agregar</button>
            </div>
            <div className="mt-3 text-right">
                <span className="text-md font-semibold text-gray-700">Total Gastos: </span>
                <span className="text-md font-bold text-red-600">DOP {totalGastos.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
        </div>

        {/* Incomes Section */}
        <div className="p-6 bg-white shadow-xl rounded-lg border border-gray-200 lg:col-span-1">
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Ingresos del Mes</h2>
            <div className="max-h-60 overflow-y-auto mb-3 border rounded-md p-2 bg-slate-50">
                {currentIncomes.length > 0 ? (
                    currentIncomes.map(item => renderEditableItem(item, 'income'))
                ) : <p className="text-sm text-gray-500 text-center py-2">No hay ingresos registrados.</p>}
            </div>
            <div className="flex items-end space-x-2 p-3 border border-green-200 rounded-md bg-green-50">
                <div className="flex-grow">
                    <label htmlFor="newIncomeSource-mh" className="block text-xs font-medium text-gray-600">Nuevo Ingreso (Fuente):</label>
                    <input type="text" id="newIncomeSource-mh" value={newIncomeSource} onChange={e => setNewIncomeSource(e.target.value)} placeholder="Ej: Ventas Directas" className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm sm:text-sm"/>
                </div>
                <div className="w-32"> {/* Adjusted width */}
                    <label htmlFor="newIncomeAmount-mh" className="block text-xs font-medium text-gray-600">Monto (DOP):</label>
                    <input type="number" id="newIncomeAmount-mh" value={newIncomeAmount} onChange={e => setNewIncomeAmount(e.target.value === '' ? '' : parseFloat(e.target.value))} placeholder="0.00" className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm sm:text-sm"/>
                </div>
                <button onClick={handleAddIncome} className="bg-green-500 text-white px-3 py-1.5 rounded-md hover:bg-green-600 text-sm whitespace-nowrap self-end">Agregar</button>
            </div>
            <div className="mt-3 text-right">
                <span className="text-md font-semibold text-gray-700">Total Ingresos: </span>
                <span className="text-md font-bold text-green-600">DOP {totalIngresos.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
        </div>
        
        {/* Investment Purchases Section */}
        <div className="p-6 bg-white shadow-xl rounded-lg border border-gray-200 lg:col-span-1">
            <h2 className="text-xl font-semibold text-gray-800 mb-3 flex items-center"><IconCash className="w-6 h-6 mr-2 text-cyan-600"/>Compras de Inversión (Mi Heladito)</h2>
            <div className="max-h-60 overflow-y-auto mb-3 border rounded-md p-2 bg-slate-50">
                {currentInvestmentPurchases.length > 0 ? (
                    currentInvestmentPurchases.map(item => renderEditableItem(item, 'investment'))
                ) : <p className="text-sm text-gray-500 text-center py-2">No hay compras de inversión registradas.</p>}
            </div>
            <div className="flex items-end space-x-2 p-3 border border-cyan-200 rounded-md bg-cyan-50">
                <div className="flex-grow">
                    <label htmlFor="newInvestmentPurchaseRemark-mh" className="block text-xs font-medium text-gray-600">Nueva Compra (Descripción):</label>
                    <input type="text" id="newInvestmentPurchaseRemark-mh" value={newInvestmentPurchaseRemark} onChange={e => setNewInvestmentPurchaseRemark(e.target.value)} placeholder="Ej: Freezer, Licuadora" className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm sm:text-sm"/>
                </div>
                <div className="w-32"> {/* Adjusted width */}
                    <label htmlFor="newInvestmentPurchaseAmount-mh" className="block text-xs font-medium text-gray-600">Monto (DOP):</label>
                    <input type="number" id="newInvestmentPurchaseAmount-mh" value={newInvestmentPurchaseAmount} onChange={e => setNewInvestmentPurchaseAmount(e.target.value === '' ? '' : parseFloat(e.target.value))} placeholder="0.00" className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm sm:text-sm"/>
                </div>
                <button onClick={handleAddInvestmentPurchase} className="bg-cyan-600 text-white px-3 py-1.5 rounded-md hover:bg-cyan-700 text-sm whitespace-nowrap self-end">Agregar</button>
            </div>
            <div className="mt-3 text-right">
                <span className="text-md font-semibold text-gray-700">Total Compras Inversión: </span>
                <span className="text-md font-bold text-cyan-700">DOP {totalInvestmentPurchases.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
        </div>
      </div>


      {/* Summary and Profit Distribution */}
      <div className="p-6 bg-white shadow-xl rounded-lg border-2 border-purple-300 mt-6">
        <h2 className="text-2xl font-semibold text-purple-700 mb-4 border-b-2 border-purple-200 pb-2">Resumen Financiero y Distribución</h2>
        <div className="mb-4 text-center">
            <span className="text-xl font-bold text-gray-700">GANANCIA NETA DEL MES: </span>
            <span className={`text-2xl font-extrabold ${totalGanancias >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                DOP {totalGanancias.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
        </div>
        <div className="mt-6 p-4 border-t-2 border-purple-200">
            <h3 className="text-lg font-semibold text-gray-700 mb-3">Distribución de Ganancias:</h3>
            <div className="space-y-2 text-md">
                 <div className="flex justify-between p-2 bg-indigo-50 rounded">
                    <span className="text-gray-600 font-medium">{MI_HELADITO_PARTNER_DENNY}:</span>
                    <span className="font-bold text-indigo-600">DOP {shareDenny.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between p-2 bg-teal-50 rounded">
                    <span className="text-gray-600 font-medium">{MI_HELADITO_PARTNER_GISAN}:</span>
                    <span className="font-bold text-teal-600">DOP {shareGisan.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>

                <div className="p-2 bg-purple-50 rounded mt-3 border-t border-purple-200 pt-3">
                    <div className="flex justify-between">
                        <span className="text-gray-600 font-medium">{MI_HELADITO_BUSINESS_ACCOUNT} (Participación Calculada):</span>
                        <span className="font-semibold text-purple-600">DOP {initialShareMiHeladito.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    {totalInvestmentPurchases > 0 && (
                        <div className="flex justify-between pl-4">
                             <span className="text-sm text-red-500 italic">Menos Compras de Inversión:</span>
                             <span className="text-sm font-semibold text-red-500 italic">(DOP {totalInvestmentPurchases.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</span>
                        </div>
                    )}
                     <div className="flex justify-between mt-1 border-t border-purple-100 pt-1">
                        <span className="text-gray-600 font-bold">{MI_HELADITO_BUSINESS_ACCOUNT} (Monto Final Neto):</span>
                        <span className="font-extrabold text-purple-700">DOP {finalShareMiHeladito.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                </div>
            </div>
             <p className="text-xs text-gray-500 mt-4 italic text-center">
                Nota: Mi Heladito ({MI_HELADITO_BUSINESS_ACCOUNT}) recibe un mínimo de DOP {MI_HELADITO_MIN_REINVESTMENT.toLocaleString()} si hay ganancias. El excedente se distribuye {MI_HELADITO_PRIMARY_DIST_SHARE_DG_COMBINED*100}% (mitad y mitad para Denny y Gisan) y {MI_HELADITO_PRIMARY_DIST_SHARE_MH_ADDITIONAL*100}% para Mi Heladito ({MI_HELADITO_BUSINESS_ACCOUNT}). Las compras de inversión se deducen de la parte final de Mi Heladito.
            </p>
        </div>
      </div>
    </div>
  );
};
