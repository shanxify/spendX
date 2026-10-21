import React, { createContext, useContext, useState } from 'react';
import { SAMPLE_TRANSACTIONS, GUEST_CATEGORIES } from '../data/sampleData';

const DemoContext = createContext();

export const DEMO_CATEGORIES = GUEST_CATEGORIES;

export const DemoProvider = ({ children }) => {
  // Derive merchants from transactions list
  const deriveMerchants = (txList) => {
    const groups = {};
    txList.forEach(t => {
      const key = t.normalized;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(t);
    });

    return Object.keys(groups).map(normalized => {
      const group = groups[normalized];
      const display = group[0].merchant;
      
      const categorizedTx = group.find(t => t.category && t.category !== 'Uncategorized');
      const category = categorizedTx ? categorizedTx.category : (group[0].category || 'Uncategorized');

      const count = group.length;
      const totalSpend = group
        .filter(t => t.type === 'debit')
        .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

      const debitCount = group.filter(t => t.type === 'debit').length;
      const creditCount = group.filter(t => t.type === 'credit').length;
      const type = debitCount >= creditCount ? 'debit' : 'credit';

      return {
        normalized,
        display,
        category,
        count,
        totalSpend,
        type
      };
    });
  };

  const [transactions, setTransactions] = useState(SAMPLE_TRANSACTIONS);
  const [merchants, setMerchants] = useState(() => deriveMerchants(SAMPLE_TRANSACTIONS));
  const [categories, setCategories] = useState(GUEST_CATEGORIES);
  const [isLoginPromptOpen, setIsLoginPromptOpen] = useState(false);
  const [loginPromptFeature, setLoginPromptFeature] = useState('');

  const promptLogin = (featureName = '') => {
    setLoginPromptFeature(featureName);
    setIsLoginPromptOpen(true);
  };

  const closeLoginPrompt = () => {
    setIsLoginPromptOpen(false);
    setLoginPromptFeature('');
  };

  const setTransactionsFromParsed = (parsedArray) => {
    setTransactions(parsedArray);
    setMerchants(deriveMerchants(parsedArray));
  };

  const updateMerchantCategory = (normalizedName, categoryName) => {
    setTransactions(prev => {
      const updated = prev.map(t => {
        if (t.normalized === normalizedName) {
          return { ...t, category: categoryName };
        }
        return t;
      });
      setMerchants(deriveMerchants(updated));
      return updated;
    });
  };

  const bulkUpdateMerchants = (normalizedNamesArray, categoryName) => {
    const namesSet = new Set(normalizedNamesArray);
    setTransactions(prev => {
      const updated = prev.map(t => {
        if (namesSet.has(t.normalized)) {
          return { ...t, category: categoryName };
        }
        return t;
      });
      setMerchants(deriveMerchants(updated));
      return updated;
    });
  };

  const resetDemo = () => {
    setTransactions(SAMPLE_TRANSACTIONS);
    setMerchants(deriveMerchants(SAMPLE_TRANSACTIONS));
  };

  return (
    <DemoContext.Provider value={{
      transactions,
      merchants,
      categories,
      setCategories,
      isGuest: true,
      isLoginPromptOpen,
      loginPromptFeature,
      promptLogin,
      closeLoginPrompt,
      setTransactionsFromParsed,
      updateMerchantCategory,
      bulkUpdateMerchants,
      resetDemo
    }}>
      {children}
    </DemoContext.Provider>
  );
};

export const useDemo = () => {
  const context = useContext(DemoContext);
  if (!context) {
    throw new Error('useDemo must be used within a DemoProvider');
  }
  return context;
};
