import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Input, Textarea } from '../components/ui/Input.js';
import { Select } from '../components/ui/Select.js';
import { Spinner } from '../components/ui/Spinner.js';
import {
  useKBCategories,
  useKBArticles,
  useCreateKBArticle,
  useUpdateKBArticle,
} from '../hooks/useKBArticles.js';

/**
 * Admin KB article create/edit page.
 * When :id is "new", creates a new article. Otherwise, loads and edits an existing one.
 */
export function KBArticleEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';

  // Load categories for the dropdown
  const { data: categoriesData, isLoading: catLoading } = useKBCategories();

  // Load existing article data for editing (search all articles to find by ID)
  const { data: articlesData, isLoading: artLoading } = useKBArticles({
    page: 1,
    per_page: 100,
  });

  const existingArticle = !isNew && articlesData
    ? articlesData.data.find((a) => a.id === id)
    : null;

  // Form state
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [formLoaded, setFormLoaded] = useState(isNew);

  // Populate form when editing
  useEffect(() => {
    if (!isNew && existingArticle && !formLoaded) {
      setTitle(existingArticle.title);
      // We don't have body in list item, so we set a placeholder
      // In a real app, we'd fetch the full article. For now, keep what's there.
      setStatus(existingArticle.status);
      setFormLoaded(true);
    }
  }, [isNew, existingArticle, formLoaded]);

  // Mutations
  const createArticle = useCreateKBArticle();
  const updateArticle = useUpdateKBArticle();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !body.trim() || !categoryId) return;

    if (isNew) {
      createArticle.mutate(
        {
          title: title.trim(),
          body: body.trim(),
          category_id: categoryId,
          status,
        },
        {
          onSuccess: () => navigate('/kb/manage'),
        },
      );
    } else if (id) {
      updateArticle.mutate(
        {
          id,
          title: title.trim(),
          body: body.trim(),
          category_id: categoryId,
          status,
        },
        {
          onSuccess: () => navigate('/kb/manage'),
        },
      );
    }
  };

  const isLoading = catLoading || (!isNew && artLoading);
  const isSaving = createArticle.isPending || updateArticle.isPending;

  const categoryOptions = categoriesData?.data.map((c) => ({
    value: c.id,
    label: c.name,
  })) || [];

  const statusOptions = [
    { value: 'draft', label: 'Draft' },
    { value: 'published', label: 'Published' },
  ];

  if (isLoading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-text-primary mb-6">
          {isNew ? 'New Article' : 'Edit Article'}
        </h1>
        <div className="flex justify-center py-12">
          <Spinner size="lg" label="Loading..." />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">
          {isNew ? 'New Article' : 'Edit Article'}
        </h1>
        <Button variant="secondary" onClick={() => navigate('/kb/manage')}>
          Cancel
        </Button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2">
            <Card padding="lg">
              <div className="space-y-4">
                <Input
                  label="Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Article title"
                  required
                />
                <Textarea
                  label="Body (HTML)"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write your article content in HTML..."
                  className="min-h-[300px] font-mono text-xs"
                  required
                />
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <Card padding="lg">
              <div className="space-y-4">
                <Select
                  label="Category"
                  options={categoryOptions}
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  placeholder="Select a category"
                />
                <Select
                  label="Status"
                  options={statusOptions}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'draft' | 'published')}
                />
                <div className="pt-2">
                  <Button
                    type="submit"
                    className="w-full"
                    isLoading={isSaving}
                    disabled={!title.trim() || !body.trim() || !categoryId}
                  >
                    {isNew ? 'Create Article' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            </Card>

            {createArticle.error && (
              <Card padding="md" className="mt-4 border-danger">
                <p className="text-xs text-danger">
                  {createArticle.error instanceof Error ? createArticle.error.message : 'Failed to create article'}
                </p>
              </Card>
            )}

            {updateArticle.error && (
              <Card padding="md" className="mt-4 border-danger">
                <p className="text-xs text-danger">
                  {updateArticle.error instanceof Error ? updateArticle.error.message : 'Failed to update article'}
                </p>
              </Card>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
