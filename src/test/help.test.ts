import { describe, it, expect } from 'vitest';
import { HELP_TOPICS, buildHelpManual, searchTopics, topicById, topicForRoute } from '@/lib/help';

describe('help content', () => {
  it('has a topic for every screen in the bottom navigation', () => {
    for (const route of ['/', '/ventas', '/productos', '/clientes', '/duenos', '/analisis']) {
      expect(topicForRoute(route), `falta la ayuda de ${route}`).toBeDefined();
    }
  });

  it('has the topics the inline "?" buttons point at', () => {
    // Wired from Productos (ajeno), Ventas (a plazos) and Dueños.
    for (const id of ['ajenos', 'plazos', 'duenos']) {
      expect(topicById(id), `falta el tema ${id}`).toBeDefined();
    }
  });

  it('uses unique ids', () => {
    const ids = HELP_TOPICS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('returns every topic for an empty search', () => {
    expect(searchTopics('  ')).toHaveLength(HELP_TOPICS.length);
  });

  it('finds topics ignoring accents and capitals', () => {
    const withAccent = searchTopics('liquidación').map((t) => t.id);
    const withoutAccent = searchTopics('LIQUIDACION').map((t) => t.id);
    expect(withAccent).toContain('duenos');
    expect(withoutAccent).toEqual(withAccent);
  });

  it('searches the body text, not just the title', () => {
    // "MLC" only appears inside the currency topic's text.
    expect(searchTopics('mlc').map((t) => t.id)).toContain('monedas');
  });

  it('returns nothing for a term that is not covered', () => {
    expect(searchTopics('zzzz')).toHaveLength(0);
  });

  it('builds a shareable manual with every topic', () => {
    const manual = buildHelpManual('NayadeStore');
    expect(manual).toContain('Manual de NayadeStore');
    for (const topic of HELP_TOPICS) {
      expect(manual).toContain(topic.title.toUpperCase());
    }
  });
});
