import { Link } from 'react-router';
import { Card } from '../components/ui/Card.js';
import { Spinner } from '../components/ui/Spinner.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { Input } from '../components/ui/Input.js';
import { useKBCategories } from '../hooks/useKBArticles.js';
import { useState } from 'react';
import { useNavigate } from 'react-router';

/**
 * Public Knowledge Base browse page.
 * Shows all categories with article counts and a search bar.
 */
export function KBBrowsePage() {
  const { data, isLoading, error } = useKBCategories();
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim().length >= 3) {
      navigate(`/kb/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-text-primary mb-2">Knowledge Base</h1>
        <p className="text-text-secondary">
          Find answers to your questions
        </p>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="max-w-xl mx-auto mb-8">
        <div className="relative">
          <Input
            type="text"
            placeholder="Search articles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
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
          <Spinner size="lg" label="Loading categories" />
        </div>
      )}

      {/* Error */}
      {error && (
        <Card padding="lg">
          <p className="text-center text-danger text-sm">
            Failed to load categories. Please try again later.
          </p>
        </Card>
      )}

      {/* Categories grid */}
      {data && data.data.length === 0 && (
        <EmptyState
          title="No articles yet"
          description="There are no knowledge base articles available at this time."
        />
      )}

      {data && data.data.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.data.map((category) => (
            <Link
              key={category.id}
              to={`/kb/${encodeURIComponent(category.name.toLowerCase().replace(/\s+/g, '-'))}`}
              state={{ categoryId: category.id, categoryName: category.name }}
            >
              <Card padding="lg" className="hover:shadow-md transition-shadow h-full">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-text-primary">
                      {category.name}
                    </h2>
                    {category.description && (
                      <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                        {category.description}
                      </p>
                    )}
                    <p className="text-xs text-text-secondary mt-2">
                      {category.article_count} {category.article_count === 1 ? 'article' : 'articles'}
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
