import { ArrowLeft, Trophy } from 'lucide-react';
import type { MatchHistoryEntry, Statistics } from '@uno/shared';

interface StatsViewProps {
  statistics: Statistics;
  history: MatchHistoryEntry[];
  onBack: () => void;
}

export const StatsView = ({ statistics, history, onBack }: StatsViewProps) => (
  <main className="panel-screen">
    <button type="button" className="icon-button" onClick={onBack} aria-label="Back">
      <ArrowLeft size={20} />
    </button>
    <section className="stats-panel">
      <div className="panel-title">Statistics</div>
      <div className="stat-grid">
        <article>
          <strong>{statistics.wins}</strong>
          <span>Wins</span>
        </article>
        <article>
          <strong>{statistics.losses}</strong>
          <span>Losses</span>
        </article>
        <article>
          <strong>{statistics.gamesPlayed}</strong>
          <span>Games</span>
        </article>
        <article>
          <strong>{statistics.winRate}%</strong>
          <span>Win rate</span>
        </article>
        <article>
          <strong>{statistics.unoCalls}</strong>
          <span>UNO calls</span>
        </article>
        <article>
          <strong>{statistics.cardsPlayed}</strong>
          <span>Cards played</span>
        </article>
      </div>
      <div className={`favorite-color color-${statistics.favoriteColor}`}>Favorite color: {statistics.favoriteColor}</div>
      <div className="history-list">
        {history.length === 0 && <p>No matches yet.</p>}
        {history.map((entry) => (
          <article key={entry.id}>
            <Trophy size={18} />
            <div>
              <strong>{entry.didWin ? 'Win' : 'Loss'} against {entry.players.length - 1}</strong>
              <span>{entry.winnerName} won after {entry.turns} plays</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  </main>
);
