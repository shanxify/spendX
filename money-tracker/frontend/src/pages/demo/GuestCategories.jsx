import React from 'react';
import TopNav from '../../components/Layout/TopNav';
import CategoryManager from '../../components/Categories/CategoryManager';
import { useDemo } from '../../context/DemoContext';
import { Plus } from 'lucide-react';

const GuestCategories = () => {
  const { categories, promptLogin } = useDemo();

  const handleCreate = () => {
    promptLogin('Create Category');
  };

  const handleUpdate = () => {
    promptLogin('Edit Category');
  };

  const handleDelete = () => {
    promptLogin('Delete Category');
  };

  return (
    <div className="min-h-full bg-primary-bg pb-12 flex flex-col">
      <TopNav
        title="Categories"
        meta="Manage and explore transaction categories in Guest Mode"
        actions={
          <button
            onClick={handleCreate}
            className="btn-primary bg-[#6c63ff] hover:bg-[#5b54e0] font-medium text-xs sm:text-sm flex items-center gap-2 py-2 px-3.5 sm:px-4 shadow-[0_0_15px_rgba(108,99,255,0.25)]"
          >
            <Plus className="w-4 h-4" />
            <span>Add Category</span>
          </button>
        }
      />

      <div className="px-4 sm:px-6 lg:px-10 py-6 max-w-7xl mx-auto w-full space-y-6 flex-1 flex flex-col animate-in fade-in duration-300">
        {/* Sample Data Callout Banner */}
        <div className="bg-[#12121c] border border-purple-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="text-xl">🏷️</span>
            <div>
              <h4 className="text-sm font-semibold text-white">Default Spending Categories</h4>
              <p className="text-xs text-gray-400">
                SpendX organizes your expenses into customizable categories with color coding and icons.
              </p>
            </div>
          </div>
          <button
            onClick={() => { window.location.href = '/'; }}
            className="shrink-0 px-3.5 py-1.5 text-xs font-semibold text-purple-300 hover:text-white bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/30 rounded-xl transition-all"
          >
            Log In to Customize →
          </button>
        </div>

        {/* Category Manager Grid */}
        <CategoryManager
          categories={categories}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      </div>
    </div>
  );
};

export default GuestCategories;
