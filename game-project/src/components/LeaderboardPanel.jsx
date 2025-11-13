const formatSeconds = (seconds) => {
  if (!Number.isFinite(seconds)) return '-'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins <= 0) return `${secs}s`
  return `${mins}m ${secs}s`
}

const LeaderboardPanel = ({ leaderboard, onRefresh, loading }) => {
  const list = Array.isArray(leaderboard) ? leaderboard : []
  return (
    <aside className="leaderboard-panel">
      <header>
        <strong>Leaderboard</strong>
        <button type="button" onClick={onRefresh} disabled={loading}>
          {loading ? '...' : '↻'}
        </button>
      </header>

      {list.length === 0 ? (
        <p className="leaderboard-empty">Aún no hay puntajes.</p>
      ) : (
        <ol>
          {list.map((entry, index) => (
            <li key={entry.id || `${entry.username}-${index}`}>
              <span className="rank">#{index + 1}</span>
              <div className="details">
                <span className="name">{entry.username}</span>
                <span className="meta">
                  {entry.points} pts · {formatSeconds(entry.durationSeconds)}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </aside>
  )
}

export default LeaderboardPanel
