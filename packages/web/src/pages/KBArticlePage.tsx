import { useState } from 'react';
import { Link, useParams, useLocation } from 'react-router';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Spinner } from '../components/ui/Spinner.js';
import { useKBArticle, useKBArticleFeedback } from '../hooks/useKBArticles.js';

/**
 * Public KB article page.
 * Displays a single article with feedback buttons.
 */
export function KBArticlePage() {
  const { slug, category: categorySlug } = useParams<{ slug: string; category: string }>();
  const location = useLocation();
  const state = location.state as { categoryId?: string; categoryName?: string } | null;

  const categoryName = state?.categoryName || categorySlug?.replace(/-/g, ' ') || 'Category';

  const { data: article, isLoading, error } = useKBArticle(slug || '');
  const feedbackMutation = useKBArticleFeedback();
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const handleFeedback = (helpful: boolean) => {
    if (!article || feedbackSubmitted) return;
    feedbackMutation.mutate(
      { articleId: article.id, helpful },
      {
        onSuccess: () => setFeedbackSubmitted(true),
      },
    );
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex justify-center py-12">
          <Spinner size="lg" label="Loading article" />
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card padding="lg">
          <div className="text-center py-8">
            <h2 className="text-lg font-semibold text-text-primary mb-2">Article not found</h2>
            <p className="text-sm text-text-secondary mb-4">
              The article you are looking for does not exist or is no longer available.
            </p>
            <Link
              to="/kb"
              className="text-sm text-primary hover:text-primary-hover transition-colors"
            >
              Back to Knowledge Base
            </Link>
          </div>
        </Card>
      </div>
    );
  }

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
          <li>
            <Link
              to={`/kb/${categorySlug}`}
              className="hover:text-primary transition-colors capitalize"
              state={state}
            >
              {categoryName}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-text-primary font-medium truncate max-w-[200px]">
            {article.title}
          </li>
        </ol>
      </nav>

      {/* Article content */}
      <Card padding="lg">
        <article>
          <header className="mb-6 pb-4 border-b border-border">
            <h1 className="text-2xl font-bold text-text-primary mb-2">
              {article.title}
            </h1>
            <div className="flex items-center gap-4 text-xs text-text-secondary">
              <span>By {article.author.full_name}</span>
              <span>Updated {new Date(article.updated_at).toLocaleDateString()}</span>
              <span>{article.category.name}</span>
            </div>
          </header>

          <div
            className="prose prose-sm max-w-none text-text-primary"
            dangerouslySetInnerHTML={{ __html: article.body }}
          />
        </article>

        {/* Feedback section */}
        <div className="mt-8 pt-6 border-t border-border">
          {feedbackSubmitted ? (
            <p className="text-center text-sm text-success font-medium">
              Thank you for your feedback!
            </p>
          ) : (
            <div className="text-center">
              <p className="text-sm text-text-secondary mb-3">
                Was this article helpful?
              </p>
              <div className="flex justify-center gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleFeedback(true)}
                  isLoading={feedbackMutation.isPending}
                >
                  Yes
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleFeedback(false)}
                  isLoading={feedbackMutation.isPending}
                >
                  No
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
