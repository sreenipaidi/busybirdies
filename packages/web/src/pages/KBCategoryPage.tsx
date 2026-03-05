import { Link, useLocation, useParams } from 'react-router';
import { Card } from '../components/ui/Card.js';
import { Badge } from '../components/ui/Badge.js';
import { Spinner } from '../components/ui/Spinner.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { useKBArticles } from '../hooks/useKBArticles.js';

/**
 * Public KB category page.
 * Shows all published articles within a category.
 */
export function KBCategoryPage() {
  const { category: categorySlug } = useParams<{ category: string }>();
  const location = useLocation();
  const state = location.state as { categoryId?: string; categoryName?: string } | null;

  const categoryId = state?.categoryId;
  const categoryName = state?.categoryName || categorySlug?.replace(/-/g, ' ') || 'Category';

  const { data, isLoading, error } = useKBArticles({
    category_id: categoryId,
    page: 1,
    per_page: 50,
  });

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
          <li className="text-text-primary font-medium capitalize">{categoryName}</li>
        </ol>
      </nav>

      <h1 className="text-2xl font-bold text-text-primary mb-6 capitalize">{categoryName}</h1>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <Spinner size="lg" label="Loading articles" />
        </div>
      )}

      {/* Error */}
      {error && (
        <Card padding="lg">
          <p className="text-center text-danger text-sm">
            Failed to load articles. Please try again later.
          </p>
        </Card>
      )}

      {/* Empty state */}
      {data && data.data.length === 0 && (
        <EmptyState
          title="No articles in this category"
          description="There are no published articles in this category yet."
        />
      )}

      {/* Articles list */}
      {data && data.data.length > 0 && (
        <div className="space-y-3">
          {data.data.map((article) => (
            <Link
              key={article.id}
              to={`/kb/${categorySlug}/${article.slug}`}
              state={{ categoryId, categoryName }}
            >
              <Card padding="md" className="hover:shadow-md transition-shadow mb-3">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-semibold text-text-primary">
                      {article.title}
                    </h2>
                    <p className="text-xs text-text-secondary mt-1">
                      Updated {new Date(article.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="default" size="sm">
                    {article.category_name}
                  </Badge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
