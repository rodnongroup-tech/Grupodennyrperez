
import React, { useState, useEffect, useRef, useCallback } from 'react';
import jsPDF from 'jspdf';
import { PayrollRun, SubagentMonthlyPayment, ReportExpenseItem, ReportIncomeItem, ManualReportEntry, PayrollRunStatus, ConduceDocument } from '../types';
import { IconChartBar, IconTrash, IconPrint, IconCalendar, IconImage, IconUpload, IconSave } from '../constants';
import { LoadingSpinner } from './common/LoadingSpinner';
import { BarChart } from './common/BarChart';
import { geminiService } from '../services/geminiService';

interface MonthlyReportViewProps {
  payrollRuns: PayrollRun[];
  subagentMonthlyPayments: SubagentMonthlyPayment[];
  conduceDocuments: ConduceDocument[];
  manualReportEntries: Record<string, ManualReportEntry>; // Key: "YYYY-MM"
  addOrUpdateManualReportEntry: (monthYearKey: string, entry: ManualReportEntry) => void;
}

const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const currentYearStatic = new Date().getFullYear();
const availableYears = Array.from({ length: 10 }, (_, i) => currentYearStatic - 5 + i);

const PARTNER_ACC_MULTISERVICES_NAME = "ACC MULTISERVICES SRL";
const PARTNER_GRUPO_DENNY_NAME = "GRUPO DENNY R PEREZ EIRL";
const PARTNER_ACC_MULTISERVICES_SHARE = 0.35;
const PARTNER_GRUPO_DENNY_SHARE = 0.65;
const REPORT_OPERATIONAL_NAME = "FOXPAC MOCA";

const getCanonicalKeyForYearlyPoundsData = (year: number, existingEntries: Record<string, ManualReportEntry>): string => {
    for (let i = 0; i < 12; i++) {
        const key = `${year}-${String(i + 1).padStart(2, '0')}`;
        if (existingEntries[key]?.manualPoundsForSelectedYear) {
            return key;
        }
    }
    return `${year}-${String(1).padStart(2, '0')}`; // Default to January
};


