
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Payslip, Deduction, ManualReportEntry, ReportExpenseItem, ReportIncomeItem, BankTransaction, ExtractedConduce } from '../types';

// IMPORTANT: API key must be set as an environment variable `process.env.API_KEY`
// Ensure this variable is available in your execution environment.
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.warn("API_KEY for Gemini is not set. AI features will not work. Please set process.env.API_KEY.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! }); 

const modelName = 'gemini-2.5-flash';

export const geminiService = {
  getPayrollAssistance: async (prompt: string): Promise<string> => {
    if (!API_KEY) return "Los servicios de IA no están disponibles actualmente. API Key no configurada.";
    try {
      const systemInstruction = `Eres un asistente de nómina IA servicial y conciso.
      Responde preguntas relacionadas con temas generales de nómina en República Dominicana.
      No proporciones asesoramiento financiero ni proceses datos reales de nómina.
      Mantén tus respuestas breves y fáciles de entender. Usa moneda DOP (Pesos Dominicanos) si mencionas cantidades.
      Recuerda que los pagos pueden ser quincenales.
      Algunas veces, debido a procesos internos de la empresa, las deducciones de TSS (AFP y SFS) pueden no aplicarse en un volante de pago específico; esto es temporal.`;

      const response: GenerateContentResponse = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.5, 
          topK: 32,
          topP: 0.9,
        }
      });
      return response.text;
    } catch (error) {
      console.error("Error calling Gemini API for payroll assistance:", error);
      throw new Error("No se pudo obtener respuesta del asistente IA.");
    }
  },

  explainPayslip: async (payslip: Payslip): Promise<string> => {
    if (!API_KEY) return "Los servicios de IA no están disponibles actualmente. API Key no configurada.";
    
    const deductionsString = payslip.deductions.length > 0
        ? payslip.deductions.map(d => `${d.name}: DOP ${d.amount.toFixed(2)}`).join('\n        - ')
        : 'Ninguna';

    const totalDeductionsAmount = payslip.deductions.reduce((acc, d) => acc + d.amount, 0);

    let overtimeDetails = '';
    if (payslip.overtimeHours > 0) {
      overtimeDetails = `
      - Horas Extras Trabajadas (en esta quincena): ${payslip.overtimeHours} hrs
      - Pago por Horas Extras (en esta quincena): DOP ${payslip.overtimePay.toFixed(2)}`;
    }

    const afpDeduction = payslip.deductions.find(d => d.name.includes("AFP"));
    const sfsDeduction = payslip.deductions.find(d => d.name.includes("SFS"));
    const isrDeduction = payslip.deductions.find(d => d.name.includes("ISR"));

    let deductionsExplanation = '';
    if (afpDeduction && sfsDeduction) {
      deductionsExplanation = `
      3. Deducciones Aplicadas:
         - Se aplicaron las deducciones de ley para la seguridad social (TSS):
           - AFP (tu fondo de pensión): DOP ${afpDeduction.amount.toFixed(2)}
           - SFS (tu seguro de salud): DOP ${sfsDeduction.amount.toFixed(2)}
      `;
    } else {
       deductionsExplanation = `
      3. Deducciones Aplicadas:
         - En este volante de pago específico, las deducciones correspondientes a AFP (pensión) y SFS (salud) no se aplicaron. Esto puede deberse a una configuración interna para esta nómina.
      `;
    }
    
    if (isrDeduction) {
        deductionsExplanation += `
         - ISR (Impuesto Sobre la Renta): DOP ${isrDeduction.amount.toFixed(2)}. Este es un impuesto que se calcula sobre tus ingresos.
        `;
    } else {
        deductionsExplanation += `
         - No se aplicó deducción por ISR (Impuesto Sobre la Renta) en esta quincena, probablemente porque tus ingresos no alcanzaron el monto mínimo imponible.
        `;
    }

    const promptContent = `
      Eres un asistente de nómina servicial. Explica los siguientes detalles del volante de pago QUINCENAL en términos simples y claros para un empleado en República Dominicana.
      Concéntrate en la claridad y desglosa brevemente a dónde va el dinero. Sé empático y tranquilizador. Usa el formato de moneda DOP.
      IMPORTANTE: El empleado recibe pagos quincenales (dos veces al mes). El "Salario Base Quincenal" es la mitad de su salario mensual.

      Detalles del Volante de Pago para ${payslip.employeeName} (${payslip.employeeCedula || 'N/A'}) para el período ${payslip.payPeriod}:
      - Salario Base Quincenal: DOP ${payslip.baseSalary.toFixed(2)}${overtimeDetails}
      - Total Ingresos Quincenales: DOP ${payslip.totalEarnings.toFixed(2)}
      - Detalle de Deducciones:
        - ${deductionsString}
      - Total Deducciones: DOP ${totalDeductionsAmount.toFixed(2)}
      - Salario Neto Quincenal (Pago a recibir): DOP ${payslip.netSalary.toFixed(2)}

      Proporciona una explicación breve y fácil de entender siguiendo estos puntos:
      1. Salario Base Quincenal: Comienza explicando el Salario Base Quincenal (indica que es la mitad del mensual).
      2. Ingresos por Horas Extras (si aplica): Si hay horas extras, explica cómo se suman al Salario Base para obtener el "Total Ingresos Quincenales".
      ${deductionsExplanation}
      4. Salario Neto Quincenal: Explica que el "Salario Neto" es el dinero que recibes en tu cuenta. Se calcula restando el "Total Deducciones" del "Total Ingresos Quincenales".
    `;

    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: modelName,
        contents: promptContent,
        config: {
          temperature: 0.3, 
        }
      });
      return response.text;
    } catch (error) {
      console.error("Error calling Gemini API for payslip explanation:", error);
      throw new Error("No se pudo obtener la explicación del volante de pago desde la IA.");
    }
  },

  extractFinancialDataFromImage: async (base64ImageData: string): Promise<Partial<ManualReportEntry> | null> => {
    if (!API_KEY) {
      console.error("API Key for Gemini not configured for image analysis.");
      return null;
    }
    try {
      const imagePart = {
        inlineData: {
          mimeType: 'image/jpeg', // Assuming JPEG, adjust if other types are common
          data: base64ImageData,
        },
      };
      const textPart = {
        text: `Analiza la siguiente imagen de un reporte financiero mensual. Extrae los datos y devuélvelos en formato JSON.
        El JSON debe tener dos claves principales: "expenses" e "incomes".

        Para "expenses":
        - Busca una tabla o lista de gastos. Cada elemento debe ser un objeto con "remark" (la descripción del gasto, ej: "IMPUESTOS", "local", "NOMINA", "luz") y "amount" (el monto numérico del gasto).
        - Ignora líneas de "TOTAL GENERAL" o subtotales para los gastos. Solo extrae los ítems individuales.
        - Si un gasto dice "NOMINA" o "NOMINA subagente", NO lo incluyas en "expenses", ya que estos se agregarán automáticamente en la app.

        Para "incomes":
        - Busca específicamente dos fuentes de ingreso: "PAQUETERIA LOCAL" y "GANANCIA PAQUETERIA COURRIER".
        - Cada una debe ser un objeto con "source" (el nombre exacto como se indica arriba) y "amount" (el monto numérico).
        - Si no encuentras una de estas fuentes de ingreso, omítela del array "incomes".

        Ejemplo del formato JSON esperado:
        {
          "expenses": [
            { "remark": "IMPUESTOS", "amount": 787.01 },
            { "remark": "local", "amount": 11000.00 },
            { "remark": "CONTABLE", "amount": 1000.00 },
            { "remark": "luz", "amount": 3134.14 }
          ],
          "incomes": [
            { "source": "PAQUETERIA LOCAL", "amount": 114.58 },
            { "source": "GANANCIA PAQUETERIA COURRIER", "amount": 130297.32 }
          ]
        }
        Si un campo no se encuentra, omite el objeto correspondiente o el campo. Asegúrate de que los montos sean números, no strings.
        No incluyas el título del reporte, fechas, o la sección "TOTAL A TRANSFERIR" / "DISTRIBUCIÓN DE GANANCIAS". Enfócate solo en los ítems de gastos (excluyendo nóminas automáticas) y los dos ítems de ingresos especificados.
        Asegúrate de que los valores numéricos no tengan comas como separadores de miles y usen punto como separador decimal.
        Si la imagen no es un reporte financiero o no se pueden extraer datos, devuelve un JSON con "expenses": [] e "incomes": [].
        `,
      };

      const response: GenerateContentResponse = await ai.models.generateContent({
        model: modelName, 
        contents: { parts: [imagePart, textPart] },
        config: {
          responseMimeType: "application/json",
          temperature: 0.1, 
        }
      });
      
      let jsonStr = response.text.trim();
      const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
      const match = jsonStr.match(fenceRegex);
      if (match && match[2]) {
        jsonStr = match[2].trim();
      }

      const parsedData = JSON.parse(jsonStr) as { expenses: ReportExpenseItem[], incomes: ReportIncomeItem[] };
      
      const cleanedData: Partial<ManualReportEntry> = { expenses: [], incomes: [] };

      if (parsedData.expenses && Array.isArray(parsedData.expenses)) {
        cleanedData.expenses = parsedData.expenses.filter(
          (item): item is ReportExpenseItem => 
            typeof item.remark === 'string' && 
            typeof item.amount === 'number' &&
            item.remark.toUpperCase() !== 'NOMINA' && 
            item.remark.toUpperCase() !== 'NOMINA SUBAGENTE' 
        ).map(item => ({ ...item, id: `img-exp-${Date.now()}-${Math.random()}`.slice(0,25) , isAutomatic: false, category: 'manual' }));
      }

      if (parsedData.incomes && Array.isArray(parsedData.incomes)) {
        cleanedData.incomes = parsedData.incomes.filter(
          (item): item is ReportIncomeItem =>
            typeof item.source === 'string' &&
            typeof item.amount === 'number' &&
            (item.source === "PAQUETERIA LOCAL" || item.source === "GANANCIA PAQUETERIA COURRIER")
        ).map(item => ({ ...item, id: `img-inc-${Date.now()}-${Math.random()}`.slice(0,25) }));
      }
      
      return cleanedData;

    } catch (error) {
      console.error("Error calling Gemini API for image data extraction:", error);
      return null;
    }
  },

  extractSubagentConducesFromFile: async (base64Data: string, mimeType: string): Promise<ExtractedConduce[]> => {
    if (!API_KEY) {
      throw new Error("API Key for Gemini not configured.");
    }

    const filePart = {
      inlineData: {
        mimeType: mimeType,
        data: base64Data,
      },
    };

    const textPart = {
      text: `Analiza la siguiente tabla en el documento (puede ser una imagen o PDF), que es un reporte de conduces para un subagente.
      Extrae los datos de cada fila de la tabla y devuélvelos como un array de objetos JSON.
      Cada objeto debe representar una fila y tener las siguientes claves: "fecha" (string), "peso" (number), "paquetes" (number), y "monto" (number).
      - La columna 'CONDUCE' es la fecha. Normaliza la fecha al formato YYYY-MM-DD si es posible, si no, déjala como está.
      - La columna 'PESO' es el peso.
      - La columna 'PAQUETES' es la cantidad de paquetes.
      - La columna 'MONTO' es el monto declarado.
      - Ignora cualquier fila que sea un encabezado (header) o un total (como 'GRAND TOTAL'). Solo extrae las filas de datos individuales.
      - Asegúrate de que los valores numéricos (peso, paquetes, monto) sean números, eliminando comas o símbolos de moneda.
      - Si una celda está vacía o no se puede interpretar, omite la clave correspondiente en el objeto JSON para esa fila.
      - No importa el nombre del subagente en el documento (e.g., WELLINGTON o WENDY), solo extrae los datos de la tabla.
      - Si no se encuentran filas de datos válidas, devuelve un array vacío [].

      Ejemplo de formato de salida esperado:
      [
        { "fecha": "2024-05-03", "peso": 2.00, "paquetes": 2, "monto": 435.01 },
        { "fecha": "2024-05-08", "peso": 7.09, "paquetes": 4, "monto": 1721.28 }
      ]
      `,
    };

    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: modelName,
        contents: { parts: [filePart, textPart] },
        config: {
          responseMimeType: "application/json",
          temperature: 0.0,
        }
      });

      let jsonStr = response.text.trim();
      const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
      const match = jsonStr.match(fenceRegex);
      if (match && match[2]) {
        jsonStr = match[2].trim();
      }
      
      const parsedData = JSON.parse(jsonStr);

      if (Array.isArray(parsedData)) {
        return parsedData.filter((item): item is ExtractedConduce => 
          typeof item === 'object' && item !== null && 'fecha' in item
        );
      }
      return [];

    } catch (error) {
      console.error("Error calling Gemini API for subagent report extraction:", error);
      throw new Error("No se pudo extraer los datos del reporte desde el archivo.");
    }
  },

  suggestBankTransactionComment: async (description: string, debit: number | null, credit: number | null): Promise<string> => {
    if (!API_KEY) return "Sugerencia IA no disponible (API Key no configurada).";
    
    const transactionType = (debit || 0) > 0 ? "Egreso (Débito)" : "Ingreso (Crédito)";
    const amount = (debit || 0) > 0 ? debit : credit;

    const prompt = `
      Eres un asistente inteligente para la entrada de datos de transacciones bancarias.
      Dada la siguiente información de una transacción:
      - Descripción: "${description}"
      - Tipo: ${transactionType}
      - Monto: DOP ${amount?.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}

      Por favor, sugiere un comentario conciso y útil que justifique esta transacción.
      El comentario debe ser breve y claro, adecuado para un registro contable.

      Ejemplos:
      - Si Descripción="Pago de factura #123 a Proveedor X", Tipo=Egreso, Comentario sugerido="Pago factura #123 a Proveedor X por servicios/productos."
      - Si Descripción="CR X TRANSFER", Tipo=Ingreso, Monto=1447.00, Comentario sugerido="Transferencia recibida de cliente por servicios." (Si la descripción es vaga, intenta inferir una causa común).
      - Si Descripción="Compra de Materiales Oficina", Tipo=Egreso, Comentario sugerido="Adquisición de suministros de oficina."
      - Si Descripción="Deposito en efectivo", Tipo=Ingreso, Comentario sugerido="Depósito en efectivo en cuenta."
      - Si Descripción="Pago salario Juan Perez", Tipo=Egreso, Comentario sugerido="Pago de salario a Juan Perez correspondiente a QX Mes."

      Sugerencia de Comentario:
    `;

    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          temperature: 0.6, // Slightly more creative for comments
          topK: 40,
          topP: 0.9,
          // thinkingConfig: { thinkingBudget: 0 } // Consider if extremely low latency is needed
        }
      });
      return response.text.trim();
    } catch (error) {
      console.error("Error calling Gemini API for bank transaction comment suggestion:", error);
      return "No se pudo generar sugerencia. Intente manualmente.";
    }
  },
};
