import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Badge } from '../components/ui/Badge.js';
import { Input } from '../components/ui/Input.js';
import { Modal } from '../components/ui/Modal.js';
import { Select } from '../components/ui/Select.js';
import { Spinner } from '../components/ui/Spinner.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import {
  useKBCategories,
  useCreateKBCategory,
  useUpdateKBCategory,
  useDeleteKBCategory,
  useKBArticles,
  useDeleteKBArticle,
} from '../hooks/useKBArticles.js';
import type { KBCategory } from '@busybirdies/shared';

/**
 * Admin KB management page.
 * Shows article list with status, category management, and CRUD operations.
 */
export function KBManagePage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'articles' | 'categories'>('articles');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [page, setPage] = useState(1);

  // Data queries
  const { data: categoriesData, isLoading: catLoading } = useKBCategories();
  const { data: articlesData, isLoading: artLoading } = useKBArticles({
    status: statusFilter || undefined,
    category_id: categoryFilter || undefined,
    page,
    per_page: 20,
  });

  // Mutations
  const deleteArticle = useDeleteKBArticle();

  const handleDeleteArticle = (id: string, title: string) => {
    if (window.confirm(`Are you sure you want to delete "${title}"?`)) {
      deleteArticle.mutate(id);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Knowledge Base</h1>
        <Button onClick={() => navigate('/kb/manage/new')}>
          New Article
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border">
        <button
          onClick={() => setActiveTab('articles')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'articles'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          Articles
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'categories'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          Categories
        </button>
      </div>

      {activeTab === 'articles' && (
        <ArticlesTab
          articlesData={articlesData}
          categoriesData={categoriesData}
          isLoading={artLoading || catLoading}
          statusFilter={statusFilter}
          categoryFilter={categoryFilter}
          page={page}
          onStatusFilterChange={(v) => { setStatusFilter(v); setPage(1); }}
          onCategoryFilterChange={(v) => { setCategoryFilter(v); setPage(1); }}
          onPageChange={setPage}
          onDelete={handleDeleteArticle}
          onEdit={(id) => navigate(`/kb/manage/${id}/edit`)}
        />
      )}

      {activeTab === 'categories' && (
        <CategoriesTab
          categoriesData={categoriesData}
          isLoading={catLoading}
        />
      )}
    </div>
  );
}

// ---- Articles Tab ----

interface ArticlesTabProps {
  articlesData: ReturnType<typeof useKBArticles>['data'];
  categoriesData: ReturnType<typeof useKBCategories>['data'];
  isLoading: boolean;
  statusFilter: string;
  categoryFilter: string;
  page: number;
  onStatusFilterChange: (value: string) => void;
  onCategoryFilterChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onDelete: (id: string, title: string) => void;
  onEdit: (id: string) => void;
}

function ArticlesTab({
  articlesData,
  categoriesData,
  isLoading,
  statusFilter,
  categoryFilter,
  page,
  onStatusFilterChange,
  onCategoryFilterChange,
  onPageChange,
  onDelete,
  onEdit,
}: ArticlesTabProps) {
  const categoryOptions = [
    { value: '', label: 'All Categories' },
    ...(categoriesData?.data.map((c) => ({ value: c.id, label: c.name })) || []),
  ];

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'draft', label: 'Draft' },
    { value: 'published', label: 'Published' },
  ];

  return (
    <>
      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="w-48">
          <Select
            options={statusOptions}
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
          />
        </div>
        <div className="w-48">
          <Select
            options={categoryOptions}
            value={categoryFilter}
            onChange={(e) => onCategoryFilterChange(e.target.value)}
          />
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Spinner size="lg" label="Loading articles" />
        </div>
      )}

      {articlesData && articlesData.data.length === 0 && (
        <EmptyState
          title="No articles found"
          description="Create your first knowledge base article."
          action={{ label: 'New Article', onClick: () => onEdit('new') }}
        />
      )}

      {articlesData && articlesData.data.length > 0 && (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-alt">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Author
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Updated
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {articlesData.data.map((article) => (
                  <tr key={article.id} className="hover:bg-surface-alt transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        to={`/kb/manage/${article.id}/edit`}
                        className="text-text-primary font-medium hover:text-primary transition-colors"
                      >
                        {article.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {article.category_name}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={article.status === 'published' ? 'success' : 'warning'}
                        size="sm"
                        dot
                      >
                        {article.status === 'published' ? 'Published' : 'Draft'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {article.author_name}
                    </td>
                    <td className="px-4 py-3 text-text-secondary text-xs">
                      {new Date(article.updated_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(article.id)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(article.id, article.title)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {articlesData.pagination.total_pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-xs text-text-secondary">
                Showing {((page - 1) * 20) + 1}--{Math.min(page * 20, articlesData.pagination.total)} of {articlesData.pagination.total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => onPageChange(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= articlesData.pagination.total_pages}
                  onClick={() => onPageChange(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </>
  );
}

// ---- Categories Tab ----

interface CategoriesTabProps {
  categoriesData: ReturnType<typeof useKBCategories>['data'];
  isLoading: boolean;
}

function CategoriesTab({ categoriesData, isLoading }: CategoriesTabProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<KBCategory | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryDescription, setCategoryDescription] = useState('');
  const [categoryOrder, setCategoryOrder] = useState('0');

  const createCategory = useCreateKBCategory();
  const updateCategory = useUpdateKBCategory();
  const deleteCategory = useDeleteKBCategory();

  const openCreateModal = () => {
    setCategoryName('');
    setCategoryDescription('');
    setCategoryOrder('0');
    setEditingCategory(null);
    setShowCreateModal(true);
  };

  const openEditModal = (category: KBCategory) => {
    setCategoryName(category.name);
    setCategoryDescription(category.description || '');
    setCategoryOrder(String(category.display_order));
    setEditingCategory(category);
    setShowCreateModal(true);
  };

  const handleSave = () => {
    if (!categoryName.trim()) return;

    if (editingCategory) {
      updateCategory.mutate(
        {
          id: editingCategory.id,
          name: categoryName.trim(),
          description: categoryDescription.trim() || undefined,
          display_order: parseInt(categoryOrder, 10),
        },
        {
          onSuccess: () => setShowCreateModal(false),
        },
      );
    } else {
      createCategory.mutate(
        {
          name: categoryName.trim(),
          description: categoryDescription.trim() || undefined,
          display_order: parseInt(categoryOrder, 10),
        },
        {
          onSuccess: () => setShowCreateModal(false),
        },
      );
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete the category "${name}"?`)) {
      deleteCategory.mutate(id);
    }
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={openCreateModal}>
          New Category
        </Button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Spinner size="lg" label="Loading categories" />
        </div>
      )}

      {categoriesData && categoriesData.data.length === 0 && (
        <EmptyState
          title="No categories yet"
          description="Create categories to organize your knowledge base articles."
          action={{ label: 'New Category', onClick: openCreateModal }}
        />
      )}

      {categoriesData && categoriesData.data.length > 0 && (
        <Card padding="none">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-alt">
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  Order
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  Description
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  Articles
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {categoriesData.data.map((category) => (
                <tr key={category.id} className="hover:bg-surface-alt transition-colors">
                  <td className="px-4 py-3 text-text-secondary">
                    {category.display_order}
                  </td>
                  <td className="px-4 py-3 font-medium text-text-primary">
                    {category.name}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {category.description || '--'}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {category.article_count}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditModal(category)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(category.id, category.name)}
                        disabled={category.article_count > 0}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Create/Edit Category Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={editingCategory ? 'Edit Category' : 'New Category'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              isLoading={createCategory.isPending || updateCategory.isPending}
            >
              {editingCategory ? 'Save Changes' : 'Create Category'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Name"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            placeholder="e.g., Getting Started"
          />
          <Input
            label="Description"
            value={categoryDescription}
            onChange={(e) => setCategoryDescription(e.target.value)}
            placeholder="A brief description of this category"
          />
          <Input
            label="Display Order"
            type="number"
            value={categoryOrder}
            onChange={(e) => setCategoryOrder(e.target.value)}
            placeholder="0"
          />
        </div>
      </Modal>
    </>
  );
}
