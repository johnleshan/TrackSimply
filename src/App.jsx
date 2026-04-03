import React, { useState } from 'react';
import Navbar from './components/Navbar';
import ProductCard from './components/ProductCard';
import ProductModal from './components/ProductModal';
import './App.css';

// Placeholder images for initial view
const debtTrackerImg = "https://images.unsplash.com/photo-1554224155-169641357599?auto=format&fit=crop&q=80&w=800";
const bookkeepingImg = "https://images.unsplash.com/photo-1454165833267-024848037b01?auto=format&fit=crop&q=80&w=800";
const budgetPlannerImg = "https://images.unsplash.com/photo-1543286386-2e659306cd6c?auto=format&fit=crop&q=80&w=800";
const inventoryTrackerImg = "https://images.unsplash.com/photo-1586769852044-692d6e3703a0?auto=format&fit=crop&q=80&w=800";

const products = [
  {
    id: 1,
    name: "Easy Debt Tracker Spreadsheet",
    price: 799,
    image: debtTrackerImg,
    description: "Effortlessly manage your finances with our digital budget planner in Excel! Stay organized, track expenses, and reach your financial goals with ease. Check your email for download link after purchase.",
    filesCount: 2
  },
  {
    id: 2,
    name: "Plan it Easy Budget Planner",
    price: 799,
    image: budgetPlannerImg,
    description: "Track income, expenses, and cash flow while planning for taxes and profits. Ideal for entrepreneurs, it simplifies tax planning, organizes business expenses, and helps you project future profits.",
    filesCount: 2
  },
  {
    id: 3,
    name: "Easy Business Bookkeeping Spreadsheet",
    price: 799,
    image: bookkeepingImg,
    description: "Keep your business finances in check with our comprehensive bookkeeping spreadsheet. Designed for ease of use and professional reporting. Perfect for small businesses and freelancers.",
    filesCount: 2
  },
  {
    id: 4,
    name: "Easy Inventory Tracker Spreadsheet",
    price: 799,
    image: inventoryTrackerImg,
    description: "Effortlessly manage your stock and materials with our digital Inventory Tracker! Track purchases, sales, and inventory levels in one simple, organized spreadsheet. Ideal for small businesses.",
    filesCount: 2
  }
];

function App() {
  const [cartCount, setCartCount] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenModal = (product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleAddToBag = (qty) => {
    setCartCount(prev => prev + qty);
    handleCloseModal();
  };

  return (
    <div className="app">
      <Navbar cartCount={cartCount} />
      
      <main className="main-content container">
        <header className="page-header animate-fade">
          <h2 className="section-title">All Products</h2>
        </header>

        <section className="product-grid">
          {products.map(product => (
            <ProductCard 
              key={product.id} 
              product={product} 
              onOpenModal={handleOpenModal} 
            />
          ))}
        </section>

        <footer className="footer container">
          <div className="footer-links">
            <a href="#about">About Us</a>
            <a href="#privacy">Privacy Policy</a>
          </div>
        </footer>
      </main>

      {selectedProduct && (
        <ProductModal 
          product={selectedProduct} 
          isOpen={isModalOpen} 
          onClose={handleCloseModal} 
          onAddToBag={handleAddToBag}
        />
      )}
    </div>
  );
}

export default App;
