import React, { useState, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
import { Subagent, SubagentPaymentModel, ConduceDocument, SubagentMonthlyPayment, ExtractedConduce } from '../types';
import { IconTruck, IconUsers, IconFileText, IconTrash, IconPrint, IconCalendar, IconUpload, IconCheckCircle, IconEye, IconCash, IconSparkles } from '../constants';
import { Modal } from './common/Modal';
import { LoadingSpinner } from './common/LoadingSpinner';
import { geminiService } from '../services/geminiService';

interface SubagentsViewProps {
  subagents: Subagent[];
  addSubagent: (subagent: Omit<Subagent, 'id'>) => void;
  updateSubagent: (subagent: Subagent) => void;
  conduceDocuments: ConduceDocument[];
  addConduceDocument: (docData: Omit<ConduceDocument, 'id' | 'calculatedPayment' | 'isPaid'>, subagentRate: number) => void;
  deleteConduceDocument: (docId: string) => void;
  updateConduceDocumentStatus: (docIds: string[], isPaid: boolean, paymentRunId?: string) => void;
  subagentMonthlyPayments: SubagentMonthlyPayment[];
  addSubagentMonthlyPayment: (payment: SubagentMonthlyPayment) => void;
  deleteSubagentMonthlyPayment: (paymentId: string) => void;
}

const initialSubagentFormState: Omit<Subagent, 'id'> = {
  code: '',
  name: '',
  paymentModel: SubagentPaymentModel.PER_CONDUCE_DOCUMENT,
  ratePerPound: 0,
  locationOrNotes: '',
};

const initialConduceFormState: Omit<ConduceDocument, 'id' | 'subagentId' | 'calculatedPayment' | 'isPaid' | 'paymentRunId'> = {
  conduceIdentifier: '',
  date: new Date().toISOString().split('T')[0],
  paymentType: 'calculated',
  totalWeightPounds: 0, 
  directPaymentAmount: undefined,
  notes: '',
  numberOfPackages: 0,
  declaredValue: 0,
};

const initialMonthlyAggregatePaymentFormState = {
    totalWeightForMonth: 0,
};

const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

// Helper function for parsing dates from imported reports
const monthMap: { [key: string]: number } = {
    'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'may': 4, 'jun': 5,
    'jul': 6, 'ago': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11,
    'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5,
    'julio': 6, 'agosto': 7, 'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
};

const parseDateFromString = (dateString: string, contextYear: number): string => {
    // Try YYYY-MM-DD format first
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        const d = new Date(dateString);
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }

    const parts = dateString.replace(/[.\s]/g, '-').toLowerCase().split('-');
    
    // Try DD-MON-YYYY or DD-MON-YY format
    if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const monthStr = parts[1].substring(0, 3);
        const yearPart = parts[2];
        const month = monthMap[monthStr];
        let year = parseInt(yearPart, 10);
        
        if (!isNaN(day) && month !== undefined && !isNaN(year)) {
            const fullYear = yearPart.length === 2 ? 2000 + year : year;
            const parsedDate = new Date(fullYear, month, day);
            if (parsedDate.getFullYear() === fullYear && parsedDate.getMonth() === month && parsedDate.getDate() === day) {
                return parsedDate.toISOString().split('T')[0];
            }
        }
    } 
    // Try DD-MON format (using context year)
    else if (parts.length === 2) {
        const day = parseInt(parts[0], 10);
        const monthStr = parts[1].substring(0, 3);
        const month = monthMap[monthStr];
        if (!isNaN(day) && month !== undefined) {
            const parsedDate = new Date(contextYear, month, day);
            if (parsedDate.getFullYear() === contextYear && parsedDate.getMonth() === month && parsedDate.getDate() === day) {
                return parsedDate.toISOString().split('T')[0];
            }
        }
    }
    
    console.warn(`Could not parse date "${dateString}", defaulting to today's date.`);
    return new Date().toISOString().split('T')[0];
};


