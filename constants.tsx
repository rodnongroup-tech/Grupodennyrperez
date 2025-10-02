
import React from 'react';
import { Employee, PayrollRun, PayrollRunStatus, Payslip, Subagent, SubagentPaymentModel, ConduceDocument, ExpenseCategory, MiHeladitoWorker, MiHeladitoWorkerType, AppUser } from './types';

export const APP_USERS: AppUser[] = [
    {
        username: 'DRONDON',
        password: 'Celular123',
        name: 'Denny Rondon',
        permissions: 'all',
    },
    {
        username: 'GCAMILO',
        password: 'Celular246',
        name: 'Gisan Camilo',
        permissions: 'mi_heladito_only',
    }
];

export const MOCK_EMPLOYEES: Employee[] = [
  { 
    id: '402-1320426-2', // Using Cédula as ID
    cedula: '402-1320426-2',
    name: 'Laura Michelle Cruceta Gil', 
    email: 'crucetalaura16@gmail.com', // Updated Email
    department: 'Administración', // Placeholder
    role: 'Servicio al Cliente', 
    salary: 16000, // Monthly base salary in DOP
    bankAccountNumber: '9606364407', 
    bankName: 'Banreservas',
    hireDate: '2024-01-10' // Placeholder
  },
  {
    id: '40224562518', // Using Cédula as ID
    cedula: '40224562518',
    name: 'Henry Joel Arthur Severino',
    email: '3kjarthur@gmail.com',
    department: 'Operaciones', // Placeholder department
    role: 'Servicio de Asistencia y Mensajería',
    salary: 7000, // Monthly base salary in DOP (3500 quincenal * 2)
    bankAccountNumber: '0000000000', // Placeholder
    bankName: 'Popular', // Placeholder
    hireDate: '2024-03-15', // Placeholder
  }
];

// Constants for payroll calculation
const AVG_WORKING_DAYS_PER_MONTH = 23.83;
const STD_HOURS_PER_DAY = 8;
const OVERTIME_MULTIPLIER = 1.35; // Standard overtime rate (e.g., 135%)
const MONTHLY_ISR_EXEMPTION = 34685.00;
export const FORTNIGHTLY_ISR_EXEMPTION = MONTHLY_ISR_EXEMPTION / 2; // Approx 17342.50

// --- Laura's Mock Payslip Calculation ---
const laura = MOCK_EMPLOYEES.find(e => e.id === '402-1320426-2')!;
const lauraMonthlySalary = laura.salary; 
const lauraFortnightlyBaseSalary = lauraMonthlySalary / 2; 
const lauraOvertimeHoursExample = 5; 
const lauraMonthlyHourlyRate = lauraMonthlySalary / AVG_WORKING_DAYS_PER_MONTH / STD_HOURS_PER_DAY;
const lauraOvertimePayFortnight = lauraOvertimeHoursExample * lauraMonthlyHourlyRate * OVERTIME_MULTIPLIER;
const lauraTotalEarningsFortnight = lauraFortnightlyBaseSalary + lauraOvertimePayFortnight;
const lauraMockTssDeductionsForIsrCalc = 0; 
let lauraIsrFortnight = 0;
let lauraAnnualTaxableIncome = (lauraTotalEarningsFortnight * 24) - (lauraMockTssDeductionsForIsrCalc * 24); 
if (lauraAnnualTaxableIncome > 416220.00) {
    if (lauraAnnualTaxableIncome <= 624329.00) {
        lauraIsrFortnight = (lauraAnnualTaxableIncome - 416220.00) * 0.15 / 24;
    } else if (lauraAnnualTaxableIncome <= 867123.00) {
        lauraIsrFortnight = (((624329.00 - 416220.00) * 0.15) + ((lauraAnnualTaxableIncome - 624329.00) * 0.20)) / 24;
    } else {
        lauraIsrFortnight = (((624329.00 - 416220.00) * 0.15) + ((867123.00 - 624329.00) * 0.20) + ((lauraAnnualTaxableIncome - 867123.00) * 0.25)) / 24;
    }
}
lauraIsrFortnight = Math.max(0, lauraIsrFortnight);
const lauraDeductionsListFortnight = [];
if (lauraIsrFortnight > 0) {
    lauraDeductionsListFortnight.push({ name: 'ISR (Impuesto Sobre la Renta)', amount: parseFloat(lauraIsrFortnight.toFixed(2)) });
}
const lauraNetSalaryFortnight = lauraTotalEarningsFortnight - lauraIsrFortnight;