export const MonthlyReportView: React.FC<MonthlyReportViewProps> = ({
  payrollRuns,
  subagentMonthlyPayments,
  conduceDocuments,
  manualReportEntries,
  addOrUpdateManualReportEntry,
}) => {
  const currentDt = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDt.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(currentDt.getFullYear());

  const [currentManualExpenses, setCurrentManualExpenses] = useState<ReportExpenseItem[]>([]);
  const [newExpenseRemark, setNewExpenseRemark] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState<number | ''>('');

  const [incomePaqueteriaLocal, setIncomePaqueteriaLocal] = useState<number | ''>('');
  const [incomeGananciaCourrier, setIncomeGananciaCourrier] = useState<number | ''>('');

  const [historicalMonthForImport, setHistoricalMonthForImport] = useState<number>(currentDt.getMonth());
  const [historicalYearForImport, setHistoricalYearForImport] = useState<number>(currentDt.getFullYear());
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [editableHistoricalPounds, setEditableHistoricalPounds] = useState<Record<string, number | ''>>(
    monthNames.reduce((acc, month) => ({ ...acc, [month]: '' }), {})
  );
  
  const [isDirty, setIsDirty] = useState(false);
  const [pristineData, setPristineData] = useState<{ expenses: ReportExpenseItem[], paqLocal: number | null, ganCourrier: number | null, pounds: Record<string, number | ''> } | null>(null);
  
  const [historicalSummaries, setHistoricalSummaries] = useState<any[]>([]);
  
  const monthYearKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;

  const getAggregatedDataForPeriod = useCallback((year: number, month: number) => {
    const key = `${year}-${String(month + 1).padStart(2, '0')}`;

    // Note: Payroll is intentionally NOT calculated here as per user request
    // to add it manually.
    const payroll = 0;
    
    const subagents = subagentMonthlyPayments
        .filter(p => p.monthYear === key)
        .reduce((sum, p) => sum + p.totalAmountPaid, 0);

    return { payroll, subagents };
  }, [subagentMonthlyPayments]);


  useEffect(() => {
    const summaries = Object.keys(manualReportEntries)
      .map(key => {
        const entry = manualReportEntries[key];
        // A valid entry for history must have some user-input data
        const hasManualData = (entry.expenses?.some(e => !e.isAutomatic) || entry.incomes?.length > 0);
        if (!hasManualData) {
            return null;
        }

        const year = parseInt(key.split('-')[0], 10);
        const month = parseInt(key.split('-')[1], 10) - 1;

        if (isNaN(year) || isNaN(month)) return null;

        const { subagents } = getAggregatedDataForPeriod(year, month);
        
        const manualExpensesAmount = entry.expenses?.filter(e => !e.isAutomatic).reduce((sum, e) => sum + e.amount, 0) || 0;
        const totalExpenses = subagents + manualExpensesAmount;
        const totalIncomes = entry.incomes?.reduce((sum, i) => sum + i.amount, 0) || 0;

        return {
            key,
            period: `${monthNames[month]} ${year}`,
            incomes: totalIncomes,
            expenses: totalExpenses,
            profit: totalIncomes - totalExpenses,
            month,
            year,
        };
      })
      .filter(Boolean) // Remove nulls
      .sort((a, b) => b!.year - a!.year || b!.month - a!.month); // Sort descending by date
    
    setHistoricalSummaries(summaries as any[]);
  }, [manualReportEntries, getAggregatedDataForPeriod]);

  useEffect(() => {
    const monthEntry = manualReportEntries[monthYearKey];
    const initialManualExpenses = monthEntry?.expenses.filter(e => !e.isAutomatic && e.category === 'manual') || [];
    const paqLocalAmount = monthEntry?.incomes.find(i => i.source === "PAQUETERIA LOCAL")?.amount ?? null;
    const ganCourrierAmount = monthEntry?.incomes.find(i => i.source === "GANANCIA PAQUETERIA COURRIER")?.amount ?? null;

    setCurrentManualExpenses(initialManualExpenses);
    setIncomePaqueteriaLocal(paqLocalAmount === null ? '' : paqLocalAmount);
    setIncomeGananciaCourrier(ganCourrierAmount === null ? '' : ganCourrierAmount);

    const canonicalKey = getCanonicalKeyForYearlyPoundsData(selectedYear, manualReportEntries);
    const yearlyPoundsDataFromStore = manualReportEntries[canonicalKey]?.manualPoundsForSelectedYear;
    const initialPoundsMap: Record<string, number | ''> = {};
    monthNames.forEach(monthName => {
        const monthIndex = monthNames.indexOf(monthName);
        if (yearlyPoundsDataFromStore && (typeof yearlyPoundsDataFromStore[monthName] === 'number' || yearlyPoundsDataFromStore[monthName] === '')) {
            initialPoundsMap[monthName] = yearlyPoundsDataFromStore[monthName];
        } else {
            const monthKeyForAutoCalc = `${selectedYear}-${String(monthIndex + 1).padStart(2, '0')}`;
            let totalPoundsForMonth = 0;
            subagentMonthlyPayments.forEach(payment => {
                if (payment.monthYear === monthKeyForAutoCalc) {
                    if (payment.totalWeightForMonth) totalPoundsForMonth += payment.totalWeightForMonth;
                    else if (payment.conduceDocIdsIncluded) {
                        payment.conduceDocIdsIncluded.forEach(docId => {
                            const doc = conduceDocuments.find(cd => cd.id === docId);
                            if (doc) totalPoundsForMonth += doc.totalWeightPounds ?? 0;
                        });
                    }
                }
            });
            initialPoundsMap[monthName] = totalPoundsForMonth > 0 ? totalPoundsForMonth : '';
        }
    });
    setEditableHistoricalPounds(initialPoundsMap);

    setPristineData({
        expenses: initialManualExpenses,
        paqLocal: paqLocalAmount,
        ganCourrier: ganCourrierAmount,
        pounds: initialPoundsMap,
    });
    setIsDirty(false); 
  }, [selectedMonth, selectedYear, manualReportEntries, subagentMonthlyPayments, conduceDocuments]);

  useEffect(() => {
    if (!pristineData) {
      setIsDirty(false);
      return;
    }
    const expensesAreDirty = JSON.stringify(currentManualExpenses) !== JSON.stringify(pristineData.expenses);
    const currentPaqLocal = incomePaqueteriaLocal === '' ? null : Number(incomePaqueteriaLocal);
    const currentGanCourrier = incomeGananciaCourrier === '' ? null : Number(incomeGananciaCourrier);
    const incomesAreDirty = currentPaqLocal !== pristineData.paqLocal || currentGanCourrier !== pristineData.ganCourrier;
    const poundsAreDirty = JSON.stringify(editableHistoricalPounds) !== JSON.stringify(pristineData.pounds);
    
    setIsDirty(expensesAreDirty || incomesAreDirty || poundsAreDirty);
  }, [currentManualExpenses, incomePaqueteriaLocal, incomeGananciaCourrier, editableHistoricalPounds, pristineData]);
  
  const { subagents: aggregatedSubagentPaymentsAmount } = getAggregatedDataForPeriod(selectedYear, selectedMonth);

  const poundsForSelectedMonthValue = editableHistoricalPounds[monthNames[selectedMonth]];
  const aggregatedSubagentTotalPoundsForCurrentReportMonth = typeof poundsForSelectedMonthValue === 'number' ? poundsForSelectedMonthValue : 0;

  const automaticExpenses: ReportExpenseItem[] = [];
  if (aggregatedSubagentPaymentsAmount > 0) automaticExpenses.push({ id: 'auto-subagentes', remark: 'NOMINA Subagentes', amount: aggregatedSubagentPaymentsAmount, isAutomatic: true, category: 'subagents' });

  const allExpenses = [...automaticExpenses, ...currentManualExpenses];
  const totalGeneralGastos = allExpenses.reduce((sum, item) => sum + item.amount, 0);
  const numIncomePaqueteriaLocal = typeof incomePaqueteriaLocal === 'number' ? incomePaqueteriaLocal : (incomePaqueteriaLocal === '' ? 0 : Number(incomePaqueteriaLocal));
  const numIncomeGananciaCourrier = typeof incomeGananciaCourrier === 'number' ? incomeGananciaCourrier : (incomeGananciaCourrier === '' ? 0 : Number(incomeGananciaCourrier));
  const totalDeGanancias = (numIncomePaqueteriaLocal + numIncomeGananciaCourrier) - totalGeneralGastos;
  const shareAccMultiservices = totalDeGanancias * PARTNER_ACC_MULTISERVICES_SHARE;
  const shareGrupoDenny = totalDeGanancias * PARTNER_GRUPO_DENNY_SHARE;

  // Handlers
  const handleAddManualExpense = () => {
    if (newExpenseRemark.trim() && typeof newExpenseAmount === 'number' && newExpenseAmount !== 0) {
      const newManualExpense: ReportExpenseItem = {
        id: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        remark: newExpenseRemark,
        amount: newExpenseAmount,
        isAutomatic: false, category: 'manual',
      };
      setCurrentManualExpenses(prev => [...prev, newManualExpense]);
      setNewExpenseRemark(''); setNewExpenseAmount('');
    } else alert("Por favor, ingrese una descripción y un monto válido para el gasto.");
  };

  const handleDeleteManualExpense = (expenseId: string) => setCurrentManualExpenses(prev => prev.filter(e => e.id !== expenseId));
  const handleIncomeChange = (setter: React.Dispatch<React.SetStateAction<number | ''>>, value: string) => setter(value === '' ? '' : parseFloat(value) || 0);

  const handleHistoricalPoundChange = (month: string, value: string) => {
    setEditableHistoricalPounds(prev => ({
      ...prev,
      [month]: value === '' ? '' : parseFloat(value) || 0,
    }));
  };

  const handleSaveChanges = () => {
    const incomesToSave: ReportIncomeItem[] = [];
    if (incomePaqueteriaLocal !== '' && Number(incomePaqueteriaLocal) > 0) {
        incomesToSave.push({id: 'income-local', source: "PAQUETERIA LOCAL", amount: Number(incomePaqueteriaLocal)});
    }
    if (incomeGananciaCourrier !== '' && Number(incomeGananciaCourrier) > 0) {
        incomesToSave.push({id: 'income-courrier', source: "GANANCIA PAQUETERIA COURRIER", amount: Number(incomeGananciaCourrier)});
    }
    const expensesToSave = currentManualExpenses.filter(e => !e.isAutomatic);

    const currentMonthEntryData = {
        expenses: expensesToSave,
        incomes: incomesToSave,
        manualPoundsForSelectedYear: editableHistoricalPounds,
    };

    addOrUpdateManualReportEntry(monthYearKey, currentMonthEntryData);

    alert("¡Reporte guardado exitosamente!");
    
    // Manually update pristine data to reflect the new saved state
    setPristineData({
        expenses: expensesToSave,
        paqLocal: incomePaqueteriaLocal === '' ? null : Number(incomePaqueteriaLocal),
        ganCourrier: incomeGananciaCourrier === '' ? null : Number(incomeGananciaCourrier),
        pounds: editableHistoricalPounds,
    });
    setIsDirty(false);
  };

  const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
       if (file.size > 4 * 1024 * 1024) {
        alert("El archivo es demasiado grande. Por favor, suba una imagen de menos de 4MB.");
        setSelectedImageFile(null); setImagePreviewUrl(null);
        if(imageInputRef.current) imageInputRef.current.value = "";
        return;
      }
      setSelectedImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreviewUrl(reader.result as string);
      reader.readAsDataURL(file);
    } else { setSelectedImageFile(null); setImagePreviewUrl(null); }
  };

  const handleAnalyzeImageAndLoadData = async () => {
    if (!selectedImageFile || !imagePreviewUrl) { alert("Por favor, seleccione una imagen."); return; }
    setIsAnalyzingImage(true);
    try {
      const base64Data = imagePreviewUrl.split(',')[1];
      const extractedData = await geminiService.extractFinancialDataFromImage(base64Data);
      if (extractedData) {
        const historicalMonthKeyToUpdate = `${historicalYearForImport}-${String(historicalMonthForImport + 1).padStart(2, '0')}`;
        
        const newManualExpensesFromImage = extractedData.expenses?.map(e => ({...e, id: `img-exp-${Date.now()}-${Math.random().toString(36).substr(2,5)}`, isAutomatic: false, category: 'manual' as 'manual'})) || [];
        
        const incomesFromImage: ReportIncomeItem[] = [];
        const paqLocalExtracted = extractedData.incomes?.find(i => i.source === "PAQUETERIA LOCAL")?.amount;
        const ganCourrierExtracted = extractedData.incomes?.find(i => i.source === "GANANCIA PAQUETERIA COURRIER")?.amount;

        if (typeof paqLocalExtracted === 'number') incomesFromImage.push({id: `img-inc-local-${Date.now()}`, source: "PAQUETERIA LOCAL", amount: paqLocalExtracted});
        if (typeof ganCourrierExtracted === 'number') incomesFromImage.push({id: `img-inc-cour-${Date.now()}`, source: "GANANCIA PAQUETERIA COURRIER", amount: ganCourrierExtracted});

        const existingEntryForImportMonth = manualReportEntries[historicalMonthKeyToUpdate] || { expenses: [], incomes: [] };
        
        addOrUpdateManualReportEntry(historicalMonthKeyToUpdate, { 
            ...existingEntryForImportMonth,
            expenses: newManualExpensesFromImage,
            incomes: incomesFromImage,
        });

        setSelectedMonth(historicalMonthForImport); 
        setSelectedYear(historicalYearForImport);

        alert(`Datos del reporte de ${monthNames[historicalMonthForImport]} ${historicalYearForImport} cargados. Revise y guarde si es necesario.`);
        setSelectedImageFile(null); setImagePreviewUrl(null);
        if(imageInputRef.current) imageInputRef.current.value = "";
      } else alert("No se pudieron extraer datos de la imagen.");
    } catch (error) { console.error("Error analyzing image:", error); alert("Error al analizar imagen."); }
    finally { setIsAnalyzingImage(false); }
  };

  const generateReportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let yPos = 20;
    const lineSpacing = 6;
    const sectionSpacing = 10;
    const subSectionSpacing = 8;

    const checkAndAddPage = (requiredHeight: number) => {
        if (yPos + requiredHeight > pageHeight - margin - 10) {
            doc.addPage();
            yPos = margin;
        }
    };

    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text(`REPORTE DE ${monthNames[selectedMonth].toUpperCase()} ${selectedYear}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;
    doc.setFontSize(15);
    doc.setFont(undefined, 'normal');
    doc.text(`${REPORT_OPERATIONAL_NAME.toUpperCase()} REPORT`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 3;
    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += sectionSpacing;

    doc.setFontSize(13);
    doc.setFont(undefined, 'bold');
    doc.text("GASTOS (DÉBITOS)", margin, yPos);
    yPos += 4;
    doc.setLineWidth(0.2);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += lineSpacing;

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    allExpenses.forEach(item => {
      checkAndAddPage(lineSpacing);
      doc.text(item.remark, margin + 2, yPos, {maxWidth: pageWidth - margin * 2 - 50});
      doc.text(item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), pageWidth - margin, yPos, { align: 'right' });
      yPos += lineSpacing;
    });
    yPos += 2; 
    doc.setLineWidth(0.2);
    doc.line(margin, yPos - 2, pageWidth - margin, yPos - 2);
    yPos += lineSpacing;
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text("TOTAL GENERAL GASTOS", margin, yPos);
    doc.text(`DOP ${totalGeneralGastos.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth - margin, yPos, { align: 'right' });
    yPos += sectionSpacing;

    // INCOMES
    checkAndAddPage(sectionSpacing + lineSpacing * 4);
    doc.setFontSize(13);
    doc.setFont(undefined, 'bold');
    doc.text("INGRESOS (CRÉDITOS)", margin, yPos);
    yPos += 4;
    doc.setLineWidth(0.2);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += lineSpacing;

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text("PAQUETERIA LOCAL", margin + 2, yPos);
    doc.text(numIncomePaqueteriaLocal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), pageWidth - margin, yPos, { align: 'right' });
    yPos += lineSpacing;
    doc.text("GANANCIA PAQUETERIA COURRIER", margin + 2, yPos);
    doc.text(numIncomeGananciaCourrier.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), pageWidth - margin, yPos, { align: 'right' });
    yPos += lineSpacing;
    
    yPos += 2;
    doc.setLineWidth(0.2);
    doc.line(margin, yPos - 2, pageWidth - margin, yPos - 2);
    yPos += lineSpacing;

    const totalIngresos = numIncomePaqueteriaLocal + numIncomeGananciaCourrier;
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text("TOTAL GENERAL INGRESOS", margin, yPos);
    doc.text(`DOP ${totalIngresos.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth - margin, yPos, { align: 'right' });
    yPos += sectionSpacing;
    
    // GANANCIAS
    checkAndAddPage(sectionSpacing + lineSpacing * 2);
    doc.setFontSize(13);
    doc.setFont(undefined, 'bold');
    doc.text("TOTAL A TRANSFERIR (GANANCIAS)", margin, yPos);
    yPos += 4;
    doc.setLineWidth(0.2);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += lineSpacing;

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text("Total Ganancias", margin + 2, yPos);
    doc.text(totalDeGanancias.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), pageWidth - margin, yPos, { align: 'right' });
    yPos += sectionSpacing;

    // DISTRIBUCIÓN DE GANANCIAS
    checkAndAddPage(sectionSpacing + lineSpacing * 3);
    doc.setFontSize(13);
    doc.setFont(undefined, 'bold');
    doc.text("DISTRIBUCIÓN DE GANANCIAS", margin, yPos);
    yPos += 4;
    doc.setLineWidth(0.2);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += lineSpacing;

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`${PARTNER_ACC_MULTISERVICES_NAME} (${(PARTNER_ACC_MULTISERVICES_SHARE * 100).toFixed(0)}%)`, margin + 2, yPos);
    doc.text(shareAccMultiservices.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), pageWidth - margin, yPos, { align: 'right' });
    yPos += lineSpacing;
    doc.text(`${PARTNER_GRUPO_DENNY_NAME} (${(PARTNER_GRUPO_DENNY_SHARE * 100).toFixed(0)}%)`, margin + 2, yPos);
    doc.text(shareGrupoDenny.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), pageWidth - margin, yPos, { align: 'right' });
    yPos += lineSpacing;
    
    // FOOTER
    const finalPageCount = doc.getNumberOfPages ? doc.getNumberOfPages() : (doc.internal as any).getNumberOfPages();
    for (let i = 1; i <= finalPageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8); doc.setTextColor(100, 100, 100);
        doc.text(`Página ${i} de ${finalPageCount}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
        doc.text(`Generado por Grupo Denny R. Perez EIRL - ${new Date().toLocaleDateString()}`, margin, pageHeight - 7);
    }
    
    doc.save(`Reporte_Mensual_${monthNames[selectedMonth]}_${selectedYear}.pdf`);
  };

  return (
    <div className="space-y-8">
        <div className="flex justify-between items-center flex-wrap gap-4">
            <h1 className="text-4xl font-bold text-gray-800 flex items-center">
                <IconChartBar className="w-10 h-10 mr-3 text-blue-600" />
                Reporte Mensual GDP
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
                    onClick={generateReportPDF}
                    className="bg-teal-500 text-white px-6 py-3 rounded-lg hover:bg-teal-600 transition-colors shadow-md hover:shadow-lg flex items-center"
                >
                    <IconPrint className="w-5 h-5 mr-2" /> Generar Reporte PDF
                </button>
            </div>
        </div>

        <div className="p-4 bg-white shadow-lg rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-700 mb-3 border-b pb-2">Seleccionar Período del Reporte</h3>
            <div className="flex items-center space-x-3">
                <IconCalendar className="w-5 h-5 text-gray-500" />
                <div>
                    <label htmlFor="report-month" className="block text-sm font-medium text-gray-600">Mes:</label>
                    <select id="report-month" value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))} className="mt-1 px-3 py-2 w-full border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                        {monthNames.map((name, index) => <option key={index} value={index}>{name}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="report-year" className="block text-sm font-medium text-gray-600">Año:</label>
                    <select id="report-year" value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} className="mt-1 px-3 py-2 w-full border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                        {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
                    </select>
                </div>
            </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-6 bg-white shadow-xl rounded-lg border border-gray-200">
                <h2 className="text-xl font-semibold text-gray-800 mb-3">Ingresos (Créditos)</h2>
                <div className="space-y-3">
                    <div>
                        <label htmlFor="income-paqueteria-local" className="block text-sm font-medium text-gray-700">Paqueteria Local (DOP)</label>
                        <input type="number" id="income-paqueteria-local" value={incomePaqueteriaLocal} onChange={e => handleIncomeChange(setIncomePaqueteriaLocal, e.target.value)} placeholder="0.00" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"/>
                    </div>
                    <div>
                        <label htmlFor="income-ganancia-courrier" className="block text-sm font-medium text-gray-700">Ganancia Paqueteria Courrier (DOP)</label>
                        <input type="number" id="income-ganancia-courrier" value={incomeGananciaCourrier} onChange={e => handleIncomeChange(setIncomeGananciaCourrier, e.target.value)} placeholder="0.00" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"/>
                    </div>
                </div>
            </div>
            
            <div className="p-6 bg-white shadow-xl rounded-lg border border-gray-200">
                <h2 className="text-xl font-semibold text-gray-800 mb-3">Gastos (Débitos)</h2>
                <div className="space-y-2">
                    {automaticExpenses.map(item => (
                         <div key={item.id} className="flex justify-between p-2 bg-gray-100 rounded">
                            <span className="text-sm font-medium text-gray-600">{item.remark} (Automático)</span>
                            <span className="text-sm font-semibold text-gray-800">DOP {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                    ))}
                </div>
                <div className="max-h-40 overflow-y-auto my-2 border-t border-b">
                     {currentManualExpenses.length > 0 ? (
                        currentManualExpenses.map(item => (
                             <div key={item.id} className="flex justify-between items-center p-2 border-b last:border-b-0">
                                <span className="text-sm text-gray-700">{item.remark}</span>
                                <div className="flex items-center">
                                    <span className="text-sm font-medium text-red-600 mr-3">DOP {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    <button onClick={() => handleDeleteManualExpense(item.id)} className="text-red-500 hover:text-red-700"><IconTrash className="w-4 h-4"/></button>
                                </div>
                            </div>
                        ))
                     ) : <p className="text-sm text-gray-500 text-center py-3">No hay gastos manuales.</p>}
                </div>
                <div className="flex items-end space-x-2 p-3 border border-blue-200 rounded-md bg-blue-50">
                    <div className="flex-grow">
                        <label htmlFor="new-expense-remark" className="block text-xs font-medium text-gray-600">Nuevo Gasto (Descripción):</label>
                        <input type="text" id="new-expense-remark" value={newExpenseRemark} onChange={e => setNewExpenseRemark(e.target.value)} placeholder="Ej: Impuestos, Luz" className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm sm:text-sm"/>
                    </div>
                    <div className="w-32">
                        <label htmlFor="new-expense-amount" className="block text-xs font-medium text-gray-600">Monto (DOP):</label>
                        <input type="number" id="new-expense-amount" value={newExpenseAmount} onChange={e => setNewExpenseAmount(e.target.value === '' ? '' : parseFloat(e.target.value))} placeholder="0.00" className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm sm:text-sm"/>
                    </div>
                    <button onClick={handleAddManualExpense} className="bg-blue-500 text-white px-3 py-1.5 rounded-md hover:bg-blue-600 text-sm whitespace-nowrap self-end">Agregar</button>
                </div>
            </div>
        </div>

        <div className="p-6 bg-white shadow-xl rounded-lg border-2 border-green-300">
            <h2 className="text-2xl font-semibold text-green-700 mb-4 border-b-2 border-green-200 pb-2">Resumen Financiero y Distribución</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-center">
                <div className="p-4 bg-green-50 rounded-lg"><h3 className="text-sm font-medium text-green-800">Total Ingresos</h3><p className="text-2xl font-bold text-green-700">DOP { (numIncomePaqueteriaLocal + numIncomeGananciaCourrier).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>
                <div className="p-4 bg-red-50 rounded-lg"><h3 className="text-sm font-medium text-red-800">Total Gastos</h3><p className="text-2xl font-bold text-red-600">DOP {totalGeneralGastos.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>
                <div className={`p-4 rounded-lg lg:col-span-2 ${totalDeGanancias >= 0 ? 'bg-blue-100' : 'bg-orange-100'}`}>
                    <h3 className={`text-sm font-medium ${totalDeGanancias >= 0 ? 'text-blue-800' : 'text-orange-800'}`}>Total a Transferir (Ganancias)</h3>
                    <p className={`text-2xl font-bold ${totalDeGanancias >= 0 ? 'text-blue-700' : 'text-orange-600'}`}>DOP {totalDeGanancias.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
            </div>
             <div className="mt-6 p-4 border-t-2 border-green-200">
                 <h3 className="text-lg font-semibold text-gray-700 mb-3">Distribución de Ganancias:</h3>
                 <div className="space-y-2 text-md">
                     <div className="flex justify-between p-2 bg-indigo-50 rounded"><span className="text-gray-600 font-medium">{PARTNER_ACC_MULTISERVICES_NAME} ({(PARTNER_ACC_MULTISERVICES_SHARE * 100).toFixed(0)}%):</span><span className="font-bold text-indigo-600">DOP {shareAccMultiservices.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                     <div className="flex justify-between p-2 bg-purple-50 rounded"><span className="text-gray-600 font-medium">{PARTNER_GRUPO_DENNY_NAME} ({(PARTNER_GRUPO_DENNY_SHARE * 100).toFixed(0)}%):</span><span className="font-bold text-purple-600">DOP {shareGrupoDenny.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                 </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-6 bg-white shadow-xl rounded-lg border border-gray-200">
                <h2 className="text-xl font-semibold text-gray-800 mb-3 flex items-center"><IconImage className="w-6 h-6 mr-2 text-purple-600"/> Importar Datos de Imagen</h2>
                <div className="p-4 border border-purple-200 rounded-lg bg-purple-50 space-y-3">
                    <p className="text-xs text-gray-600">Sube una imagen de un reporte pasado para cargar automáticamente los datos de gastos e ingresos. Esto sobreescribirá los datos manuales del período seleccionado.</p>
                     <div className="flex items-center space-x-3">
                         <label htmlFor="import-month" className="text-sm font-medium text-gray-700">Período a Cargar:</label>
                         <select id="import-month" value={historicalMonthForImport} onChange={e => setHistoricalMonthForImport(parseInt(e.target.value))} className="px-2 py-1 border border-gray-300 rounded-md shadow-sm text-sm">{monthNames.map((name, index) => <option key={index} value={index}>{name}</option>)}</select>
                         <select id="import-year" value={historicalYearForImport} onChange={e => setHistoricalYearForImport(parseInt(e.target.value))} className="px-2 py-1 border border-gray-300 rounded-md shadow-sm text-sm">{availableYears.map(year => <option key={year} value={year}>{year}</option>)}</select>
                    </div>
                    <input type="file" accept="image/*" onChange={handleImageFileChange} ref={imageInputRef} className="text-sm text-gray-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-purple-100 file:text-purple-700 hover:file:bg-purple-200"/>
                    {imagePreviewUrl && <img src={imagePreviewUrl} alt="Vista previa de importación" className="mt-2 max-h-40 rounded-md shadow-md"/>}
                    <button onClick={handleAnalyzeImageAndLoadData} disabled={isAnalyzingImage || !selectedImageFile} className="w-full bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:bg-purple-300 flex items-center justify-center">
                        {isAnalyzingImage ? <LoadingSpinner size="sm" className="mr-2"/> : <IconUpload className="w-5 h-5 mr-2"/>}
                        {isAnalyzingImage ? 'Analizando...' : 'Analizar y Cargar Datos'}
                    </button>
                </div>
            </div>
            
            <div className="p-6 bg-white shadow-xl rounded-lg border border-gray-200">
                <h2 className="text-xl font-semibold text-gray-800 mb-3">Libras Manejadas ({selectedYear})</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 max-h-80 overflow-y-auto">
                    {monthNames.map(month => (
                        <div key={month}>
                            <label htmlFor={`pounds-${month}`} className="block text-sm font-medium text-gray-700">{month}</label>
                            <input type="number" id={`pounds-${month}`} value={editableHistoricalPounds[month]} onChange={e => handleHistoricalPoundChange(month, e.target.value)} placeholder="0" className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm sm:text-sm"/>
                        </div>
                    ))}
                </div>
            </div>
        </div>
        
        <div className="p-6 bg-white shadow-xl rounded-lg border border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Historial de Ganancias</h2>
            {historicalSummaries.length > 0 ? (
                 <BarChart 
                    data={historicalSummaries.slice(0, 12).reverse().map(s => ({label: s.period.split(' ')[0], value: s.profit, color: s.profit >= 0 ? '#22c55e' : '#ef4444' }))}
                    title={`Resumen de Ganancias de los Últimos Meses`}
                    yAxisLabel="Ganancia (DOP)"
                    height={400}
                    width={1000}
                    year={selectedYear} // Just passing a year, chart logic is generic
                />
            ) : <p className="text-center text-gray-500 py-4">No hay suficientes datos históricos para mostrar el gráfico.</p>}
        </div>
    </div>
  );
};
