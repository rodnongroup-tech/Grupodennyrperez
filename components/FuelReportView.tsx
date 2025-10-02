
import React, { useState, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
import { FuelLogEntry, FuelType, RouteSegment } from '../types';
import { IconFuel, IconPrint, IconCalendar, IconUpload, IconEye, IconTrash } from '../constants';
import { Modal } from './common/Modal';

interface FuelReportViewProps {
  fuelLogEntries: FuelLogEntry[];
  addFuelLogEntry: (entryData: Omit<FuelLogEntry, 'id'>) => void;
  updateFuelLogEntry: (entryData: FuelLogEntry) => void;
  deleteFuelLogEntry: (entryId: string) => void;
}

const initialSegmentState: Omit<RouteSegment, 'id' | 'segmentKm'> = {
    description: '',
    startKmOdometer: 0,
    endKmOdometer: 0,
};

const initialFuelLogFormState: Omit<FuelLogEntry, 'id' | 'totalKilometersThisLog' | 'efficiencyKmpg' | 'costPerGallon'> = {
  date: new Date().toISOString().split('T')[0],
  vehicle: '',
  segments: [], 
  refueledThisLog: false,
  gallonsAdded: undefined,
  totalFuelCost: undefined,
  fuelType: FuelType.GASOLINA_REGULAR,
  hasInvoice: false,
  invoiceNumber: '',
  invoiceImage: undefined,
  invoiceFileName: undefined,
  notes: '',
};

export const FuelReportView: React.FC<FuelReportViewProps> = ({ fuelLogEntries, addFuelLogEntry, updateFuelLogEntry, deleteFuelLogEntry }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<FuelLogEntry | null>(null);
  const [formData, setFormData] = useState<Omit<FuelLogEntry, 'id' | 'totalKilometersThisLog' | 'efficiencyKmpg' | 'costPerGallon'>>(initialFuelLogFormState);
  
  const [currentSegment, setCurrentSegment] = useState<Omit<RouteSegment, 'id' | 'segmentKm'>>(initialSegmentState);

  const [selectedInvoiceFile, setSelectedInvoiceFile] = useState<File | null>(null);
  const [invoicePreviewUrl, setInvoicePreviewUrl] = useState<string | null>(null);
  
  const [isVoucherPreviewModalOpen, setIsVoucherPreviewModalOpen] = useState(false);
  const [currentVoucherToPreview, setCurrentVoucherToPreview] = useState<string | null>(null);
  const [viewingSegmentsForLog, setViewingSegmentsForLog] = useState<RouteSegment[] | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalKmFromCurrentSegments = formData.segments.reduce((sum, seg) => sum + seg.segmentKm, 0);
  
  const calculatedCostPerGallon = (formData.gallonsAdded && formData.gallonsAdded > 0 && formData.totalFuelCost && formData.totalFuelCost > 0)
    ? formData.totalFuelCost / formData.gallonsAdded
    : 0;

  useEffect(() => {
    if (selectedInvoiceFile) {
      const reader = new FileReader();
      reader.onloadend = () => setInvoicePreviewUrl(reader.result as string);
      reader.readAsDataURL(selectedInvoiceFile);
    } else if (formData.invoiceImage) {
      setInvoicePreviewUrl(formData.invoiceImage);
    }
    else {
      setInvoicePreviewUrl(null);
    }
  }, [selectedInvoiceFile, formData.invoiceImage]);

  const openModal = (logToEdit: FuelLogEntry | null = null) => {
    if (logToEdit) {
        setEditingLog(logToEdit);
        setFormData(logToEdit);
    } else {
        setEditingLog(null);
        setFormData(initialFuelLogFormState);
    }
    setCurrentSegment(initialSegmentState);
    setSelectedInvoiceFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setViewingSegmentsForLog(null);
    setEditingLog(null);
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
        const checked = (e.target as HTMLInputElement).checked;
        setFormData(prev => {
            const newState = { ...prev, [name]: checked };
            if(name === 'hasInvoice' && !checked) {
              newState.invoiceNumber = '';
              newState.invoiceImage = undefined;
              newState.invoiceFileName = undefined;
              setSelectedInvoiceFile(null);
            }
            if(name === 'refueledThisLog' && !checked) {
              newState.gallonsAdded = undefined;
              newState.totalFuelCost = undefined;
              newState.hasInvoice = false;
              newState.invoiceNumber = '';
              newState.invoiceImage = undefined;
              newState.invoiceFileName = undefined;
              setSelectedInvoiceFile(null);
            }
            return newState;
        });
    } else if (type === 'number' || name === 'gallonsAdded' || name === 'totalFuelCost') {
        setFormData(prev => ({ ...prev, [name]: value === '' ? undefined : parseFloat(value) }));
    }
    else {
        setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSegmentInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCurrentSegment(prev => ({ ...prev, [name]: name.includes('Km') ? parseFloat(value) || 0 : value }));
  };

  const handleAddSegment = () => {
    if (!currentSegment.description.trim()) {
        alert("La descripción del tramo es obligatoria.");
        return;
    }
    if (currentSegment.endKmOdometer <= currentSegment.startKmOdometer) {
        alert("El KM final del odómetro debe ser mayor que el KM inicial para el tramo.");
        return;
    }
    const newSegment: RouteSegment = {
        ...currentSegment,
        id: `seg-${Date.now()}`,
        segmentKm: currentSegment.endKmOdometer - currentSegment.startKmOdometer,
    };
    setFormData(prev => ({ ...prev, segments: [...prev.segments, newSegment] }));
    
    setCurrentSegment({
        description: '',
        startKmOdometer: newSegment.endKmOdometer,
        endKmOdometer: newSegment.endKmOdometer,
    });
  };
  
  const handleRemoveSegment = (segmentId: string) => {
    setFormData(prev => ({ ...prev, segments: prev.segments.filter(s => s.id !== segmentId) }));
  };


  const handleInvoiceFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        alert("El archivo es demasiado grande. Por favor, suba una imagen de menos de 2MB.");
        setSelectedInvoiceFile(null);
        if(fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      setSelectedInvoiceFile(file);
    } else {
      setSelectedInvoiceFile(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.segments.length === 0) {
        alert("Debe agregar al menos un tramo de viaje.");
        return;
    }
    if (formData.refueledThisLog) {
        if (!formData.gallonsAdded || formData.gallonsAdded <= 0) {
            alert("Los galones agregados deben ser un número positivo si se repostó combustible."); return;
        }
        if (!formData.totalFuelCost || formData.totalFuelCost <= 0) {
             alert("El costo total del combustible debe ser un número positivo si se repostó."); return;
        }
    }
    
    const totalKilometersThisLog = formData.segments.reduce((sum, seg) => sum + seg.segmentKm, 0);
    let efficiencyKmpg: number | undefined = undefined;
    let finalCostPerGallon: number | undefined = undefined;

    if (formData.refueledThisLog && formData.gallonsAdded && formData.gallonsAdded > 0) {
        if(totalKilometersThisLog > 0) efficiencyKmpg = totalKilometersThisLog / formData.gallonsAdded;
        if(formData.totalFuelCost && formData.totalFuelCost > 0) finalCostPerGallon = formData.totalFuelCost / formData.gallonsAdded;
    }
    
    const entryToSave: FuelLogEntry = {
        id: editingLog ? editingLog.id : `fl-${Date.now()}`,
        date: formData.date,
        vehicle: formData.vehicle,
        segments: formData.segments,
        totalKilometersThisLog: totalKilometersThisLog,
        refueledThisLog: formData.refueledThisLog,
        gallonsAdded: formData.gallonsAdded,
        totalFuelCost: formData.totalFuelCost,
        costPerGallon: finalCostPerGallon,
        fuelType: formData.fuelType,
        hasInvoice: formData.hasInvoice,
        invoiceNumber: formData.invoiceNumber,
        invoiceImage: invoicePreviewUrl || undefined,
        invoiceFileName: selectedInvoiceFile?.name || formData.invoiceFileName,
        efficiencyKmpg: efficiencyKmpg,
        notes: formData.notes,
    };

    if (editingLog) {
      updateFuelLogEntry(entryToSave);
    } else {
      addFuelLogEntry(entryToSave);
    }
    closeModal();
  };

  const openVoucherPreview = (voucherImage: string) => {
    setCurrentVoucherToPreview(voucherImage);
    setIsVoucherPreviewModalOpen(true);
  };
  
  const openSegmentsModal = (segments: RouteSegment[]) => {
    setViewingSegmentsForLog(segments);
  };


  const generateFuelReportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let yPos = 20;
    const lineSpacing = 6;
    const sectionSpacing = 8;

    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text("Reporte Detallado de Combustible", pageWidth / 2, yPos, { align: 'center' });
    yPos += sectionSpacing;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Fecha de Generación: ${new Date().toLocaleDateString()}`, margin, yPos);
    yPos += sectionSpacing;

    if (fuelLogEntries.length === 0) {
        doc.text("No hay registros de combustible para mostrar.", margin, yPos);
    } else {
        [...fuelLogEntries].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).forEach((log, index) => {
            if (index > 0) yPos += 3;
             if (yPos > pageHeight - margin - 50) {
                doc.addPage();
                yPos = margin;
            }
            doc.setLineWidth(0.3);
            doc.line(margin, yPos, pageWidth - margin, yPos);
            yPos += lineSpacing;

            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.text(`Registro #${index + 1}: Vehículo ${log.vehicle} - Fecha: ${new Date(log.date).toLocaleDateString()}`, margin, yPos);
            yPos += lineSpacing;
            
            doc.setFontSize(9);
            doc.setFont(undefined, 'normal');
            doc.text(`Total KM Recorridos (registro): ${log.totalKilometersThisLog.toFixed(1)} km`, margin, yPos);
            yPos += lineSpacing;

            if (log.segments.length > 0) {
                doc.setFont(undefined, 'italic');
                doc.text("Tramos:", margin, yPos); yPos += lineSpacing -2;
                log.segments.forEach(seg => {
                    if (yPos > pageHeight - margin - 15) { doc.addPage(); yPos = margin; }
                    doc.text(`  - ${seg.description}: ${seg.startKmOdometer.toFixed(1)}km a ${seg.endKmOdometer.toFixed(1)}km (${seg.segmentKm.toFixed(1)}km)`, margin + 2, yPos, {maxWidth: pageWidth - margin*2 - 5});
                    yPos += lineSpacing -1;
                });
                doc.setFont(undefined, 'normal');
            }
            
            if (log.refueledThisLog) {
                if (yPos > pageHeight - margin - 30) { doc.addPage(); yPos = margin; }
                doc.setFont(undefined, 'bold');
                doc.text("Detalles del Repostaje:", margin, yPos); yPos += lineSpacing-1;
                doc.setFont(undefined, 'normal');
                doc.text(`  Galones: ${log.gallonsAdded?.toFixed(2) || 'N/A'} gal`, margin + 2, yPos); yPos += lineSpacing-1;
                doc.text(`  Costo Total: DOP ${log.totalFuelCost?.toFixed(2) || 'N/A'}`, margin + 2, yPos); yPos += lineSpacing-1;
                doc.text(`  Tipo: ${log.fuelType || 'N/A'}`, margin + 2, yPos); yPos += lineSpacing-1;
                if(log.costPerGallon) doc.text(`  Costo/Galón: DOP ${log.costPerGallon.toFixed(2)}`, margin + 2, yPos); yPos += lineSpacing-1;
                if(log.efficiencyKmpg) doc.text(`  Rendimiento: ${log.efficiencyKmpg.toFixed(2)} KM/Gal`, margin + 2, yPos); yPos += lineSpacing-1;
                if(log.hasInvoice) doc.text(`  Factura: ${log.invoiceNumber || 'Sí'}`, margin + 2, yPos); yPos += lineSpacing-1;
            }
            if (log.notes) {
                 if (yPos > pageHeight - margin - 15) { doc.addPage(); yPos = margin; }
                 doc.text(`Notas: ${log.notes}`, margin, yPos, {maxWidth: pageWidth-margin*2-5}); yPos += lineSpacing;
            }
        });
        
        if (yPos > pageHeight - margin - 40) { doc.addPage(); yPos = margin; } 
        yPos += sectionSpacing;
        doc.setLineWidth(0.3);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += lineSpacing;

        const totalKmOverall = fuelLogEntries.reduce((sum, log) => sum + log.totalKilometersThisLog, 0);
        const refueledEntries = fuelLogEntries.filter(log => log.refueledThisLog && log.gallonsAdded && log.gallonsAdded > 0);
        const totalGallonsOverall = refueledEntries.reduce((sum, log) => sum + (log.gallonsAdded || 0), 0);
        const totalCostOverall = refueledEntries.reduce((sum, log) => sum + (log.totalFuelCost || 0), 0);
        
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text("Resumen General:", margin, yPos); yPos += lineSpacing;
        doc.setFont(undefined, 'normal');
        doc.text(`Total KM Recorridos: ${totalKmOverall.toLocaleString(undefined, {minimumFractionDigits:1})} km`, margin, yPos); yPos += lineSpacing;
        if (totalGallonsOverall > 0) {
            doc.text(`Total Combustible: ${totalGallonsOverall.toLocaleString(undefined, {minimumFractionDigits:2})} galones`, margin, yPos); yPos += lineSpacing;
            doc.text(`Costo Total: DOP ${totalCostOverall.toLocaleString(undefined, {minimumFractionDigits:2})}`, margin, yPos); yPos += lineSpacing;
            if (totalKmOverall > 0) {
                 doc.text(`Eficiencia Promedio: ${(totalKmOverall / totalGallonsOverall).toLocaleString(undefined, {minimumFractionDigits:2})} km/galón`, margin, yPos); yPos += lineSpacing;
            }
            doc.text(`Costo Promedio/Galón: DOP ${(totalCostOverall / totalGallonsOverall).toLocaleString(undefined, {minimumFractionDigits:2})}`, margin, yPos); yPos += lineSpacing;
        }
         if (totalKmOverall > 0 && totalCostOverall > 0) {
            doc.text(`Costo Promedio/KM: DOP ${(totalCostOverall / totalKmOverall).toLocaleString(undefined, {minimumFractionDigits:2})}`, margin, yPos); yPos += lineSpacing;
        }
    }
    
    const finalPageCount = doc.getNumberOfPages ? doc.getNumberOfPages() : (doc.internal as any).getNumberOfPages();
    for (let i = 1; i <= finalPageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8); doc.setTextColor(100, 100, 100);
      doc.text(`Página ${i} de ${finalPageCount}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
      doc.text(`Reporte Combustible - Grupo Denny R. Perez EIRL`, margin, pageHeight - 7);
    }

    doc.save("Reporte_Detallado_Combustible.pdf");
  };


  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-4xl font-bold text-gray-800 flex items-center">
          <IconFuel className="w-10 h-10 mr-3 text-green-600" />
          Reporte de Combustible
        </h1>
        <div className="flex space-x-3">
          <button onClick={generateFuelReportPDF} className="bg-teal-500 text-white px-4 py-2 rounded-lg hover:bg-teal-600 shadow-md flex items-center" disabled={fuelLogEntries.length === 0}>
            <IconPrint className="w-5 h-5 mr-2" /> Generar PDF
          </button>
          <button onClick={() => openModal()} className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 shadow-md flex items-center">
            <IconFuel className="w-5 h-5 mr-2" /> Agregar Registro
          </button>
        </div>
      </div>

      <div className="bg-white shadow-xl rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Fecha', 'Vehículo', 'KM Total', 'Repostó?', 'Galones', 'Costo', 'Rendim.', 'Factura', 'Acciones'].map(header => (
                  <th key={header} scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {[...fuelLogEntries].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700">{new Date(log.date).toLocaleDateString()}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{log.vehicle}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-600 font-medium">{log.totalKilometersThisLog.toFixed(1)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm">{log.refueledThisLog ? <span className="text-green-600">Sí</span> : <span className="text-red-600">No</span>}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{log.gallonsAdded?.toFixed(2) || '-'}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-600 font-medium">{log.totalFuelCost ? `DOP ${log.totalFuelCost.toFixed(2)}` : '-'}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-blue-600 font-semibold">{log.efficiencyKmpg?.toFixed(2) || '-'}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm">
                    {log.hasInvoice && log.invoiceImage && <button onClick={() => openVoucherPreview(log.invoiceImage!)} className="text-blue-600 hover:text-blue-800" title={log.invoiceNumber || "Ver Factura"}><IconEye className="w-5 h-5"/></button>}
                    {log.hasInvoice && !log.invoiceImage && (log.invoiceNumber || 'Sí')}
                    {!log.hasInvoice && 'No'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-sm space-x-3">
                     <button onClick={() => openSegmentsModal(log.segments)} className="text-indigo-600 hover:text-indigo-800" title="Ver Tramos">{log.segments.length} tramo(s)</button>
                     <button onClick={() => openModal(log)} className="text-blue-600 hover:text-blue-800">Editar</button>
                     <button onClick={() => deleteFuelLogEntry(log.id)} className="text-red-600 hover:text-red-800"><IconTrash className="w-4 h-4"/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {fuelLogEntries.length === 0 && <p className="p-4 text-center text-gray-500">No hay registros de combustible.</p>}
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingLog ? "Editar Registro de Combustible" : "Agregar Nuevo Registro"} size="xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700">Fecha del Viaje</label>
              <input type="date" name="date" id="date" value={formData.date} onChange={handleInputChange} required className="mt-1 block w-full input-style"/>
            </div>
            <div>
              <label htmlFor="vehicle" className="block text-sm font-medium text-gray-700">Vehículo</label>
              <input type="text" name="vehicle" id="vehicle" value={formData.vehicle} onChange={handleInputChange} required placeholder="Ej: Moto CG Azul" className="mt-1 block w-full input-style"/>
            </div>
          </div>
            
          <div className="p-4 border border-indigo-200 rounded-lg bg-indigo-50 space-y-3">
            <h3 className="text-md font-semibold text-indigo-700">Tramos del Viaje (Odómetro)</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-x-4 gap-y-2 items-end">
                <div className="md:col-span-2">
                    <label htmlFor="segmentDescription" className="block text-xs font-medium text-gray-600">Descripción Tramo</label>
                    <input type="text" name="description" id="segmentDescription" value={currentSegment.description} onChange={handleSegmentInputChange} placeholder="Ej: La Vega a Villa Tapia" className="mt-0.5 block w-full input-style text-sm"/>
                </div>
                <div>
                    <label htmlFor="segmentStartKm" className="block text-xs font-medium text-gray-600">KM Inicial</label>
                    <input type="number" name="startKmOdometer" id="segmentStartKm" value={currentSegment.startKmOdometer} onChange={handleSegmentInputChange} min="0" step="0.1" className="mt-0.5 block w-full input-style text-sm"/>
                </div>
                <div>
                    <label htmlFor="segmentEndKm" className="block text-xs font-medium text-gray-600">KM Final</label>
                    <input type="number" name="endKmOdometer" id="segmentEndKm" value={currentSegment.endKmOdometer} onChange={handleSegmentInputChange} min={currentSegment.startKmOdometer || 0} step="0.1" className="mt-0.5 block w-full input-style text-sm"/>
                </div>
                 <button type="button" onClick={handleAddSegment} className="bg-indigo-500 text-white px-3 py-1.5 rounded-md hover:bg-indigo-600 text-sm md:col-start-4">Agregar Tramo</button>
            </div>
            {formData.segments.length > 0 && (
                <div className="mt-2 max-h-40 overflow-y-auto border border-gray-300 rounded-md bg-white">
                    {formData.segments.map((seg, index) => (
                        <div key={seg.id} className="flex justify-between items-center p-1.5 border-b text-xs">
                            <span>{index+1}. {seg.description} ({seg.startKmOdometer}km - {seg.endKmOdometer}km = <span className="font-semibold">{seg.segmentKm.toFixed(1)}km</span>)</span>
                            <button type="button" onClick={() => handleRemoveSegment(seg.id)} className="text-red-500 hover:text-red-700 p-0.5"><IconTrash className="w-3.5 h-3.5"/></button>
                        </div>
                    ))}
                </div>
            )}
            <p className="text-sm font-medium text-indigo-700">Total KM del Viaje: {totalKmFromCurrentSegments.toFixed(1)} km</p>
          </div>
          
          <div className="p-4 border border-green-200 rounded-lg bg-green-50 space-y-3">
             <div className="flex items-center space-x-2">
              <input type="checkbox" name="refueledThisLog" id="refueledThisLog" checked={formData.refueledThisLog} onChange={handleInputChange} className="h-4 w-4 text-green-600 border-gray-300 rounded"/>
              <label htmlFor="refueledThisLog" className="text-sm font-medium text-green-700">¿Se repostó combustible?</label>
            </div>
            {formData.refueledThisLog && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 pt-2">
                    <div><label htmlFor="gallonsAdded" className="block text-sm font-medium">Galones Agregados</label><input type="number" name="gallonsAdded" id="gallonsAdded" value={formData.gallonsAdded || ''} onChange={handleInputChange} min="0.01" step="0.01" className="mt-1 block w-full input-style"/></div>
                    <div><label htmlFor="totalFuelCost" className="block text-sm font-medium">Costo Total (DOP)</label><input type="number" name="totalFuelCost" id="totalFuelCost" value={formData.totalFuelCost || ''} onChange={handleInputChange} min="0.01" step="0.01" className="mt-1 block w-full input-style"/></div>
                    <div className="p-1 bg-green-100 rounded-md"><p className="text-xs text-gray-600">Costo/Galón Calculado:</p><p className="text-md font-semibold text-green-700">DOP {calculatedCostPerGallon > 0 ? calculatedCostPerGallon.toFixed(2) : '0.00'}</p></div>
                    <div><label htmlFor="fuelType" className="block text-sm font-medium">Tipo</label><select name="fuelType" id="fuelType" value={formData.fuelType} onChange={handleInputChange} className="mt-1 block w-full input-style">{Object.values(FuelType).map(type => <option key={type} value={type}>{type}</option>)}</select></div>
                    <div className="flex items-center space-x-2 pt-5"><input type="checkbox" name="hasInvoice" id="hasInvoice" checked={formData.hasInvoice} onChange={handleInputChange} className="h-4 w-4 text-indigo-600 border-gray-300 rounded"/><label htmlFor="hasInvoice" className="text-sm font-medium">¿Tiene Factura?</label></div>
                    {formData.hasInvoice && (
                        <>
                            <div><label htmlFor="invoiceNumber" className="block text-sm font-medium"># Factura</label><input type="text" name="invoiceNumber" id="invoiceNumber" value={formData.invoiceNumber || ''} onChange={handleInputChange} placeholder="Opcional" className="mt-1 block w-full input-style"/></div>
                            <div className="lg:col-span-full"><label htmlFor="invoiceImageFile" className="block text-sm font-medium">Imagen</label><input type="file" id="invoiceImageFile" name="invoiceImageFile" accept="image/*" onChange={handleInvoiceFileChange} ref={fileInputRef} className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"/>{invoicePreviewUrl && <img src={invoicePreviewUrl} alt="Vista previa" className="mt-2 max-h-28 rounded shadow"/>}</div>
                        </>
                    )}
                </div>
            )}
          </div>
          
          <div>
            <label htmlFor="notes" className="block text-sm font-medium">Notas Adicionales</label>
            <textarea name="notes" id="notes" value={formData.notes || ''} onChange={handleInputChange} rows={2} placeholder="Cualquier observación..." className="mt-1 block w-full input-style"></textarea>
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">Cancelar</button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700">
              {editingLog ? 'Actualizar Registro' : 'Guardar Registro'}
            </button>
          </div>
        </form>
         <style>{`.input-style { padding: 0.5rem 0.75rem; border: 1px solid #D1D5DB; border-radius: 0.375rem; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); outline: none; transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out; } .input-style:focus { border-color: #4F46E5; box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.2); }`}</style>
      </Modal>

      {viewingSegmentsForLog && (
        <Modal isOpen={!!viewingSegmentsForLog} onClose={closeModal} title="Detalle de Tramos del Viaje" size="lg">
            <div className="max-h-96 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 sticky top-0"><tr><th className="px-3 py-2 text-left font-medium text-gray-500">#</th><th className="px-3 py-2 text-left font-medium text-gray-500">Descripción</th><th className="px-3 py-2 text-left font-medium text-gray-500">KM Inicial</th><th className="px-3 py-2 text-left font-medium text-gray-500">KM Final</th><th className="px-3 py-2 text-left font-medium text-gray-500">KM Tramo</th></tr></thead>
                    <tbody className="bg-white divide-y divide-gray-200">{viewingSegmentsForLog.map((seg, index) => (<tr key={seg.id}><td className="px-3 py-1.5">{index+1}</td><td className="px-3 py-1.5">{seg.description}</td><td className="px-3 py-1.5">{seg.startKmOdometer.toFixed(1)}</td><td className="px-3 py-1.5">{seg.endKmOdometer.toFixed(1)}</td><td className="px-3 py-1.5 font-semibold">{seg.segmentKm.toFixed(1)}</td></tr>))}</tbody>
                </table>
            </div>
             <div className="flex justify-end mt-4"><button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">Cerrar</button></div>
        </Modal>
      )}

      {isVoucherPreviewModalOpen && currentVoucherToPreview && (
        <Modal isOpen={isVoucherPreviewModalOpen} onClose={() => setIsVoucherPreviewModalOpen(false)} title="Vista Previa de Factura" size="lg">
            <img src={currentVoucherToPreview} alt="Factura de combustible" className="max-w-full max-h-[70vh] mx-auto rounded shadow"/>
            <div className="flex justify-end mt-4"><button type="button" onClick={() => setIsVoucherPreviewModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">Cerrar</button></div>
        </Modal>
      )}
    </div>
  );
};