// --- Henry's Mock Payslip Calculation ---
const henry = MOCK_EMPLOYEES.find(e => e.id === '40224562518')!;
const henryMonthlySalary = henry.salary; // 7,000
const henryFortnightlyBaseSalary = henryMonthlySalary / 2; // 3,500
const henryOvertimeHoursExample = 0; // No overtime for mock
const henryMonthlyHourlyRate = henryMonthlySalary / AVG_WORKING_DAYS_PER_MONTH / STD_HOURS_PER_DAY;
const henryOvertimePayFortnight = henryOvertimeHoursExample * henryMonthlyHourlyRate * OVERTIME_MULTIPLIER; // 0
const henryTotalEarningsFortnight = henryFortnightlyBaseSalary + henryOvertimePayFortnight; // 3,500
let henryIsrFortnight = 0;
// ISR for Henry will be 0 as (3500 * 24) = 84000 is less than 416220.00
const henryDeductionsListFortnight = []; // No ISR
const henryNetSalaryFortnight = henryTotalEarningsFortnight - henryIsrFortnight; // 3500

export const MOCK_PAYROLL_RUNS: PayrollRun[] = [
  {
    id: 'pr-2024-08-q1-multi', 
    payPeriod: 'August 2024 - 1st Fortnight', 
    status: PayrollRunStatus.COMPLETED,
    totalAmount: lauraNetSalaryFortnight + henryNetSalaryFortnight, // Sum of net salaries
    employeesProcessed: 2, // Two employees processed
    processingDate: '2024-08-14', 
    payslipsGenerated: [
      { 
        id: `ps-${laura.id}-2024-08-q1`, 
        employeeId: laura.id, 
        employeeName: laura.name, 
        employeeCedula: laura.cedula,
        employeeEmail: laura.email,
        payrollRunId: 'pr-2024-08-q1-multi', 
        payPeriod: 'August 2024 - 1st Fortnight', 
        baseSalary: parseFloat(lauraFortnightlyBaseSalary.toFixed(2)),
        overtimeHours: lauraOvertimeHoursExample,
        overtimePay: parseFloat(lauraOvertimePayFortnight.toFixed(2)),
        totalEarnings: parseFloat(lauraTotalEarningsFortnight.toFixed(2)),
        deductions: lauraDeductionsListFortnight,
        netSalary: parseFloat(lauraNetSalaryFortnight.toFixed(2)),
        generatedDate: '2024-08-14' 
      },
      { 
        id: `ps-${henry.id}-2024-08-q1`, 
        employeeId: henry.id, 
        employeeName: henry.name, 
        employeeCedula: henry.cedula,
        employeeEmail: henry.email,
        payrollRunId: 'pr-2024-08-q1-multi', 
        payPeriod: 'August 2024 - 1st Fortnight', 
        baseSalary: parseFloat(henryFortnightlyBaseSalary.toFixed(2)),
        overtimeHours: henryOvertimeHoursExample,
        overtimePay: parseFloat(henryOvertimePayFortnight.toFixed(2)),
        totalEarnings: parseFloat(henryTotalEarningsFortnight.toFixed(2)),
        deductions: henryDeductionsListFortnight,
        netSalary: parseFloat(henryNetSalaryFortnight.toFixed(2)),
        generatedDate: '2024-08-14' 
      }
    ]
  }
];

export const MOCK_SUBAGENTS: Subagent[] = [
  {
    id: 'sub-001',
    code: 'BS1',
    name: 'YULEIDY HICINO',
    paymentModel: SubagentPaymentModel.PER_CONDUCE_DOCUMENT,
    ratePerPound: 9.36,
    locationOrNotes: 'Pago por conduces individuales'
  },
  {
    id: 'sub-002',
    code: 'C01',
    name: 'GISAN MERCEDES CAMILO',
    paymentModel: SubagentPaymentModel.MONTHLY_AGGREGATE_WEIGHT,
    ratePerPound: 25,
  },
  {
    id: 'sub-003',
    code: 'SV',
    name: 'WENDY VARGAS',
    paymentModel: SubagentPaymentModel.PER_CONDUCE_DOCUMENT, 
    ratePerPound: 20,
    locationOrNotes: 'SAN VICTOR'
  },
  {
    id: 'sub-004',
    code: 'LG',
    name: 'Johnneirys De Jesús Pérez Morel',
    paymentModel: SubagentPaymentModel.MONTHLY_AGGREGATE_WEIGHT,
    ratePerPound: 15,
    locationOrNotes: 'LAS LAGUNAS'
  },
  {
    id: 'sub-005',
    code: 'JN',
    name: 'ISABEL RODRIGUEZ',
    paymentModel: SubagentPaymentModel.PER_CONDUCE_DOCUMENT, 
    ratePerPound: 15,
    locationOrNotes: 'JAMAO AL NORTE' 
  },
];

