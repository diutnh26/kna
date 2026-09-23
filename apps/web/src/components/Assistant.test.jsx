import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Assistant from './Assistant';
import { api, chatStream } from '../lib/api';
import { renderScreen } from '../test/helpers';

vi.mock('../lib/api', async (importOriginal) => {
  const original = await importOriginal();
  return { ...original, chatStream: vi.fn() };
});

/**
 * The assistant screen, and one contract above all: `done.answer` is
 * authoritative. A draft that fails the server's grounding check streams
 * its tokens first and is refused after — so whatever the visitor watched
 * being written must be replaced by what the server finally stands
 * behind. A client that kept its own accumulation would show exactly the
 * text the verifier threw out.
 */
describe('Assistant', () => {
  beforeEach(() => {
    vi.spyOn(api, 'chatHealth').mockResolvedValue({
      model: true,
      documents: { en: 27, vi: 27 },
    });
  });

  it('says what it can promise once the health check answers', async () => {
    renderScreen(<Assistant />);
    expect(await screen.findByText(/Committee-reviewed archive/)).toBeInTheDocument();
  });

  it('drops to the approved-answers notice when the model host is down', async () => {
    api.chatHealth.mockResolvedValue({ model: false, documents: { en: 27, vi: 27 } });
    renderScreen(<Assistant />);
    expect(await screen.findByText(/language model is offline/)).toBeInTheDocument();
  });

  it('streams an answer, then shows its tier, sources and report button', async () => {
    chatStream.mockImplementation(async ({ onToken, onDone }) => {
      onToken('Let the elder ');
      onToken('speak first. [#1]');
      onDone({
        tier: 'B',
        answer: 'Let the elder speak first. [#1]',
        sources: [
          { id: 'd1', sourceId: 'card1', sourceType: 'KnowledgeCard', title: 'How do I greet an elder?', href: '#explore' },
        ],
      });
    });

    renderScreen(<Assistant />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Ask the assistant/i), 'How should I greet?');
    await user.click(screen.getByRole('button', { name: /Send/i }));

    expect(await screen.findByText('Let the elder speak first. [#1]')).toBeInTheDocument();
    expect(screen.getByText(/Composed from cited sources/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'How do I greet an elder?' })).toHaveAttribute(
      'href',
      '#explore'
    );
    expect(screen.getByRole('button', { name: /Report to the Committee/i })).toBeInTheDocument();
  });

  it('replaces a streamed draft with the refusal the server settled on', async () => {
    chatStream.mockImplementation(async ({ onToken, onDone }) => {
      onToken('A confident draft the verifier is about to reject');
      onDone({ tier: 'C', answer: 'I don’t have that in the community archive.', sources: [] });
    });

    renderScreen(<Assistant />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Ask the assistant/i), 'Something uncovered');
    await user.click(screen.getByRole('button', { name: /Send/i }));

    expect(
      await screen.findByText('I don’t have that in the community archive.')
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/confident draft the verifier is about to reject/)
    ).not.toBeInTheDocument();
    // A refusal has no sources and nothing to report.
    expect(screen.queryByRole('button', { name: /Report to the Committee/i })).toBeNull();
  });

  it('sends a report to the Committee and says so', async () => {
    chatStream.mockImplementation(async ({ onDone }) => {
      onDone({
        tier: 'A',
        answer: 'An approved answer.',
        sources: [{ id: 'd1', sourceId: 'card1', sourceType: 'KnowledgeCard', title: 'A card', href: '#explore' }],
      });
    });
    const flagSpy = vi.spyOn(api, 'flagAnswer').mockResolvedValue({ id: 'flag1' });

    renderScreen(<Assistant />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Ask the assistant/i), 'A question');
    await user.click(screen.getByRole('button', { name: /Send/i }));
    await user.click(await screen.findByRole('button', { name: /Report to the Committee/i }));

    await waitFor(() => expect(screen.getByText(/Reported — thank you/i)).toBeInTheDocument());
    expect(flagSpy).toHaveBeenCalledWith(
      expect.objectContaining({ tier: 'A', question: 'A question', sourceIds: ['card1'] }),
      undefined
    );
  });
});
