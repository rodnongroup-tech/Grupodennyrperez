
import React, { useState } from 'react';
import { Employee } from '../types';
import { IconUsers, IconCalendar } from '../constants';
import { Modal } from './common/Modal';

interface EmployeesViewProps {
  employees: Employee[];
  addEmployee: (employee: Omit<Employee, 'id'>) => void;
  updateEmployee: (employee: Employee) => void;
}

const initialEmployeeFormState: Omit<Employee, 'id'> = {
  cedula: '',
  name: '',
  email: '',
  department: '',
  role: '',
  salary: 0,
  bankAccountNumber: '',
  bankName: '',
  hireDate: '',
};

export const EmployeesView: React.FC<EmployeesViewProps> = ({ employees, addEmployee, updateEmployee }) => {
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [employeeFormData, setEmployeeFormData] = useState<Omit<Employee, 'id'> | Employee>(initialEmployeeFormState);

  const openAddModal = () => {
    setIsEditing(false);
    setEmployeeFormData(initialEmployeeFormState);
    setIsModalOpen(true);
  };

  const openEditModal = (employee: Employee) => {
    setIsEditing(true);
    setSelectedEmployee(employee);
    setEmployeeFormData(employee);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedEmployee(null); // Deselect employee when closing modal
    setEmployeeFormData(initialEmployeeFormState);
  };
  
  const viewEmployeeDetails = (employee: Employee) => {
    setSelectedEmployee(employee);
  };


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEmployeeFormData(prev => ({ ...prev, [name]: name === 'salary' ? parseFloat(value) : value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing && 'id' in employeeFormData) {
      updateEmployee(employeeFormData as Employee);
    } else {
      addEmployee(employeeFormData as Omit<Employee, 'id'>);
    }
    closeModal();
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-4xl font-bold text-gray-800">Employees</h1>
        <button
          onClick={openAddModal}
          className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors shadow-md hover:shadow-lg flex items-center"
        >
          <IconUsers className="w-5 h-5 mr-2" /> Add Employee
        </button>
      </div>

      {/* Employee List Table */}
      <div className="bg-white shadow-xl rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Name', 'Cédula', 'Email', 'Department', 'Role', 'Salary (DOP)', 'Hire Date', 'Actions'].map(header => (
                  <th key={header} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {employees.map((employee) => (
                <tr key={employee.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button 
                      onClick={() => viewEmployeeDetails(employee)} 
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-900 hover:underline"
                      aria-label={`View details for ${employee.name}`}
                    >
                        {employee.name}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{employee.cedula}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{employee.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{employee.department}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{employee.role}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">DOP {employee.salary.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits:2})}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(employee.hireDate).toLocaleDateString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button onClick={() => openEditModal(employee)} className="text-indigo-600 hover:text-indigo-900 transition-colors">
                      Edit
                    </button>
                    {/* Add delete button functionality here if needed */}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
           {employees.length === 0 && <p className="p-4 text-center text-gray-500">No employees found. Click "Add Employee" to get started.</p>}
        </div>
      </div>
      
      {selectedEmployee && !isModalOpen && (
         <div className="bg-white p-6 rounded-lg shadow-lg mt-6  border border-gray-200">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-semibold text-gray-700">{selectedEmployee.name} - Details</h2>
                <button
                    onClick={() => setSelectedEmployee(null)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label="Close details view"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                <p><strong>Cédula:</strong> <span className="text-gray-600">{selectedEmployee.cedula}</span></p>
                <p><strong>Email:</strong> <span className="text-gray-600">{selectedEmployee.email}</span></p>
                <p><strong>Department:</strong> <span className="text-gray-600">{selectedEmployee.department}</span></p>
                <p><strong>Role:</strong> <span className="text-gray-600">{selectedEmployee.role}</span></p>
                <p><strong>Salary:</strong> <span className="text-gray-600 font-medium">DOP {selectedEmployee.salary.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits:2})}</span></p>
                <p><strong>Bank Name:</strong> <span className="text-gray-600">{selectedEmployee.bankName}</span></p>
                <p><strong>Bank Account:</strong> <span className="text-gray-600">{selectedEmployee.bankAccountNumber}</span></p>
                <p><strong>Hire Date:</strong> <span className="text-gray-600">{new Date(selectedEmployee.hireDate).toLocaleDateString()}</span></p>
            </div>
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={closeModal} title={isEditing ? 'Edit Employee' : 'Add New Employee'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Full Name</label>
            <input type="text" name="name" id="name" value={employeeFormData.name} onChange={handleInputChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
          </div>
           <div>
            <label htmlFor="cedula" className="block text-sm font-medium text-gray-700">Cédula</label>
            <input type="text" name="cedula" id="cedula" value={employeeFormData.cedula} onChange={handleInputChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
            <input type="email" name="email" id="email" value={employeeFormData.email} onChange={handleInputChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
          </div>
          <div>
            <label htmlFor="department" className="block text-sm font-medium text-gray-700">Department</label>
            <input type="text" name="department" id="department" value={employeeFormData.department} onChange={handleInputChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
          </div>
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700">Role</label>
            <input type="text" name="role" id="role" value={employeeFormData.role} onChange={handleInputChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
          </div>
          <div>
            <label htmlFor="salary" className="block text-sm font-medium text-gray-700">Monthly Salary (DOP)</label>
            <input type="number" name="salary" id="salary" value={employeeFormData.salary} onChange={handleInputChange} required min="0" step="100" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
          </div>
           <div>
            <label htmlFor="bankName" className="block text-sm font-medium text-gray-700">Bank Name</label>
            <input type="text" name="bankName" id="bankName" value={employeeFormData.bankName} onChange={handleInputChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
          </div>
          <div>
            <label htmlFor="bankAccountNumber" className="block text-sm font-medium text-gray-700">Bank Account Number</label>
            <input type="text" name="bankAccountNumber" id="bankAccountNumber" value={employeeFormData.bankAccountNumber} onChange={handleInputChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
          </div>
          <div>
            <label htmlFor="hireDate" className="block text-sm font-medium text-gray-700">Hire Date</label>
            <input type="date" name="hireDate" id="hireDate" value={employeeFormData.hireDate} onChange={handleInputChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
          </div>
          <div className="flex justify-end space-x-3 pt-2">
            <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">Cancel</button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors">
              {isEditing ? 'Save Changes' : 'Add Employee'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};