import { Banknote, Receipt, ArrowDownCircle, ArrowUpCircle, ShoppingCart, SlidersHorizontal } from 'lucide-react'

export const TYPE_COLORS = {
  Payment: 'bg-green-100 text-green-700',
  'Outgoing Materials': 'bg-red-100 text-red-700',
  'Incoming Materials': 'bg-blue-100 text-blue-700',
  'General Expenditure': 'bg-amber-100 text-amber-700',
  'Materials Procurement': 'bg-purple-100 text-purple-700',
  'Adjustment': 'bg-gray-100 text-gray-700',
}

export const TYPE_ICONS = {
  Payment: Banknote,
  'Outgoing Materials': ArrowUpCircle,
  'Incoming Materials': ArrowDownCircle,
  'General Expenditure': Receipt,
  'Materials Procurement': ShoppingCart,
  'Adjustment': SlidersHorizontal,
}

export const MATERIAL_DIRECTIONS = [
  {
    value: 'Materials Procurement',
    label: 'Procurement',
    description: 'Buying stock from supplier',
    icon: ShoppingCart,
    color: 'border-purple-300 bg-purple-50 text-purple-700',
    activeColor: 'border-purple-500 bg-purple-100 text-purple-800 ring-2 ring-purple-300',
  },
  {
    value: 'Outgoing Materials',
    label: 'Outgoing',
    description: 'Stock going to a project',
    icon: ArrowUpCircle,
    color: 'border-red-300 bg-red-50 text-red-700',
    activeColor: 'border-red-500 bg-red-100 text-red-800 ring-2 ring-red-300',
  },
  {
    value: 'Incoming Materials',
    label: 'Incoming',
    description: 'Returned or unused from project',
    icon: ArrowDownCircle,
    color: 'border-blue-300 bg-blue-50 text-blue-700',
    activeColor: 'border-blue-500 bg-blue-100 text-blue-800 ring-2 ring-blue-300',
  },
  {
    value: 'Adjustment',
    label: 'Adjustment',
    description: 'Manual stock correction',
    icon: SlidersHorizontal,
    color: 'border-gray-300 bg-gray-50 text-gray-700',
    activeColor: 'border-gray-500 bg-gray-100 text-gray-800 ring-2 ring-gray-300',
  },
]

export const fmt = (n) => `₱${(parseFloat(n) || 0).toLocaleString()}`