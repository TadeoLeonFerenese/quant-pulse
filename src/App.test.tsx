import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';

describe('App root shell', () => {
  it('renders mobile-first shell without console errors or horizontal clipping classes', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { container } = render(<App />);

    expect(screen.getByRole('heading', { name: 'Quant-Pulse' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Sistema listo');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(container.innerHTML).not.toContain('w-screen');
    expect(errorSpy).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });
});