export const MOCK_CONDUCE_DOCUMENTS: ConduceDocument[] = [
  // Data for Wendy Vargas (sub-003)
  { id: 'cd-wen-001', subagentId: 'sub-003', conduceIdentifier: '4-Apr-2024', date: '2024-04-04', paymentType: 'calculated', totalWeightPounds: 32.8, calculatedPayment: 32.8 * 20, isPaid: false, numberOfPackages: 0, declaredValue: 0 },
  { id: 'cd-wen-002', subagentId: 'sub-003', conduceIdentifier: '6-Apr-2024', date: '2024-04-06', paymentType: 'calculated', totalWeightPounds: 28.4, calculatedPayment: 28.4 * 20, isPaid: false, numberOfPackages: 0, declaredValue: 0 },
  { id: 'cd-wen-003', subagentId: 'sub-003', conduceIdentifier: '11-Apr-2024', date: '2024-04-11', paymentType: 'calculated', totalWeightPounds: 15, calculatedPayment: 15 * 20, isPaid: false, numberOfPackages: 0, declaredValue: 0 },
  { id: 'cd-wen-004', subagentId: 'sub-003', conduceIdentifier: '15-Apr-2024', date: '2024-04-15', paymentType: 'calculated', totalWeightPounds: 6.9, calculatedPayment: 6.9 * 20, isPaid: false, numberOfPackages: 0, declaredValue: 0 },
  { id: 'cd-wen-005', subagentId: 'sub-003', conduceIdentifier: '16-Apr-2024', date: '2024-04-16', paymentType: 'calculated', totalWeightPounds: 19.6, calculatedPayment: 19.6 * 20, isPaid: false, numberOfPackages: 0, declaredValue: 0 },
  { id: 'cd-wen-006', subagentId: 'sub-003', conduceIdentifier: '18-Apr-2024', date: '2024-04-18', paymentType: 'calculated', totalWeightPounds: 21.8, calculatedPayment: 21.8 * 20, isPaid: false, numberOfPackages: 0, declaredValue: 0 },
  { id: 'cd-wen-007', subagentId: 'sub-003', conduceIdentifier: '24-Apr-2024', date: '2024-04-24', paymentType: 'calculated', totalWeightPounds: 31.7, calculatedPayment: 31.7 * 20, isPaid: false, numberOfPackages: 0, declaredValue: 0 },
  
  // Data for Isabel Rodriguez (sub-005) from the "Reporte de Pago - Jamao" image
  { id: 'cd-isa-001', subagentId: 'sub-005', conduceIdentifier: '03-may-2025', date: '2025-05-03', paymentType: 'calculated', totalWeightPounds: 11.30, numberOfPackages: 8, declaredValue: 2641.56, calculatedPayment: 11.30 * 15, isPaid: false },
  { id: 'cd-isa-002', subagentId: 'sub-005', conduceIdentifier: '09-MAY-2025', date: '2025-05-09', paymentType: 'calculated', totalWeightPounds: 5.02, numberOfPackages: 5, declaredValue: 1275.62, calculatedPayment: 5.02 * 15, isPaid: false },
  { id: 'cd-isa-003', subagentId: 'sub-005', conduceIdentifier: '13-MAY-2025', date: '2025-05-13', paymentType: 'calculated', totalWeightPounds: 19.50, numberOfPackages: 3, declaredValue: 3822.57, calculatedPayment: 19.50 * 15, isPaid: false },
  { id: 'cd-isa-004', subagentId: 'sub-005', conduceIdentifier: '15-MAY-2025', date: '2025-05-15', paymentType: 'calculated', totalWeightPounds: 18.30, numberOfPackages: 8, declaredValue: 3790.53, calculatedPayment: 18.30 * 15, isPaid: false },
  { id: 'cd-isa-005', subagentId: 'sub-005', conduceIdentifier: '17-MAY-2025', date: '2025-05-17', paymentType: 'calculated', totalWeightPounds: 7.90, numberOfPackages: 3, declaredValue: 1661.04, calculatedPayment: 7.90 * 15, isPaid: false },
  { id: 'cd-isa-006', subagentId: 'sub-005', conduceIdentifier: '20-MAY-2025', date: '2025-05-20', paymentType: 'calculated', totalWeightPounds: 7.80, numberOfPackages: 4, declaredValue: 1702.55, calculatedPayment: 7.80 * 15, isPaid: false }, 
  { id: 'cd-isa-007', subagentId: 'sub-005', conduceIdentifier: '22-MAY-2025', date: '2025-05-22', paymentType: 'calculated', totalWeightPounds: 13.40, numberOfPackages: 9, declaredValue: 2932.62, calculatedPayment: 13.40 * 15, isPaid: false },
  { id: 'cd-isa-008', subagentId: 'sub-005', conduceIdentifier: '26-MAY-2025', date: '2025-05-26', paymentType: 'calculated', totalWeightPounds: 7.09, numberOfPackages: 7, declaredValue: 1841.79, calculatedPayment: 7.09 * 15, isPaid: false },
  { id: 'cd-isa-009', subagentId: 'sub-005', conduceIdentifier: '27-MAY-2025', date: '2025-05-27', paymentType: 'calculated', totalWeightPounds: 27.15, numberOfPackages: 19, declaredValue: 6161.60, calculatedPayment: 27.15 * 15, isPaid: false },
  { id: 'cd-isa-010', subagentId: 'sub-005', conduceIdentifier: '31-MAY-2025', date: '2025-05-31', paymentType: 'calculated', totalWeightPounds: 11.09, numberOfPackages: 8, declaredValue: 2761.51, calculatedPayment: 11.09 * 15, isPaid: false },
];


