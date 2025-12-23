import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        className={cn(
          'inline-flex items-center justify-center rounded-md font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
          'disabled:opacity-50 disabled:pointer-events-none',
          'dark:focus-visible:ring-primary-500',
          {
            'bg-primary-500 text-white hover:bg-primary-600': variant === 'default',
            'bg-coal-100 text-coal-800 hover:bg-coal-200': variant === 'secondary',
            'border border-coal-300 bg-transparent hover:bg-coal-50': variant === 'outline',
            'hover:bg-coal-100': variant === 'ghost',
            'bg-red-500 text-white hover:bg-red-600': variant === 'destructive',
          },
          {
            'h-10 py-2 px-4': size === 'default',
            'h-9 px-3 text-sm': size === 'sm',
            'h-11 px-8': size === 'lg',
            'h-10 w-10': size === 'icon',
          },
          'dark:bg-primary-600 dark:hover:bg-primary-700 dark:text-white',
          'dark:data-[variant=secondary]:bg-gray-700 dark:data-[variant=secondary]:text-gray-100 dark:data-[variant=secondary]:hover:bg-gray-600',
          'dark:data-[variant=outline]:border-gray-600 dark:data-[variant=outline]:text-gray-100 dark:data-[variant=outline]:hover:bg-gray-800',
          'dark:data-[variant=ghost]:hover:bg-gray-800',
          'dark:data-[variant=destructive]:bg-red-700 dark:data-[variant=destructive]:text-white dark:data-[variant=destructive]:hover:bg-red-800',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export { Button };
