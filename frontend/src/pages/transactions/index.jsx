import { useState } from 'react'
import Layout from '../../components/Layout'
import PaymentsTab from './PaymentsTab'
import MaterialsTab from './MaterialsTab'
import ExpendituresTab from './ExpendituresTab'
import { Banknote, Package, Receipt } from 'lucide-react'

const TABS = [
  { key: 'payments', label: 'Payments', icon: Banknote, description: 'Customer payments received' },
  { key: 'materials', label: 'Materials', icon: Package, description: 'Stock in, out and procurement' },
  { key: 'expenditures', label: 'Expenditures', icon: Receipt, description: 'General expenses' },
]

export default function Transactions() {
  const [activeTab, setActiveTab] = useState('payments')

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
          <p className="text-sm text-gray-500 mt-1">Track all financial and material transactions</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          {TABS.map(tab => {
            const Icon = tab.icon
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
                <Icon size={16} />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Tab Content */}
        {activeTab === 'payments' && <PaymentsTab />}
        {activeTab === 'materials' && <MaterialsTab />}
        {activeTab === 'expenditures' && <ExpendituresTab />}
      </div>
    </Layout>
  )
}