export const MOCK_MI_HELADITO_WORKERS: MiHeladitoWorker[] = [
  {
    id: 'mhw-001',
    name: 'Asistente de Tienda (Medio Tiempo)',
    workerType: MiHeladitoWorkerType.PART_TIME,
    baseAmount: 6000, // Monthly salary
  },
  {
    id: 'mhw-002',
    name: 'Persona de Pegar Etiquetas',
    workerType: MiHeladitoWorkerType.CONTRACTOR,
    baseAmount: 2000, // Fixed payment
  },
];


// Constants for Mi Heladito Profit Distribution
export const MI_HELADITO_PARTNER_DENNY = "Denny Rondon";
export const MI_HELADITO_PARTNER_GISAN = "Gisan Camilo";
export const MI_HELADITO_BUSINESS_ACCOUNT = "Mi Heladito (Para Inversión)";
export const MI_HELADITO_MIN_REINVESTMENT = 50000; // DOP
export const MI_HELADITO_PRIMARY_DIST_SHARE_DG_COMBINED = 0.60; // 60% for Denny & Gisan combined from remaining profit
export const MI_HELADITO_PRIMARY_DIST_SHARE_MH_ADDITIONAL = 0.40; // 40% additional for Mi Heladito from remaining profit

// Expense Categories for Bank Transactions
export const EXPENSE_CATEGORIES = Object.values(ExpenseCategory);


// SVG Icons
export const IconGDPLogo: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <linearGradient id="gdpGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#4f46e5', stopOpacity: 1 }} /> 
          <stop offset="100%" style={{ stopColor: '#818cf8', stopOpacity: 1 }} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="20" fill="url(#gdpGradient)"/>
      <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fontSize="48" fontWeight="bold" fill="white" fontFamily="sans-serif">
        GDP
      </text>
    </svg>
);

export const IconDashboard: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
  </svg>
);

export const IconEmployees: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
  </svg>
);

export const IconPayroll: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414-.336.75-.75.75h-.75a.75.75 0 01-.75-.75V5.25m0 0h3.75m-3.75 0h.375m-3.75 0h.375M2.25 9.75h1.5M2.25 12h1.5m-1.5 3h1.5m1.5-6h13.5c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-1.5a1.125 1.125 0 00-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
  </svg>
);

export const IconTruck: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.988-1.13A6.004 6.004 0 0012 5.25H8.25m8.25 3H12M8.25 5.25h3.75M8.25 9h3.75m0-3.75H5.625c-.621 0-1.125.504-1.125 1.125v6.75c0 .621.504 1.125 1.125 1.125H9M16.5 9h2.25M12 12.75H8.25" />
  </svg>
);

export const IconChartBar: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25A1.125 1.125 0 019.75 19.875V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
  </svg>
);

export const IconClipboardList: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);


export const IconUsers: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
  </svg>
);

export const IconCalendar: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V18Zm0 2.25h.008v.008h-.008v-.008Zm4.5-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V18Zm0 2.25h.008v.008h-.008v-.008Z" />
  </svg>
);

export const IconChatBubble: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3.692-3.693a9.976 9.976 0 01-4.606.94H6.75a2.25 2.25 0 01-2.25-2.25V6.75a2.25 2.25 0 012.25-2.25h7.5c.969 0 1.813.526 2.234 1.334L17.25 6H20.25a.75.75 0 01.75.75v1.036a4.508 4.508 0 01-.75-.274zM7.5 15a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5h-4.5A.75.75 0 017.5 15zm0-3a.75.75 0 01.75-.75h6.75a.75.75 0 010 1.5h-6.75A.75.75 0 017.5 12z" />
  </svg>
);

