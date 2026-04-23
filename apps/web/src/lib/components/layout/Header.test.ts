import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import Header from './Header.svelte';

describe('Header', () => {
  it('renders without crash', () => {
    const { container } = render(Header);
    expect(container.querySelector('.header')).not.toBeNull();
  });

  it('renders title prop', () => {
    render(Header, { props: { title: 'Dashboard' } });
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders no h1 when title is empty', () => {
    render(Header, { props: { title: '' } });
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('has banner role', () => {
    render(Header);
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('has actions slot area', () => {
    const { container } = render(Header);
    expect(container.querySelector('.header__actions')).not.toBeNull();
  });
});
