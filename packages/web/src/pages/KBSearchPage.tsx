import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Card } from '../components/ui/Card.js';
import { Input } from '../components/ui/Input.js';
import { Spinner } from '../components/ui/Spinner.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { useKBSearch } from '../hooks/useKBArticles.js';

/**
 * Public KB search page.
 * Allows users to search articles using full-text search.
 */
export function KBSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryFromUrl = searchParams.get('q') || '';
  const pageFromUrl = Number(searchParams.get('page') || '1');

  const [inputValue, setInputValue] = useState(queryFromUrl);

  const { data, isLoading, error } = useKBSearch(queryFromUrl, pageFromUrl);

  useEffect(() => {
    setInputValue(queryFromUrl);
  }, [queryFromUrl]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim().length >= 3) {
      setSearchParams({ q: inputValue.trim(), page: '1' });
    }
  };

  const goToPage = (page: number) => {
    setSearchParams({ q: queryFromUrl, page: String(page) });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-text-secondary" aria-label="Breadcrumb">
        <ol className="flex items-center gap-1">
          <li>
            <Link to="/kb" className="hover:text-primary transition-colors">
              Knowledge Base
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-text-primary font-medium">Search</li>
        </ol>
      </nav>

      <h1 className="text-2xl font-bold text-text-primary mb-6">Search Knowledge Base</h1>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="relative max-w-xl">
          <Input
            type="text"
            placeholder="Search articles (min 3 characters)..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="pr-12"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-text-secondary hover:text-primary transition-colors"
            aria-label="Search"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </form>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <Spinner size="lg" label="Searching articles" />
        </div>
      )}

      {/* Error */}
      {error && (
        <Card padding="lg">
          <p className="text-center text-danger text-sm">
            Search failed. Please try again.
          </p>
        </Card>
      )}

      {/* No query entered */}
      {!queryFromUrl && !isLoading && (
        <EmptyState
          title="Enter a search query"
          description="Type at least 3 characters to search the knowledge base."
        />
      )}

      {/* No results */}
      {data && data.data.length === 0 && queryFromUrl && (
        <EmptyState
          title="No results found"
          description={`No articles matched "${queryFromUrl}". Try different keywords.`}
        />
      )}

      {/* Results */}
      {data && data.data.length > 0 && (
        <>
          <p className="text-sm text-text-secondary mb-4">
            {data.pagination.total} {data.pagination.total === 1 ? 'result' : 'results'} for &quot;{queryFromUrl}&quot;
          </p>

          <div className="space-y-3">
            {data.data.map((result) => (
              <Link key={result.id} to={`/kb/${result.category_name.toLowerCase().replace(/\s+/g, '-')}/${result.slug}`}>
                <Card padding="md" className="hover:shadow-md transition-shadow mb-3">
                  <h2 className="text-sm font-semibold text-text-primary mb-1">
                    {result.title}
                  </h2>
                  <p className="text-xs text-text-secondary mb-2">
                    {result.category_name}
                  </p>
                  <p
                    className="text-xs text-text-secondary line-clamp-2"
                    dangerouslySetInnerHTML={{ __html: result.snippet }}
                  />
                </Card>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {data.pagination.total_pages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <button
                onClick={() => goToPage(pageFromUrl - 1)}
                disabled={pageFromUrl <= 1}
                className="px-3 py-1.5 text-xs rounded-md border border-border text-text-secondary hover:bg-surface-alt disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="px-3 py-1.5 text-xs text-text-secondary">
                Page {pageFromUrl} of {data.pagination.total_pages}
              </span>
              <button
                onClick={() => goToPage(pageFromUrl + 1)}
                disabled={pageFromUrl >= data.pagination.total_pages}
                className="px-3 py-1.5 text-xs rounded-md border border-border text-text-secondary hover:bg-surface-alt disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