export const SubagentsView: React.FC<SubagentsViewProps> = ({ 
    subagents, addSubagent, updateSubagent, 
    conduceDocuments, addConduceDocument, deleteConduceDocument, updateConduceDocumentStatus,
    subagentMonthlyPayments, addSubagentMonthlyPayment, deleteSubagentMonthlyPayment,
}) => {
  const [isSubagentModalOpen, setIsSubagentModalOpen] = useState(false);
  const [isConduceModalOpen, setIsConduceModalOpen] = useState(false);
  const [isConfirmPaymentModalOpen, setIsConfirmPaymentModalOpen] = useState(false);
  const [isMonthlyAggregatePaymentModalOpen, setIsMonthlyAggregatePaymentModalOpen] = useState(false);
  const [isVoucherPreviewModalOpen, setIsVoucherPreviewModalOpen] = useState(false);

  const [isEditingSubagent, setIsEditingSubagent] = useState(false);
  const [currentSubagentForm, setCurrentSubagentForm] = useState<Omit<Subagent, 'id'> | Subagent>(initialSubagentFormState);
  
  const [selectedSubagent, setSelectedSubagent] = useState<Subagent | null>(null);
  
  const [conduceFormData, setConduceFormData] = useState(initialConduceFormState);
  const [monthlyAggregatePaymentFormData, setMonthlyAggregatePaymentFormData] = useState(initialMonthlyAggregatePaymentFormState);
  
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const [selectedVoucherFile, setSelectedVoucherFile] = useState<File | null>(null);
  const [voucherPreviewUrl, setVoucherPreviewUrl] = useState<string | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [currentVoucherToPreview, setCurrentVoucherToPreview] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State for AI file import
  const [fileForImport, setFileForImport] = useState<File | null>(null);
  const [fileForImportPreview, setFileForImportPreview] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const displayCalculatedPaymentForForm = (): number => {
    if (!selectedSubagent) return 0;
    if (conduceFormData.paymentType === 'direct') {
      return conduceFormData.directPaymentAmount || 0;
    }
    return (conduceFormData.totalWeightPounds || 0) * selectedSubagent.ratePerPound;
  };


  useEffect(() => {
    if (selectedVoucherFile) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setVoucherPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(selectedVoucherFile);
    } else {
      setVoucherPreviewUrl(null);
    }
  }, [selectedVoucherFile]);

  useEffect(() => {
    if (fileForImport) {
        if (fileForImport.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFileForImportPreview(reader.result as string);
            };
            reader.readAsDataURL(fileForImport);
        } else {
            setFileForImportPreview(null); // No preview for non-image files like PDFs
        }
    } else {
        setFileForImportPreview(null);
    }
  }, [fileForImport]);
  

  const openAddSubagentModal = () => {
    setIsEditingSubagent(false);
    setCurrentSubagentForm(initialSubagentFormState);
    setIsSubagentModalOpen(true);
  };
  const openEditSubagentModal = (subagent: Subagent) => {
    setIsEditingSubagent(true);
    setCurrentSubagentForm(subagent);
    setIsSubagentModalOpen(true);
  };
  const closeSubagentModal = () => {
    setIsSubagentModalOpen(false);
    setIsEditingSubagent(false);
    setCurrentSubagentForm(initialSubagentFormState);
};
  const handleSubagentFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCurrentSubagentForm(prev => ({ ...prev, [name]: name === 'ratePerPound' ? parseFloat(value) || 0 : value }));
  };
  const handleSubagentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditingSubagent && 'id' in currentSubagentForm) {
      updateSubagent(currentSubagentForm as Subagent);
    } else {
      addSubagent(currentSubagentForm as Omit<Subagent, 'id'>);
    }
    closeSubagentModal();
  };
  
  const openConduceManagementModal = (subagent: Subagent) => {
    setSelectedSubagent(subagent);
    setConduceFormData(initialConduceFormState);
    setSelectedMonth(new Date().getMonth());
    setSelectedYear(new Date().getFullYear());
    setFileForImport(null);
    setIsConduceModalOpen(true);
  };
  const closeConduceManagementModal = () => {
    setIsConduceModalOpen(false);
    setSelectedSubagent(null);
  };
  const handleConduceFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    let parsedValue: string | number | undefined = value;
    if (name === 'totalWeightPounds' || name === 'directPaymentAmount' || name === 'numberOfPackages' || name === 'declaredValue') {
        parsedValue = value === '' ? undefined : parseFloat(value);
    }

    setConduceFormData(prev => {
        const newState = { ...prev, [name]: parsedValue };
        if (name === 'paymentType') {
            if (value === 'calculated') {
                newState.directPaymentAmount = undefined;
            }
        }
        return newState;
    });
  };
  const handleAddConduceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubagent) return;
    if (conduceFormData.paymentType === 'direct' && (conduceFormData.directPaymentAmount === undefined || conduceFormData.directPaymentAmount <=0)) {
        alert("Si el tipo de monto es 'Directo', debe ingresar un monto válido y mayor a cero.");
        return;
    }
    if (conduceFormData.paymentType === 'calculated' && (!conduceFormData.totalWeightPounds || conduceFormData.totalWeightPounds <=0)) {
        alert("Si el tipo de monto es 'Calculado', debe ingresar un peso válido y mayor a cero.");
        return;
    }

    const dataToPass = {
        ...conduceFormData,
        subagentId: selectedSubagent.id,
        totalWeightPounds: conduceFormData.paymentType === 'calculated' ? (conduceFormData.totalWeightPounds || 0) : (conduceFormData.totalWeightPounds || undefined),
    };

    addConduceDocument(dataToPass, selectedSubagent.ratePerPound);
    setConduceFormData(initialConduceFormState);
  };
  const handleDeleteConduce = (docId: string) => {
    if (window.confirm("¿Está seguro de que desea eliminar este conduce pendiente?")) {
        deleteConduceDocument(docId);
    }
  };

  const handleFileForImportChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
       if (file.size > 4 * 1024 * 1024) { // 4MB limit for Gemini
        alert("El archivo es demasiado grande. Por favor, suba un archivo (imagen o PDF) de menos de 4MB.");
        if(importInputRef.current) importInputRef.current.value = "";
        setFileForImport(null);
        return;
      }
      setFileForImport(file);
    } else {
      setFileForImport(null);
    }
  };

  const handleImportFromFile = async () => {
    if (!fileForImport || !selectedSubagent) return;
    setIsImporting(true);
    
    try {
        const reader = new FileReader();
        reader.readAsDataURL(fileForImport);
        reader.onload = async (event) => {
            const base64Data = (event.target?.result as string).split(',')[1];
            if (!base64Data) {
                alert("No se pudo leer el archivo.");
                setIsImporting(false);
                return;
            }

            try {
                const extractedDocs: ExtractedConduce[] = await geminiService.extractSubagentConducesFromFile(base64Data, fileForImport.type);

                if (extractedDocs.length === 0) {
                    alert("La IA no pudo extraer conduces válidos del archivo. Intente con un archivo más claro o ingréselos manualmente.");
                    setIsImporting(false);
                    return;
                }

                let conducesAddedCount = 0;
                let firstValidDate: Date | null = null;
                const contextYear = parseInt(`${selectedYear}`, 10);

                for (const doc of extractedDocs) {
                    if (doc.fecha && typeof doc.peso === 'number' && doc.peso > 0) {
                        const parsedDateStr = parseDateFromString(doc.fecha.toString(), contextYear);
                        
                        if (!firstValidDate) {
                             const parts = parsedDateStr.split('-').map(Number);
                             firstValidDate = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
                        }

                        const docData = {
                            subagentId: selectedSubagent.id,
                            conduceIdentifier: `Importado: ${doc.fecha}`,
                            date: parsedDateStr,
                            paymentType: 'calculated' as const,
                            totalWeightPounds: doc.peso,
                            numberOfPackages: doc.paquetes,
                            declaredValue: doc.monto,
                            notes: `Importado de ${fileForImport.name}`,
                        };
                        addConduceDocument(docData, selectedSubagent.ratePerPound);
                        conducesAddedCount++;
                    }
                }
                
                if (conducesAddedCount > 0 && firstValidDate) {
                    const navYear = firstValidDate.getUTCFullYear();
                    const navMonth = firstValidDate.getUTCMonth();
                    setSelectedYear(navYear);
                    setSelectedMonth(navMonth);
                    alert(`${conducesAddedCount} conduces agregados. Navegando al reporte de ${monthNames[navMonth]} ${navYear}.`);
                } else {
                    alert("No se encontraron conduces válidos para agregar.");
                }

                if (importInputRef.current) importInputRef.current.value = "";
                setFileForImport(null);

            } catch (aiError) {
                 console.error("Error importing from file via AI:", aiError);
                 alert(`Ocurrió un error al procesar el archivo: ${(aiError as Error).message}`);
            } finally {
                setIsImporting(false);
            }
        };
        reader.onerror = (error) => {
            console.error("Error reading file:", error);
            alert("Ocurrió un error al leer el archivo.");
            setIsImporting(false);
        };

    } catch (error) {
        console.error("General error in import process:", error);
        alert("Ocurrió un error inesperado durante la importación.");
        setIsImporting(false);
    }
  };


  const getExistingPaymentForMonth = (subagentId: string, year: number, month: number): SubagentMonthlyPayment | undefined => {
    const monthYearString = `${year}-${String(month + 1).padStart(2, '0')}`;
    return subagentMonthlyPayments.find(p => p.subagentId === subagentId && p.monthYear === monthYearString);
  };
  
  const existingPaymentForConduceModal = selectedSubagent ? getExistingPaymentForMonth(selectedSubagent.id, selectedYear, selectedMonth) : undefined;

  const filteredConduces = selectedSubagent ? conduceDocuments.filter(doc => {
      if (!doc.date || typeof doc.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(doc.date)) {
        return false;
      }
      const [year, month] = doc.date.split('-').map(Number);
      
      const yearMatches = year === selectedYear;
      const monthMatches = selectedMonth === -1 || (month - 1) === selectedMonth;

      return doc.subagentId === selectedSubagent.id && yearMatches && monthMatches;
  }) : [];

  const unpaidConducesForSelectedMonth = filteredConduces.filter(doc => !doc.isPaid);
  const totalPendingForConduceMonth = unpaidConducesForSelectedMonth.reduce((sum, doc) => sum + doc.calculatedPayment, 0);

  const openConfirmPaymentModal = () => {
    if (totalPendingForConduceMonth > 0) {
      setIsConfirmPaymentModalOpen(true);
    } else {
      alert("No hay conduces pendientes de pago para este mes.");
    }
  };
  const closeConfirmPaymentModal = () => {
    setIsConfirmPaymentModalOpen(false);
    setSelectedVoucherFile(null);
    setVoucherPreviewUrl(null);
    if(fileInputRef.current) fileInputRef.current.value = "";
  };
  
  const handleVoucherFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (file.size > 2 * 1024 * 1024) {
        alert("El archivo es demasiado grande. Por favor, suba una imagen de menos de 2MB.");
        setSelectedVoucherFile(null);
        if(fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      setSelectedVoucherFile(file);
    } else {
      setSelectedVoucherFile(null);
    }
  };

  const handleConfirmAndPayPerConduce = async () => {
    if (!selectedSubagent || unpaidConducesForSelectedMonth.length === 0) return;
    setProcessingPayment(true);

    const paymentId = `smp-cd-${Date.now()}`;
    const conduceIdsToPay = unpaidConducesForSelectedMonth.map(doc => doc.id);

    const newPayment: SubagentMonthlyPayment = {
      id: paymentId,
      subagentId: selectedSubagent.id,
      monthYear: `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`,
      totalAmountPaid: totalPendingForConduceMonth,
      conduceDocIdsIncluded: conduceIdsToPay,
      processingDate: new Date().toISOString(),
      paymentVoucherImage: voucherPreviewUrl || undefined,
      voucherFileName: selectedVoucherFile?.name || undefined,
    };

    addSubagentMonthlyPayment(newPayment);
    updateConduceDocumentStatus(conduceIdsToPay, true, paymentId);
    
    await new Promise(resolve => setTimeout(resolve, 1000));

    setProcessingPayment(false);
    closeConfirmPaymentModal();
    alert(`Pago de DOP ${totalPendingForConduceMonth.toFixed(2)} para ${selectedSubagent.name} (${monthNames[selectedMonth]} ${selectedYear}) registrado exitosamente.`);
  };

  const openMonthlyAggregatePaymentModal = (subagent: Subagent) => {
    setSelectedSubagent(subagent);
    setMonthlyAggregatePaymentFormData(initialMonthlyAggregatePaymentFormState);
    setSelectedMonth(new Date().getMonth());
    setSelectedYear(new Date().getFullYear());
    setSelectedVoucherFile(null);
    setVoucherPreviewUrl(null);
    setIsMonthlyAggregatePaymentModalOpen(true);
  };
  const closeMonthlyAggregatePaymentModal = () => {
    setIsMonthlyAggregatePaymentModalOpen(false);
    setSelectedSubagent(null);
    setSelectedVoucherFile(null);
    setVoucherPreviewUrl(null);
    if(fileInputRef.current) fileInputRef.current.value = "";
  };
  const handleMonthlyAggregateFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setMonthlyAggregatePaymentFormData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
  };

  const existingPaymentForMonthlyAggregateModal = selectedSubagent ? getExistingPaymentForMonth(selectedSubagent.id, selectedYear, selectedMonth) : undefined;
  const calculatedMonthlyAggregatePayment = selectedSubagent ? monthlyAggregatePaymentFormData.totalWeightForMonth * selectedSubagent.ratePerPound : 0;

  const handleRegisterMonthlyAggregatePayment = async () => {
    if (!selectedSubagent || monthlyAggregatePaymentFormData.totalWeightForMonth <= 0) {
        alert("Por favor, ingrese un peso total válido.");
        return;
    }
    setProcessingPayment(true);

    const paymentId = `smp-agg-${Date.now()}`;
    const newPayment: SubagentMonthlyPayment = {
      id: paymentId,
      subagentId: selectedSubagent.id,
      monthYear: `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`,
      totalAmountPaid: calculatedMonthlyAggregatePayment,
      totalWeightForMonth: monthlyAggregatePaymentFormData.totalWeightForMonth,
      processingDate: new Date().toISOString(),
      paymentVoucherImage: voucherPreviewUrl || undefined,
      voucherFileName: selectedVoucherFile?.name || undefined,
    };

    addSubagentMonthlyPayment(newPayment);
    
    await new Promise(resolve => setTimeout(resolve, 1000));

    setProcessingPayment(false);
    closeMonthlyAggregatePaymentModal();
    alert(`Pago mensual agregado de DOP ${calculatedMonthlyAggregatePayment.toFixed(2)} para ${selectedSubagent.name} (${monthNames[selectedMonth]} ${selectedYear}) registrado exitosamente.`);
  };


  const handlePrintSubagentReport = (subagent: Subagent, currentMonth: number, currentYear: number) => {
    const paymentForReportMonth = getExistingPaymentForMonth(subagent.id, currentYear, currentMonth);
    const isPaidReport = !!paymentForReportMonth;
    const reportDate = new Date();
    let reportTitle = "";
    let conducesForReport: ConduceDocument[] = [];
    let totalPaidForReport = 0;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let yPos = 20;

    if (subagent.paymentModel === SubagentPaymentModel.PER_CONDUCE_DOCUMENT) {
        reportTitle = isPaidReport ? "Comprobante de Pago - Conduces" : "Estado de Cuenta - Conduces Pendientes";
        conducesForReport = paymentForReportMonth
            ? conduceDocuments.filter(c => c.paymentRunId === paymentForReportMonth.id)
            : unpaidConducesForSelectedMonth;
        totalPaidForReport = paymentForReportMonth?.totalAmountPaid || conducesForReport.reduce((sum, doc) => sum + doc.calculatedPayment, 0);

        if (conducesForReport.length === 0 && !paymentForReportMonth) {
            alert("No hay conduces para generar el reporte para este subagente y período.");
            return;
        }
    } else if (subagent.paymentModel === SubagentPaymentModel.MONTHLY_AGGREGATE_WEIGHT) {
        reportTitle = isPaidReport ? "Comprobante de Pago - Mensual Agregado" : "Reporte Pendiente - Mensual Agregado";
        if (!paymentForReportMonth) {
             totalPaidForReport = 0; 
        } else {
            totalPaidForReport = paymentForReportMonth.totalAmountPaid;
        }
    }
    
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text(reportTitle, pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text("Grupo Denny R. Perez EIRL", margin, yPos); yPos += 5;
    doc.text("RNC: 133129221", margin, yPos); yPos += 7;

    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    doc.text(`Subagente: ${subagent.name} (${subagent.code})`, margin, yPos);
    yPos += 7;
    doc.text(`Ruta/Zona: ${subagent.locationOrNotes || 'N/A'}`, margin, yPos);
    yPos += 7;
    if (subagent.paymentModel === SubagentPaymentModel.PER_CONDUCE_DOCUMENT || subagent.paymentModel === SubagentPaymentModel.MONTHLY_AGGREGATE_WEIGHT) {
        doc.text(`Tarifa por Libra: DOP ${subagent.ratePerPound.toFixed(2)}`, margin, yPos);
        yPos += 7;
    }
    doc.text(`Período del Reporte: ${monthNames[currentMonth]} ${currentYear}`, margin, yPos);
    yPos += 7;
    doc.text(`Fecha de Emisión: ${reportDate.toLocaleDateString()} ${reportDate.toLocaleTimeString()}`, margin, yPos);
    yPos += 10;

    if (subagent.paymentModel === SubagentPaymentModel.PER_CONDUCE_DOCUMENT) {
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.text(`Detalle de Conduces:`, margin, yPos);
        yPos += 8;
        const tableHeaders = ["Fecha", "ID Conduce", "Peso (lbs)", "Monto (DOP)"];
        const colWidths = [30, 85, 30, 30];
        let xPos = margin;
        
        const tableHeaderY = yPos;
        doc.setFillColor(30, 41, 59); // slate-800
        doc.rect(margin, tableHeaderY - 4, pageWidth - margin * 2, 10, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        xPos = margin + 2;
        tableHeaders.forEach((header, i) => { 
            doc.text(header, xPos, tableHeaderY + 3); 
            xPos += colWidths[i]; 
        });
        yPos += 8;

        doc.setTextColor(0, 0, 0);       
        doc.setFont(undefined, 'normal');
        [...conducesForReport].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).forEach((conduce, index) => {
          const rowHeight = 6;
          const textHeight = doc.getTextDimensions(conduce.conduceIdentifier, {maxWidth: colWidths[1] - 4}).h;
          const effectiveRowHeight = Math.max(rowHeight, textHeight);
          
          if (yPos + effectiveRowHeight > pageHeight - margin - 20) { doc.addPage(); yPos = margin; }
          
           if (index % 2 !== 0) {
            doc.setFillColor(241, 245, 249); // slate-100
            doc.rect(margin, yPos - 4.5, pageWidth - margin * 2, effectiveRowHeight + 1, 'F');
          }

          xPos = margin + 2;
          doc.text(new Date(conduce.date).toLocaleDateString(), xPos, yPos); xPos += colWidths[0];
          doc.text(conduce.conduceIdentifier, xPos, yPos, {maxWidth: colWidths[1]-2}); xPos += colWidths[1];
          doc.text(conduce.paymentType === 'calculated' && conduce.totalWeightPounds ? conduce.totalWeightPounds.toFixed(2) : (conduce.totalWeightPounds ? `${conduce.totalWeightPounds.toFixed(2)} (Info)` : 'N/A'), xPos, yPos); xPos += colWidths[2];
          doc.text(conduce.calculatedPayment.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2}), xPos, yPos);
          yPos += effectiveRowHeight + 2;
        });

        doc.line(margin, yPos, pageWidth - margin, yPos); 
        yPos += 8;
    } else if (subagent.paymentModel === SubagentPaymentModel.MONTHLY_AGGREGATE_WEIGHT && paymentForReportMonth) {
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.text(`Detalle del Pago Mensual Agregado:`, margin, yPos);
        yPos += 8;
        doc.setFont(undefined, 'normal');
        doc.text(`Peso Total Registrado para el Mes: ${paymentForReportMonth.totalWeightForMonth?.toFixed(2) || 'N/A'} lbs`, margin, yPos);
        yPos += 10;
    }


    if (yPos > pageHeight - margin - (paymentForReportMonth?.paymentVoucherImage ? 70 : 20)) { doc.addPage(); yPos = margin; }
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    const totalText = `GRAN TOTAL ${isPaidReport ? 'PAGADO' : 'A PAGAR'}: DOP ${totalPaidForReport.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`;
    doc.text(totalText, pageWidth - margin, yPos, { align: 'right' });
    yPos += 10;
    
    if (isPaidReport && paymentForReportMonth?.paymentVoucherImage) {
      if (yPos > pageHeight - margin - 60) { doc.addPage(); yPos = margin; }
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text("Voucher de Pago Adjunto:", margin, yPos);
      yPos += 5;
      try {
        const imgData = paymentForReportMonth.paymentVoucherImage;
        const imgProps = doc.getImageProperties(imgData);
        const imgWidth = 80;
        const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
        if (yPos + imgHeight > pageHeight - margin) { doc.addPage(); yPos = margin; }
        doc.addImage(imgData, 'JPEG', margin, yPos, imgWidth, imgHeight);
      } catch (e) { console.error("Error adding image to PDF:", e); doc.text("Error al cargar la imagen del voucher.", margin, yPos); }
    } else if (isPaidReport && !paymentForReportMonth?.paymentVoucherImage) {
         doc.setFontSize(10);
         doc.setFont(undefined, 'normal');
         doc.text("Voucher de Pago: No adjuntado.", margin, yPos);
    } else if (!isPaidReport) {
        doc.setFontSize(10);
        doc.setFont(undefined, 'italic');
        doc.text("Este es un estado de cuenta de valores pendientes. No es un comprobante de pago.", margin, yPos);
    }
    doc.save(`Reporte_Pago_${subagent.name.replace(/\s+/g, '_')}_${monthNames[currentMonth]}_${currentYear}${isPaidReport ? '_Pagado' : '_Pendiente'}.pdf`);
  };
  
  const openVoucherPreview = (voucherImage: string) => {
    setCurrentVoucherToPreview(voucherImage);
    setIsVoucherPreviewModalOpen(true);
  };

  const SubagentsTable = (
    <div className="bg-white shadow-xl rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-slate-800">
            <tr>
              {['Código', 'Nombre', 'Modelo de Pago', 'Tarifa/Libra (DOP)', 'Ubicación/Notas', 'Acciones'].map(header => (
                <th key={header} scope="col" className="px-6 py-4 text-left text-sm font-semibold text-white uppercase tracking-wider">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {subagents.map((subagent) => (
              <tr key={subagent.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{subagent.code}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{subagent.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{subagent.paymentModel}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">DOP {subagent.ratePerPound.toFixed(2)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate" title={subagent.locationOrNotes}>{subagent.locationOrNotes || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                  <button onClick={() => openEditSubagentModal(subagent)} className="text-indigo-600 hover:text-indigo-900 transition-colors">
                    Editar
                  </button>
                  {subagent.paymentModel === SubagentPaymentModel.PER_CONDUCE_DOCUMENT && (
                     <button onClick={() => openConduceManagementModal(subagent)} className="text-green-600 hover:text-green-900 transition-colors inline-flex items-center" title="Gestionar Conduces y Pagos">
                       <IconFileText className="w-4 h-4 mr-1"/> Gestionar Conduces
                     </button>
                  )}
                   {subagent.paymentModel === SubagentPaymentModel.MONTHLY_AGGREGATE_WEIGHT && (
                     <button onClick={() => openMonthlyAggregatePaymentModal(subagent)} className="text-blue-600 hover:text-blue-900 transition-colors inline-flex items-center" title="Registrar Pago Mensual Agregado">
                       <IconCash className="w-4 h-4 mr-1"/> Registrar Pago Mensual
                     </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {subagents.length === 0 && <p className="p-4 text-center text-gray-500">No hay subagentes registrados.</p>}
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-4xl font-bold text-gray-800 flex items-center">
          <IconTruck className="w-10 h-10 mr-3 text-blue-600" />
          Gestión de Subagentes
        </h1>
        <button onClick={openAddSubagentModal} className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors shadow-md hover:shadow-lg flex items-center">
          <IconUsers className="w-5 h-5 mr-2" /> Agregar Subagente
        </button>
      </div>

      {SubagentsTable}

      <Modal isOpen={isSubagentModalOpen} onClose={closeSubagentModal} title={isEditingSubagent ? 'Editar Subagente' : 'Agregar Nuevo Subagente'} size="lg">
        <form onSubmit={handleSubagentSubmit} className="space-y-4">
          <div><label htmlFor="sub-code" className="block text-sm font-medium text-gray-700">Código</label><input type="text" name="code" id="sub-code" value={currentSubagentForm.code} onChange={handleSubagentFormChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/></div>
          <div><label htmlFor="sub-name" className="block text-sm font-medium text-gray-700">Nombre Completo</label><input type="text" name="name" id="sub-name" value={currentSubagentForm.name} onChange={handleSubagentFormChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/></div>
          <div><label htmlFor="sub-paymentModel" className="block text-sm font-medium text-gray-700">Modelo de Pago</label><select name="paymentModel" id="sub-paymentModel" value={currentSubagentForm.paymentModel} onChange={handleSubagentFormChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">{Object.values(SubagentPaymentModel).map(model => <option key={model} value={model}>{model}</option>)}</select></div>
          <div><label htmlFor="sub-rate" className="block text-sm font-medium text-gray-700">Tarifa por Libra (DOP)</label><input type="number" step="0.01" name="ratePerPound" id="sub-rate" value={currentSubagentForm.ratePerPound} onChange={handleSubagentFormChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/></div>
          <div><label htmlFor="sub-location" className="block text-sm font-medium text-gray-700">Ubicación / Notas</label><textarea name="locationOrNotes" id="sub-location" value={currentSubagentForm.locationOrNotes || ''} onChange={handleSubagentFormChange} rows={2} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"></textarea></div>
          <div className="flex justify-end space-x-3 pt-2"><button type="button" onClick={closeSubagentModal} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">Cancelar</button><button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">{isEditingSubagent ? 'Guardar Cambios' : 'Agregar Subagente'}</button></div>
        </form>
      </Modal>

      {selectedSubagent && (
        <Modal isOpen={isConduceModalOpen} onClose={closeConduceManagementModal} title={`Gestionar Conduces: ${selectedSubagent.name}`} size="5xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-1 space-y-4">
               <div className="flex items-center space-x-3 bg-gray-100 p-3 rounded-md">
                    <label htmlFor="conduce-month" className="text-sm font-medium text-gray-700">Período:</label>
                    <select id="conduce-month" value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))} className="px-2 py-1 border border-gray-300 rounded-md shadow-sm text-sm"><option value="-1">Todos</option>{monthNames.map((name, index) => <option key={index} value={index}>{name}</option>)}</select>
                    <select id="conduce-year" value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} className="px-2 py-1 border border-gray-300 rounded-md shadow-sm text-sm">{Array.from({length: 5}, (_, i) => new Date().getFullYear() - i).map(year => <option key={year} value={year}>{year}</option>)}</select>
               </div>
               
               {existingPaymentForConduceModal ? (
                    <div className="p-4 border border-green-300 bg-green-50 rounded-lg text-sm text-green-800">
                        <h4 className="font-bold flex items-center"><IconCheckCircle className="w-5 h-5 mr-2"/>¡Pago Registrado para {monthNames[selectedMonth]} {selectedYear}!</h4>
                        <p>Monto Pagado: <strong>DOP {existingPaymentForConduceModal.totalAmountPaid.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</strong></p>
                        <p>Fecha de Pago: {new Date(existingPaymentForConduceModal.processingDate).toLocaleDateString()}</p>
                        <div className="mt-2 space-x-2">
                            <button onClick={() => handlePrintSubagentReport(selectedSubagent, selectedMonth, selectedYear)} className="bg-green-500 text-white px-3 py-1 text-xs rounded hover:bg-green-600 flex items-center"><IconPrint className="w-3 h-3 mr-1"/>Imprimir Comprobante</button>
                            {existingPaymentForConduceModal.paymentVoucherImage && <button onClick={() => openVoucherPreview(existingPaymentForConduceModal.paymentVoucherImage!)} className="bg-blue-500 text-white px-3 py-1 text-xs rounded hover:bg-blue-600 flex items-center"><IconEye className="w-3 h-3 mr-1"/>Ver Voucher</button>}
                            <button onClick={() => deleteSubagentMonthlyPayment(existingPaymentForConduceModal.id)} className="bg-red-500 text-white px-3 py-1 text-xs rounded hover:bg-red-600 flex items-center"><IconTrash className="w-3 h-3 mr-1"/>Anular Pago</button>
                        </div>
                    </div>
               ) : (
                <>
                    <div className="p-4 border border-purple-200 rounded-lg bg-purple-50 space-y-3">
                        <h3 className="text-lg font-semibold text-purple-800 mb-2 flex items-center"><IconSparkles className="w-5 h-5 mr-2 text-purple-600"/>Importar Conduces de Archivo</h3>
                        <p className="text-xs text-gray-600">Sube el reporte del subagente para este mes (imagen o PDF) y la IA agregará los conduces a la lista de pendientes.</p>
                        <input type="file" accept="image/*,application/pdf" onChange={handleFileForImportChange} ref={importInputRef} className="text-sm text-gray-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-purple-100 file:text-purple-700 hover:file:bg-purple-200"/>
                        {fileForImportPreview && <img src={fileForImportPreview} alt="Vista previa de importación" className="mt-2 max-h-40 rounded-md shadow-md"/>}
                        {fileForImport && !fileForImportPreview && <div className="p-3 bg-gray-200 rounded-md text-sm flex items-center"><IconFileText className="w-5 h-5 mr-2"/> {fileForImport.name}</div>}
                        <button onClick={handleImportFromFile} disabled={isImporting || !fileForImport} className="w-full bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:bg-purple-300 flex items-center justify-center">
                            {isImporting ? <LoadingSpinner size="sm" className="mr-2"/> : <IconUpload className="w-5 h-5 mr-2"/>}
                            {isImporting ? 'Importando...' : 'Importar Conduces de Archivo'}
                        </button>
                    </div>

                    <div className="p-4 border border-blue-200 rounded-lg bg-blue-50">
                        <h3 className="text-lg font-semibold text-gray-800 mb-3 text-center">Agregar Nuevo Conduce (Manual)</h3>
                        <form onSubmit={handleAddConduceSubmit} className="space-y-3">
                            <div>
                                <label htmlFor="conduce-date" className="block text-sm font-medium text-gray-700">Fecha</label>
                                <input type="date" id="conduce-date" name="date" value={conduceFormData.date} onChange={handleConduceFormChange} required className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm sm:text-sm"/>
                            </div>
                            <div>
                                <label htmlFor="conduce-identifier" className="block text-sm font-medium text-gray-700">Identificador Conduce</label>
                                <input type="text" id="conduce-identifier" name="conduceIdentifier" value={conduceFormData.conduceIdentifier} onChange={handleConduceFormChange} required placeholder="Ej: #12345, Fecha" className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm sm:text-sm"/>
                            </div>
                            <div>
                                <label htmlFor="conduce-paymentType" className="block text-sm font-medium text-gray-700">Tipo de Monto</label>
                                <select id="conduce-paymentType" name="paymentType" value={conduceFormData.paymentType} onChange={handleConduceFormChange} className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm sm:text-sm">
                                    <option value="calculated">Calculado (por Peso y Tarifa)</option>
                                    <option value="direct">Monto Directo</option>
                                </select>
                            </div>
                            {conduceFormData.paymentType === 'calculated' ? (
                                <div><label htmlFor="conduce-weight" className="block text-sm font-medium text-gray-700">Peso (lbs)</label><input type="number" step="0.01" id="conduce-weight" name="totalWeightPounds" value={conduceFormData.totalWeightPounds || ''} onChange={handleConduceFormChange} className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm sm:text-sm"/></div>
                            ) : (
                                <div><label htmlFor="conduce-directAmount" className="block text-sm font-medium text-gray-700">Monto a Pagar (DOP)</label><input type="number" step="0.01" id="conduce-directAmount" name="directPaymentAmount" value={conduceFormData.directPaymentAmount || ''} onChange={handleConduceFormChange} className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded-md shadow-sm sm:text-sm"/></div>
                            )}
                            <div className="p-2 bg-blue-100 text-center rounded-md text-sm">Monto a Pagar: <span className="font-bold">DOP {displayCalculatedPaymentForForm().toFixed(2)}</span></div>
                            <button type="submit" className="w-full bg-blue-500 text-white py-2 rounded-md hover:bg-blue-600">Agregar Conduce</button>
                        </form>
                    </div>
                </>
               )}
            </div>

            <div className="md:col-span-1 space-y-4">
               <div className="bg-white shadow rounded-lg p-4 border">
                  <h3 className="font-semibold text-lg text-gray-800 mb-2">Conduces Pendientes para {selectedMonth === -1 ? selectedYear : `${monthNames[selectedMonth]} ${selectedYear}`}</h3>
                  <div className="max-h-96 overflow-y-auto border-t">
                     <table className="min-w-full text-sm">
                        <thead className="bg-slate-700 sticky top-0"><tr><th className="px-4 py-2 text-left text-xs font-semibold text-white uppercase tracking-wider">Fecha</th><th className="px-4 py-2 text-left text-xs font-semibold text-white uppercase tracking-wider">ID</th><th className="px-4 py-2 text-right text-xs font-semibold text-white uppercase tracking-wider">Monto (DOP)</th><th className="px-4 py-2 text-center text-xs font-semibold text-white uppercase tracking-wider">Acción</th></tr></thead>
                        <tbody>
                           {unpaidConducesForSelectedMonth.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(doc => (
                              <tr key={doc.id} className="border-b hover:bg-gray-50"><td className="px-2 py-1">{new Date(doc.date).toLocaleDateString()}</td><td className="px-2 py-1 truncate max-w-[150px]" title={doc.conduceIdentifier}>{doc.conduceIdentifier}</td><td className="px-2 py-1 text-right">{doc.calculatedPayment.toFixed(2)}</td><td className="px-2 py-1 text-center"><button onClick={() => handleDeleteConduce(doc.id)} className="text-red-500 hover:text-red-700"><IconTrash className="w-4 h-4"/></button></td></tr>
                           ))}
                        </tbody>
                     </table>
                     {unpaidConducesForSelectedMonth.length === 0 && !existingPaymentForConduceModal && <p className="text-center text-gray-500 text-sm py-3">No hay conduces pendientes.</p>}
                  </div>
                  <div className="border-t pt-3 mt-3 flex justify-between items-center">
                     <span className="font-bold text-md text-gray-800">Total Pendiente:</span>
                     <span className="font-bold text-lg text-red-600">DOP {totalPendingForConduceMonth.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
                  </div>
                  <div className="mt-3 flex space-x-2">
                    <button onClick={() => openConfirmPaymentModal()} disabled={totalPendingForConduceMonth <= 0 || selectedMonth === -1} title={selectedMonth === -1 ? "Por favor, seleccione un mes específico para registrar el pago." : ""} className="flex-1 bg-green-500 text-white py-2 rounded-md hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed">Registrar Pago de {selectedMonth !== -1 ? monthNames[selectedMonth] : '...'}</button>
                    <button onClick={() => handlePrintSubagentReport(selectedSubagent, selectedMonth, selectedYear)} disabled={totalPendingForConduceMonth <= 0 || selectedMonth === -1} className="bg-teal-500 text-white px-3 py-2 rounded-md hover:bg-teal-600 disabled:bg-gray-300"><IconPrint className="w-5 h-5"/></button>
                  </div>
               </div>
            </div>
          </div>
        </Modal>
      )}

      {selectedSubagent && isConfirmPaymentModalOpen && (
        <Modal isOpen={isConfirmPaymentModalOpen} onClose={closeConfirmPaymentModal} title={`Confirmar Pago para ${selectedSubagent.name}`} size="lg">
            <div className="space-y-4">
                <p className="text-sm">Está a punto de registrar un pago para <strong className="font-semibold">{selectedSubagent.name}</strong> por los conduces pendientes del período de <strong className="font-semibold">{monthNames[selectedMonth]} {selectedYear}</strong>.</p>
                <div className="p-3 bg-green-50 border border-green-200 rounded-md text-center">
                    <p className="text-md text-gray-700">Monto Total a Pagar:</p>
                    <p className="text-2xl font-bold text-green-700">DOP {totalPendingForConduceMonth.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</p>
                </div>
                 <div>
                    <label htmlFor="voucherFile" className="block text-sm font-medium text-gray-700">Adjuntar Voucher/Comprobante (Opcional)</label>
                    <input type="file" id="voucherFile" name="voucherFile" accept="image/*" onChange={handleVoucherFileChange} ref={fileInputRef} className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"/>
                    {voucherPreviewUrl && <img src={voucherPreviewUrl} alt="Vista previa de voucher" className="mt-2 max-h-40 rounded shadow"/>}
                </div>
                 <div className="flex justify-end space-x-3 pt-2">
                    <button type="button" onClick={closeConfirmPaymentModal} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200" disabled={processingPayment}>Cancelar</button>
                    <button type="button" onClick={handleConfirmAndPayPerConduce} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 flex items-center" disabled={processingPayment}>
                        {processingPayment ? <LoadingSpinner size="sm" className="mr-2"/> : <IconCheckCircle className="w-4 h-4 mr-2"/>}
                        {processingPayment ? 'Procesando...' : 'Confirmar y Registrar Pago'}
                    </button>
                </div>
            </div>
        </Modal>
      )}

      {selectedSubagent && isMonthlyAggregatePaymentModalOpen && (
        <Modal isOpen={isMonthlyAggregatePaymentModalOpen} onClose={closeMonthlyAggregatePaymentModal} title={`Registrar Pago Mensual Agregado: ${selectedSubagent.name}`} size="lg">
             <div className="flex items-center space-x-3 bg-gray-100 p-3 rounded-md mb-4">
                <label htmlFor="agg-month" className="text-sm font-medium text-gray-700">Período:</label>
                <select id="agg-month" value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))} className="px-2 py-1 border border-gray-300 rounded-md shadow-sm text-sm"><option value="-1">Todos</option>{monthNames.map((name, index) => <option key={index} value={index}>{name}</option>)}</select>
                <select id="agg-year" value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} className="px-2 py-1 border border-gray-300 rounded-md shadow-sm text-sm">{Array.from({length: 5}, (_, i) => new Date().getFullYear() - i).map(year => <option key={year} value={year}>{year}</option>)}</select>
            </div>
            {existingPaymentForMonthlyAggregateModal ? (
                 <div className="p-4 border border-green-300 bg-green-50 rounded-lg text-sm text-green-800">
                     <h4 className="font-bold flex items-center"><IconCheckCircle className="w-5 h-5 mr-2"/>¡Pago Registrado para {monthNames[selectedMonth]} {selectedYear}!</h4>
                     <p>Monto Pagado: <strong>DOP {existingPaymentForMonthlyAggregateModal.totalAmountPaid.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</strong> ({existingPaymentForMonthlyAggregateModal.totalWeightForMonth} lbs)</p>
                     <p>Fecha de Pago: {new Date(existingPaymentForMonthlyAggregateModal.processingDate).toLocaleDateString()}</p>
                     <div className="mt-2 space-x-2">
                         <button onClick={() => handlePrintSubagentReport(selectedSubagent, selectedMonth, selectedYear)} className="bg-green-500 text-white px-3 py-1 text-xs rounded hover:bg-green-600 flex items-center"><IconPrint className="w-3 h-3 mr-1"/>Imprimir Comprobante</button>
                         {existingPaymentForMonthlyAggregateModal.paymentVoucherImage && <button onClick={() => openVoucherPreview(existingPaymentForMonthlyAggregateModal.paymentVoucherImage!)} className="bg-blue-500 text-white px-3 py-1 text-xs rounded hover:bg-blue-600 flex items-center"><IconEye className="w-3 h-3 mr-1"/>Ver Voucher</button>}
                         <button onClick={() => deleteSubagentMonthlyPayment(existingPaymentForMonthlyAggregateModal.id)} className="bg-red-500 text-white px-3 py-1 text-xs rounded hover:bg-red-600 flex items-center"><IconTrash className="w-3 h-3 mr-1"/>Anular Pago</button>
                     </div>
                 </div>
            ) : (
             <form onSubmit={(e) => { e.preventDefault(); handleRegisterMonthlyAggregatePayment(); }} className="space-y-4">
                <div><label htmlFor="totalWeightForMonth" className="block text-sm font-medium text-gray-700">Peso Total del Mes (lbs)</label><input type="number" step="0.01" name="totalWeightForMonth" id="totalWeightForMonth" value={monthlyAggregatePaymentFormData.totalWeightForMonth || ''} onChange={handleMonthlyAggregateFormChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"/></div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-center"><p className="text-md text-gray-700">Monto Calculado a Pagar:</p><p className="text-2xl font-bold text-blue-700">DOP {calculatedMonthlyAggregatePayment.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</p></div>
                <div><label htmlFor="voucherFileAgg" className="block text-sm font-medium text-gray-700">Adjuntar Voucher/Comprobante (Opcional)</label><input type="file" id="voucherFileAgg" name="voucherFile" accept="image/*" onChange={handleVoucherFileChange} ref={fileInputRef} className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"/>{voucherPreviewUrl && <img src={voucherPreviewUrl} alt="Vista previa de voucher" className="mt-2 max-h-40 rounded shadow"/>}</div>
                <div className="flex justify-end space-x-3 pt-2">
                    <button type="button" onClick={closeMonthlyAggregatePaymentModal} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200" disabled={processingPayment}>Cancelar</button>
                    <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 flex items-center" disabled={processingPayment || calculatedMonthlyAggregatePayment <= 0}>
                         {processingPayment ? <LoadingSpinner size="sm" className="mr-2"/> : <IconCheckCircle className="w-4 h-4 mr-2"/>}
                         {processingPayment ? 'Procesando...' : 'Registrar Pago'}
                    </button>
                </div>
            </form>
            )}
        </Modal>
      )}

      {isVoucherPreviewModalOpen && currentVoucherToPreview && (
        <Modal isOpen={isVoucherPreviewModalOpen} onClose={() => setIsVoucherPreviewModalOpen(false)} title="Vista Previa de Voucher" size="lg">
            <img src={currentVoucherToPreview} alt="Comprobante de pago" className="max-w-full max-h-[70vh] mx-auto rounded shadow"/>
            <div className="flex justify-end mt-4"><button type="button" onClick={() => setIsVoucherPreviewModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">Cerrar</button></div>
        </Modal>
      )}
    </div>
  );
};