export const IconPaperAirplane: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
  </svg>
);


export const IconSparkles: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.898 20.624L16.5 21.75l-.398-1.126a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.126-.398a2.25 2.25 0 001.423-1.423L16.5 15.75l.398 1.126a2.25 2.25 0 001.423 1.423L19.5 18.75l-1.126.398a2.25 2.25 0 00-1.423 1.423z" />
  </svg>
);

export const IconPrint: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
  </svg>
);

export const IconClock: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export const IconShieldCheck: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622V6.25a11.99 11.99 0 00-10.098-3.627c-.422-.033-.85-.05-1.275-.052A11.952 11.952 0 009 2.714z" />
  </svg>
);

export const IconMail: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
  </svg>
);

export const IconFileText: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>
);

export const IconTrash: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12.56 0c.34-.059.68-.111 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
  </svg>
);

export const IconUpload: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
  </svg>
);

export const IconSave: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>
);

export const IconCheckCircle: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export const IconEye: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

export const IconCash: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h6m3-3.75l3 3m0 0l-3 3m3-3H6.75m12.75-3v2.25c0 .621-.504 1.125-1.125 1.125H4.125A1.125 1.125 0 013 12.75V9.75m18 3V9A2.25 2.25 0 0018.75 6.75H5.25A2.25 2.25 0 003 9v3.75m18 0v1.875a1.125 1.125 0 01-1.125 1.125H4.125a1.125 1.125 0 01-1.125-1.125V12.75m18 0h-1.688c-.622 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125h1.688m-1.688-2.625v2.625m0-2.625H5.25" />
  </svg>
);

export const IconImage: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
  </svg>
);

export const IconIceCream: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l-.988-5.236M13.5 21l.988-5.236M12 15.75V21m0-15.375C12 3.75 10.125 3 8.25 3S4.5 3.75 4.5 5.625c0 1.83 1.002 3.324 2.363 4.148.86.516 1.888.626 2.887.276M12 2.25C12 3.75 13.875 3 15.75 3s3.75.75 3.75 2.625c0 1.83-1.002 3.324-2.363 4.148-.86.516-1.888.626-2.887.276M12 2.25V9.375m0 6.375c2.313 0 4.25-1.455 4.868-3.48.163-.538.293-1.107.362-1.722M12 15.75c-2.313 0-4.25-1.455-4.868-3.48-.163-.538-.293-1.107-.362-1.722" />
  </svg>
);

export const IconFuel: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.306a1.5 1.5 0 0 1 .94-.282A5.969 5.969 0 0 1 12 6c1.213 0 2.383.337 3.328.924a1.5 1.5 0 0 1 .94.282V7.5M8.25 7.5A2.25 2.25 0 0 0 6 9.75v7.5a2.25 2.25 0 0 0 2.25 2.25h7.5a2.25 2.25 0 0 0 2.25-2.25v-7.5a2.25 2.25 0 0 0-2.25-2.25H8.25Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v5.25m-2.25-5.25H12m2.25-5.25H12" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 15.75H9" />
  </svg>
);

export const IconCreditCard: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h6m3-3.75l3 3m0 0l-3 3m3-3H6.75m12.75-3v2.25c0 .621-.504 1.125-1.125 1.125H4.125A1.125 1.125 0 013 12.75V9.75m18 3V9A2.25 2.25 0 0018.75 6.75H5.25A2.25 2.25 0 003 9v3.75m18 0v1.875a1.125 1.125 0 01-1.125 1.125H4.125a1.125 1.125 0 01-1.125-1.125V12.75m18 0h-1.688c-.622 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125h1.688m-1.688-2.625v2.625m0-2.625H5.25" />
  </svg>
);

export const IconReceiptPercent: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-1.5h5.25m-5.25 0h-1.5m-2.25-3h9m-9 0h-1.5m-2.25 0h1.5m9 0h1.5m-2.25 0h-9m9 0h-1.5m-2.25 0h1.5m9 0h1.5m6-13.5V21a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 21V4.5A2.25 2.25 0 015.25 2.25h10.5a2.25 2.25 0 012.25 2.25z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 14.25l6-6m-5.25 6a.75.75 0 100-1.5.75.75 0 000 1.5zm6-6a.75.75 0 100-1.5.75.75 0 000 1.5z" />
    </svg>
);

export const IconPencil: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </svg>
);

export const IconCheck: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
);

export const IconX: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

export const IconLogout: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
  </svg>
);