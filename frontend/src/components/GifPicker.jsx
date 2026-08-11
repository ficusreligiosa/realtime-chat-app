import { useState, useEffect } from 'react';

const GIPHY_API_KEY = 'cw9s98BDRMuTOSaW6Y6WzA18iDBW3nD3';

const CURATED_GIFS = [
  { id: '1', title: 'Happy', url: 'https://media.giphy.com/media/l0AM4X1j8Snd0W4fS/giphy.gif' },
  { id: '2', title: 'LOL', url: 'https://media.giphy.com/media/10UeedrT5M6TX2/giphy.gif' },
  { id: '3', title: 'Thumbs Up', url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif' },
  { id: '4', title: 'Dance', url: 'https://media.giphy.com/media/blSTtZehjAZ8I/giphy.gif' },
  { id: '5', title: 'Love', url: 'https://media.giphy.com/media/26hpKMT7hPOHiOUp5/giphy.gif' },
  { id: '6', title: 'Mind Blown', url: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif' },
  { id: '7', title: 'Clap', url: 'https://media.giphy.com/media/d31w24psGYeekCXY/giphy.gif' },
  { id: '8', title: 'Bye', url: 'https://media.giphy.com/media/kaq6GnxDlJaBq/giphy.gif' },
];

export default function GifPicker({ onSelectGif, onClose }) {
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState(CURATED_GIFS);
  const [loading, setLoading] = useState(false);

  const fetchGifs = async (searchQuery) => {
    setLoading(true);
    try {
      const endpoint = searchQuery.trim()
        ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(searchQuery)}&limit=18&rating=g`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=18&rating=g`;

      const res = await fetch(endpoint);
      if (!res.ok) throw new Error('Failed to fetch GIFs');
      const data = await res.json();
      if (data?.data && Array.isArray(data.data) && data.data.length > 0) {
        const fetched = data.data.map((item) => ({
          id: item.id,
          title: item.title,
          url: item.images?.fixed_height?.url || item.images?.original?.url,
        }));
        setGifs(fetched);
      } else if (!searchQuery.trim()) {
        setGifs(CURATED_GIFS);
      }
    } catch (err) {
      console.error('GIF fetch error:', err);
      if (!searchQuery.trim()) setGifs(CURATED_GIFS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchGifs(query);
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="gif-picker-popover">
      <div className="gif-picker-header">
        <div className="input-group input-group-sm">
          <span className="input-group-text bg-dark border-secondary text-muted">
            <i className="bi bi-search" />
          </span>
          <input
            type="text"
            className="form-control form-control-sm custom-input"
            placeholder="Search GIFs on Giphy..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
        <button type="button" className="btn-close-gif" onClick={onClose}>
          <i className="bi bi-x-lg" />
        </button>
      </div>

      <div className="gif-grid">
        {loading ? (
          <div className="gif-loading text-center p-3">
            <div className="spinner-border spinner-border-sm text-primary me-2" />
            <span>Loading GIFs...</span>
          </div>
        ) : gifs.length === 0 ? (
          <div className="gif-empty text-center p-3 text-muted">No GIFs found</div>
        ) : (
          gifs.map((g) => (
            <div
              key={g.id}
              className="gif-item"
              onClick={() => {
                onSelectGif(g.url);
                onClose();
              }}
            >
              <img src={g.url} alt={g.title || 'GIF'} loading="lazy" />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
