import { render } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import Orb from './Orb.svelte';

describe('Orb', () => {
  it('renders without crash in idle state', () => {
    const { container } = render(Orb, { props: { state: 'idle' } });
    expect(container.querySelector('.orb')).not.toBeNull();
  });

  it('renders without crash in listening state', () => {
    const { container } = render(Orb, { props: { state: 'listening' } });
    expect(container.querySelector('.orb')).not.toBeNull();
  });

  it('renders without crash in thinking state', () => {
    const { container } = render(Orb, { props: { state: 'thinking' } });
    expect(container.querySelector('.orb')).not.toBeNull();
  });

  it('renders without crash in speaking state', () => {
    const { container } = render(Orb, { props: { state: 'speaking' } });
    expect(container.querySelector('.orb')).not.toBeNull();
  });

  it('renders without crash in error state', () => {
    const { container } = render(Orb, { props: { state: 'error' } });
    expect(container.querySelector('.orb')).not.toBeNull();
  });

  it('has role="img"', () => {
    const { container } = render(Orb, { props: { state: 'idle' } });
    const orb = container.querySelector('[role="img"]');
    expect(orb).not.toBeNull();
  });

  it('aria-label changes by state: idle', () => {
    const { container } = render(Orb, { props: { state: 'idle' } });
    const orb = container.querySelector('[role="img"]');
    expect(orb?.getAttribute('aria-label')).toBe('Genie — assistente financeiro');
  });

  it('aria-label changes by state: listening', () => {
    const { container } = render(Orb, { props: { state: 'listening' } });
    const orb = container.querySelector('[role="img"]');
    expect(orb?.getAttribute('aria-label')).toBe('Genie está ouvindo...');
  });

  it('aria-label changes by state: thinking', () => {
    const { container } = render(Orb, { props: { state: 'thinking' } });
    const orb = container.querySelector('[role="img"]');
    expect(orb?.getAttribute('aria-label')).toBe('Genie está pensando...');
  });

  it('aria-label changes by state: speaking', () => {
    const { container } = render(Orb, { props: { state: 'speaking' } });
    const orb = container.querySelector('[role="img"]');
    expect(orb?.getAttribute('aria-label')).toBe('Genie está falando...');
  });

  it('aria-label changes by state: error', () => {
    const { container } = render(Orb, { props: { state: 'error' } });
    const orb = container.querySelector('[role="img"]');
    expect(orb?.getAttribute('aria-label')).toBe('Genie encontrou um erro.');
  });

  it('applies data-state attribute from prop', () => {
    const { container } = render(Orb, { props: { state: 'thinking' } });
    const orb = container.querySelector('.orb');
    expect(orb?.getAttribute('data-state')).toBe('thinking');
  });

  it('applies data-state="error" when state is error', () => {
    const { container } = render(Orb, { props: { state: 'error' } });
    expect(container.querySelector('[data-state="error"]')).not.toBeNull();
  });

  it('size prop sets --size CSS var', () => {
    const { container } = render(Orb, { props: { state: 'idle', size: 360 } });
    const orb = container.querySelector('.orb') as HTMLElement | null;
    expect(orb?.style.getPropertyValue('--size') || orb?.getAttribute('style')).toContain('360px');
  });

  it('renders the SVG root', () => {
    const { container } = render(Orb, { props: { state: 'idle' } });
    expect(container.querySelector('.orb__svg')).not.toBeNull();
  });

  it('renders the halo layer', () => {
    const { container } = render(Orb, { props: { state: 'idle' } });
    expect(container.querySelector('.halo')).not.toBeNull();
  });

  it('renders orbit rings and particles', () => {
    const { container } = render(Orb, { props: { state: 'idle' } });
    expect(container.querySelector('.ring--h')).not.toBeNull();
    expect(container.querySelector('.particle--1')).not.toBeNull();
  });

  it('default size is 240', () => {
    const { container } = render(Orb);
    const orb = container.querySelector('.orb') as HTMLElement | null;
    expect(orb?.getAttribute('style')).toContain('240px');
  });
});
