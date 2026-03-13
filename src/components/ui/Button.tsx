import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'keep' | 'reject' | 'pass'
  size?: 'sm' | 'md' | 'lg'
}

export function Button({ variant = 'primary', size = 'md', className = '', children, ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]'

  const variants = {
    primary: 'bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold focus:ring-amber-400',
    secondary: 'bg-slate-700 hover:bg-slate-600 text-slate-100 focus:ring-slate-500',
    ghost: 'hover:bg-slate-700 text-slate-300 hover:text-white focus:ring-slate-500',
    danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
    keep: 'bg-teal-600 hover:bg-teal-700 text-white focus:ring-teal-500',
    reject: 'bg-orange-600 hover:bg-orange-700 text-white focus:ring-orange-500',
    pass: 'bg-rose-700 hover:bg-rose-800 text-white focus:ring-rose-500',
  }

  const sizes = {
    sm: 'h-8 px-3 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  }

  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  )
}
